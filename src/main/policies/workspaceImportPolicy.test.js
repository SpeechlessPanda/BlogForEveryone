const test = require('node:test');
const assert = require('node:assert/strict');

const { assertSupportedImportedFramework } = require('./workspaceImportPolicy');

test('assertSupportedImportedFramework rejects unknown imports', () => {
    assert.throws(
        () => assertSupportedImportedFramework('unknown'),
        /不支持/
    );
});

test('assertSupportedImportedFramework allows hexo/hugo imports', () => {
    assert.equal(assertSupportedImportedFramework('hexo'), 'hexo');
    assert.equal(assertSupportedImportedFramework('hugo'), 'hugo');
});
