const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');

function createMockChildProcess(result) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    queueMicrotask(() => {
        if (result.stdout) {
            child.stdout.emit('data', Buffer.from(result.stdout));
        }
        if (result.stderr) {
            child.stderr.emit('data', Buffer.from(result.stderr));
        }
        child.emit('close', result.code ?? 0);
    });

    return child;
}

function loadVerifyModuleForTests({ spawnImpl, platform = 'win32', comspec = 'C:/Windows/System32/cmd.exe' }) {
    const filePath = path.join(__dirname, 'e2e-real-workspace-verify.js');
    const original = fs.readFileSync(filePath, 'utf8');
    const instrumented = original.replace(
        /main\(\)\.catch\([\s\S]*?\);\s*$/,
        'module.exports = { run };\n'
    );

    const originalLoad = Module._load;
    const originalPlatform = process.platform;
    const originalComSpec = process.env.ComSpec;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return { spawn: spawnImpl };
        }
        return originalLoad.apply(this, arguments);
    };

    Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true
    });
    process.env.ComSpec = comspec;

    const mod = new Module(filePath, module);
    mod.filename = filePath;
    mod.paths = Module._nodeModulePaths(path.dirname(filePath));
    mod._compile(instrumented, filePath);

    return {
        verifyModule: mod.exports,
        restore() {
            Module._load = originalLoad;
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                configurable: true
            });
            if (originalComSpec === undefined) {
                delete process.env.ComSpec;
            } else {
                process.env.ComSpec = originalComSpec;
            }
        }
    };
}

function loadVerifyMainForTests({
    spawnImpl,
    startLocalPreviewImpl,
    stopLocalPreviewImpl,
    resolveHugoExecutableImpl,
    getHugoExecutionEnvImpl,
    platform = 'win32',
    comspec = 'C:/Windows/System32/cmd.exe'
}) {
    const filePath = path.join(__dirname, 'e2e-real-workspace-verify.js');
    const original = fs.readFileSync(filePath, 'utf8');
    const instrumented = original.replace(
        /main\(\)\.catch\([\s\S]*?\);\s*$/,
        'module.exports = { main, run };\n'
    );

    const originalLoad = Module._load;
    const originalPlatform = process.platform;
    const originalComSpec = process.env.ComSpec;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return { spawn: spawnImpl };
        }
        if (request === '../src/main/services/previewService') {
            return {
                startLocalPreview: startLocalPreviewImpl,
                stopLocalPreview: stopLocalPreviewImpl
            };
        }
        if (request === '../src/main/services/envService') {
            return {
                resolveHugoExecutable: resolveHugoExecutableImpl,
                getHugoExecutionEnv: getHugoExecutionEnvImpl
            };
        }
        return originalLoad.apply(this, arguments);
    };

    Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true
    });
    process.env.ComSpec = comspec;

    const mod = new Module(filePath, module);
    mod.filename = filePath;
    mod.paths = Module._nodeModulePaths(path.dirname(filePath));
    mod._compile(instrumented, filePath);

    return {
        verifyModule: mod.exports,
        restore() {
            Module._load = originalLoad;
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                configurable: true
            });
            if (originalComSpec === undefined) {
                delete process.env.ComSpec;
            } else {
                process.env.ComSpec = originalComSpec;
            }
        }
    };
}

function loadVerifyRealWorkspaceModuleForTests({ spawnSyncImpl } = {}) {
    const filePath = path.join(__dirname, 'verify-real-workspace.js');
    const mod = new Module(filePath, module);
    mod.filename = filePath;
    mod.paths = Module._nodeModulePaths(path.dirname(filePath));

    const originalLoad = Module._load;
    const childProcessModule = originalLoad('child_process', module, false);
    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return {
                ...childProcessModule,
                spawnSync: spawnSyncImpl || childProcessModule.spawnSync
            };
        }
        return originalLoad.apply(this, arguments);
    };

    delete require.cache[filePath];
    mod._compile(fs.readFileSync(filePath, 'utf8'), filePath);

    return {
        verifyRealWorkspaceModule: mod.exports,
        restore() {
            Module._load = originalLoad;
        }
    };
}

test('verify runner uses Windows-safe cmd wrapper for pnpm build publish path', async (t) => {
    const calls = [];
    const mocked = loadVerifyModuleForTests({
        spawnImpl: (...args) => {
            calls.push(args);
            return createMockChildProcess({ code: 0, stdout: 'ok', stderr: '' });
        }
    });
    t.after(() => mocked.restore());

    const result = await mocked.verifyModule.run('C:/tmp/project', 'pnpm', ['build'], { shell: true });

    assert.equal(result.ok, true);
    assert.equal(path.basename(calls[0][0]).toLowerCase(), 'cmd.exe');
    assert.deepEqual(calls[0][1], ['/d', '/s', '/c', 'pnpm.cmd', 'build']);
    assert.equal(calls[0][2].shell, false);
    assert.equal(calls[0][2].windowsHide, true);
});

