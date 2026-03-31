const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

function setupHexoWorkspace() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-publish-workflow-'));
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const postsDir = path.join(workspaceRoot, 'source', '_posts');
    const allowedFile = path.join(postsDir, 'allowed.md');
    const outsideFile = path.join(tmpDir, 'outside.md');

    fs.mkdirSync(postsDir, { recursive: true });
    fs.writeFileSync(allowedFile, '---\ntitle: Allowed\n---\n\nAllowed body', 'utf-8');
    fs.writeFileSync(outsideFile, '---\ntitle: Outside\n---\n\nOutside body', 'utf-8');

    return {
        tmpDir,
        workspaceRoot,
        postsDir,
        allowedRoots: [postsDir],
        allowedFile,
        outsideFile
    };
}

function loadWorkflowServiceWithPublishImpl(options = {}) {
    const publishImpl = typeof options === 'function' ? options : options.publishImpl;
    const inspectGitIdentityImpl = typeof options === 'function'
        ? undefined
        : options.inspectGitIdentityImpl;
    const originalLoad = Module._load;
    const workflowServicePath = path.join(__dirname, 'contentPublishWorkflowService.js');

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === './publishService') {
            return {
                publishToGitHub: publishImpl,
                inspectGitIdentity: inspectGitIdentityImpl || (() => ({ ok: true }))
            };
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[workflowServicePath];
    const service = require('./contentPublishWorkflowService');
    Module._load = originalLoad;
    return service;
}

test('contentPublishWorkflowService exposes explicit publish workflow entry points for H2 extraction', () => {
    const workflowService = require('./contentPublishWorkflowService');

    assert.equal(typeof workflowService.watchSaveAndAutoPublish, 'function');
    assert.equal(typeof workflowService.publishSavedContent, 'function');
    assert.equal(typeof workflowService.getPublishJobStatus, 'function');
});

