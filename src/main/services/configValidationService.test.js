const test = require('node:test');
const assert = require('node:assert/strict');

const {
    validateGithubImportPayload,
    validateGithubImportRepositoryState
} = require('./configValidationService');
const { RESULT_CODES, RESULT_CATEGORIES } = require('../../shared/operationResultContract');

test('validateGithubImportPayload rejects non-absolute destination before clone/import', () => {
    const result = validateGithubImportPayload({
        localDestinationPath: 'relative/path',
        backupRepoUrl: 'https://github.com/alice/BFE.git'
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, RESULT_CODES.validationFailed);
    assert.equal(result.category, RESULT_CATEGORIES.validation);
    assert.equal(result.causes.length, 1);
    assert.equal(result.causes[0].key, 'destination_path_invalid');
});

test('validateGithubImportPayload accepts non-BFE backup repository URL and keeps parsed owner/name', () => {
    const result = validateGithubImportPayload({
        localDestinationPath: '/tmp/import-target',
        backupRepoUrl: 'https://github.com/alice/my-archive.git'
    });

    assert.equal(result.ok, true);
    assert.equal(result.normalizedPayload.backupRepo.owner, 'alice');
    assert.equal(result.normalizedPayload.backupRepo.name, 'my-archive');
    assert.equal(result.normalizedPayload.backupRepo.url, 'https://github.com/alice/my-archive.git');
});

test('validateGithubImportRepositoryState rejects deploy-exists-but-backup-missing state', () => {
    const result = validateGithubImportRepositoryState({
        hasDeployRepo: true,
        hasBackupRepo: false
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, RESULT_CODES.validationFailed);
    assert.equal(result.category, RESULT_CATEGORIES.validation);
    assert.equal(result.causes.length, 1);
    assert.equal(result.causes[0].key, 'github_import_backup_missing');
});

test('validateGithubImportRepositoryState allows backup-present import even when deploy is missing', () => {
    const result = validateGithubImportRepositoryState({
        hasDeployRepo: false,
        hasBackupRepo: true
    });

    assert.deepEqual(result, {
        ok: true
    });
});
