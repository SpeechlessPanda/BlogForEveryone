const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const { EventEmitter } = require('events');

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

function createMockPreviewProcess({ ready = true, stderr = '', stdout = '' } = {}) {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.killed = false;
    proc.pid = 12001;
    proc.kill = function kill() {
        this.killed = true;
        this.emit('exit', 0);
    };

    process.nextTick(() => {
        if (stdout) {
            proc.stdout.emit('data', Buffer.from(stdout));
        }
        if (stderr) {
            proc.stderr.emit('data', Buffer.from(stderr));
        }
        if (ready) {
            proc.stdout.emit('data', Buffer.from('Hexo is running at http://localhost:4321'));
        } else {
            proc.emit('exit', 1);
        }
    });

    return proc;
}

function loadPreviewServiceWithMocks({
    ensureFrameworkEnvironmentImpl,
    resolveHugoExecutableImpl,
    getHugoExecutionEnvImpl,
    evaluateExternalUrlImpl,
    spawnImpl
} = {}) {
    const originalLoad = Module._load;
    const servicePath = require.resolve('./previewService');
    const opened = [];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === './envService') {
            return {
                ensureFrameworkEnvironment: ensureFrameworkEnvironmentImpl || (() => ({ ok: true, logs: [] })),
                resolveHugoExecutable: resolveHugoExecutableImpl || (() => 'hugo'),
                getHugoExecutionEnv: getHugoExecutionEnvImpl || (() => ({ ok: true, env: process.env, logs: [] }))
            };
        }
        if (request === '../policies/externalUrlPolicy') {
            return {
                evaluateExternalUrl: evaluateExternalUrlImpl || (() => ({ allowed: true, normalizedUrl: 'http://localhost:4000/' })),
                EXTERNAL_URL_RULES: { preview: {}, windowOpen: {} }
            };
        }
        if (request === 'electron') {
            return {
                shell: {
                    openExternal(url) {
                        opened.push(url);
                    }
                }
            };
        }
        if (request === 'child_process') {
            return {
                spawn: spawnImpl || (() => createMockPreviewProcess())
            };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[servicePath];
    const loaded = require('./previewService');

    return {
        loaded,
        opened,
        cleanup() {
            Module._load = originalLoad;
            delete require.cache[servicePath];
        }
    };
}

test('startLocalPreview returns alreadyRunning when tracked process exists', async () => {
    previewService.__test__.setPreviewProcess({
        framework: 'hexo',
        projectDir: 'D:/tmp/already',
        proc: { killed: false },
        port: 4567
    });

    try {
        const result = await previewService.startLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/already' });
        assert.equal(result.ok, true);
        assert.equal(result.alreadyRunning, true);
        assert.equal(result.url, 'http://localhost:4567/');
    } finally {
        previewService.__test__.clearPreviewProcesses();
    }
});

test('startLocalPreview fails early when environment check fails', async () => {
    const harness = loadPreviewServiceWithMocks({
        ensureFrameworkEnvironmentImpl: () => ({ ok: false, reason: 'NODE_MISSING', message: 'missing node', logs: [{ step: 'check' }] })
    });

    try {
        const result = await harness.loaded.startLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/project' });
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'NODE_MISSING');
        assert.equal(Array.isArray(result.logs), true);
    } finally {
        harness.cleanup();
    }
});

test('startLocalPreview rejects unsupported framework and missing hugo executable', async () => {
    const unsupported = await previewService.startLocalPreview({ framework: 'jekyll', projectDir: 'D:/tmp/project' });
    assert.equal(unsupported.ok, false);
    assert.equal(unsupported.reason, 'UNSUPPORTED_FRAMEWORK');

    const harness = loadPreviewServiceWithMocks({ resolveHugoExecutableImpl: () => '' });
    try {
        const missing = await harness.loaded.startLocalPreview({ framework: 'hugo', projectDir: 'D:/tmp/project' });
        assert.equal(missing.ok, false);
        assert.equal(missing.reason, 'HUGO_EXTENDED_MISSING');
    } finally {
        harness.cleanup();
    }
});

