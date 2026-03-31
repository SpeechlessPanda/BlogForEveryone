const test = require('node:test');
const assert = require('node:assert/strict');

const {
    checkGitClean
} = require('./verify-git-clean.js');

test('checkGitClean reports clean when porcelain output is empty', () => {
    const result = checkGitClean({ statusOutput: '   \n\n' });
    assert.equal(result.ok, true);
    assert.equal(result.hasChanges, false);
});

test('checkGitClean reports dirty when porcelain output has entries', () => {
    const result = checkGitClean({ statusOutput: ' M src/main/main.js\n?? tmp.txt\n' });
    assert.equal(result.ok, false);
    assert.equal(result.hasChanges, true);
    assert.match(result.message, /Working tree is not clean/);
});
