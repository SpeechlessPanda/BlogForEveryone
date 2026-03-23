const test = require('node:test');
const assert = require('node:assert/strict');

const { MIRROR_REGISTRY, getWingetPackageIds } = require('./registryPolicy');

test('MIRROR_REGISTRY remains the expected fallback URL', () => {
    assert.equal(MIRROR_REGISTRY, 'https://registry.npmmirror.com');
});

test('getWingetPackageIds returns expected mappings', () => {
    assert.deepEqual(getWingetPackageIds('git'), ['Git.Git']);
    assert.deepEqual(getWingetPackageIds('node'), ['OpenJS.NodeJS.LTS']);
    assert.deepEqual(getWingetPackageIds('hugo'), ['Hugo.Hugo.Extended', 'Hugo.Hugo']);
    assert.deepEqual(getWingetPackageIds('hugo-extended'), ['Hugo.Hugo.Extended']);
    assert.equal(getWingetPackageIds('pnpm'), null);
});
