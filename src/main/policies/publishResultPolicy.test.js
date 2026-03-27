const test = require('node:test');
const assert = require('node:assert/strict');
const { RESULT_CODES, RESULT_CATEGORIES } = require('../../shared/operationResultContract');

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

test('combined envelope keeps child outcomes and marks status success when deploy and backup both succeed', () => {
    const result = normalizePublishResult({
        deployRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
        backupRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
        deployPublish: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
        backupPush: { ok: true, code: 'ok', category: 'runtime', userMessage: '' }
    });

    assert.equal(result.status, 'success');
    assert.equal(result.ok, true);
    assert.equal(result.deployRepoEnsure.ok, true);
    assert.equal(result.backupRepoEnsure.ok, true);
    assert.equal(result.deployPublish.ok, true);
    assert.equal(result.backupPush.ok, true);
});

test('combined envelope marks partial_success when only one of deploy/backup execution fails', () => {
    const deployOnly = normalizePublishResult({
        deployRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
        backupRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
        deployPublish: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
        backupPush: { ok: false, code: 'runtime_error', category: 'runtime', userMessage: 'backup failed' }
    });

    assert.equal(deployOnly.status, 'partial_success');
    assert.equal(deployOnly.ok, false);
    assert.equal(deployOnly.reason, undefined);
    assert.equal(deployOnly.backupPush.ok, false);

    const backupOnly = normalizePublishResult({
        deployRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
        backupRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
        deployPublish: { ok: false, code: 'runtime_error', category: 'runtime', userMessage: 'deploy failed' },
        backupPush: { ok: true, code: 'ok', category: 'runtime', userMessage: '' }
    });

    assert.equal(backupOnly.status, 'partial_success');
    assert.equal(backupOnly.ok, false);
    assert.equal(backupOnly.reason, undefined);
    assert.equal(backupOnly.deployPublish.ok, false);
});

test('combined envelope marks failed when an ensure/create step fails before execution', () => {
    const result = normalizePublishResult({
        deployRepoEnsure: { ok: false, code: 'conflict', category: 'conflict', userMessage: 'deploy ensure failed' },
        backupRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
        deployPublish: { ok: false, code: 'runtime_error', category: 'runtime', userMessage: 'deploy skipped' },
        backupPush: { ok: false, code: 'runtime_error', category: 'runtime', userMessage: 'backup skipped' }
    });

    assert.equal(result.status, 'failed');
    assert.equal(result.ok, false);
    assert.equal(result.deployRepoEnsure.ok, false);
});

test('combined envelope fallback child outcomes use shared result constants', () => {
    const result = normalizePublishResult({
        deployRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' }
    });

    assert.equal(result.status, 'failed');
    assert.equal(result.ok, false);
    assert.equal(result.deployRepoEnsure.code, 'ok');
    assert.equal(result.deployRepoEnsure.category, 'runtime');
    assert.equal(result.backupRepoEnsure.code, RESULT_CODES.runtimeError);
    assert.equal(result.backupRepoEnsure.category, RESULT_CATEGORIES.runtime);
    assert.equal(result.deployPublish.code, RESULT_CODES.runtimeError);
    assert.equal(result.deployPublish.category, RESULT_CATEGORIES.runtime);
    assert.equal(result.backupPush.code, RESULT_CODES.runtimeError);
    assert.equal(result.backupPush.category, RESULT_CATEGORIES.runtime);
});
