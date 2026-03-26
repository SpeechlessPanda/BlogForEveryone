const test = require('node:test');
const assert = require('node:assert/strict');

const { createRunCommandTools } = require('./runCommand');

test('runCommand applies default spawn options', () => {
    const calls = [];
    const tools = createRunCommandTools({
        spawnSyncImpl: (...args) => {
            calls.push(args);
            return { status: 0, stdout: '', stderr: '' };
        },
        mirrorRegistry: 'https://registry.npmmirror.com'
    });

    tools.runCommand('node', ['--version']);

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'node');
    assert.deepEqual(calls[0][1], ['--version']);
    assert.equal(calls[0][2].shell, false);
    assert.equal(calls[0][2].encoding, 'utf-8');
    assert.equal(calls[0][2].timeout, 120000);
    assert.equal(calls[0][2].windowsHide, true);
});

test('runPnpmDlxWithRetry retries with registry fallback after failure', () => {
    const calls = [];
    const scripted = [
        { status: 1, stdout: '', stderr: 'first failed' },
        { status: 0, stdout: 'ok', stderr: '' }
    ];

    const tools = createRunCommandTools({
        spawnSyncImpl: (...args) => {
            calls.push(args);
            return scripted.shift() || { status: 0, stdout: '', stderr: '' };
        },
        mirrorRegistry: 'https://registry.npmmirror.com'
    });

    const result = tools.runPnpmDlxWithRetry(['foo']);
    assert.equal(result.ok, true);
    assert.equal(result.retried, true);
    assert.equal(result.logs.some((item) => item.event === 'mirror-fallback'), true);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0][0], 'pnpm');
    assert.deepEqual(calls[0][1], ['dlx', 'foo']);
    assert.equal(calls[0][2].shell, false);
    assert.deepEqual(calls[1][0], 'pnpm');
    assert.deepEqual(calls[1][1], ['--registry', 'https://registry.npmmirror.com', 'dlx', 'foo']);
    assert.equal(calls[1][2].shell, false);
});

test('runPnpmDlxWithRetry does not leave registry mutation after fallback', () => {
    const calls = [];
    const scripted = [
        { status: 1, stdout: '', stderr: 'first failed' },
        { status: 0, stdout: 'ok', stderr: '' }
    ];

    const tools = createRunCommandTools({
        spawnSyncImpl: (...args) => {
            calls.push(args);
            return scripted.shift() || { status: 0, stdout: '', stderr: '' };
        },
        mirrorRegistry: 'https://registry.npmmirror.com'
    });

    const result = tools.runPnpmDlxWithRetry(['foo']);
    assert.equal(result.ok, true);
    assert.equal(result.retried, true);
    assert.equal(calls.some((call) => call[1][0] === 'config'), false);
    assert.deepEqual(calls[1][1], ['--registry', 'https://registry.npmmirror.com', 'dlx', 'foo']);
});
