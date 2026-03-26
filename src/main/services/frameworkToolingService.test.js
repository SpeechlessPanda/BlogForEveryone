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
    child.kill = () => {
        child.emit('close', null);
    };

    process.nextTick(() => {
        if (result?.error) {
            child.emit('error', new Error(result.error));
            return;
        }
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

function loadFrameworkToolingServiceWithMocks({ mirrorRegistry = 'https://registry.npmmirror.com', spawnPlans = [] } = {}) {
    const servicePath = path.join(__dirname, 'frameworkToolingService.js');
    const originalLoad = Module._load;
    const spawnCalls = [];
    let callIndex = 0;

    const spawn = (command, args, options) => {
        spawnCalls.push({ command, args, options });
        const plan = spawnPlans[callIndex] || { status: 0, stdout: '', stderr: '' };
        callIndex += 1;
        return createMockChildProcess(plan);
    };

    const mocks = {
        './envService': { MIRROR_REGISTRY: mirrorRegistry },
        child_process: { spawn }
    };

    Module._load = function patchedLoad(request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) {
            return mocks[request];
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[servicePath];
    const loaded = require('./frameworkToolingService');
    Module._load = originalLoad;

    return { ...loaded, spawnCalls, mirrorRegistry };
}

test('ensureFrameworkPublishPackages runs pnpm commands without shell mode', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-tooling-'));
    const projectDir = path.join(tmpDir, 'hexo-site');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"hexo-site"}', 'utf8');

    const { ensureFrameworkPublishPackages, spawnCalls } = loadFrameworkToolingServiceWithMocks({
        spawnPlans: [{ status: 0, stdout: 'ok', stderr: '' }]
    });

    const result = await ensureFrameworkPublishPackages({ projectDir, framework: 'hexo' });

    assert.equal(result.ok, true);
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].options.shell, false);
    assert.equal(spawnCalls[0].options.windowsHide, true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('ensureFrameworkPublishPackages retries with one-shot mirror registry argument instead of persistent config mutation', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-tooling-retry-'));
    const projectDir = path.join(tmpDir, 'hexo-site');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"hexo-site"}', 'utf8');

    const { ensureFrameworkPublishPackages, spawnCalls, mirrorRegistry } = loadFrameworkToolingServiceWithMocks({
        mirrorRegistry: 'https://registry.npmmirror.com',
        spawnPlans: [
            { status: 1, stdout: '', stderr: 'network timeout' },
            { status: 0, stdout: 'retry ok', stderr: '' }
        ]
    });

    const result = await ensureFrameworkPublishPackages({ projectDir, framework: 'hexo' });

    assert.equal(result.ok, true);
    assert.equal(spawnCalls.length, 2);
    assert.deepEqual(spawnCalls[0].args.slice(0, 1), ['add']);
    assert.deepEqual(spawnCalls[1].args.slice(0, 3), ['--registry', mirrorRegistry, 'add']);
    assert.equal(spawnCalls.some((call) => call.args[0] === 'config' && call.args[1] === 'set' && call.args[2] === 'registry'), false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('ensureFrameworkPublishPackages handles spawn error event and retries with mirror registry', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-tooling-error-retry-'));
    const projectDir = path.join(tmpDir, 'hexo-site');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"hexo-site"}', 'utf8');

    const { ensureFrameworkPublishPackages, spawnCalls, mirrorRegistry } = loadFrameworkToolingServiceWithMocks({
        mirrorRegistry: 'https://registry.npmmirror.com',
        spawnPlans: [
            { error: 'spawn failed for pnpm' },
            { status: 0, stdout: 'retry ok', stderr: '' }
        ]
    });

    const result = await ensureFrameworkPublishPackages({ projectDir, framework: 'hexo' });

    assert.equal(result.ok, true);
    assert.equal(spawnCalls.length, 2);
    assert.deepEqual(spawnCalls[0].args.slice(0, 1), ['add']);
    assert.deepEqual(spawnCalls[1].args.slice(0, 3), ['--registry', mirrorRegistry, 'add']);
    assert.equal(result.logs.some((entry) => entry.command === 'pnpm add hexo-deployer-git hexo-generator-feed' && /spawn failed for pnpm/.test(entry.stderr || '')), true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});
