const fs = require('fs');
const path = require('path');
const { publishToGitHub } = require('./publishService');

const publishJobs = new Map();

function normalizeForCompare(inputPath) {
    const resolved = path.resolve(String(inputPath || ''));
    if (fs.existsSync(resolved)) {
        try {
            const real = fs.realpathSync.native(resolved);
            return process.platform === 'win32' ? real.toLowerCase() : real;
        } catch {
            const real = fs.realpathSync(resolved);
            return process.platform === 'win32' ? real.toLowerCase() : real;
        }
    }

    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isSubPath(parentPath, childPath) {
    const parent = normalizeForCompare(parentPath);
    const child = normalizeForCompare(childPath);
    if (!parent || !child) {
        return false;
    }

    if (parent === child) {
        return true;
    }

    const relative = path.relative(parent, child);
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function assertAllowedRoots(filePath, allowedRoots) {
    if (!Array.isArray(allowedRoots) || !allowedRoots.length) {
        throw new Error('缺少受管内容路径白名单，拒绝watch操作。');
    }

    if (!allowedRoots.some((root) => isSubPath(root, filePath))) {
        throw new Error('内容路径越界，拒绝watch操作。');
    }
}

function watchSaveAndAutoPublish(payload) {
    const { filePath, projectDir, framework, repoUrl, timeoutMs = 10 * 60 * 1000, allowedRoots } = payload;
    if (!filePath || !repoUrl) {
        throw new Error('自动发布需要 filePath 与 repoUrl');
    }

    assertAllowedRoots(filePath, allowedRoots);

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initialMtime = fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
    const startedAt = Date.now();

    publishJobs.set(jobId, {
        jobId,
        status: 'watching',
        message: '等待文件保存中...',
        filePath,
        startedAt,
        publishResult: null
    });

    const timer = setInterval(async () => {
        const job = publishJobs.get(jobId);
        if (!job) {
            clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt > timeoutMs) {
            job.status = 'timeout';
            job.message = '等待保存超时，请重新触发自动发布。';
            clearInterval(timer);
            return;
        }

        if (!fs.existsSync(filePath)) {
            return;
        }

        const currentMtime = fs.statSync(filePath).mtimeMs;
        if (currentMtime <= initialMtime) {
            return;
        }

        clearInterval(timer);
        job.status = 'publishing';
        job.message = '检测到保存，开始自动发布...';

        try {
            const publishResult = await publishToGitHub({ projectDir, framework, repoUrl });
            job.publishResult = publishResult;
            if (publishResult?.ok) {
                job.status = 'done';
                job.message = '自动发布完成。';
            } else {
                job.status = 'error';
                job.message = publishResult?.message || '自动发布失败。';
            }
        } catch (error) {
            job.status = 'error';
            job.message = error.message;
        }
    }, 3000);

    return { jobId, status: 'watching' };
}

function getPublishJobStatus(jobId) {
    return publishJobs.get(jobId) || null;
}

module.exports = {
    watchSaveAndAutoPublish,
    getPublishJobStatus
};
