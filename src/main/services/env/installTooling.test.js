const test = require('node:test');
const assert = require('node:assert/strict');

const { createInstallToolingService } = require('./installTooling');

test('openInstaller blocks unsupported installer target', () => {
    const svc = createInstallToolingService({
        evaluateExternalUrlImpl: () => ({ allowed: true, normalizedUrl: 'https://example.com' }),
        externalUrlRules: { installer: {} },
        shellImpl: { openExternal: () => {} }
    });

    assert.throws(() => svc.openInstaller('pnpm'), /Unsupported installer target/);
});

test('ensureFrameworkEnvironment reports unsupported framework', () => {
    const svc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ nodeInstalled: true, gitInstalled: true, pnpmInstalled: true, wingetInstalled: true }),
        resolveExecutableImpl: () => '',
        resolveHugoExecutableImpl: () => '',
        autoInstallToolWithWingetImpl: () => ({ ok: false, logs: [] }),
        ensurePnpmImpl: () => ({ ok: true, logs: [] }),
        ensureDartSassImpl: () => ({ ok: true, logs: [] })
    });

    const result = svc.ensureFrameworkEnvironment('jekyll');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'UNSUPPORTED_FRAMEWORK');
});

test('getHugoExecutionEnv reuses direct sass executable on non-windows', () => {
    const svc = createInstallToolingService({
        processImpl: { platform: 'linux', env: { PATH: '/usr/bin' }, cwd: () => '/tmp' },
        resolveExecutableImpl: (command) => (command === 'sass' ? 'sass' : ''),
        shellImpl: { openExternal: () => {} }
    });

    const result = svc.getHugoExecutionEnv();

    assert.equal(result.ok, true);
    assert.equal(result.env.PATH, '/usr/bin');
    assert.ok(result.logs.some((entry) => entry.mode === 'direct' && entry.executable === 'sass'));
});

test('ensureDartSass uses the resolved pnpm executable path on Windows', () => {
    let sassInstalled = false;
    const runCommandCalls = [];
    const pnpmExecutable = 'C:\\Users\\ming\\.pnpm\\pnpm.cmd';
    const sassExecutable = 'C:\\Users\\ming\\AppData\\Roaming\\npm\\sass.cmd';

    const svc = createInstallToolingService({
        processImpl: { platform: 'win32', env: {}, cwd: () => 'C:\\repo' },
        ensurePnpmImpl: () => ({ ok: true, alreadyInstalled: true, logs: [] }),
        resolveExecutableImpl: (command) => {
            if (command === 'pnpm') {
                return pnpmExecutable;
            }
            if (command === 'sass') {
                return sassInstalled ? sassExecutable : '';
            }
            return '';
        },
        runCommandImpl: (command, args, options = {}) => {
            runCommandCalls.push({ command, args, options });
            if (command === pnpmExecutable && args.join(' ') === 'add -g sass') {
                sassInstalled = true;
                return { status: 0, stdout: 'installed', stderr: '' };
            }
            return { status: 1, stdout: '', stderr: `unexpected command: ${command} ${args.join(' ')}` };
        },
        shellImpl: { openExternal: () => {} }
    });

    const result = svc.ensureDartSass();

    assert.equal(result.ok, true);
    assert.equal(runCommandCalls.length, 1);
    assert.equal(runCommandCalls[0].command, pnpmExecutable);
    assert.deepEqual(runCommandCalls[0].args, ['add', '-g', 'sass']);
    assert.equal(runCommandCalls[0].options.timeout, 180000);
});

test('ensureDartSass accepts discovered Windows sass runner after successful install even when sass is not yet on PATH', () => {
    const pnpmExecutable = 'C:\\Users\\ming\\.pnpm\\pnpm.cmd';
    const sassRunner = 'C:\\Users\\ming\\AppData\\Roaming\\npm\\node_modules\\sass-embedded-win32-x64\\dart-sass\\sass.bat';
    const runCommandCalls = [];

    const svc = createInstallToolingService({
        processImpl: {
            platform: 'win32',
            env: {
                APPDATA: 'C:\\Users\\ming\\AppData\\Roaming',
                USERPROFILE: 'C:\\Users\\ming'
            },
            cwd: () => 'C:\\repo'
        },
        ensurePnpmImpl: () => ({ ok: true, alreadyInstalled: true, logs: [] }),
        resolveExecutableImpl: (command) => {
            if (command === 'pnpm') {
                return pnpmExecutable;
            }
            if (command === 'sass') {
                return '';
            }
            return '';
        },
        runCommandImpl: (command, args) => {
            runCommandCalls.push({ command, args });
            return { status: 0, stdout: 'installed', stderr: '' };
        },
        fsImpl: {
            existsSync(targetPath) {
                return targetPath === sassRunner;
            },
            mkdirSync() {},
            writeFileSync() {}
        },
        shellImpl: { openExternal: () => {} }
    });

    const result = svc.ensureDartSass();

    assert.equal(result.ok, true);
    assert.equal(runCommandCalls.length, 1);
    assert.equal(runCommandCalls[0].command, pnpmExecutable);
});
