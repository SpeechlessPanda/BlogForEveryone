const test = require('node:test');
const assert = require('node:assert/strict');

const {
    checkWindowsSigningEnv,
    WINDOWS_SIGNING_REQUIRED_ENV
} = require('./verify-windows-signing-env.js');

test('WINDOWS_SIGNING_REQUIRED_ENV exposes expected required keys', () => {
    assert.deepEqual(WINDOWS_SIGNING_REQUIRED_ENV, ['CSC_LINK', 'CSC_KEY_PASSWORD']);
});

test('checkWindowsSigningEnv returns missing keys when env vars absent', () => {
    const result = checkWindowsSigningEnv({});
    assert.equal(result.ok, false);
    assert.deepEqual(result.missing, ['CSC_LINK', 'CSC_KEY_PASSWORD']);
});

test('checkWindowsSigningEnv passes when required vars are non-empty', () => {
    const result = checkWindowsSigningEnv({
        CSC_LINK: 'file:///tmp/cert.p12',
        CSC_KEY_PASSWORD: 'secret'
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.missing, []);
});