test('openLocalPreview opens trusted local URL', () => {
    const harness = loadPreviewServiceWithMocks({
        evaluateExternalUrlImpl: () => ({ allowed: true, normalizedUrl: 'http://localhost:9876/' })
    });

    try {
        const result = harness.loaded.openLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/project', port: 9876 });
        assert.equal(result.ok, true);
        assert.equal(result.url, 'http://localhost:9876/');
        assert.equal(harness.opened[0], 'http://localhost:9876/');
    } finally {
        harness.cleanup();
    }
});

test('startLocalPreview succeeds and returns launch logs', async () => {
    const harness = loadPreviewServiceWithMocks({
        spawnImpl: () => createMockPreviewProcess({ ready: true })
    });

    try {
        const result = await harness.loaded.startLocalPreview({
            framework: 'hexo',
            projectDir: 'D:/tmp/project',
            port: 4999
        });

        assert.equal(result.ok, true);
        assert.match(result.url, /localhost/);
        assert.equal(result.logs.some((entry) => entry.command === 'port-selection'), true);
    } finally {
        harness.loaded.__test__.clearPreviewProcesses();
        harness.cleanup();
    }
});

test('startLocalPreview returns PREVIEW_START_FAILED when launch exits without ready log', async () => {
    const harness = loadPreviewServiceWithMocks({
        spawnImpl: () => createMockPreviewProcess({ ready: false, stderr: 'fatal: unsupported theme' })
    });

    try {
        const result = await harness.loaded.startLocalPreview({
            framework: 'hexo',
            projectDir: 'D:/tmp/project',
            port: 5001
        });

        assert.equal(result.ok, false);
        assert.equal(result.reason, 'PREVIEW_START_FAILED');
        assert.equal(result.logs.some((entry) => entry.command === 'port-selection'), true);
    } finally {
        harness.cleanup();
    }
});

test('setPreviewProcess ignores incomplete payload', () => {
    previewService.__test__.clearPreviewProcesses();
    previewService.__test__.setPreviewProcess({ framework: '', projectDir: 'D:/tmp/none' });
    previewService.__test__.setPreviewProcess({ framework: 'hexo', projectDir: '' });

    return previewService.stopLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/none' }).then((result) => {
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'PREVIEW_NOT_RUNNING');
    });
});

test('__test__ exposes deterministic helper seams for coverage-driven tests', () => {
    assert.equal(typeof previewService.__test__.isPortBusy, 'function');
    assert.equal(typeof previewService.__test__.findAvailablePort, 'function');
    assert.equal(typeof previewService.__test__.waitForPortRelease, 'function');
    assert.equal(typeof previewService.__test__.waitForServerReady, 'function');
    assert.equal(typeof previewService.__test__.waitForProcessExit, 'function');
    assert.equal(typeof previewService.__test__.terminateProcessTree, 'function');
    assert.equal(typeof previewService.__test__.setCreateServerForTests, 'function');
});

test('port helper seams cover busy/error/no-host and fallback scan branches', async () => {
    const createServerWithPlan = (plan) => () => {
        const handlers = new Map();
        return {
            once(event, handler) {
                handlers.set(event, handler);
            },
            listen() {
                if (plan.errorCode) {
                    handlers.get('error')?.({ code: plan.errorCode });
                    return;
                }
                handlers.get('listening')?.();
            },
            close(callback) {
                callback?.();
            }
        };
    };

    const busyState = { calls: 0 };
    previewService.__test__.setCreateServerForTests(() => {
        busyState.calls += 1;
        return createServerWithPlan({ errorCode: 'EADDRINUSE' })();
    });

    try {
        assert.equal(await previewService.__test__.isPortBusy(4010, '127.0.0.1'), true);
        assert.equal(await previewService.__test__.findAvailablePort(5000, '127.0.0.1'), 5031);
        assert.equal(busyState.calls >= 31, true);
    } finally {
        previewService.__test__.setCreateServerForTests(null);
    }

    previewService.__test__.setCreateServerForTests(createServerWithPlan({ errorCode: 'EACCES' }));
    try {
        assert.equal(await previewService.__test__.isPortBusy(4011, '127.0.0.1'), false);
    } finally {
        previewService.__test__.setCreateServerForTests(null);
    }

    previewService.__test__.setCreateServerForTests(createServerWithPlan({}));
    try {
        assert.equal(await previewService.__test__.isPortBusy(4012), false);
    } finally {
        previewService.__test__.setCreateServerForTests(null);
    }
});

