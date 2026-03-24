const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePublishResult } = require('./publishResultPolicy');

test('marks actions publish result as failed when any git command exits non-zero', () => {
    const result = normalizePublishResult({
        mode: 'actions',
        pagesUrl: 'https://example.github.io/',
        logs: [
            { bin: 'git', args: ['init'], code: 0, stdout: 'ok', stderr: '' },
            { bin: 'git', args: ['push', '-u', 'origin', 'main'], code: 1, stdout: '', stderr: 'permission denied' }
        ]
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'PUBLISH_GIT_COMMAND_FAILED');
    assert.equal(result.mode, 'actions');
    assert.equal(result.pagesUrl, '');
    assert.match(result.message, /git/i);
});

test('keeps actions publish result successful when all git commands succeed', () => {
    const result = normalizePublishResult({
        mode: 'actions',
        pagesUrl: 'https://example.github.io/',
        logs: [
            { bin: 'git', args: ['init'], code: 0, stdout: 'ok', stderr: '' },
            { bin: 'git', args: ['push', '-u', 'origin', 'main'], code: 0, stdout: 'ok', stderr: '' }
        ]
    });

    assert.equal(result.ok, true);
    assert.equal(result.mode, 'actions');
    assert.equal(result.pagesUrl, 'https://example.github.io/');
});

test('marks actions publish result as failed when git command exits with null code and error', () => {
    const result = normalizePublishResult({
        mode: 'actions',
        pagesUrl: 'https://example.github.io/',
        logs: [
            { bin: 'git', args: ['init'], code: 0, stdout: 'ok', stderr: '' },
            { bin: 'git', args: ['push', '-u', 'origin', 'main'], code: null, error: { message: 'spawn git ENOENT' }, stdout: '', stderr: '' }
        ]
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'PUBLISH_GIT_COMMAND_FAILED');
    assert.equal(result.pagesUrl, '');
});
