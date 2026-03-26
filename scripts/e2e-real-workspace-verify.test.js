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
