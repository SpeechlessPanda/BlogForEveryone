const test = require('node:test');
const assert = require('node:assert/strict');

const { createGithubAuthStorage } = require('./storeService');

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
