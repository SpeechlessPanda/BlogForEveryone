const test = require('node:test');
const assert = require('node:assert/strict');

const { summarizeScope } = require('./githubAuthService');

test('summarizeScope supports whitespace-delimited scopes', () => {
    const summary = summarizeScope('repo read:user user:email');
    assert.deepEqual(summary, {
        canReadProfile: true,
        canPublishToGithub: true
    });
});

test('summarizeScope supports comma-delimited scopes', () => {
    const summary = summarizeScope('repo,read:user,user:email');
    assert.deepEqual(summary, {
        canReadProfile: true,
        canPublishToGithub: true
    });
});

test('summarizeScope supports mixed delimiters and still detects read-only profile scopes', () => {
    const summary = summarizeScope('read:user, user:email');
    assert.deepEqual(summary, {
        canReadProfile: true,
        canPublishToGithub: false
    });
});
