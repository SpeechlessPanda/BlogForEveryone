const test = require('node:test');
const assert = require('node:assert/strict');

const { createGithubAuthStorage, normalizeStoreState } = require('./storeService');
const {
    FIXED_BACKUP_REPO_NAME,
    REMOTE_SITE_TYPES,
    REMOTE_IMPORT_SOURCES,
    REMOTE_REPO_VISIBILITY,
    REMOTE_REPO_SOURCE_TYPES,
    hydrateWorkspaceRemoteMetadata
} = require('../../shared/remoteWorkspaceContract');
const {
    RESULT_CATEGORIES,
    RESULT_CODES,
    COMBINED_OPERATION_STATUS
} = require('../../shared/operationResultContract');

function createInMemoryStore(initialState = {}) {
    const state = initialState;
    return {
        getState() {
            return state;
        },
        readStore() {
            return state;
        },
        updateStore(mutator) {
            const next = mutator(state) || state;
            Object.assign(state, next);
            return state;
        }
    };
}

test('shared remote workspace contract keeps backup repo name and url from provided metadata', () => {
    assert.equal(FIXED_BACKUP_REPO_NAME, 'BFE');
    const normalized = hydrateWorkspaceRemoteMetadata({
        backupRepo: {
            owner: 'alice',
            name: 'custom-backup-repo',
            url: 'https://github.com/alice/custom-backup-repo',
            visibility: REMOTE_REPO_VISIBILITY.private,
            sourceType: REMOTE_REPO_SOURCE_TYPES.existing
        }
    });

    assert.equal(normalized.backupRepo.name, 'custom-backup-repo');
    assert.equal(normalized.backupRepo.url, 'https://github.com/alice/custom-backup-repo');
    assert.equal(normalized.backupRepo.owner, 'alice');
    assert.equal(normalized.backupRepo.visibility, REMOTE_REPO_VISIBILITY.private);
    assert.equal(normalized.backupRepo.sourceType, REMOTE_REPO_SOURCE_TYPES.existing);
});

test('shared remote workspace contract preserves unknown backup URL forms and backup name', () => {
    const normalized = hydrateWorkspaceRemoteMetadata({
        backupRepo: {
            owner: 'alice',
            name: 'custom-backup-repo',
            url: 'https://git.example.com/alice/custom-backup-repo',
            visibility: REMOTE_REPO_VISIBILITY.private,
            sourceType: REMOTE_REPO_SOURCE_TYPES.existing
        }
    });

    assert.equal(normalized.backupRepo.name, 'custom-backup-repo');
    assert.equal(normalized.backupRepo.url, 'https://git.example.com/alice/custom-backup-repo');
});

test('shared remote workspace contract preserves common GitHub SSH backup URL forms', () => {
    const normalized = hydrateWorkspaceRemoteMetadata({
        backupRepo: {
            owner: 'alice',
            name: 'wrong-name',
            url: 'git@github.com:alice/not-bfe.git'
        }
    });

    assert.equal(normalized.backupRepo.name, 'wrong-name');
    assert.equal(normalized.backupRepo.url, 'git@github.com:alice/not-bfe.git');
});

test('shared operation result contract exposes fixed constants for code/category/combined status', () => {
    assert.equal(RESULT_CODES.ok, 'ok');
    assert.equal(RESULT_CODES.validationFailed, 'validation_failed');
    assert.equal(RESULT_CATEGORIES.validation, 'validation');
    assert.equal(RESULT_CATEGORIES.runtime, 'runtime');
    assert.deepEqual(COMBINED_OPERATION_STATUS, {
        success: 'success',
        partialSuccess: 'partial_success',
        failed: 'failed'
    });
});

