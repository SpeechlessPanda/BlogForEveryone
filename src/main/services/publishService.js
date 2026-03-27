const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const YAML = require('yaml');
const { normalizePublishResult } = require('../policies/publishResultPolicy');
const { runCommand } = require('./env/runCommand');
const { ensureRemoteRepositories } = require('./githubRepoService');
const { getAccessTokenForPrivilegedUse } = require('./githubAuthService');
const { backupWorkspace, pushBackupToRepoOutcome } = require('./backupService');
const {
    RESULT_CODES,
    RESULT_CATEGORIES,
    COMBINED_OPERATION_STATUS
} = require('../../shared/operationResultContract');
const { FIXED_BACKUP_REPO_NAME, REMOTE_SITE_TYPES } = require('../../shared/remoteWorkspaceContract');

function runGit(projectDir, args) {
    return spawnSync('git', args, {
        cwd: projectDir,
        shell: false,
        encoding: 'utf-8'
    });
}

function getGitConfigValue(projectDir, key, globalFallback = false) {
    const local = runGit(projectDir, ['config', '--get', key]);
    const localValue = String(local.stdout || '').trim();
    if (local.status === 0 && localValue) {
        return localValue;
    }

    if (!globalFallback) {
        return '';
    }

    const global = runGit(projectDir, ['config', '--global', '--get', key]);
    const globalValue = String(global.stdout || '').trim();
    if (global.status === 0 && globalValue) {
        return globalValue;
    }

    return '';
}

function ensureGitIdentity(projectDir, payload = {}) {
    const logs = [];

    const localName = getGitConfigValue(projectDir, 'user.name', false);
    const localEmail = getGitConfigValue(projectDir, 'user.email', false);

    if (localName && localEmail) {
        return {
            ok: true,
            logs,
            identity: { name: localName, email: localEmail, source: 'local' }
        };
    }

    const nextName = String(payload.gitUserName || '').trim() || getGitConfigValue(projectDir, 'user.name', true);
    const nextEmail = String(payload.gitUserEmail || '').trim() || getGitConfigValue(projectDir, 'user.email', true);

    if (!nextName || !nextEmail) {
        return {
            ok: false,
            reason: 'GIT_IDENTITY_MISSING',
            message:
                '发布前需要 Git 身份信息。请填写 Git 提交用户名和邮箱（例如用户名与 noreply 邮箱），软件会自动写入当前工程。',
            action:
                '在发布页填写“Git 提交用户名”“Git 提交邮箱”后重试；或先在终端执行 git config --global user.name 和 git config --global user.email。',
            tutorial: 'docs/guides/git-first-publish-identity.md',
            logs
        };
    }

    const setName = runGit(projectDir, ['config', 'user.name', nextName]);
    logs.push({ command: `git config user.name ${nextName}`, code: setName.status, stdout: setName.stdout, stderr: setName.stderr });
    if (setName.status !== 0) {
        return {
            ok: false,
            reason: 'GIT_IDENTITY_SET_FAILED',
            message: '设置 Git 提交用户名失败，请检查目录权限后重试。',
            tutorial: 'docs/guides/git-first-publish-identity.md',
            logs
        };
    }

    const setEmail = runGit(projectDir, ['config', 'user.email', nextEmail]);
    logs.push({ command: `git config user.email ${nextEmail}`, code: setEmail.status, stdout: setEmail.stdout, stderr: setEmail.stderr });
    if (setEmail.status !== 0) {
        return {
            ok: false,
            reason: 'GIT_IDENTITY_SET_FAILED',
            message: '设置 Git 提交邮箱失败，请检查邮箱格式后重试。',
            tutorial: 'docs/guides/git-first-publish-identity.md',
            logs
        };
    }

    return {
        ok: true,
        logs,
        identity: { name: nextName, email: nextEmail, source: 'payload-or-global' }
    };
}

