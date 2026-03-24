const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

function loadContentService() {
    const originalLoad = Module._load;
    const shellCalls = [];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'electron') {
            return {
                shell: {
                    openPath(filePath) {
                        shellCalls.push(filePath);
                        return '';
                    }
                }
            };
        }

        if (request === './publishService') {
            return {
                publishToGitHub() {
                    throw new Error('publishToGitHub should not be called in contentService tests');
                }
            };
        }

        return originalLoad(request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./contentService')];
        const service = require('./contentService');
        return { service, shellCalls };
    } finally {
        Module._load = originalLoad;
    }
}

test('Hexo about page uses canonical path and remains listable', (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-content-hexo-'));
    t.after(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const { service, shellCalls } = loadContentService();
    const expectedPath = path.join(tempDir, 'source', 'about', 'index.md');

    const result = service.createAndOpenContent({
        projectDir: tempDir,
        framework: 'hexo',
        type: 'about',
        title: '关于我们',
        slug: 'company-about'
    });

    assert.equal(result.filePath, expectedPath);
    assert.deepEqual(shellCalls, [expectedPath]);

    const list = service.listExistingContents({
        projectDir: tempDir,
        framework: 'hexo'
    });

    assert.equal(list.length, 1);
    assert.equal(list[0].relativePath, 'source/about/index.md');
    assert.equal(list[0].type, 'about');
});

test('Hugo links page uses canonical path and keeps special-page type', (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-content-hugo-'));
    t.after(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const { service, shellCalls } = loadContentService();
    const expectedPath = path.join(tempDir, 'content', 'links', 'index.md');

    const result = service.createAndOpenContent({
        projectDir: tempDir,
        framework: 'hugo',
        type: 'links',
        title: '友情链接',
        slug: 'partners'
    });

    assert.equal(result.filePath, expectedPath);
    assert.deepEqual(shellCalls, [expectedPath]);

    const list = service.listExistingContents({
        projectDir: tempDir,
        framework: 'hugo'
    });

    assert.equal(list.length, 1);
    assert.equal(list[0].relativePath, 'content/links/index.md');
    assert.equal(list[0].type, 'links');
});