test('waitForPortRelease and waitForServerReady cover timeout and finish-guard paths', async () => {
    previewService.__test__.setCreateServerForTests(() => {
        const handlers = new Map();
        return {
            once(event, handler) {
                handlers.set(event, handler);
            },
            listen() {
                handlers.get('error')?.({ code: 'EADDRINUSE' });
            },
            close(callback) {
                callback?.();
            }
        };
    });

    const originalDateNow = Date.now;
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    let tick = 0;
    Date.now = () => {
        tick += 2;
        return tick;
    };
    global.setTimeout = (handler) => {
        handler();
        return 1;
    };
    global.clearTimeout = () => {};

    try {
        const released = await previewService.__test__.waitForPortRelease(4100, '127.0.0.1', 5);
        assert.equal(released, false);

        const proc = new EventEmitter();
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        const ready = await previewService.__test__.waitForServerReady(proc, 10);
        proc.emit('exit', 0);
        assert.equal(ready.ok, false);
        assert.equal(ready.timedOut, true);
    } finally {
        Date.now = originalDateNow;
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
        previewService.__test__.setCreateServerForTests(null);
    }
});

test('waitForProcessExit and terminateProcessTree cover no-op and kill-failure branches', async () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    global.setTimeout = (handler) => {
        handler();
        return 1;
    };
    global.clearTimeout = () => {};

    try {
        await previewService.__test__.waitForProcessExit(null);

        let exitHandler;
        const proc = {
            once(event, handler) {
                if (event === 'exit') {
                    exitHandler = handler;
                }
            },
            killed: false,
            kill() {
                throw new Error('kill failed');
            }
        };

        await previewService.__test__.waitForProcessExit(proc, 10);
        exitHandler?.();

        await previewService.__test__.terminateProcessTree(null);
        await previewService.__test__.terminateProcessTree(proc);
    } finally {
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
    }
});

test('startLocalPreview covers unsupported-framework branch after env precheck', async () => {
    const harness = loadPreviewServiceWithMocks({
        ensureFrameworkEnvironmentImpl: () => ({ ok: true, logs: [] })
    });

    try {
        const result = await harness.loaded.startLocalPreview({ framework: 'jekyll', projectDir: 'D:/tmp/project' });
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'UNSUPPORTED_FRAMEWORK');
    } finally {
        harness.cleanup();
    }
});

test('startLocalPreview uses non-windows hexo command path when platform is linux', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' });

    const harness = loadPreviewServiceWithMocks({
        ensureFrameworkEnvironmentImpl: () => ({ ok: true, logs: [] }),
        spawnImpl: () => createMockPreviewProcess({ ready: true })
    });

    try {
        const result = await harness.loaded.startLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/linux-hexo', port: 4101 });
        assert.equal(result.ok, true);
        assert.match(result.logs[0].command, /^pnpm\s+exec\s+hexo\s+server/);
    } finally {
        harness.loaded.__test__.clearPreviewProcesses();
        harness.cleanup();
        if (originalPlatform) {
            Object.defineProperty(process, 'platform', originalPlatform);
        }
    }
});