function buildWorkflowContent({ framework, repoUrl }) {
    const inferredPagesUrl = inferPagesUrl(repoUrl);
    const cmd = framework === 'hexo'
        ? 'pnpm dlx hexo generate'
        : (inferredPagesUrl ? `hugo --baseURL ${inferredPagesUrl}` : 'hugo');
    const artifactDir = framework === 'hexo' ? 'public' : 'public';

    return [
        'name: Deploy Blog',
        '',
        'on:',
        '  push:',
        '    branches: ["main"]',
        '  workflow_dispatch:',
        '',
        'permissions:',
        '  contents: read',
        '  pages: write',
        '  id-token: write',
        '',
        'concurrency:',
        '  group: "pages"',
        '  cancel-in-progress: false',
        '',
        'jobs:',
        '  build:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: actions/setup-node@v4',
        '        with:',
        '          node-version: 20',
        '      - uses: pnpm/action-setup@v4',
        '        with:',
        '          version: 9',
        '      - name: Install dependencies',
        '        run: pnpm install',
        '      - name: Build site',
        `        run: ${cmd}`,
        '      - uses: actions/upload-pages-artifact@v3',
        '        with:',
        `          path: ${artifactDir}`,
        '',
        '  deploy:',
        '    environment:',
        '      name: github-pages',
        '      url: ${{ steps.deployment.outputs.page_url }}',
        '    runs-on: ubuntu-latest',
        '    needs: build',
        '    steps:',
        '      - id: deployment',
        '        uses: actions/deploy-pages@v4',
        ''
    ].join('\n');
}

function isNoopCommitResult(result) {
    if (!result || result.status === 0) {
        return false;
    }

    const output = `${String(result.stdout || '')}\n${String(result.stderr || '')}`.toLowerCase();
    return output.includes('nothing to commit') || output.includes('working tree clean');
}

function isMissingOriginRemoteResult(result) {
    if (!result || result.status === 0) {
        return false;
    }

    const output = `${String(result.stdout || '')}\n${String(result.stderr || '')}`.toLowerCase();
    return output.includes('no such remote') && output.includes('origin');
}

function markLastGitLogAsBenign(outputs, patch = {}) {
    const current = outputs[outputs.length - 1];
    if (!current) {
        return;
    }

    outputs[outputs.length - 1] = {
        ...current,
        code: 0,
        benign: true,
        originalCode: current.code,
        ...patch
    };
}

function isGithubHttpsUrl(repoUrl) {
    return /^https:\/\/github\.com\//i.test(String(repoUrl || '').trim());
}

function buildGithubGitAuthEnv(repoUrl) {
    if (!isGithubHttpsUrl(repoUrl)) {
        return null;
    }

    let token = null;
    try {
        token = getAccessTokenForPrivilegedUse();
    } catch {
        return null;
    }
    if (!token) {
        return null;
    }

    return {
        ...process.env,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
        GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`, 'utf-8').toString('base64')}`
    };
}

function resolveDefaultBackupDir(projectDir) {
    return path.join(path.dirname(projectDir), '.bfe-backup', path.basename(projectDir));
}

function parseGithubRepo(repoUrl) {
    const clean = String(repoUrl || '').trim().replace(/\.git$/i, '');
    const match = clean.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
    if (!match) {
        return null;
    }

    return {
        owner: match[1],
        repo: match[2]
    };
}

function toOutcome({ ok, code, category, userMessage, detail = '', retryable = false, logs = [] }) {
    return {
        ok: Boolean(ok),
        code,
        category,
        userMessage,
        detail,
        retryable,
        logs: Array.isArray(logs) ? logs : []
    };
}

function outcomeFromOperationError(error, fallbackMessage, fallbackKey) {
    const operationResult = error && error.operationResult && typeof error.operationResult === 'object'
        ? error.operationResult
        : null;
    if (operationResult) {
        const causeMessage = operationResult.causes?.[0]?.message || fallbackMessage;
        return {
            ...operationResult,
            ok: false,
            code: operationResult.code || RESULT_CODES.runtimeError,
            category: operationResult.category || RESULT_CATEGORIES.runtime,
            userMessage: operationResult.userMessage || causeMessage,
            detail: operationResult.detail || causeMessage,
            retryable: Boolean(operationResult.retryable),
            logs: Array.isArray(operationResult.logs) ? operationResult.logs : []
        };
    }

    const detail = String(error?.message || '').trim();
    return toOutcome({
        ok: false,
        code: RESULT_CODES.runtimeError,
        category: RESULT_CATEGORIES.runtime,
        userMessage: fallbackMessage,
        detail: detail || fallbackKey,
        retryable: true,
        logs: []
    });
}