test('workspace persistence stores and hydrates remote metadata fields', () => {
    const normalizedStore = normalizeStoreState({
        workspaces: [
            {
            id: 'ws-1',
            name: 'My Blog',
            projectDir: 'C:/blogs/my-blog',
            framework: 'hugo',
            theme: 'stack',
            siteType: REMOTE_SITE_TYPES.userPages,
            deployRepo: {
                owner: 'alice',
                name: 'alice.github.io',
                url: 'https://github.com/alice/alice.github.io',
                visibility: REMOTE_REPO_VISIBILITY.public,
                sourceType: REMOTE_REPO_SOURCE_TYPES.autoCreated
            },
            backupRepo: {
                owner: 'alice',
                name: 'ignored-by-contract',
                url: 'https://github.com/alice/ignored-by-contract',
                visibility: REMOTE_REPO_VISIBILITY.private,
                sourceType: REMOTE_REPO_SOURCE_TYPES.existing
            },
            importSource: REMOTE_IMPORT_SOURCES.githubRemote,
            localProjectPath: 'D:/imports/my-blog'
            }
        ]
    });

    const stored = normalizedStore.workspaces[0];
    assert.equal(stored.siteType, REMOTE_SITE_TYPES.userPages);
    assert.deepEqual(stored.deployRepo, {
        owner: 'alice',
        name: 'alice.github.io',
        url: 'https://github.com/alice/alice.github.io',
        visibility: REMOTE_REPO_VISIBILITY.public,
        sourceType: REMOTE_REPO_SOURCE_TYPES.autoCreated
    });
    assert.deepEqual(stored.backupRepo, {
        owner: 'alice',
        name: 'ignored-by-contract',
        url: 'https://github.com/alice/ignored-by-contract',
        visibility: REMOTE_REPO_VISIBILITY.private,
        sourceType: REMOTE_REPO_SOURCE_TYPES.existing
    });
    assert.equal(stored.importSource, REMOTE_IMPORT_SOURCES.githubRemote);
    assert.equal(stored.localProjectPath, 'D:/imports/my-blog');
});

test('workspace persistence backfills missing remote metadata into contract defaults', () => {
    const normalizedStore = normalizeStoreState({
        workspaces: [
            {
                id: 'legacy-1',
                name: 'Legacy Blog',
                projectDir: 'C:/legacy/site',
                framework: 'hexo',
                theme: 'landscape'
            }
        ]
    });

    const stored = normalizedStore.workspaces[0];
    assert.equal(stored.siteType, null);
    assert.deepEqual(stored.deployRepo, {
        owner: '',
        name: '',
        url: '',
        visibility: REMOTE_REPO_VISIBILITY.public,
        sourceType: REMOTE_REPO_SOURCE_TYPES.manualEntry
    });
    assert.deepEqual(stored.backupRepo, {
        owner: '',
        name: '',
        url: '',
        visibility: REMOTE_REPO_VISIBILITY.public,
        sourceType: REMOTE_REPO_SOURCE_TYPES.manualEntry
    });
    assert.equal(stored.importSource, REMOTE_IMPORT_SOURCES.localDirectory);
    assert.equal(stored.localProjectPath, 'C:/legacy/site');
});

test('workspace persistence normalizes invalid remote metadata values into contract defaults', () => {
    const normalizedStore = normalizeStoreState({
        workspaces: [
            {
                id: 'legacy-2',
                name: 'Legacy Invalid Blog',
                projectDir: 'C:/legacy/invalid',
                framework: 'hugo',
                theme: 'stack',
                siteType: 'broken-site-type',
                deployRepo: {
                    owner: 'alice',
                    name: 'repo-a',
                    url: 'https://github.com/alice/repo-a',
                    visibility: 'invalid-visibility',
                    sourceType: 'invalid-source-type'
                },
                backupRepo: {
                    owner: 'alice',
                    name: 'bad-backup-name',
                    url: 'https://github.com/alice/not-bfe.git',
                    visibility: 'invalid-visibility',
                    sourceType: 'invalid-source-type'
                },
                importSource: 'invalid-import-source',
                localProjectPath: null
            }
        ]
    });

    const stored = normalizedStore.workspaces[0];
    assert.equal(stored.siteType, null);
    assert.deepEqual(stored.deployRepo, {
        owner: 'alice',
        name: 'repo-a',
        url: 'https://github.com/alice/repo-a',
        visibility: REMOTE_REPO_VISIBILITY.public,
        sourceType: REMOTE_REPO_SOURCE_TYPES.manualEntry
    });
    assert.deepEqual(stored.backupRepo, {
        owner: 'alice',
        name: 'bad-backup-name',
        url: 'https://github.com/alice/not-bfe.git',
        visibility: REMOTE_REPO_VISIBILITY.public,
        sourceType: REMOTE_REPO_SOURCE_TYPES.manualEntry
    });
    assert.equal(stored.importSource, REMOTE_IMPORT_SOURCES.localDirectory);
    assert.equal(stored.localProjectPath, 'C:/legacy/invalid');
});

