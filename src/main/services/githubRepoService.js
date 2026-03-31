const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getAccessTokenForPrivilegedUse } = require('./githubAuthService');
const {
    REMOTE_REPO_VISIBILITY,
    REMOTE_SITE_TYPES,
    REMOTE_REPO_SOURCE_TYPES
} = require('../../shared/remoteWorkspaceContract');
const { RESULT_CODES, RESULT_CATEGORIES } = require('../../shared/operationResultContract');

function getGithubToken() {
    const token = getAccessTokenForPrivilegedUse();
    if (!token) {
        throw new Error('请先完成 GitHub 登录。');
    }
    return token;
}

async function requestGithub(url, options = {}) {
    const token = getGithubToken();
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'User-Agent': 'BlogForEveryone',
            ...(options.headers || {})
        }
    });

    if (response.status === 404) {
        return { notFound: true, status: 404, data: null };
    }

    const text = await response.text();
    let data = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
        }
    }

    if (!response.ok) {
        const error = new Error(data.message || 'GitHub API request failed');
        error.status = response.status;
        error.responseBody = data;
        throw error;
    }

    return { notFound: false, status: response.status, data };
}

function isGithubHttpsUrl(repoUrl) {
    return /^https:\/\/github\.com\//i.test(String(repoUrl || '').trim());
}

function buildGithubGitAuthEnv(repoUrl) {
    if (!isGithubHttpsUrl(repoUrl)) {
        return null;
    }

    const token = getAccessTokenForPrivilegedUse();
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

function createOperationError({ code, category, key, message }) {
    const error = new Error(message);
    error.operationResult = {
        ok: false,
        code,
        category,
        causes: [{ key, message }]
    };
    return error;
}

function mapGithubErrorToOperationError(error, fallback) {
    const status = Number(error?.status || 0);

    if (status === 401) {
        return createOperationError({
            code: RESULT_CODES.unauthorized,
            category: RESULT_CATEGORIES.auth,
            key: fallback.key,
            message: 'GitHub 登录已失效，请重新登录后重试。'
        });
    }

    if (status === 403) {
        return createOperationError({
            code: RESULT_CODES.permissionDenied,
            category: RESULT_CATEGORIES.permission,
            key: fallback.key,
            message: '当前 GitHub 账号无权限执行该仓库操作。'
        });
    }

    if (status === 404) {
        return createOperationError({
            code: RESULT_CODES.notFound,
            category: RESULT_CATEGORIES.notFound,
            key: fallback.key,
            message: fallback.notFoundMessage || '目标 GitHub 仓库不存在。'
        });
    }

    if (status === 409 || status === 422) {
        return createOperationError({
            code: RESULT_CODES.conflict,
            category: RESULT_CATEGORIES.conflict,
            key: fallback.key,
            message: fallback.conflictMessage || 'GitHub 仓库状态冲突。'
        });
    }

    return createOperationError({
        code: RESULT_CODES.runtimeError,
        category: RESULT_CATEGORIES.runtime,
        key: fallback.key,
        message: fallback.runtimeMessage || String(error?.message || 'GitHub 仓库操作失败。')
    });
}

function normalizeRepoEntry(repo) {
    const isPrivate = Boolean(repo?.private);
    return {
        owner: String(repo?.owner?.login || ''),
        name: String(repo?.name || ''),
        url: String(repo?.clone_url || ''),
        visibility: isPrivate ? REMOTE_REPO_VISIBILITY.private : REMOTE_REPO_VISIBILITY.public
    };
}

async function listUserRepositories() {
    const response = await requestGithub('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner');
    const repos = Array.isArray(response.data) ? response.data : [];
    return repos
        .map(normalizeRepoEntry)
        .filter((repo) => repo.owner && repo.name && repo.url);
}

function resolveDeployRepoName({ login, siteType, deployRepoName }) {
    if (siteType === REMOTE_SITE_TYPES.userPages) {
        return `${String(login || '').trim()}.github.io`;
    }

    return String(deployRepoName || '').trim();
}

async function createRepository({ name, visibility }) {
    const response = await requestGithub('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name,
            private: visibility === REMOTE_REPO_VISIBILITY.private,
            auto_init: false
        })
    });
    return normalizeRepoEntry(response.data);
}