function resolveDeployRepoName(payload = {}) {
    const explicitName = String(payload.deployRepoName || payload.deployRepo?.name || '').trim();
    if (explicitName) {
        return explicitName;
    }
    const parsedRepo = parseGithubRepo(payload.repoUrl);
    if (parsedRepo) {
        return parsedRepo.repo;
    }
    return '';
}

function resolveBackupRepoName(payload = {}) {
    const explicitName = String(payload.backupRepoName || payload.backupRepo?.name || '').trim();
    if (explicitName) {
        return explicitName;
    }
    const parsedRepo = parseGithubRepo(payload.backupRepoUrl);
    if (parsedRepo) {
        return parsedRepo.repo;
    }
    return '';
}

function shouldRunCoordinatedPublish(payload = {}) {
    return Boolean(
        payload.siteType
        || payload.backupRepo
        || payload.backupRepoUrl
        || payload.backupDir
        || payload.createBackupRepo
        || payload.createDeployRepo
    );
}

function finalizeCombinedResult(result) {
    const ensureOk = Boolean(result.deployRepoEnsure?.ok && result.backupRepoEnsure?.ok);
    const deployOk = Boolean(result.deployPublish?.ok);
    const backupOk = Boolean(result.backupPush?.ok);

    let status = COMBINED_OPERATION_STATUS.failed;
    if (ensureOk && deployOk && backupOk) {
        status = COMBINED_OPERATION_STATUS.success;
    } else if (ensureOk && ((deployOk && !backupOk) || (!deployOk && backupOk))) {
        status = COMBINED_OPERATION_STATUS.partialSuccess;
    }

    return {
        ...result,
        status,
        ok: status === COMBINED_OPERATION_STATUS.success
    };
}

function inferDeployPublishOk(deployResult) {
    if (typeof deployResult?.ok === 'boolean') {
        return deployResult.ok;
    }

    const logs = Array.isArray(deployResult?.logs) ? deployResult.logs : [];
    const failedGitStep = logs.find((entry) => {
        if (!entry || entry.bin !== 'git') {
            return false;
        }
        if (entry.error) {
            return true;
        }
        if (entry.code === null) {
            return true;
        }
        return typeof entry.code === 'number' && entry.code !== 0;
    });

    return !failedGitStep;
}

function ensureWorkflow(projectDir, framework, repoUrl) {
    const workflowDir = path.join(projectDir, '.github', 'workflows');
    fs.mkdirSync(workflowDir, { recursive: true });
    const workflow = buildWorkflowContent({ framework, repoUrl });

    fs.writeFileSync(path.join(workflowDir, 'deploy.yml'), workflow, 'utf-8');
}

function ensureHexoDeployConfig(projectDir, repoUrl) {
    const configPath = path.join(projectDir, '_config.yml');
    const raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';
    const config = raw ? (YAML.parse(raw) || {}) : {};

    config.deploy = {
        type: 'git',
        repo: repoUrl,
        branch: 'gh-pages'
    };

    fs.writeFileSync(configPath, YAML.stringify(config), 'utf-8');
}

function runShellCommand(projectDir, command, args, commandOptions = {}) {
    const result = runCommand(command, args, {
        cwd: projectDir,
        ...commandOptions
    });
    return {
        command: `${command} ${args.join(' ')}`,
        code: result.status,
        stdout: result.stdout,
        stderr: result.stderr
    };
}