test('workspace persistence preserves unknown nested repo fields while normalizing known fields', () => {
    const normalizedStore = normalizeStoreState({
        workspaces: [
            {
                id: 'ws-preserve-unknown',
                name: 'Preserve Unknown',
                projectDir: 'C:/preserve/unknown',
                deployRepo: {
                    owner: 'alice',
                    name: 'deploy-target',
                    url: 'https://github.com/alice/deploy-target',
                    visibility: REMOTE_REPO_VISIBILITY.private,
                    sourceType: REMOTE_REPO_SOURCE_TYPES.existing,
                    branch: 'gh-pages',
                    mirrorStrategy: 'full'
                },
                backupRepo: {
                    owner: 'alice',
                    name: 'custom-backup-repo',
                    url: 'https://git.example.com/alice/custom-backup-repo',
                    visibility: REMOTE_REPO_VISIBILITY.private,
                    sourceType: REMOTE_REPO_SOURCE_TYPES.existing,
                    branch: 'main',
                    mirrorStrategy: 'incremental'
                }
            }
        ]
    });

    const stored = normalizedStore.workspaces[0];
    assert.equal(stored.deployRepo.branch, 'gh-pages');
    assert.equal(stored.deployRepo.mirrorStrategy, 'full');
    assert.equal(stored.backupRepo.branch, 'main');
    assert.equal(stored.backupRepo.mirrorStrategy, 'incremental');
    assert.equal(stored.backupRepo.name, 'custom-backup-repo');
    assert.equal(stored.backupRepo.url, 'https://git.example.com/alice/custom-backup-repo');
});

test('persists token material encrypted and retrieves it via secure helper', () => {
    const secureStorage = {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(`enc:${value}`, 'utf-8'),
        decryptString: (value) => Buffer.from(value).toString('utf-8').replace(/^enc:/, '')
    };
    const memory = createInMemoryStore({});
    const storage = createGithubAuthStorage({
        safeStorage: secureStorage,
        readStore: memory.readStore,
        updateStore: memory.updateStore
    });

    storage.saveGithubAuthSession({
        user: { id: 1, login: 'alice' },
        loggedInAt: '2026-03-23T00:00:00.000Z',
        permissionSummary: { canReadProfile: true, canPublishToGithub: true },
        tokenType: 'bearer',
        accessToken: 'secret-token',
        scope: 'repo read:user'
    });

    assert.equal(memory.getState().githubAuth.accessToken, undefined);
    assert.equal(memory.getState().githubAuth.tokenType, undefined);
    assert.equal(memory.getState().githubAuth.scope, undefined);
    assert.equal(typeof memory.getState().githubAuthSecure?.ciphertext, 'string');
    assert.equal(storage.readGithubAccessToken(), 'secret-token');
});

test('fails secure persistence when encryption is unavailable', () => {
    const secureStorage = {
        isEncryptionAvailable: () => false,
        encryptString: () => Buffer.from('nope', 'utf-8'),
        decryptString: () => ''
    };
    const memory = createInMemoryStore({});
    const storage = createGithubAuthStorage({
        safeStorage: secureStorage,
        readStore: memory.readStore,
        updateStore: memory.updateStore
    });

    assert.throws(() => {
        storage.saveGithubAuthSession({
            user: { id: 2, login: 'bob' },
            loggedInAt: '2026-03-23T00:00:00.000Z',
            permissionSummary: { canReadProfile: true, canPublishToGithub: false },
            tokenType: 'bearer',
            accessToken: 'secret-token',
            scope: 'read:user'
        });
    }, /安全凭据存储/);
});

test('marks legacy plaintext token records as reauth-required and scrubs token fields', () => {
    const secureStorage = {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(`enc:${value}`, 'utf-8'),
        decryptString: (value) => Buffer.from(value).toString('utf-8').replace(/^enc:/, '')
    };
    const memory = createInMemoryStore({
        githubAuth: {
            user: { id: 3, login: 'legacy' },
            loggedInAt: '2026-03-23T00:00:00.000Z',
            accessToken: 'legacy-secret',
            tokenType: 'bearer',
            scope: 'repo'
        }
    });
    const storage = createGithubAuthStorage({
        safeStorage: secureStorage,
        readStore: memory.readStore,
        updateStore: memory.updateStore
    });

    const record = storage.readGithubAuthRecord();
    assert.equal(record.reauthRequired, true);
    assert.equal(memory.getState().githubAuth.accessToken, undefined);
    assert.equal(memory.getState().githubAuth.tokenType, undefined);
    assert.equal(memory.getState().githubAuth.scope, undefined);
});

test('saveGithubAuthSession rejects empty access token payloads', () => {
    const secureStorage = {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(`enc:${value}`, 'utf-8'),
        decryptString: (value) => Buffer.from(value).toString('utf-8').replace(/^enc:/, '')
    };
    const memory = createInMemoryStore({});
    const storage = createGithubAuthStorage({
        safeStorage: secureStorage,
        readStore: memory.readStore,
        updateStore: memory.updateStore
    });

    assert.throws(() => storage.saveGithubAuthSession({ accessToken: '' }), /缺少 access token/);
});

