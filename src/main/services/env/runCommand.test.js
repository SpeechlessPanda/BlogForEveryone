const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

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

test('runPnpmDlxWithRetry uses Windows-safe cmd wrapper and env-based mirror fallback', () => {
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
        mirrorRegistry: 'https://registry.npmmirror.com',
        platform: 'win32'
    });

    const result = tools.runPnpmDlxWithRetry(['foo']);
    assert.equal(result.ok, true);
    assert.equal(result.retried, true);
    assert.equal(result.logs.some((item) => item.event === 'mirror-fallback'), true);
    assert.equal(calls.length, 2);
    assert.equal(path.basename(calls[0][0]).toLowerCase(), 'cmd.exe');
    assert.deepEqual(calls[0][1], ['/d', '/s', '/c', 'pnpm.cmd', 'dlx', 'foo']);
    assert.equal(calls[0][2].shell, false);
    assert.equal(path.basename(calls[1][0]).toLowerCase(), 'cmd.exe');
    assert.deepEqual(calls[1][1], ['/d', '/s', '/c', 'pnpm.cmd', 'dlx', 'foo']);
    assert.equal(calls[1][2].shell, false);
    assert.equal(calls[1][2].env.npm_config_registry, 'https://registry.npmmirror.com');
});

test('runPnpmDlxWithRetry keeps mirror fallback out of pnpm argv and preserves existing env', () => {
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
        mirrorRegistry: 'https://registry.npmmirror.com',
        platform: 'win32'
    });

    const result = tools.runPnpmDlxWithRetry(['foo'], {
        env: {
            EXISTING_ENV: 'kept'
        }
    });
    assert.equal(result.ok, true);
    assert.equal(result.retried, true);
    assert.equal(calls.some((call) => call[1][0] === 'config'), false);
    assert.equal(calls[1][1].slice(3).includes('--registry'), false);
    assert.deepEqual(calls[1][1].slice(0, 4), ['/d', '/s', '/c', 'pnpm.cmd']);
    assert.equal(calls[1][2].env.EXISTING_ENV, 'kept');
    assert.equal(calls[1][2].env.npm_config_registry, 'https://registry.npmmirror.com');
});
