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

function loadWorkflowServiceWithPublishImpl(publishImpl) {
    const originalLoad = Module._load;
    const workflowServicePath = path.join(__dirname, 'contentPublishWorkflowService.js');

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === './publishService') {
            return {
                publishToGitHub: publishImpl
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
    assert.equal(typeof workflowService.getPublishJobStatus, 'function');
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
