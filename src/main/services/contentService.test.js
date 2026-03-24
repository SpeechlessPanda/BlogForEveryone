const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const {
    readExistingContent,
    saveExistingContent,
    openExistingContent,
    __test__
} = require('./contentService');

function setupHexoWorkspace() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-service-'));
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
        allowedRoots: [postsDir],
        allowedFile,
        outsideFile
    };
}

test('readExistingContent rejects file path outside allowed roots', () => {
    const fixture = setupHexoWorkspace();

    assert.throws(
        () => readExistingContent({ filePath: fixture.outsideFile, allowedRoots: fixture.allowedRoots }),
        /越界/
    );

    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
});

test('saveExistingContent rejects file path outside allowed roots', () => {
    const fixture = setupHexoWorkspace();

    assert.throws(
        () => saveExistingContent({
            filePath: fixture.outsideFile,
            title: 'Nope',
            body: 'Nope',
            allowedRoots: fixture.allowedRoots
        }),
        /越界/
    );

    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
});

test('openExistingContent rejects file path outside allowed roots', () => {
    const fixture = setupHexoWorkspace();

    assert.throws(
        () => openExistingContent({ filePath: fixture.outsideFile, allowedRoots: fixture.allowedRoots }),
        /越界/
    );

    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
});

test('openExistingContent allows file path within allowed roots', () => {
    const fixture = setupHexoWorkspace();
    const opened = [];

    __test__.setOpenPathForTests((target) => {
        opened.push(target);
        return '';
    });

    const result = openExistingContent({
        filePath: fixture.allowedFile,
        allowedRoots: fixture.allowedRoots
    });

    assert.equal(result.ok, true);
    assert.equal(result.filePath, fixture.allowedFile);
    assert.deepEqual(opened, [fixture.allowedFile]);

    __test__.setOpenPathForTests(null);
    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
});

test('readExistingContent rejects when allowedRoots is missing', () => {
    const fixture = setupHexoWorkspace();

    assert.throws(
        () => readExistingContent({ filePath: fixture.allowedFile }),
        /缺少受管内容路径白名单/
    );

    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
});

test('saveExistingContent rejects when allowedRoots is empty', () => {
    const fixture = setupHexoWorkspace();

    assert.throws(
        () => saveExistingContent({
            filePath: fixture.allowedFile,
            title: 'Allowed',
            body: 'Still blocked without roots',
            allowedRoots: []
        }),
        /缺少受管内容路径白名单/
    );

    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
});

function loadContentServiceWithPublishResult(publishResult) {
    const originalLoad = Module._load;
    const contentServicePath = path.join(__dirname, 'contentService.js');
    const mocks = {
        './publishService': {
            publishToGitHub: () => publishResult
        }
    };

    Module._load = function patchedLoad(request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) {
            return mocks[request];
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[contentServicePath];
    const loaded = require('./contentService');
    Module._load = originalLoad;
    return loaded;
}

function loadContentServiceWithShellSpy() {
    const originalLoad = Module._load;
    const shellCalls = [];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'electron') {
            return {
                shell: {
                    openPath(filePath) {
                        shellCalls.push(filePath);
                        return '';
                    }
                }
            };
        }

        if (request === './publishService') {
            return {
                publishToGitHub() {
                    throw new Error('publishToGitHub should not be called in create/list tests');
                }
            };
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./contentService')];
        const service = require('./contentService');
        return { service, shellCalls };
    } finally {
        Module._load = originalLoad;
    }
}

test('watchSaveAndAutoPublish does not mark job done when publish returns failed result', async () => {
    const fixture = setupHexoWorkspace();
    const service = loadContentServiceWithPublishResult({
        ok: false,
        mode: 'actions',
        message: 'Git push 失败。',
        logs: []
    });

    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    let scheduledTick = null;

    global.setInterval = (handler) => {
        scheduledTick = handler;
        return 1;
    };
    global.clearInterval = () => {};

    const watchResult = service.watchSaveAndAutoPublish({
        filePath: fixture.allowedFile,
        projectDir: fixture.workspaceRoot,
        framework: 'hexo',
        repoUrl: 'https://github.com/example/example.github.io.git',
        allowedRoots: fixture.allowedRoots,
        timeoutMs: 30000
    });

    assert.equal(typeof scheduledTick, 'function');

    const previousMtime = fs.statSync(fixture.allowedFile).mtimeMs;
    fs.writeFileSync(fixture.allowedFile, '---\ntitle: Allowed\n---\n\nUpdated body', 'utf-8');
    const boostedMtime = new Date(previousMtime + 5000);
    fs.utimesSync(fixture.allowedFile, boostedMtime, boostedMtime);
    await scheduledTick();

    const job = service.getPublishJobStatus(watchResult.jobId);
    assert.notEqual(job, null);
    assert.equal(job.status, 'error');
    assert.equal(job.message, 'Git push 失败。');

    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
});

test('Hexo about page uses canonical path and remains listable', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-service-hexo-about-'));
    const allowedRoots = [path.join(projectDir, 'source')];

    fs.writeFileSync(path.join(projectDir, '_config.yml'), 'theme: next\n', 'utf-8');

    const { service, shellCalls } = loadContentServiceWithShellSpy();
    const result = service.createAndOpenContent({
        projectDir,
        framework: 'hexo',
        type: 'about',
        title: '关于我们',
        slug: 'company-about',
        allowedRoots
    });

    const expectedPath = path.join(projectDir, 'source', 'about', 'index.md');
    assert.equal(result.filePath, expectedPath);
    assert.deepEqual(shellCalls, [expectedPath]);

    const listed = service.listExistingContents({ projectDir, framework: 'hexo' });
    assert.equal(listed.some((item) => item.filePath === expectedPath && item.type === 'about'), true);

    fs.rmSync(projectDir, { recursive: true, force: true });
});

test('Hugo links page uses canonical path and keeps special-page type', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-service-hugo-links-'));
    const allowedRoots = [path.join(projectDir, 'content')];

    fs.writeFileSync(path.join(projectDir, 'hugo.toml'), 'theme = "stack"\n', 'utf-8');

    const { service, shellCalls } = loadContentServiceWithShellSpy();
    const result = service.createAndOpenContent({
        projectDir,
        framework: 'hugo',
        type: 'links',
        title: '友情链接',
        slug: 'partners',
        allowedRoots
    });

    const expectedPath = path.join(projectDir, 'content', 'links', 'index.md');
    assert.equal(result.filePath, expectedPath);
    assert.deepEqual(shellCalls, [expectedPath]);

    const listed = service.listExistingContents({ projectDir, framework: 'hugo' });
    assert.equal(listed.some((item) => item.filePath === expectedPath && item.type === 'links'), true);

    fs.rmSync(projectDir, { recursive: true, force: true });
});