function publishWithHexoDeploy(payload) {
    const { projectDir, repoUrl } = payload;
    const logs = [];
    const authEnv = buildGithubGitAuthEnv(repoUrl);

    ensureHexoDeployConfig(projectDir, repoUrl);
    logs.push({ stage: 'hexo-deploy-config', message: '已写入 _config.yml deploy 配置（type: git / branch: gh-pages）' });

    const installDeployer = runShellCommand(projectDir, 'pnpm', ['add', 'hexo-deployer-git']);
    logs.push(installDeployer);
    if (installDeployer.code !== 0) {
        const error = new Error('安装 hexo-deployer-git 失败。请检查网络后重试。');
        error.logs = logs;
        throw error;
    }

    const cleanResult = runShellCommand(projectDir, 'pnpm', ['exec', 'hexo', 'clean']);
    logs.push(cleanResult);
    if (cleanResult.code !== 0) {
        const error = new Error('Hexo clean 失败。');
        error.logs = logs;
        throw error;
    }

    const generateResult = runShellCommand(projectDir, 'pnpm', ['exec', 'hexo', 'generate']);
    logs.push(generateResult);
    if (generateResult.code !== 0) {
        const error = new Error('Hexo generate 失败。');
        error.logs = logs;
        throw error;
    }

    const deployResult = runShellCommand(projectDir, 'pnpm', ['exec', 'hexo', 'deploy'], authEnv ? { env: authEnv } : {});
    logs.push(deployResult);
    if (deployResult.code !== 0) {
        const error = new Error('Hexo deploy 失败。请检查仓库权限、SSH/PAT 凭据后重试。');
        error.logs = logs;
        throw error;
    }

    return {
        logs,
        pagesUrl: inferPagesUrl(repoUrl),
        mode: 'hexo-deploy'
    };
}

function runGitCommands(projectDir, repoUrl, payload) {
    const outputs = [];

    const initResult = spawnSync('git', ['init'], {
        cwd: projectDir,
        shell: false,
        encoding: 'utf-8'
    });
    outputs.push({ bin: 'git', args: ['init'], code: initResult.status, stderr: initResult.stderr, stdout: initResult.stdout });
    if (initResult.status !== 0) {
        return outputs;
    }

    const identityResult = ensureGitIdentity(projectDir, payload);
    if (!identityResult.ok) {
        const error = new Error(identityResult.message);
        error.code = identityResult.reason;
        error.hint = identityResult.action;
        error.tutorial = identityResult.tutorial;
        error.logs = identityResult.logs;
        throw error;
    }

    outputs.push({
        stage: 'git-identity',
        message: `Git 身份已就绪：${identityResult.identity.name} <${identityResult.identity.email}>`,
        source: identityResult.identity.source
    });
    outputs.push(...(identityResult.logs || []));

    const commands = [
        ['git', ['add', '.']],
        ['git', ['commit', '-m', 'chore: initialize blog project']],
        ['git', ['branch', '-M', 'main']],
        ['git', ['remote', 'set-url', 'origin', repoUrl]],
        ['git', ['push', '-u', 'origin', 'main']]
    ];

    for (const [bin, args] of commands) {
        const authEnv = (bin === 'git' && args[0] === 'push') ? buildGithubGitAuthEnv(repoUrl) : null;
        const result = spawnSync(bin, args, {
            cwd: projectDir,
            shell: false,
            encoding: 'utf-8',
            ...(authEnv ? { env: authEnv } : {})
        });
        outputs.push({ bin, args, code: result.status, stderr: result.stderr, stdout: result.stdout });
        if (result.status !== 0) {
            if (args[0] === 'commit' && isNoopCommitResult(result)) {
                markLastGitLogAsBenign(outputs, {
                    reason: 'noop_commit',
                    message: '当前工作区无新增改动，沿用已有提交继续发布。'
                });
                continue;
            }

            if (args[0] === 'remote' && args[1] === 'set-url' && isMissingOriginRemoteResult(result)) {
                markLastGitLogAsBenign(outputs, {
                    reason: 'missing_origin_remote',
                    message: 'origin 不存在，已改为补建 origin 后继续发布。'
                });
                const addResult = runGit(projectDir, ['remote', 'add', 'origin', repoUrl]);
                outputs.push({ bin: 'git', args: ['remote', 'add', 'origin', repoUrl], code: addResult.status, stderr: addResult.stderr, stdout: addResult.stdout });
                if (addResult.status === 0) {
                    continue;
                }
            }

            break;
        }
    }
    return outputs;
}

function publishDeployOnly(payload) {
    const { projectDir, framework, repoUrl } = payload;
    const mode = payload.publishMode || 'actions';

    if (mode === 'hexo-deploy') {
        if (framework !== 'hexo') {
            throw new Error('Hexo 命令发布仅支持 Hexo 工程。');
        }
        return normalizePublishResult(publishWithHexoDeploy(payload));
    }

    ensureWorkflow(projectDir, framework, repoUrl);
    const logs = runGitCommands(projectDir, repoUrl, payload);
    return normalizePublishResult({
        logs,
        pagesUrl: inferPagesUrl(repoUrl),
        mode: 'actions'
    });
}

