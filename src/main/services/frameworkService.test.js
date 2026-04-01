const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { EventEmitter } = require('events');

function createMockChildProcess(result) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    process.nextTick(() => {
        if (result?.stdout) {
            child.stdout.emit('data', Buffer.from(result.stdout));
        }
        if (result?.stderr) {
            child.stderr.emit('data', Buffer.from(result.stderr));
        }
        child.emit('close', result?.status ?? 0);
    });

    return child;
}

function loadFrameworkServiceWithMocks(envServiceMock, childProcessMock = null) {
    const originalLoad = Module._load;
    const servicePath = path.join(__dirname, 'frameworkService.js');
    const mocks = {
        './envService': envServiceMock
    };
    if (childProcessMock) {
        mocks.child_process = childProcessMock;
    }

    Module._load = function patchedLoad(request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) {
            return mocks[request];
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[servicePath];
    const loaded = require('./frameworkService');
    Module._load = originalLoad;
    return loaded;
}

test('initProject recovers hexo partial init when retry hits non-empty directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-service-'));
    const projectDir = path.join(tmpDir, 'hexo-site');
    fs.mkdirSync(path.join(projectDir, 'scaffolds'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'source'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, '_config.yml'), 'title: test\n', 'utf8');
    fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"hexo-site"}', 'utf8');

    let installCalledWith = null;
    const { initProject } = loadFrameworkServiceWithMocks({
        ensureFrameworkEnvironment: () => ({ ok: true, logs: [{ step: 'ensure-pnpm', ok: true }] }),
        runPnpmDlxWithRetry: () => ({
            retried: true,
            result: {
                status: 1,
                stdout: 'INFO  Start blogging with Hexo!\n',
                stderr: 'FATAL target not empty\nError: target not empty'
            },
            logs: [{ command: 'pnpm dlx hexo init ...', status: 1 }]
        }),
        installDependenciesWithRetry: (dir) => {
            installCalledWith = dir;
            return { ok: true, logs: [{ command: 'pnpm install', status: 0 }] };
        },
        resolveExecutable: () => 'hugo'
    });

    const result = await initProject({ framework: 'hexo', projectDir });

    assert.equal(installCalledWith, projectDir);
    assert.equal(result.status, 0);
    assert.equal(result.recoveredFromPartialInit, true);
    assert.equal(result.retried, true);
    assert.match(result.stderr, /target not empty/i);
    assert.ok(result.logs.some((entry) => entry.event === 'hexo-init-recovery' && entry.ok === true));

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('initProject uses extended timeout for hexo init command', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-service-hexo-timeout-'));
    const projectDir = path.join(tmpDir, 'hexo-site');
    let receivedOptions = null;

    const { initProject } = loadFrameworkServiceWithMocks({
        ensureFrameworkEnvironment: () => ({ ok: true, logs: [] }),
        runPnpmDlxWithRetry: (args, options) => {
            receivedOptions = options;
            return {
                retried: false,
                result: {
                    status: 0,
                    stdout: 'hexo ok',
                    stderr: ''
                },
                logs: []
            };
        },
        installDependenciesWithRetry: () => ({ ok: true, logs: [] }),
        resolveExecutable: () => 'hugo'
    });

    const result = await initProject({ framework: 'hexo', projectDir });

    assert.equal(result.status, 0);
    assert.equal(receivedOptions.cwd, process.cwd());
    assert.equal(receivedOptions.timeout, 600000);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('detectFramework recognizes Hugo projects using YAML/YML/JSON config files', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-service-detect-hugo-'));
    t.after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const yamlDir = path.join(tmpDir, 'yaml-site');
    fs.mkdirSync(yamlDir, { recursive: true });
    fs.writeFileSync(path.join(yamlDir, 'config.yaml'), 'theme: PaperMod\n', 'utf8');

    const ymlDir = path.join(tmpDir, 'yml-site');
    fs.mkdirSync(ymlDir, { recursive: true });
    fs.writeFileSync(path.join(ymlDir, 'config.yml'), 'theme: PaperMod\n', 'utf8');

    const jsonDir = path.join(tmpDir, 'json-site');
    fs.mkdirSync(jsonDir, { recursive: true });
    fs.writeFileSync(path.join(jsonDir, 'config.json'), JSON.stringify({ theme: 'PaperMod' }), 'utf8');

    const { detectFramework } = loadFrameworkServiceWithMocks({
        ensureFrameworkEnvironment: () => ({ ok: true, logs: [] }),
        runPnpmDlxWithRetry: () => ({ retried: false, result: { status: 0, stdout: '', stderr: '' }, logs: [] }),
        installDependenciesWithRetry: () => ({ ok: true, logs: [] }),
        resolveExecutable: () => 'hugo'
    });

    assert.equal(detectFramework(yamlDir), 'hugo');
    assert.equal(detectFramework(ymlDir), 'hugo');
    assert.equal(detectFramework(jsonDir), 'hugo');
});

