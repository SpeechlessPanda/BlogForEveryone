const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const YAML = require('yaml');

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

function runShellCommand(projectDir, command, args) {
    const result = spawnSync(command, args, {
        cwd: projectDir,
        shell: true,
        encoding: 'utf-8'
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

    const deployResult = runShellCommand(projectDir, 'pnpm', ['exec', 'hexo', 'deploy']);
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
        ['git', ['remote', 'add', 'origin', repoUrl]],
        ['git', ['push', '-u', 'origin', 'main']]
    ];

    for (const [bin, args] of commands) {
        const result = spawnSync(bin, args, {
            cwd: projectDir,
            shell: false,
            encoding: 'utf-8'
        });
        outputs.push({ bin, args, code: result.status, stderr: result.stderr, stdout: result.stdout });
        if (result.status !== 0) {
            break;
        }
    }
    return outputs;
}

function publishToGitHub(payload) {
    const { projectDir, framework, repoUrl } = payload;
    const mode = payload.publishMode || 'actions';

    if (mode === 'hexo-deploy') {
        if (framework !== 'hexo') {
            throw new Error('Hexo 命令发布仅支持 Hexo 工程。');
        }
        return publishWithHexoDeploy(payload);
    }

    ensureWorkflow(projectDir, framework, repoUrl);
    const logs = runGitCommands(projectDir, repoUrl, payload);
    return {
        logs,
        pagesUrl: inferPagesUrl(repoUrl),
        mode: 'actions'
    };
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