test('verify-real-workspace wrapper runs prepare then verify and fails fast', async () => {
    const calls = [];
    const manifestPath = path.resolve(__dirname, '..', 'e2e-real-workspaces', 'manifest.json');
    fs.rmSync(path.dirname(manifestPath), { recursive: true, force: true });

    const loaded = loadVerifyRealWorkspaceModuleForTests({
        spawnSyncImpl: (command, args, options) => {
            calls.push({ command, args, options });
            if (String(args[0]).endsWith('e2e-real-workspace-prepare.js')) {
                fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
                fs.writeFileSync(manifestPath, '{"ok":true}\n', 'utf8');
                return { status: 0, stdout: Buffer.from('prepared\n'), stderr: Buffer.from('') };
            }
            if (String(args[0]).endsWith('e2e-real-workspace-verify.js')) {
                return { status: 2, stdout: Buffer.from(''), stderr: Buffer.from('verify failed\n') };
            }
            return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') };
        }
    });

    try {
        const code = await loaded.verifyRealWorkspaceModule.runVerifyWorkspaceForTests();
        assert.equal(code, 2);
        assert.equal(calls.length, 2);
        assert.equal(path.basename(calls[0].args[0]), 'e2e-real-workspace-prepare.js');
        assert.equal(path.basename(calls[1].args[0]), 'e2e-real-workspace-verify.js');
    } finally {
        loaded.restore();
        fs.rmSync(path.dirname(manifestPath), { recursive: true, force: true });
    }
});

test('verify main exits non-zero when any workspace row fails checks', async (t) => {
    const workspacesDir = path.resolve(__dirname, '..', 'e2e-real-workspaces');
    const manifestPath = path.join(workspacesDir, 'manifest.json');
    const reportPath = path.join(workspacesDir, 'verify-report.json');
    const projectDir = path.join(workspacesDir, 'failing-theme-project');
    const originalExitCode = process.exitCode;

    fs.rmSync(workspacesDir, { recursive: true, force: true });
    fs.mkdirSync(workspacesDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({
        themes: [{ framework: 'hexo', themeId: 'next', projectDir }]
    }), 'utf8');

    const loaded = loadVerifyMainForTests({
        spawnImpl: () => createMockChildProcess({ code: 0, stdout: 'publish ok\n', stderr: '' }),
        startLocalPreviewImpl: async () => ({ ok: false, url: '', logs: ['preview failed'] }),
        stopLocalPreviewImpl: async () => {},
        resolveHugoExecutableImpl: () => 'hugo',
        getHugoExecutionEnvImpl: () => ({ env: process.env })
    });

    t.after(() => {
        loaded.restore();
        process.exitCode = originalExitCode;
        fs.rmSync(workspacesDir, { recursive: true, force: true });
    });

    delete process.exitCode;
    await loaded.verifyModule.main();
    const observedExitCode = process.exitCode;
    process.exitCode = originalExitCode;

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.total, 1);
    assert.equal(report.passAll, 0);
    assert.equal(observedExitCode, 1);
});

test('verify main retries preview startup once before failing a workspace', async (t) => {
    const workspacesDir = path.resolve(__dirname, '..', 'e2e-real-workspaces');
    const manifestPath = path.join(workspacesDir, 'manifest.json');
    const reportPath = path.join(workspacesDir, 'verify-report.json');
    const projectDir = path.join(workspacesDir, 'retry-theme-project');
    const publicDir = path.join(projectDir, 'public');
    const originalExitCode = process.exitCode;
    let previewCalls = 0;

    fs.rmSync(workspacesDir, { recursive: true, force: true });
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({
        themes: [{ framework: 'hexo', themeId: 'landscape', projectDir }]
    }), 'utf8');
    fs.writeFileSync(path.join(projectDir, '_config.yml'), [
        'theme: landscape',
        'theme_config:',
        '  favicon: /img/e2e-favicon.jpg',
        '  banner: /img/e2e-bg.jpg'
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(publicDir, 'index.html'), '<html><head><link rel="icon" href="/img/e2e-favicon.jpg"></head><body>landscape ok</body></html>', 'utf8');

    const loaded = loadVerifyMainForTests({
        spawnImpl: () => createMockChildProcess({ code: 0, stdout: 'publish ok\n', stderr: '' }),
        startLocalPreviewImpl: async () => {
            previewCalls += 1;
            if (previewCalls === 1) {
                return { ok: false, url: '', logs: [{ attempt: 1, message: 'transient startup failure' }] };
            }
            return {
                ok: true,
                url: 'http://localhost:31001/',
                logs: [{ attempt: 2, message: 'preview ready after retry' }]
            };
        },
        stopLocalPreviewImpl: async () => {},
        resolveHugoExecutableImpl: () => 'hugo',
        getHugoExecutionEnvImpl: () => ({ env: process.env })
    });

    t.after(() => {
        loaded.restore();
        process.exitCode = originalExitCode;
        fs.rmSync(workspacesDir, { recursive: true, force: true });
    });

    delete process.exitCode;
    await loaded.verifyModule.main();
    const observedExitCode = process.exitCode;
    process.exitCode = originalExitCode;

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(previewCalls, 2);
    assert.equal(report.total, 1);
    assert.equal(report.passAll, 0);
    assert.equal(report.rows[0].previewStartOk, true);
    assert.equal(report.rows[0].previewHttpOk, false);
    assert.equal(observedExitCode, 1);
});