test('startLocalPreview removes tracked process when spawned server exits after ready', async () => {
    let capturedProc = null;
    const harness = loadPreviewServiceWithMocks({
        ensureFrameworkEnvironmentImpl: () => ({ ok: true, logs: [] }),
        spawnImpl: () => {
            capturedProc = createMockPreviewProcess({ ready: true });
            return capturedProc;
        }
    });

    try {
        const started = await harness.loaded.startLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/exit-cleanup', port: 4102 });
        assert.equal(started.ok, true);

        capturedProc?.emit('exit', 0);

        const stopped = await harness.loaded.stopLocalPreview({ framework: 'hexo', projectDir: 'D:/tmp/exit-cleanup' });
        assert.equal(stopped.ok, false);
        assert.equal(stopped.reason, 'PREVIEW_NOT_RUNNING');
    } finally {
        harness.cleanup();
    }
});

test('startLocalPreview covers hugo success command/env path', async () => {
    let spawnArgs = null;
    const harness = loadPreviewServiceWithMocks({
        ensureFrameworkEnvironmentImpl: () => ({ ok: true, logs: [] }),
        resolveHugoExecutableImpl: () => 'hugo-custom',
        getHugoExecutionEnvImpl: () => ({ ok: true, env: { HUGO_BIN: '1' }, logs: [] }),
        spawnImpl: (command, args, options) => {
            spawnArgs = { command, args, options };
            return createMockPreviewProcess({ ready: true, stdout: 'Web Server is available at http://127.0.0.1:1313/' });
        }
    });

    try {
        const result = await harness.loaded.startLocalPreview({ framework: 'hugo', projectDir: 'D:/tmp/hugo-preview', port: 1313 });
        assert.equal(result.ok, true);
        assert.equal(spawnArgs.command, 'hugo-custom');
        assert.equal(spawnArgs.args[0], 'server');
        assert.equal(spawnArgs.options.env.HUGO_BIN, '1');
    } finally {
        harness.loaded.__test__.clearPreviewProcesses();
        harness.cleanup();
    }
});

test('setProcessTreeKillerForTests reset branch rebuilds default killer closure', async () => {
    const servicePath = require.resolve('./previewService');
    const originalLoad = Module._load;
    let spawned = false;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return {
                spawn() {
                    spawned = true;
                    return {
                        once(event, handler) {
                            if (event === 'error' || event === 'close') {
                                handler();
                            }
                        },
                        unref() {}
                    };
                }
            };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[servicePath];
    const loaded = require('./previewService');

    try {
        loaded.__test__.setProcessTreeKillerForTests(null);
        await loaded.__test__.terminateProcessTree({
            pid: 1234,
            killed: false,
            kill() {
                this.killed = true;
            },
            once(event, handler) {
                if (event === 'exit') {
                    handler();
                }
            }
        });
        assert.equal(spawned, true);
    } finally {
        Module._load = originalLoad;
        delete require.cache[servicePath];
    }
});

test('terminateProcessTree executes default process-tree killer from module init', async () => {
    const servicePath = require.resolve('./previewService');
    const originalLoad = Module._load;
    let spawned = false;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return {
                spawn() {
                    spawned = true;
                    return {
                        once(event, handler) {
                            if (event === 'error' || event === 'close') {
                                handler();
                            }
                        },
                        unref() {}
                    };
                }
            };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[servicePath];
    const loaded = require('./previewService');

    try {
        await loaded.__test__.terminateProcessTree({
            pid: 5678,
            killed: false,
            kill() {
                this.killed = true;
            },
            once(event, handler) {
                if (event === 'exit') {
                    handler();
                }
            }
        });
        assert.equal(spawned, true);
    } finally {
        Module._load = originalLoad;
        delete require.cache[servicePath];
    }
});

test('setCreateServerForTests reset branch restores default net.createServer path', async () => {
    previewService.__test__.setCreateServerForTests(null);
    const busy = await previewService.__test__.isPortBusy(0);
    assert.equal(busy, false);
});
