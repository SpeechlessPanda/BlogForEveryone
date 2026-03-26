const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { EventEmitter } = require('events');

const themeService = require('./themeService');

function createMockChildProcess(result) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    queueMicrotask(() => {
        if (result.stdout) {
            child.stdout.emit('data', Buffer.from(result.stdout));
        }
        if (result.stderr) {
            child.stderr.emit('data', Buffer.from(result.stderr));
        }
        child.emit('close', result.status ?? 0);
    });

    return child;
}

function withThemeServiceMocks({ spawnImpl, platform = 'win32', comspec = 'C:/Windows/System32/cmd.exe' }) {
    const originalLoad = Module._load;
    const originalPlatform = process.platform;
    const originalComSpec = process.env.ComSpec;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return {
                spawn: spawnImpl
            };
        }
        return originalLoad.apply(this, arguments);
    };

    Object.defineProperty(process, 'platform', {
        value: platform,
        configurable: true
    });
    process.env.ComSpec = comspec;

    delete require.cache[require.resolve('./themeService')];
    const mockedThemeService = require('./themeService');

    return {
        themeService: mockedThemeService,
        restore() {
            Module._load = originalLoad;
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                configurable: true
            });

            if (originalComSpec === undefined) {
                delete process.env.ComSpec;
            } else {
                process.env.ComSpec = originalComSpec;
            }

            delete require.cache[require.resolve('./themeService')];
        }
    };
}

test('infers recognized Hexo theme id from project config', (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-hexo-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    fs.writeFileSync(path.join(projectDir, '_config.yml'), 'theme: next\n', 'utf-8');

    const inferred = themeService.inferRecognizedThemeIdFromProject(projectDir, 'hexo');
    assert.equal(inferred, 'next');
});

test('returns unknown for unrecognized imported theme', (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-unknown-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    fs.writeFileSync(path.join(projectDir, 'hugo.toml'), 'theme = "some-random-theme"\n', 'utf-8');

    const inferred = themeService.inferRecognizedThemeIdFromProject(projectDir, 'hugo');
    assert.equal(inferred, 'unknown');
});

test('installAndApplyTheme uses Windows-safe runner and env-based mirror fallback for Hexo theme install', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-install-hexo-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });
    fs.writeFileSync(path.join(projectDir, '_config.yml'), 'theme: landscape\n', 'utf-8');

    const spawnCalls = [];
    const scripted = [
        { status: 1, stdout: '', stderr: 'first failed' },
        { status: 0, stdout: 'ok', stderr: '' }
    ];
    const mocked = withThemeServiceMocks({
        spawnImpl: (...args) => {
            spawnCalls.push(args);
            return createMockChildProcess(scripted.shift() || { status: 0, stdout: '', stderr: '' });
        }
    });
    t.after(() => mocked.restore());

    const result = await mocked.themeService.installAndApplyTheme({
        projectDir,
        framework: 'hexo',
        themeId: 'next'
    });

    assert.equal(result.ok, true);
    assert.equal(path.basename(spawnCalls[0][0]).toLowerCase(), 'cmd.exe');
    assert.deepEqual(spawnCalls[0][1], ['/d', '/s', '/c', 'pnpm.cmd', 'add', 'hexo-theme-next']);
    assert.equal(spawnCalls[0][2].shell, false);
    assert.equal(spawnCalls[0][2].windowsHide, true);
    assert.equal(path.basename(spawnCalls[1][0]).toLowerCase(), 'cmd.exe');
    assert.deepEqual(spawnCalls[1][1], ['/d', '/s', '/c', 'pnpm.cmd', 'add', 'hexo-theme-next']);
    assert.equal(spawnCalls[1][2].shell, false);
    assert.equal(spawnCalls[1][2].windowsHide, true);
    assert.equal(spawnCalls[1][2].env.npm_config_registry, 'https://registry.npmmirror.com');
    assert.equal(spawnCalls.some((call) => call[1].includes('config')), false);
});