test('initProject awaits async hexo runner before reading execution result', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-service-hexo-async-'));
    const projectDir = path.join(tmpDir, 'hexo-site');

    const { initProject } = loadFrameworkServiceWithMocks({
        ensureFrameworkEnvironment: () => ({ ok: true, logs: [{ step: 'ensure-pnpm', ok: true }] }),
        runPnpmDlxWithRetry: async () => ({
            retried: false,
            result: {
                status: 0,
                stdout: 'hexo ok',
                stderr: ''
            },
            logs: [{ command: 'pnpm dlx hexo init ...', status: 0 }]
        }),
        installDependenciesWithRetry: () => ({ ok: true, logs: [] }),
        resolveExecutable: () => 'hugo'
    });

    const result = await initProject({ framework: 'hexo', projectDir });

    assert.equal(result.status, 0);
    assert.equal(result.retried, false);
    assert.equal(result.stdout, 'hexo ok');
    assert.equal(result.stderr, '');
    assert.deepEqual(result.logs, [
        { step: 'ensure-pnpm', ok: true },
        { command: 'pnpm dlx hexo init ...', status: 0 }
    ]);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('initProject executes hugo init without shell mode', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-service-hugo-'));
    const projectDir = path.join(tmpDir, 'hugo-site');
    const spawnCalls = [];

    const spawn = (command, args, options) => {
        spawnCalls.push({ command, args, options });
        return createMockChildProcess({ status: 0, stdout: 'hugo ok', stderr: '' });
    };

    const { initProject } = loadFrameworkServiceWithMocks(
        {
            ensureFrameworkEnvironment: () => ({ ok: true, logs: [] }),
            runPnpmDlxWithRetry: () => ({
                retried: false,
                result: { status: 0, stdout: '', stderr: '' },
                logs: []
            }),
            installDependenciesWithRetry: () => ({ ok: true, logs: [] }),
            resolveExecutable: () => 'hugo'
        },
        { spawn }
    );

    const result = await initProject({ framework: 'hugo', projectDir });

    assert.equal(result.status, 0);
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].options.shell, false);
    assert.equal(spawnCalls[0].options.windowsHide, true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('initProject handles hugo spawn error event', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-service-hugo-error-'));
    const projectDir = path.join(tmpDir, 'hugo-site');
    const spawnCalls = [];

    const spawn = (command, args, options) => {
        spawnCalls.push({ command, args, options });
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();

        process.nextTick(() => {
            child.emit('error', new Error('spawn hugo ENOENT'));
        });

        return child;
    };

    const { initProject } = loadFrameworkServiceWithMocks(
        {
            ensureFrameworkEnvironment: () => ({ ok: true, logs: [{ step: 'ensure-hugo', ok: true }] }),
            runPnpmDlxWithRetry: () => ({
                retried: false,
                result: { status: 0, stdout: '', stderr: '' },
                logs: []
            }),
            installDependenciesWithRetry: () => ({ ok: true, logs: [] }),
            resolveExecutable: () => 'hugo'
        },
        { spawn }
    );

    const result = await initProject({ framework: 'hugo', projectDir });

    assert.equal(spawnCalls.length, 1);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /spawn hugo ENOENT/);
    assert.equal(result.retried, false);
    assert.equal(result.logs.length, 2);
    assert.equal(result.logs[1].status, 1);
    assert.match(result.logs[1].stderr, /spawn hugo ENOENT/);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});