async function ensureRemoteRepositories(payload = {}) {
    const login = String(payload.login || '').trim();
    const siteType = payload.siteType || REMOTE_SITE_TYPES.projectPages;
    const deployRepoName = resolveDeployRepoName({
        login,
        siteType,
        deployRepoName: payload.deployRepoName
    });
    const backupRepoName = String(payload.backupRepoName || payload.backupRepo?.name || '').trim();

    let deployRepo = payload.deployRepo || null;
    let backupRepo = payload.backupRepo || null;
    let failedCreateTarget = null;

    try {
        if (payload.createDeployRepo) {
            failedCreateTarget = 'deploy';
            deployRepo = {
                ...(await createRepository({
                    name: deployRepoName,
                    visibility: payload.deployRepoVisibility || REMOTE_REPO_VISIBILITY.public
                })),
                sourceType: REMOTE_REPO_SOURCE_TYPES.autoCreated
            };
        }

        if (payload.createBackupRepo) {
            failedCreateTarget = 'backup';
            backupRepo = {
                ...(await createRepository({
                    name: backupRepoName,
                    visibility: payload.backupRepoVisibility || REMOTE_REPO_VISIBILITY.private
                })),
                name: backupRepoName,
                sourceType: REMOTE_REPO_SOURCE_TYPES.autoCreated
            };
        }

        failedCreateTarget = null;
    } catch (error) {
        const isBackupFailure = failedCreateTarget === 'backup';
        const mapped = mapGithubErrorToOperationError(error, {
            key: isBackupFailure ? 'backup_repo_create_failed' : 'deploy_repo_create_failed',
            conflictMessage: isBackupFailure
                ? '创建备份仓库失败，可能仓库已存在。'
                : '创建发布仓库失败，可能仓库已存在。'
        });
        throw mapped;
    }

    return {
        deployRepo,
        backupRepo
    };
}

function cloneRepositoryToDestination({ repoUrl, destinationPath }) {
    const authEnv = buildGithubGitAuthEnv(repoUrl);
    const result = spawnSync('git', ['clone', repoUrl, destinationPath], {
        shell: false,
        encoding: 'utf-8',
        ...(authEnv ? { env: authEnv } : {})
    });

    if (result.status !== 0) {
        throw createOperationError({
            code: RESULT_CODES.runtimeError,
            category: RESULT_CATEGORIES.runtime,
            key: 'github_clone_failed',
            message: String(result.stderr || result.stdout || '克隆备份仓库失败。').trim()
        });
    }

    return {
        ok: true,
        logs: [{
            command: `git clone ${repoUrl} ${destinationPath}`,
            code: result.status,
            stdout: result.stdout,
            stderr: result.stderr
        }]
    };
}

function normalizePath(inputPath) {
    return inputPath.replace(/\\/g, '/').replace(/^\/+/, '');
}

async function uploadImageToRepo(payload) {
    const {
        owner,
        repo,
        branch = 'main',
        targetDir = 'assets/images',
        localFilePath,
        commitMessage
    } = payload;

    if (!owner || !repo || !localFilePath) {
        throw new Error('缺少 owner/repo/localFilePath 参数');
    }

    if (!fs.existsSync(localFilePath)) {
        throw new Error('图片文件不存在');
    }

    const fileName = path.basename(localFilePath);
    const targetPath = normalizePath(path.posix.join(targetDir, fileName));
    const contentBase64 = fs.readFileSync(localFilePath).toString('base64');

    const existing = await requestGithub(
        `https://api.github.com/repos/${owner}/${repo}/contents/${targetPath}?ref=${encodeURIComponent(branch)}`
    );

    const body = {
        message: commitMessage || `chore: upload image ${fileName}`,
        content: contentBase64,
        branch
    };

    if (!existing.notFound && existing.data?.sha) {
        body.sha = existing.data.sha;
    }

    await requestGithub(`https://api.github.com/repos/${owner}/${repo}/contents/${targetPath}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const cdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${targetPath}`;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${targetPath}`;

    return {
        ok: true,
        path: targetPath,
        cdnUrl,
        rawUrl
    };
}

module.exports = {
    uploadImageToRepo,
    listUserRepositories,
    ensureRemoteRepositories,
    cloneRepositoryToDestination
};
