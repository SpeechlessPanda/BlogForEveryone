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
