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
