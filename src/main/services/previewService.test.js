const test = require('node:test');
const assert = require('node:assert/strict');

const previewService = require('./previewService');

test('exports windows process-tree kill helper', () => {
    assert.ok(previewService.__test__, 'expected __test__ export for unit tests');
    assert.equal(typeof previewService.__test__.buildWindowsKillArgs, 'function');

    const args = previewService.__test__.buildWindowsKillArgs(1234);
    assert.deepEqual(args, ['/c', 'taskkill', '/PID', '1234', '/T', '/F']);
});

test('stopLocalPreview triggers cleanup chain for tracked process', () => {
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

    const result = previewService.stopLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/project' });

    assert.equal(result.ok, true);
    assert.equal(result.stopped, true);
    assert.equal(killerPid, process.platform === 'win32' ? 4321 : null);
    assert.equal(killCallCount, 1);

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

test('stopLocalPreview returns explicit failed outcome when preview is not running', () => {
    previewService.__test__.clearPreviewProcesses();

    const result = previewService.stopLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/missing' });

    assert.equal(result.ok, false);
    assert.equal(result.stopped, false);
    assert.equal(result.reason, 'PREVIEW_NOT_RUNNING');
    assert.match(result.message, /没有正在运行的预览进程/);
});