function publishToGitHub(payload) {
    if (!shouldRunCoordinatedPublish(payload)) {
        return publishDeployOnly(payload);
    }

    return (async () => {
        const siteType = payload.siteType || REMOTE_SITE_TYPES.projectPages;
        const login = String(payload.login || '').trim();
        const deployRepoName = resolveDeployRepoName(payload);
        const backupRepoName = resolveBackupRepoName(payload);

        const result = {
            mode: payload.publishMode || 'actions',
            pagesUrl: '',
            deployRepoEnsure: toOutcome({
                ok: false,
                code: RESULT_CODES.runtimeError,
                category: RESULT_CATEGORIES.runtime,
                userMessage: '发布仓库检查未执行。'
            }),
            backupRepoEnsure: toOutcome({
                ok: false,
                code: RESULT_CODES.runtimeError,
                category: RESULT_CATEGORIES.runtime,
                userMessage: '备份仓库检查未执行。'
            }),
            deployPublish: toOutcome({
                ok: false,
                code: RESULT_CODES.runtimeError,
                category: RESULT_CATEGORIES.runtime,
                userMessage: '发布执行未完成。'
            }),
            backupPush: toOutcome({
                ok: false,
                code: RESULT_CODES.runtimeError,
                category: RESULT_CATEGORIES.runtime,
                userMessage: '备份推送未完成。'
            })
        };

        if (siteType === REMOTE_SITE_TYPES.userPages) {
            const expected = `${login}.github.io`;
            if (!login || deployRepoName.toLowerCase() !== expected.toLowerCase()) {
                result.deployRepoEnsure = toOutcome({
                    ok: false,
                    code: RESULT_CODES.validationFailed,
                    category: RESULT_CATEGORIES.validation,
                    userMessage: `用户主页仓库名必须为 ${expected}。`
                });
                return normalizePublishResult(finalizeCombinedResult(result));
            }
        }

        if (backupRepoName.toLowerCase() !== FIXED_BACKUP_REPO_NAME.toLowerCase()) {
            result.backupRepoEnsure = toOutcome({
                ok: false,
                code: RESULT_CODES.validationFailed,
                category: RESULT_CATEGORIES.validation,
                userMessage: `备份仓库名称必须为 ${FIXED_BACKUP_REPO_NAME}。`
            });
            return normalizePublishResult(finalizeCombinedResult(result));
        }

        const parsedDeployRepo = parseGithubRepo(payload.repoUrl);
        const parsedBackupRepo = parseGithubRepo(payload.backupRepoUrl);

        let deployRepo = payload.deployRepo || (parsedDeployRepo
            ? {
                owner: parsedDeployRepo.owner,
                name: deployRepoName || parsedDeployRepo.repo,
                url: String(payload.repoUrl || '').trim()
            }
            : null);
        let backupRepo = payload.backupRepo || (parsedBackupRepo
            ? {
                owner: parsedBackupRepo.owner,
                name: FIXED_BACKUP_REPO_NAME,
                url: String(payload.backupRepoUrl || '').trim()
            }
            : null);

        try {
            const ensuredDeploy = await ensureRemoteRepositories({
                login,
                siteType,
                deployRepoName,
                deployRepo,
                backupRepo,
                createDeployRepo: Boolean(payload.createDeployRepo),
                createBackupRepo: false,
                deployRepoVisibility: payload.deployRepoVisibility,
                backupRepoVisibility: payload.backupRepoVisibility
            });
            deployRepo = ensuredDeploy.deployRepo || deployRepo;
            result.deployRepoEnsure = toOutcome({
                ok: Boolean(deployRepo && deployRepo.url),
                code: RESULT_CODES.ok,
                category: RESULT_CATEGORIES.runtime,
                userMessage: '发布仓库已就绪。'
            });
        } catch (error) {
            result.deployRepoEnsure = outcomeFromOperationError(error, '发布仓库准备失败。', 'deploy_repo_ensure_failed');
            return normalizePublishResult(finalizeCombinedResult(result));
        }

        try {
            const ensuredBackup = await ensureRemoteRepositories({
                login,
                siteType,
                deployRepoName,
                deployRepo,
                backupRepo,
                createDeployRepo: false,
                createBackupRepo: Boolean(payload.createBackupRepo),
                deployRepoVisibility: payload.deployRepoVisibility,
                backupRepoVisibility: payload.backupRepoVisibility
            });
            backupRepo = ensuredBackup.backupRepo || backupRepo;
            result.backupRepoEnsure = toOutcome({
                ok: Boolean(backupRepo && backupRepo.url),
                code: RESULT_CODES.ok,
                category: RESULT_CATEGORIES.runtime,
                userMessage: '备份仓库已就绪。'
            });
        } catch (error) {
            result.backupRepoEnsure = outcomeFromOperationError(error, '备份仓库准备失败。', 'backup_repo_ensure_failed');
            return normalizePublishResult(finalizeCombinedResult(result));
        }

        const deployRepoUrl = String(deployRepo?.url || payload.repoUrl || '').trim();
        const backupRepoUrl = String(backupRepo?.url || payload.backupRepoUrl || '').trim();

        try {
            const deployResult = await Promise.resolve(publishDeployOnly({
                ...payload,
                repoUrl: deployRepoUrl
            }));
            const deployOk = inferDeployPublishOk(deployResult);
            result.deployPublish = toOutcome({
                ok: deployOk,
                code: deployOk ? RESULT_CODES.ok : RESULT_CODES.runtimeError,
                category: RESULT_CATEGORIES.runtime,
                userMessage: deployOk ? '公开发布完成。' : (deployResult.message || '公开发布失败。'),
                detail: deployOk ? '' : String(deployResult.message || '').trim(),
                retryable: !deployOk,
                logs: deployResult.logs || []
            });
            if (deployOk) {
                result.pagesUrl = String(deployResult.pagesUrl || '');
            }
        } catch (error) {
            result.deployPublish = outcomeFromOperationError(error, '公开发布失败。', 'deploy_publish_failed');
        }

        try {
            const snapshotDir = backupWorkspace({
                projectDir: payload.projectDir,
                backupDir: payload.backupDir || resolveDefaultBackupDir(payload.projectDir),
                metadata: {
                    deployRepo,
                    backupRepo,
                    siteType,
                    createdAt: new Date().toISOString()
                }
            });
            const backupPushResult = pushBackupToRepoOutcome(snapshotDir, backupRepoUrl);
            result.backupPush = {
                ...backupPushResult,
                ok: Boolean(backupPushResult.ok),
                code: backupPushResult.code || (backupPushResult.ok ? RESULT_CODES.ok : RESULT_CODES.runtimeError),
                category: backupPushResult.category || RESULT_CATEGORIES.runtime,
                userMessage: backupPushResult.userMessage || (backupPushResult.ok ? '备份推送完成。' : '备份推送失败。'),
                detail: backupPushResult.detail || '',
                retryable: Boolean(backupPushResult.retryable),
                logs: Array.isArray(backupPushResult.logs) ? backupPushResult.logs : []
            };
        } catch (error) {
            result.backupPush = outcomeFromOperationError(error, '备份推送失败。', 'backup_push_failed');
        }

        const finalizedResult = finalizeCombinedResult(result);
        const normalized = normalizePublishResult(finalizedResult);
        if (!normalized.status) {
            normalized.status = finalizedResult.status;
        }
        if (typeof normalized.ok !== 'boolean') {
            normalized.ok = finalizedResult.ok;
        }
        return normalized;
    })();
}

function inferPagesUrl(repoUrl) {
    if (!repoUrl) {
        return '';
    }

    const clean = repoUrl.replace(/\.git$/, '');
    const match = clean.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
    if (!match) {
        return '';
    }

    const owner = match[1];
    const repo = match[2];
    if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
        return `https://${owner}.github.io/`;
    }
    return `https://${owner}.github.io/${repo}/`;
}

module.exports = {
    publishToGitHub,
    __test__: {
        buildWorkflowContent
    }
};
