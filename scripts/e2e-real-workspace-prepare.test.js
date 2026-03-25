const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

function loadPrepareModuleForTests() {
    const filePath = path.join(__dirname, 'e2e-real-workspace-prepare.js');
    const original = fs.readFileSync(filePath, 'utf8');
    const instrumented = original.replace(
        /main\(\)\.catch\([\s\S]*?\);\s*$/,
        'module.exports = { applyThemeSpecificConfig };\n'
    );

    const mod = new Module(filePath, module);
    mod.filename = filePath;
    mod.paths = Module._nodeModulePaths(path.dirname(filePath));
    mod._compile(instrumented, filePath);
    return mod.exports;
}

test('landscape prepare config uses theme-specific banner and favicon keys', () => {
    const { applyThemeSpecificConfig } = loadPrepareModuleForTests();
    const config = {};

    applyThemeSpecificConfig(
        config,
        { framework: 'hexo', themeId: 'landscape' },
        {
            background: '/img/e2e-bg.jpg',
            favicon: '/img/e2e-favicon.jpg',
            avatar: '/img/e2e-avatar.jpg'
        }
    );

    assert.equal(config.theme_config?.banner, '/img/e2e-bg.jpg');
    assert.equal(config.theme_config?.favicon, '/img/e2e-favicon.jpg');
    assert.equal(config.theme_config?.background_image, undefined);
    assert.equal(config.favicon, undefined);
});