test('installAndApplyTheme uses Windows-safe runner and env-based mirror fallback for Hugo theme install', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-install-hugo-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });
    fs.writeFileSync(path.join(projectDir, 'hugo.toml'), 'theme = "PaperMod"\n', 'utf-8');

    const spawnCalls = [];
    const scripted = [
        { status: 1, stdout: '', stderr: 'first failed' },
        { status: 0, stdout: 'ok', stderr: '' }
    ];
    const mocked = withThemeServiceMocks({
        spawnImpl: (...args) => {
            spawnCalls.push(args);
            return createMockChildProcess(scripted.shift() || { status: 0, stdout: '', stderr: '' });
        }
    });
    t.after(() => mocked.restore());

    const result = await mocked.themeService.installAndApplyTheme({
        projectDir,
        framework: 'hugo',
        themeId: 'papermod'
    });

    assert.equal(result.ok, true);
    assert.equal(path.basename(spawnCalls[0][0]).toLowerCase(), 'cmd.exe');
    assert.deepEqual(
        spawnCalls[0][1],
        ['/d', '/s', '/c', 'pnpm.cmd', 'dlx', 'degit', 'github.com/adityatelange/hugo-PaperMod', 'themes/PaperMod']
    );
    assert.equal(spawnCalls[0][2].shell, false);
    assert.equal(spawnCalls[0][2].windowsHide, true);
    assert.equal(path.basename(spawnCalls[1][0]).toLowerCase(), 'cmd.exe');
    assert.deepEqual(
        spawnCalls[1][1],
        ['/d', '/s', '/c', 'pnpm.cmd', 'dlx', 'degit', 'github.com/adityatelange/hugo-PaperMod', 'themes/PaperMod']
    );
    assert.equal(spawnCalls[1][2].shell, false);
    assert.equal(spawnCalls[1][2].windowsHide, true);
    assert.equal(spawnCalls[1][2].env.npm_config_registry, 'https://registry.npmmirror.com');
    assert.equal(spawnCalls.some((call) => call[1].includes('config')), false);
});

test('inferRecognizedThemeIdFromProject returns unknown when framework context is invalid', () => {
    assert.equal(themeService.inferRecognizedThemeIdFromProject('', 'hexo'), 'unknown');
    assert.equal(themeService.inferRecognizedThemeIdFromProject('/tmp/demo', ''), 'unknown');
    assert.equal(themeService.inferRecognizedThemeIdFromProject('/tmp/demo', 'unknown'), 'unknown');
});

test('inferRecognizedThemeIdFromProject returns unknown when config has no theme value', (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-empty-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    fs.writeFileSync(path.join(projectDir, '_config.yml'), 'title: demo\n', 'utf-8');
    assert.equal(themeService.inferRecognizedThemeIdFromProject(projectDir, 'hexo'), 'unknown');
});

test('installAndApplyTheme returns skipped result when themeId is empty', async () => {
    const result = await themeService.installAndApplyTheme({
        projectDir: '/tmp/unused',
        framework: 'hexo',
        themeId: ''
    });

    assert.deepEqual(result, { ok: true, skipped: true, logs: [] });
});

test('installAndApplyTheme rejects unsupported framework', async () => {
    const result = await themeService.installAndApplyTheme({
        projectDir: '/tmp/unused',
        framework: 'jekyll',
        themeId: 'minimal'
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'UNSUPPORTED_FRAMEWORK');
});

test('installAndApplyTheme rejects unsupported theme ids for each framework', async () => {
    const hexoResult = await themeService.installAndApplyTheme({
        projectDir: '/tmp/unused',
        framework: 'hexo',
        themeId: 'missing-theme'
    });
    const hugoResult = await themeService.installAndApplyTheme({
        projectDir: '/tmp/unused',
        framework: 'hugo',
        themeId: 'missing-theme'
    });

    assert.equal(hexoResult.reason, 'UNSUPPORTED_THEME');
    assert.equal(hugoResult.reason, 'UNSUPPORTED_THEME');
});

test('installAndApplyTheme applies built-in Hexo landscape without invoking package install', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-landscape-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });
    fs.writeFileSync(path.join(projectDir, '_config.yml'), 'theme: next\n', 'utf-8');

    const result = await themeService.installAndApplyTheme({
        projectDir,
        framework: 'hexo',
        themeId: 'landscape'
    });

    assert.equal(result.ok, true);
    assert.equal(result.theme, 'landscape');
    assert.equal(result.logs.some((entry) => String(entry.command || '').includes('pnpm')), false);
    const nextConfig = fs.readFileSync(path.join(projectDir, '_config.yml'), 'utf-8');
    assert.match(nextConfig, /theme: landscape/);
});

