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
    assert.equal(calls[0][2].shell, true);
    assert.equal(calls[0][2].encoding, 'utf-8');
    assert.equal(calls[0][2].timeout, 120000);
    assert.equal(calls[0][2].windowsHide, true);
});

test('runPnpmDlxWithRetry retries with registry fallback after failure', () => {
    const scripted = [
        { status: 1, stdout: '', stderr: 'first failed' },
        { status: 0, stdout: '', stderr: '' },
        { status: 0, stdout: 'ok', stderr: '' }
    ];

    const tools = createRunCommandTools({
        spawnSyncImpl: () => scripted.shift() || { status: 0, stdout: '', stderr: '' },
        mirrorRegistry: 'https://registry.npmmirror.com'
    });

    const result = tools.runPnpmDlxWithRetry(['foo']);
    assert.equal(result.ok, true);
    assert.equal(result.retried, true);
    assert.equal(result.logs.some((item) => item.event === 'mirror-fallback'), true);
});
