const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

function loadVerifyModuleForTests() {
    const filePath = path.join(__dirname, 'e2e-real-workspace-verify.js');
    const original = fs.readFileSync(filePath, 'utf8');
    const instrumented = original.replace(
        /main\(\)\.catch\([\s\S]*?\);\s*$/,
        'module.exports = { checkMarkers };\n'
    );

    const mod = new Module(filePath, module);
    mod.filename = filePath;
    mod.paths = Module._nodeModulePaths(path.dirname(filePath));
    mod._compile(instrumented, filePath);
    return mod.exports;
}

test('landscape marker verification accepts theme_config.banner background config', async () => {
    const { checkMarkers } = loadVerifyModuleForTests();
    const projectDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bfe-landscape-verify-'));

    try {
        fs.mkdirSync(path.join(projectDir, 'public'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'layouts', 'partials'), { recursive: true });
        fs.writeFileSync(path.join(projectDir, '_config.yml'), [
            'theme: landscape',
            'theme_config:',
            '  favicon: /img/e2e-favicon.jpg',
            '  banner: /img/e2e-bg.jpg'
        ].join('\n'));
        fs.writeFileSync(path.join(projectDir, 'public', 'index.html'), '<html><body>landscape</body></html>');
        fs.writeFileSync(path.join(projectDir, 'layouts', 'partials', 'extend_head.html'), '');

        const markers = checkMarkers({
            projectDir,
            framework: 'hexo',
            themeId: 'landscape'
        });

        assert.equal(markers.backgroundOk, true);
    } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});
