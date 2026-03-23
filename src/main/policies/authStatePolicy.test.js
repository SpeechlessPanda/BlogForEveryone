const test = require('node:test');
const assert = require('node:assert/strict');

const { toRendererAuthState } = require('./authStatePolicy');

test('maps token-bearing auth record to renderer-safe account summary', () => {
    const authRecord = {
        reauthRequired: false,
        permissionSummary: {
            canReadProfile: true,
            canPublishToGithub: true
        },
        user: {
            id: 1,
            login: 'alice',
            name: 'Alice',
            avatarUrl: 'https://example.com/avatar.png',
            htmlUrl: 'https://github.com/alice',
            email: 'alice@example.com'
        },
        loggedInAt: '2026-03-22T00:00:00.000Z'
    };

    const rendererState = toRendererAuthState(authRecord);

    assert.deepEqual(rendererState, {
        isLoggedIn: true,
        account: {
            id: 1,
            login: 'alice',
            name: 'Alice',
            avatarUrl: 'https://example.com/avatar.png',
            htmlUrl: 'https://github.com/alice'
        },
        permissionSummary: {
            canReadProfile: true,
            canPublishToGithub: true
        },
        reauthRequired: false
    });
    assert.equal('accessToken' in rendererState, false);
    assert.equal('tokenType' in rendererState, false);
    assert.equal('scope' in rendererState, false);
});

test('returns logged-out renderer state when auth record is missing', () => {
    assert.deepEqual(toRendererAuthState(null), {
        isLoggedIn: false,
        account: null,
        permissionSummary: null,
        reauthRequired: false
    });
});

test('marks reauth required auth record as not logged-in', () => {
    const rendererState = toRendererAuthState({
        user: {
            id: 2,
            login: 'bob'
        },
        permissionSummary: {
            canReadProfile: true,
            canPublishToGithub: false
        },
        reauthRequired: true
    });

    assert.equal(rendererState.isLoggedIn, false);
    assert.equal(rendererState.reauthRequired, true);
    assert.deepEqual(rendererState.account, {
        id: 2,
        login: 'bob',
        name: undefined,
        avatarUrl: undefined,
        htmlUrl: undefined
    });
});