test('readGithubAuthRecord returns null when no auth record exists', () => {
    const secureStorage = {
        isEncryptionAvailable: () => true,
        encryptString: () => Buffer.from('enc:{}', 'utf-8'),
        decryptString: () => '{}'
    };
    const memory = createInMemoryStore({});
    const storage = createGithubAuthStorage({
        safeStorage: secureStorage,
        readStore: memory.readStore,
        updateStore: memory.updateStore
    });

    assert.equal(storage.readGithubAuthRecord(), null);
});

test('readGithubAuthRecord requires reauth when secure token missing or encryption unavailable', () => {
    const secureStorage = {
        isEncryptionAvailable: () => false,
        encryptString: () => Buffer.from('enc:{}', 'utf-8'),
        decryptString: () => '{}'
    };
    const memory = createInMemoryStore({
        githubAuth: {
            user: { id: 9, login: 'reauth-user' },
            loggedInAt: '2026-03-23T00:00:00.000Z'
        },
        githubAuthSecure: {
            version: 1,
            ciphertext: '',
            updatedAt: '2026-03-23T00:00:00.000Z'
        }
    });
    const storage = createGithubAuthStorage({
        safeStorage: secureStorage,
        readStore: memory.readStore,
        updateStore: memory.updateStore
    });

    const record = storage.readGithubAuthRecord();
    assert.equal(record.reauthRequired, true);
    assert.deepEqual(record.user, { id: 9, login: 'reauth-user' });
});

test('readGithubAccessToken surfaces missing, unavailable, corrupted, and empty-token errors', () => {
    const base64 = Buffer.from(JSON.stringify({ accessToken: 'secure-token' }), 'utf-8').toString('base64');
    const secureStorage = {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value, 'utf-8'),
        decryptString: (value) => Buffer.from(value).toString('utf-8')
    };

    const missingSecureState = createInMemoryStore({ githubAuth: { user: { id: 1 } } });
    const missingSecureStorage = createGithubAuthStorage({
        safeStorage: secureStorage,
        readStore: missingSecureState.readStore,
        updateStore: missingSecureState.updateStore
    });
    assert.throws(() => missingSecureStorage.readGithubAccessToken(), /请先完成 GitHub 登录/);

    const unavailableStorage = createGithubAuthStorage({
        safeStorage: {
            isEncryptionAvailable: () => false,
            encryptString: secureStorage.encryptString,
            decryptString: secureStorage.decryptString
        },
        readStore: createInMemoryStore({ githubAuthSecure: { ciphertext: base64 } }).readStore,
        updateStore: createInMemoryStore({}).updateStore
    });
    assert.throws(() => unavailableStorage.readGithubAccessToken(), /不支持安全凭据存储解密/);

    const corruptedStorage = createGithubAuthStorage({
        safeStorage: {
            isEncryptionAvailable: () => true,
            encryptString: secureStorage.encryptString,
            decryptString: () => '{'
        },
        readStore: createInMemoryStore({ githubAuthSecure: { ciphertext: base64 } }).readStore,
        updateStore: createInMemoryStore({}).updateStore
    });
    assert.throws(() => corruptedStorage.readGithubAccessToken(), /安全凭据已损坏/);

    const emptyTokenStorage = createGithubAuthStorage({
        safeStorage: {
            isEncryptionAvailable: () => true,
            encryptString: secureStorage.encryptString,
            decryptString: () => JSON.stringify({ tokenType: 'bearer' })
        },
        readStore: createInMemoryStore({ githubAuthSecure: { ciphertext: base64 } }).readStore,
        updateStore: createInMemoryStore({}).updateStore
    });
    assert.throws(() => emptyTokenStorage.readGithubAccessToken(), /登录信息缺失/);
});

test('clearGithubAuthSession removes both auth records', () => {
    const secureStorage = {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(`enc:${value}`, 'utf-8'),
        decryptString: (value) => Buffer.from(value).toString('utf-8').replace(/^enc:/, '')
    };
    const memory = createInMemoryStore({
        githubAuth: { user: { id: 1, login: 'alice' } },
        githubAuthSecure: { version: 1, ciphertext: 'abc' }
    });
    const storage = createGithubAuthStorage({
        safeStorage: secureStorage,
        readStore: memory.readStore,
        updateStore: memory.updateStore
    });

    storage.clearGithubAuthSession();
    assert.equal(memory.getState().githubAuth, null);
    assert.equal(memory.getState().githubAuthSecure, null);
});