test('installAndApplyTheme skips Hugo download when theme directory already exists', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-hugo-existing-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });
    fs.writeFileSync(path.join(projectDir, 'hugo.toml'), 'theme = "PaperMod"\n', 'utf-8');
    fs.mkdirSync(path.join(projectDir, 'themes', 'Mainroad'), { recursive: true });

    const result = await themeService.installAndApplyTheme({
        projectDir,
        framework: 'hugo',
        themeId: 'mainroad'
    });

    assert.equal(result.ok, true);
    assert.equal(result.theme, 'Mainroad');
    assert.equal(result.logs.some((entry) => String(entry.message || '').includes('跳过下载')), true);
});

test('readThemeConfig and saveThemeConfig cover file selection branches', (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-config-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    assert.deepEqual(themeService.readThemeConfig(projectDir, 'hexo'), {});
    assert.deepEqual(themeService.readThemeConfig(projectDir, 'hugo'), {});

    themeService.saveThemeConfig(projectDir, 'hexo', { theme: 'next' });
    const hexoRead = themeService.readThemeConfig(projectDir, 'hexo');
    assert.equal(hexoRead.theme, 'next');

    themeService.saveThemeConfig(projectDir, 'hugo', { theme: 'PaperMod', title: 'demo' });
    const hugoReadFromConfig = themeService.readThemeConfig(projectDir, 'hugo');
    assert.equal(hugoReadFromConfig.theme, 'PaperMod');

    fs.writeFileSync(path.join(projectDir, 'hugo.toml'), 'theme = "Mainroad"\n', 'utf-8');
    themeService.saveThemeConfig(projectDir, 'hugo', { theme: 'hugo-theme-stack', title: 'demo-2' });
    const hugoReadFromHugoToml = themeService.readThemeConfig(projectDir, 'hugo');
    assert.equal(hugoReadFromHugoToml.theme, 'hugo-theme-stack');

    assert.deepEqual(themeService.readThemeConfig(projectDir, 'other'), {});
});

test('saveLocalAssetToBlog throws when local file is missing', () => {
    assert.throws(() => {
        themeService.saveLocalAssetToBlog({
            projectDir: '/tmp/unused',
            framework: 'hexo',
            localFilePath: '/tmp/not-exists-demo.png'
        });
    }, /本地资源文件不存在/);
});

test('saveLocalAssetToBlog saves asset with fallback and preferred path rules', (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-asset-'));
    const sourceFile = path.join(projectDir, 'source-image.png');
    fs.writeFileSync(sourceFile, 'image', 'utf-8');
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    const hexoResult = themeService.saveLocalAssetToBlog({
        projectDir,
        framework: 'hexo',
        localFilePath: sourceFile,
        preferredFileName: 'banner*invalid'
    });

    const hugoResult = themeService.saveLocalAssetToBlog({
        projectDir,
        framework: 'hugo',
        localFilePath: sourceFile,
        preferredDir: '../assets\\images',
        preferredFileName: 'favicon'
    });

    assert.equal(fs.existsSync(hexoResult.savedPath), true);
    assert.match(hexoResult.webPath, /^\/img\//);
    assert.equal(path.basename(hexoResult.savedPath).includes('*'), false);

    assert.equal(fs.existsSync(hugoResult.savedPath), true);
    assert.match(hugoResult.webPath, /^\/assets\/images\/favicon\.png$/);
});

test('applyPreviewOverrides skips non-hugo payload and writes/updates papermod artifacts', (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-preview-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    const skipped = themeService.applyPreviewOverrides({
        projectDir,
        framework: 'hexo',
        themeId: 'next',
        favicon: '/img/icon.png',
        backgroundImage: '/img/bg.png'
    });
    assert.deepEqual(skipped, { ok: true, skipped: true });

    const first = themeService.applyPreviewOverrides({
        projectDir,
        framework: 'hugo',
        themeId: 'papermod',
        favicon: '/img/favicon.png',
        backgroundImage: '/img/bg.png'
    });

    assert.equal(first.ok, true);
    assert.equal(fs.existsSync(first.partialPath), true);
    assert.equal(fs.existsSync(first.generatedCssPath), true);
    assert.deepEqual(first.applied, { backgroundImage: true, favicon: true });

    const second = themeService.applyPreviewOverrides({
        projectDir,
        framework: 'hugo',
        themeId: 'papermod',
        favicon: '/img/favicon.png',
        backgroundImage: ''
    });

    assert.equal(second.ok, true);
    assert.equal(fs.existsSync(second.generatedCssPath), false);

    const partial = fs.readFileSync(first.partialPath, 'utf-8');
    assert.equal(partial.includes('bfe-preview-overrides:start'), true);
    assert.equal(partial.includes('/img/favicon.png'), true);
});
