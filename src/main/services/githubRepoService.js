const fs = require('fs');
const path = require('path');
const { readStore } = require('./storeService');

function getGithubToken() {
    const state = readStore();
    const token = state.githubAuth?.accessToken;
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
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
        throw new Error(data.message || 'GitHub API request failed');
    }

    return { notFound: false, status: response.status, data };
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
    uploadImageToRepo
};
