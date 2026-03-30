const fs = require('fs');
const path = require('path');
const { publishToGitHub } = require('./publishService');

const publishJobs = new Map();
const publishJobTimers = new Map();

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

function inspectAutoPublishRepoBinding(payload = {}) {
    const siteType = String(payload.siteType || '').trim();
    if (siteType !== 'user-pages') {
        return { ok: true };
    }

    const parsedRepo = parseGithubRepo(payload.repoUrl);
    if (!parsedRepo) {
        return {
            ok: false,
            message: '当前工程是用户主页，但保存的发布仓库地址无效，请先到发布与备份页修正仓库绑定。'
        };
    }

    const expectedRepo = `${parsedRepo.owner}.github.io`;
    if (String(parsedRepo.repo || '').trim().toLowerCase() !== expectedRepo.toLowerCase()) {
        return {
            ok: false,
            message: `当前工程是用户主页，自动发布仓库必须为 ${expectedRepo}，请先到发布与备份页修正仓库绑定。`
        };
    }

    return { ok: true };
}

function inspectAutoPublishBackupBinding(payload = {}) {
    const backupRepoUrl = String(payload.backupRepoUrl || '').trim();
    if (!backupRepoUrl) {
        return {
            ok: false,
            message: '自动发布前需要先在发布与备份页保存 BFE 备份仓库地址。'
        };
    }

    const parsedRepo = parseGithubRepo(backupRepoUrl);
    if (!parsedRepo || String(parsedRepo.repo || '').trim().toLowerCase() !== 'bfe') {
        return {
            ok: false,
            message: '自动发布前需要先在发布与备份页保存 BFE 备份仓库地址。'
        };
    }

    return { ok: true };
}

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

function cancelWatchingJobForFile(filePath) {
    for (const [jobId, job] of publishJobs.entries()) {
        if (job?.filePath !== filePath || job?.status !== 'watching') {
            continue;
        }

        const timer = publishJobTimers.get(jobId);
        if (timer) {
            clearInterval(timer);
            publishJobTimers.delete(jobId);
        }

        job.status = 'cancelled';
        job.message = '检测到手动保存发布，已取消等待保存型自动发布。';
    }
}

function watchSaveAndAutoPublish(payload) {
    const {
        filePath,
        projectDir,
        framework,
        repoUrl,
        timeoutMs = 10 * 60 * 1000,
        allowedRoots,
        siteType,
        login,
        gitUserName,
        gitUserEmail,
        deployRepoName,
        backupRepoName,
        backupRepoUrl
    } = payload;
    if (!filePath || !repoUrl) {
        throw new Error('自动发布需要 filePath 与 repoUrl');
    }

    const bindingState = inspectAutoPublishRepoBinding(payload);
    if (!bindingState.ok) {
        return {
            jobId: '',
            status: 'blocked',
            message: bindingState.message
        };
    }

    const backupBindingState = inspectAutoPublishBackupBinding(payload);
    if (!backupBindingState.ok) {
        return {
            jobId: '',
            status: 'blocked',
            message: backupBindingState.message
        };
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
            publishJobTimers.delete(jobId);
            return;
        }

        if (Date.now() - startedAt > timeoutMs) {
            job.status = 'timeout';
            job.message = '等待保存超时，请重新触发自动发布。';
            clearInterval(timer);
            publishJobTimers.delete(jobId);
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
        publishJobTimers.delete(jobId);
        job.status = 'publishing';
        job.message = '检测到保存，开始自动发布...';

        try {
            const publishResult = await publishToGitHub({
                projectDir,
                framework,
                repoUrl,
                siteType,
                login,
                gitUserName,
                gitUserEmail,
                deployRepoName,
                backupRepoName,
                backupRepoUrl
            });
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

    publishJobTimers.set(jobId, timer);

    return { jobId, status: 'watching' };
}

function publishSavedContent(payload) {
    const {
        filePath,
        projectDir,
        framework,
        repoUrl,
        allowedRoots,
        siteType,
        login,
        gitUserName,
        gitUserEmail,
        deployRepoName,
        backupRepoName,
        backupRepoUrl
    } = payload || {};
    if (!filePath || !repoUrl) {
        throw new Error('自动发布需要 filePath 与 repoUrl');
    }

    const bindingState = inspectAutoPublishRepoBinding(payload);
    if (!bindingState.ok) {
        return {
            jobId: '',
            status: 'blocked',
            message: bindingState.message
        };
    }

    const backupBindingState = inspectAutoPublishBackupBinding(payload);
    if (!backupBindingState.ok) {
        return {
            jobId: '',
            status: 'blocked',
            message: backupBindingState.message
        };
    }

    assertAllowedRoots(filePath, allowedRoots);
    cancelWatchingJobForFile(filePath);

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();

    publishJobs.set(jobId, {
        jobId,
        status: 'publishing',
        message: '已保存内容，开始自动发布...',
        filePath,
        startedAt,
        publishResult: null
    });

    Promise.resolve()
        .then(() => publishToGitHub({
            projectDir,
            framework,
            repoUrl,
            siteType,
            login,
            gitUserName,
            gitUserEmail,
            deployRepoName,
            backupRepoName,
            backupRepoUrl
        }))
        .then((publishResult) => {
            const job = publishJobs.get(jobId);
            if (!job) {
                return;
            }
            job.publishResult = publishResult;
            if (publishResult?.ok) {
                job.status = 'done';
                job.message = '自动发布完成。';
            } else {
                job.status = 'error';
                job.message = publishResult?.message || '自动发布失败。';
            }
        })
        .catch((error) => {
            const job = publishJobs.get(jobId);
            if (!job) {
                return;
            }
            job.status = 'error';
            job.message = error.message;
        });

    return { jobId, status: 'publishing' };
}

function getPublishJobStatus(jobId) {
    return publishJobs.get(jobId) || null;
}

module.exports = {
    watchSaveAndAutoPublish,
    publishSavedContent,
    getPublishJobStatus
};
