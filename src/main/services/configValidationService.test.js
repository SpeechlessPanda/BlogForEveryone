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

test('validateGithubImportPayload rejects backup repository URL when repo name is not fixed BFE', () => {
    const result = validateGithubImportPayload({
        localDestinationPath: '/tmp/import-target',
        backupRepoUrl: 'https://github.com/alice/not-bfe.git'
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, RESULT_CODES.validationFailed);
    assert.equal(result.category, RESULT_CATEGORIES.validation);
    assert.equal(result.causes.length, 1);
    assert.equal(result.causes[0].key, 'backup_repo_name_invalid');
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