test('publishSavedContent starts publishing immediately for already-saved content and records final result', async () => {
    const fixture = setupHexoWorkspace();
    const publishCalls = [];

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl({ publishImpl: async (payload) => {
            publishCalls.push(payload);
            return { ok: true, mode: 'actions', message: 'ok', logs: [] };
        } });

        const publishResult = workflowService.publishSavedContent({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/example.github.io.git',
            siteType: 'project-pages',
            backupRepoName: 'BFE',
            backupRepoUrl: 'https://github.com/example/BFE.git',
            allowedRoots: fixture.allowedRoots
        });

        assert.equal(publishResult.status, 'publishing');

        const inFlight = workflowService.getPublishJobStatus(publishResult.jobId);
        assert.equal(inFlight?.status, 'publishing');

        await new Promise((resolve) => setTimeout(resolve, 0));

        const completed = workflowService.getPublishJobStatus(publishResult.jobId);
        assert.equal(completed?.status, 'done');
        assert.equal(completed?.message, '自动发布完成。');
        assert.equal(publishCalls.length, 1);
        assert.equal(publishCalls[0].repoUrl, 'https://github.com/example/example.github.io.git');
    } finally {
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('watchSaveAndAutoPublish moves job from watching to publishing to done when publishToGitHub resolves', async () => {
    const fixture = setupHexoWorkspace();
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    const publishCalls = [];
    let scheduledTick = null;
    let workflowService = null;
    let activeJobId = null;

    global.setInterval = (handler) => {
        scheduledTick = handler;
        return 1;
    };
    global.clearInterval = () => {};

    try {
        workflowService = loadWorkflowServiceWithPublishImpl(async (payload) => {
            publishCalls.push(payload);
            const inFlight = workflowService.getPublishJobStatus(activeJobId);
            assert.equal(inFlight?.status, 'publishing');
            return { ok: true, mode: 'actions', message: 'ok', logs: [] };
        });

        const watchResult = workflowService.watchSaveAndAutoPublish({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/example.github.io.git',
            siteType: 'project-pages',
            backupRepoName: 'BFE',
            backupRepoUrl: 'https://github.com/example/BFE.git',
            allowedRoots: fixture.allowedRoots,
            timeoutMs: 30000
        });
        activeJobId = watchResult.jobId;

        const previousMtime = fs.statSync(fixture.allowedFile).mtimeMs;
        fs.writeFileSync(fixture.allowedFile, '---\ntitle: Allowed\n---\n\nUpdated body', 'utf-8');
        const boostedMtime = new Date(previousMtime + 5000);
        fs.utimesSync(fixture.allowedFile, boostedMtime, boostedMtime);
        await scheduledTick();

        const job = workflowService.getPublishJobStatus(watchResult.jobId);
        assert.equal(job.status, 'done');
        assert.equal(job.message, '自动发布完成。');
        assert.equal(publishCalls.length, 1);
    } finally {
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('watchSaveAndAutoPublish rejects file paths outside allowedRoots inside workflow owner', () => {
    const fixture = setupHexoWorkspace();
    const workflowService = loadWorkflowServiceWithPublishImpl(() => ({ ok: true, logs: [] }));
    const originalSetInterval = global.setInterval;

    global.setInterval = () => 1;

    try {
        assert.throws(
            () => workflowService.watchSaveAndAutoPublish({
                filePath: fixture.outsideFile,
                projectDir: fixture.workspaceRoot,
                framework: 'hexo',
                repoUrl: 'https://github.com/example/example.github.io.git',
                siteType: 'project-pages',
                backupRepoName: 'BFE',
                backupRepoUrl: 'https://github.com/example/BFE.git',
                allowedRoots: fixture.allowedRoots,
                timeoutMs: 30000
            }),
            /越界/
        );
    } finally {
        global.setInterval = originalSetInterval;
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('watchSaveAndAutoPublish keeps a stable job status payload during unchanged-tree rescans', async () => {
    const fixture = setupHexoWorkspace();
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    const publishCalls = [];
    let scheduledTick = null;

    global.setInterval = (handler) => {
        scheduledTick = handler;
        return 1;
    };
    global.clearInterval = () => {};

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl(async (payload) => {
            publishCalls.push(payload);
            return { ok: true, mode: 'actions', message: 'ok', logs: [] };
        });

        const watchResult = workflowService.watchSaveAndAutoPublish({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/example.github.io.git',
            siteType: 'project-pages',
            backupRepoName: 'BFE',
            backupRepoUrl: 'https://github.com/example/BFE.git',
            allowedRoots: fixture.allowedRoots,
            timeoutMs: 30000
        });

        await scheduledTick();

        const job = workflowService.getPublishJobStatus(watchResult.jobId);
        assert.notEqual(job, null);
        assert.equal(job.jobId, watchResult.jobId);
        assert.equal(job.status, 'watching');
        assert.equal(job.message, '等待文件保存中...');
        assert.equal(job.filePath, fixture.allowedFile);
        assert.equal(typeof job.startedAt, 'number');
        assert.equal(job.publishResult, null);
        assert.equal(publishCalls.length, 0);
    } finally {
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
  }
});

test('publishSavedContent cancels an active watcher job for the same file before starting immediate publish', async () => {
    const fixture = setupHexoWorkspace();
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    const publishCalls = [];
    let scheduledTick = null;
    let clearedTimer = null;

    global.setInterval = (handler) => {
        scheduledTick = handler;
        return 77;
    };
    global.clearInterval = (timerId) => {
        clearedTimer = timerId;
    };

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl(async (payload) => {
            publishCalls.push(payload);
            return { ok: true, mode: 'actions', message: 'ok', logs: [] };
        });

        const watchingJob = workflowService.watchSaveAndAutoPublish({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/example.github.io.git',
            siteType: 'project-pages',
            backupRepoName: 'BFE',
            backupRepoUrl: 'https://github.com/example/BFE.git',
            allowedRoots: fixture.allowedRoots,
            timeoutMs: 30000
        });

        const immediateJob = workflowService.publishSavedContent({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/example.github.io.git',
            siteType: 'project-pages',
            backupRepoName: 'BFE',
            backupRepoUrl: 'https://github.com/example/BFE.git',
            allowedRoots: fixture.allowedRoots
        });

        const cancelledWatcher = workflowService.getPublishJobStatus(watchingJob.jobId);
        assert.equal(cancelledWatcher?.status, 'cancelled');
        assert.equal(cancelledWatcher?.message, '检测到手动保存发布，已取消等待保存型自动发布。');
        assert.equal(clearedTimer, 77);

        await new Promise((resolve) => setTimeout(resolve, 0));

        const completedImmediate = workflowService.getPublishJobStatus(immediateJob.jobId);
        assert.equal(completedImmediate?.status, 'done');
        assert.equal(publishCalls.length, 1);

        await scheduledTick?.();
        assert.equal(publishCalls.length, 1);
    } finally {
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('watchSaveAndAutoPublish does not block on inspect-only identity checks and forwards payload identity to publish', async () => {
    const fixture = setupHexoWorkspace();
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    const publishCalls = [];
    let scheduledTick = null;

    global.setInterval = (handler) => {
        scheduledTick = handler;
        return 1;
    };
    global.clearInterval = () => {};

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl({
            publishImpl: async (payload) => {
                publishCalls.push(payload);
                return { ok: true, mode: 'actions', message: 'ok', logs: [] };
            },
            inspectGitIdentityImpl: () => ({
                ok: false,
                message: '自动发布前需要 Git 提交用户名和邮箱，请先到发布与备份页补齐 Git 身份。'
            })
        });

        const watchResult = workflowService.watchSaveAndAutoPublish({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/example.github.io.git',
            siteType: 'project-pages',
            gitUserName: 'Demo Bot',
            gitUserEmail: 'demo@example.com',
            backupRepoName: 'BFE',
            backupRepoUrl: 'https://github.com/example/BFE.git',
            allowedRoots: fixture.allowedRoots,
            timeoutMs: 30000
        });

        assert.equal(watchResult.status, 'watching');

        const previousMtime = fs.statSync(fixture.allowedFile).mtimeMs;
        fs.writeFileSync(fixture.allowedFile, '---\ntitle: Allowed\n---\n\nUpdated body', 'utf-8');
        const boostedMtime = new Date(previousMtime + 5000);
        fs.utimesSync(fixture.allowedFile, boostedMtime, boostedMtime);

        await scheduledTick();

        assert.equal(publishCalls.length, 1);
        assert.equal(publishCalls[0].gitUserName, 'Demo Bot');
        assert.equal(publishCalls[0].gitUserEmail, 'demo@example.com');
    } finally {
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('publishSavedContent does not block on inspect-only identity checks and forwards payload identity to publish', async () => {
    const fixture = setupHexoWorkspace();
    const publishCalls = [];

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl({
            publishImpl: async (payload) => {
                publishCalls.push(payload);
                return { ok: true, mode: 'actions', message: 'ok', logs: [] };
            },
            inspectGitIdentityImpl: () => ({
                ok: false,
                message: '自动发布前需要 Git 提交用户名和邮箱，请先到发布与备份页补齐 Git 身份。'
            })
        });

        const publishResult = workflowService.publishSavedContent({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/example.github.io.git',
            siteType: 'project-pages',
            gitUserName: 'Demo Bot',
            gitUserEmail: 'demo@example.com',
            backupRepoName: 'BFE',
            backupRepoUrl: 'https://github.com/example/BFE.git',
            allowedRoots: fixture.allowedRoots
        });

        assert.equal(publishResult.status, 'publishing');

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.equal(publishCalls.length, 1);
        assert.equal(publishCalls[0].gitUserName, 'Demo Bot');
        assert.equal(publishCalls[0].gitUserEmail, 'demo@example.com');
    } finally {
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('watchSaveAndAutoPublish blocks early when user-pages repo binding is not <owner>.github.io', () => {
    const fixture = setupHexoWorkspace();

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl({
            publishImpl: async () => ({ ok: true, mode: 'actions', message: 'ok', logs: [] }),
            inspectGitIdentityImpl: () => ({ ok: true })
        });

        const blocked = workflowService.watchSaveAndAutoPublish({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/not-the-user-site.git',
            siteType: 'user-pages',
            backupRepoName: 'BFE',
            backupRepoUrl: 'https://github.com/example/BFE.git',
            allowedRoots: fixture.allowedRoots,
            timeoutMs: 30000
        });

        assert.deepEqual(blocked, {
            jobId: '',
            status: 'blocked',
            message: '当前工程是用户主页，自动发布仓库必须为 example.github.io，请先到发布与备份页修正仓库绑定。'
        });
    } finally {
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('publishSavedContent blocks early when user-pages repo binding is not <owner>.github.io', () => {
    const fixture = setupHexoWorkspace();

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl({
            publishImpl: async () => ({ ok: true, mode: 'actions', message: 'ok', logs: [] }),
            inspectGitIdentityImpl: () => ({ ok: true })
        });

        const blocked = workflowService.publishSavedContent({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/not-the-user-site.git',
            siteType: 'user-pages',
            backupRepoName: 'BFE',
            backupRepoUrl: 'https://github.com/example/BFE.git',
            allowedRoots: fixture.allowedRoots
        });

        assert.deepEqual(blocked, {
            jobId: '',
            status: 'blocked',
            message: '当前工程是用户主页，自动发布仓库必须为 example.github.io，请先到发布与备份页修正仓库绑定。'
        });
    } finally {
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('watchSaveAndAutoPublish blocks early when backup repo binding is missing', () => {
    const fixture = setupHexoWorkspace();

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl({
            publishImpl: async () => ({ ok: true, mode: 'actions', message: 'ok', logs: [] }),
            inspectGitIdentityImpl: () => ({ ok: true })
        });

        const blocked = workflowService.watchSaveAndAutoPublish({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/example.github.io.git',
            siteType: 'user-pages',
            login: 'example',
            deployRepoName: 'example.github.io',
            backupRepoName: 'BFE',
            backupRepoUrl: '',
            allowedRoots: fixture.allowedRoots,
            timeoutMs: 30000
        });

        assert.deepEqual(blocked, {
            jobId: '',
            status: 'blocked',
            message: '自动发布前需要先在发布与备份页保存备份仓库地址。'
        });
    } finally {
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('publishSavedContent blocks early when backup repo binding is missing', () => {
    const fixture = setupHexoWorkspace();

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl({
            publishImpl: async () => ({ ok: true, mode: 'actions', message: 'ok', logs: [] }),
            inspectGitIdentityImpl: () => ({ ok: true })
        });

        const blocked = workflowService.publishSavedContent({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/example.github.io.git',
            siteType: 'user-pages',
            login: 'example',
            deployRepoName: 'example.github.io',
            backupRepoName: 'BFE',
            backupRepoUrl: '',
            allowedRoots: fixture.allowedRoots
        });

        assert.deepEqual(blocked, {
            jobId: '',
            status: 'blocked',
            message: '自动发布前需要先在发布与备份页保存备份仓库地址。'
        });
    } finally {
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('watchSaveAndAutoPublish blocks early when user-pages repo binding is not <owner>.github.io', () => {
    const fixture = setupHexoWorkspace();

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl({
            publishImpl: async () => ({ ok: true, mode: 'actions', message: 'ok', logs: [] }),
            inspectGitIdentityImpl: () => ({ ok: true })
        });

        const blocked = workflowService.watchSaveAndAutoPublish({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/not-the-user-site.git',
            siteType: 'user-pages',
            allowedRoots: fixture.allowedRoots,
            timeoutMs: 30000
        });

        assert.deepEqual(blocked, {
            jobId: '',
            status: 'blocked',
            message: '当前工程是用户主页，自动发布仓库必须为 example.github.io，请先到发布与备份页修正仓库绑定。'
        });
    } finally {
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});

test('publishSavedContent blocks early when user-pages repo binding is not <owner>.github.io', () => {
    const fixture = setupHexoWorkspace();

    try {
        const workflowService = loadWorkflowServiceWithPublishImpl({
            publishImpl: async () => ({ ok: true, mode: 'actions', message: 'ok', logs: [] }),
            inspectGitIdentityImpl: () => ({ ok: true })
        });

        const blocked = workflowService.publishSavedContent({
            filePath: fixture.allowedFile,
            projectDir: fixture.workspaceRoot,
            framework: 'hexo',
            repoUrl: 'https://github.com/example/not-the-user-site.git',
            siteType: 'user-pages',
            allowedRoots: fixture.allowedRoots
        });

        assert.deepEqual(blocked, {
            jobId: '',
            status: 'blocked',
            message: '当前工程是用户主页，自动发布仓库必须为 example.github.io，请先到发布与备份页修正仓库绑定。'
        });
    } finally {
        fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
});
