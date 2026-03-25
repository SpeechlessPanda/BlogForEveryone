const test = require('node:test');
const assert = require('node:assert/strict');

const previewService = require('./previewService');

test('exports windows process-tree kill helper', () => {
    assert.ok(previewService.__test__, 'expected __test__ export for unit tests');
    assert.equal(typeof previewService.__test__.buildWindowsKillArgs, 'function');

    const args = previewService.__test__.buildWindowsKillArgs(1234);
    assert.deepEqual(args, ['/c', 'taskkill', '/PID', '1234', '/T', '/F']);
});

test('stopLocalPreview triggers cleanup chain for tracked process', async () => {
    assert.equal(typeof previewService.__test__.setPreviewProcess, 'function');
    assert.equal(typeof previewService.__test__.setProcessTreeKillerForTests, 'function');

    let killerPid = null;
    previewService.__test__.setProcessTreeKillerForTests((pid) => {
        killerPid = pid;
    });

    let killCallCount = 0;
    const fakeProc = {
        pid: 4321,
        killed: false,
        kill() {
            killCallCount += 1;
            this.killed = true;
        }
    };

    previewService.__test__.setPreviewProcess({
        framework: 'hexo',
        projectDir: 'D:/tmp/project',
        proc: fakeProc,
        port: 32001
    });

    const result = await previewService.stopLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/project' });

    assert.equal(result.ok, true);
    assert.equal(result.stopped, true);
    assert.equal(killerPid, process.platform === 'win32' ? 4321 : null);
    assert.equal(killCallCount, 1);

    previewService.__test__.setProcessTreeKillerForTests(null);
    previewService.__test__.clearPreviewProcesses();
});

test('stopLocalPreview waits for async windows cleanup before resolving', async () => {
    if (process.platform !== 'win32') {
        return;
    }

    let cleanupFinished = false;
    previewService.__test__.setProcessTreeKillerForTests(() => new Promise((resolve) => {
        setTimeout(() => {
            cleanupFinished = true;
            resolve();
        }, 20);
    }));

    const fakeProc = {
        pid: 9876,
        killed: false,
        kill() {
            this.killed = true;
        },
        once(event, handler) {
            if (event === 'exit') {
                setTimeout(handler, 25);
            }
        }
    };

    previewService.__test__.setPreviewProcess({
        framework: 'hexo',
        projectDir: 'D:/tmp/async-project',
        proc: fakeProc,
        port: 32002
    });

    const result = await previewService.stopLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/async-project' });

    assert.equal(cleanupFinished, true);
    assert.equal(result.ok, true);
    assert.equal(result.stopped, true);

    previewService.__test__.setProcessTreeKillerForTests(null);
    previewService.__test__.clearPreviewProcesses();
});

test('stopLocalPreview does not hang forever when windows tree kill promise never settles', async () => {
    if (process.platform !== 'win32') {
        return;
    }

    previewService.__test__.setProcessTreeKillerForTests(() => new Promise(() => { }));

    const fakeProc = {
        pid: 7654,
        killed: false,
        kill() {
            this.killed = true;
        },
        once(event, handler) {
            if (event === 'exit') {
                setTimeout(handler, 10);
            }
        }
    };

    previewService.__test__.setPreviewProcess({
        framework: 'hexo',
        projectDir: 'D:/tmp/hanging-killer',
        proc: fakeProc,
        port: 32003
    });

    const start = Date.now();
    const result = await previewService.stopLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/hanging-killer' });
    const elapsed = Date.now() - start;

    assert.equal(result.ok, true);
    assert.equal(result.stopped, true);
    assert.ok(elapsed < 4000, `expected stopLocalPreview to resolve before timeout ceiling, got ${elapsed}ms`);

    previewService.__test__.setProcessTreeKillerForTests(null);
    previewService.__test__.clearPreviewProcesses();
});

test('openLocalPreview blocks explicit non-local preview url', () => {
    const result = previewService.openLocalPreview({
        framework: 'hexo',
        projectDir: 'D:/tmp/project',
        url: 'https://evil.example.com/preview'
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'PREVIEW_URL_BLOCKED');
});

test('stopLocalPreview returns explicit failed outcome when preview is not running', async () => {
    previewService.__test__.clearPreviewProcesses();

    const result = await previewService.stopLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/missing' });

    assert.equal(result.ok, false);
    assert.equal(result.stopped, false);
    assert.equal(result.reason, 'PREVIEW_NOT_RUNNING');
    assert.match(result.message, /没有正在运行的预览进程/);
});
