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

test('autoInstallToolWithWinget covers missing winget, retry success and full failure', () => {
    const missingWinget = createInstallToolingService({
        checkEnvironmentImpl: () => ({ wingetInstalled: false })
    });
    assert.equal(missingWinget.autoInstallToolWithWinget('node').ok, false);
    assert.equal(missingWinget.autoInstallToolWithWinget('node').reason, 'WINGET_MISSING');

    const retryCalls = [];
    const retrySvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ wingetInstalled: true }),
        runCommandImpl: (command, args) => {
            retryCalls.push(`${command} ${args.join(' ')}`);
            if (args[0] === 'install' && !retryCalls.some((line) => line.includes('source update'))) {
                return { status: 1, stdout: '', stderr: 'first fail' };
            }
            if (args[0] === 'source') {
                return { status: 0, stdout: 'updated', stderr: '' };
            }
            return { status: 0, stdout: 'installed', stderr: '' };
        }
    });
    const retried = retrySvc.autoInstallToolWithWinget('node');
    assert.equal(retried.ok, true);
    assert.equal(retried.retried, true);

    const failSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ wingetInstalled: true }),
        runCommandImpl: () => ({ status: 1, stdout: '', stderr: 'nope' })
    });
    const failed = failSvc.autoInstallToolWithWinget('git');
    assert.equal(failed.ok, false);
    assert.equal(failed.retried, true);
});

test('openInstaller enforces trust policy and opens supported links', () => {
    const opened = [];
    const blockedSvc = createInstallToolingService({
        evaluateExternalUrlImpl: () => ({ allowed: false, normalizedUrl: '' }),
        externalUrlRules: { installer: {} },
        shellImpl: { openExternal: (url) => opened.push(url) }
    });
    assert.throws(() => blockedSvc.openInstaller('git'), /blocked by trust policy/);

    const allowedSvc = createInstallToolingService({
        evaluateExternalUrlImpl: () => ({ allowed: true, normalizedUrl: 'https://nodejs.org/en/download' }),
        externalUrlRules: { installer: {} },
        shellImpl: { openExternal: (url) => opened.push(url) }
    });
    const result = allowedSvc.openInstaller('node');
    assert.equal(result.ok, true);
    assert.equal(opened.at(-1), 'https://nodejs.org/en/download');
});

test('ensurePnpm covers node missing, already installed, corepack success and fallback failure', () => {
    const missingNodeSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ nodeInstalled: false, pnpmInstalled: false })
    });
    assert.equal(missingNodeSvc.ensurePnpm().reason, 'NODE_MISSING');

    const installedSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ nodeInstalled: true, pnpmInstalled: true })
    });
    assert.equal(installedSvc.ensurePnpm().alreadyInstalled, true);

    const corepackSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ nodeInstalled: true, pnpmInstalled: false }),
        runCommandImpl: () => ({ status: 0, stdout: 'ok', stderr: '' }),
        resolveExecutableImpl: (command) => (command === 'pnpm' ? 'pnpm' : ''),
        shellImpl: { openExternal: () => {} }
    });
    const corepackResult = corepackSvc.ensurePnpm();
    assert.equal(corepackResult.ok, true);
    assert.equal(corepackResult.alreadyInstalled, false);

    let callCount = 0;
    const failSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ nodeInstalled: true, pnpmInstalled: false }),
        runCommandImpl: () => {
            callCount += 1;
            return { status: 1, stdout: '', stderr: `failed-${callCount}` };
        },
        resolveExecutableImpl: () => '',
        shellImpl: { openExternal: () => {} }
    });
    const failResult = failSvc.ensurePnpm();
    assert.equal(failResult.ok, false);
    assert.equal(failResult.reason, 'PNPM_INSTALL_FAILED');
    assert.equal(failResult.logs.some((entry) => entry.event === 'mirror-fallback'), true);
});

test('ensureDartSass covers already-installed, ensurePnpm failure and install failure branches', () => {
    const alreadySvc = createInstallToolingService({
        resolveExecutableImpl: (command) => (command === 'sass' ? 'sass' : ''),
        shellImpl: { openExternal: () => {} }
    });
    assert.equal(alreadySvc.ensureDartSass().alreadyInstalled, true);

    const pnpmFailedSvc = createInstallToolingService({
        resolveExecutableImpl: () => '',
        ensurePnpmImpl: () => ({ ok: false, reason: 'PNPM_INSTALL_FAILED', logs: [] }),
        shellImpl: { openExternal: () => {} }
    });
    assert.equal(pnpmFailedSvc.ensureDartSass().ok, false);

    const installFailedSvc = createInstallToolingService({
        processImpl: { platform: 'linux', env: {}, cwd: () => '/tmp' },
        resolveExecutableImpl: () => '',
        ensurePnpmImpl: () => ({ ok: true, logs: [] }),
        runCommandImpl: () => ({ status: 1, stdout: '', stderr: 'install failed' }),
        shellImpl: { openExternal: () => {} }
    });
    const failed = installFailedSvc.ensureDartSass();
    assert.equal(failed.ok, false);
    assert.equal(failed.reason, 'SASS_INSTALL_FAILED');
});

test('getHugoExecutionEnv returns shim failure and windows PATH injection', () => {
    const failSvc = createInstallToolingService({
        processImpl: { platform: 'linux', env: { PATH: '/usr/bin' }, cwd: () => '/tmp' },
        resolveExecutableImpl: () => '',
        shellImpl: { openExternal: () => {} }
    });
    const failResult = failSvc.getHugoExecutionEnv();
    assert.equal(failResult.ok, false);
    assert.equal(failResult.reason, 'SASS_SHIM_PREPARE_FAILED');

    const writes = [];
    const winSvc = createInstallToolingService({
        processImpl: {
            platform: 'win32',
            env: {
                PATH: 'C:\\Windows\\System32',
                LOCALAPPDATA: 'C:\\Users\\ming\\AppData\\Local',
                APPDATA: 'C:\\Users\\ming\\AppData\\Roaming'
            },
            cwd: () => 'C:\\repo'
        },
        resolveExecutableImpl: (command) => (command === 'sass' ? '' : ''),
        fsImpl: {
            existsSync(target) {
                return target.includes('sass-embedded-win32-x64') && target.endsWith('sass.bat');
            },
            mkdirSync() {},
            writeFileSync(target, content) {
                writes.push({ target, content });
            }
        },
        shellImpl: { openExternal: () => {} }
    });
    const winEnv = winSvc.getHugoExecutionEnv();
    assert.equal(winEnv.ok, true);
    assert.equal(writes.length >= 2, true);
    assert.match(winEnv.env.PATH, /BlogForEveryone/);
});

test('ensureFrameworkEnvironment covers hexo/hugo success and failure branches', () => {
    const hexoNodeFailSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ nodeInstalled: false, wingetInstalled: false, pnpmInstalled: false }),
        ensurePnpmImpl: () => ({ ok: true, logs: [] }),
        shellImpl: { openExternal: () => {} }
    });
    const nodeFail = hexoNodeFailSvc.ensureFrameworkEnvironment('hexo');
    assert.equal(nodeFail.ok, false);
    assert.equal(nodeFail.reason, 'NODE_MISSING');

    const hexoPnpmFailSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ nodeInstalled: true, wingetInstalled: true, pnpmInstalled: false }),
        ensurePnpmImpl: () => ({ ok: false, reason: 'PNPM_INSTALL_FAILED', logs: [] }),
        shellImpl: { openExternal: () => {} }
    });
    assert.equal(hexoPnpmFailSvc.ensureFrameworkEnvironment('hexo').reason, 'PNPM_INSTALL_FAILED');

    const hexoOkSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ nodeInstalled: true, wingetInstalled: true, pnpmInstalled: true }),
        ensurePnpmImpl: () => ({ ok: true, logs: [] }),
        shellImpl: { openExternal: () => {} }
    });
    assert.equal(hexoOkSvc.ensureFrameworkEnvironment('hexo').ok, true);

    const hugoMissingSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ wingetInstalled: false }),
        resolveHugoExecutableImpl: () => '',
        ensureDartSassImpl: () => ({ ok: true, logs: [] }),
        shellImpl: { openExternal: () => {} }
    });
    assert.equal(hugoMissingSvc.ensureFrameworkEnvironment('hugo').reason, 'HUGO_EXTENDED_MISSING');

    let hugoReady = true;
    const hugoSassFailSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ wingetInstalled: true }),
        resolveHugoExecutableImpl: () => (hugoReady ? 'hugo_extended' : ''),
        ensureDartSassImpl: () => ({ ok: false, logs: [] }),
        shellImpl: { openExternal: () => {} }
    });
    assert.equal(hugoSassFailSvc.ensureFrameworkEnvironment('hugo').reason, 'DART_SASS_MISSING');
    hugoReady = false;

    const unsupportedSvc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ wingetInstalled: true }),
        shellImpl: { openExternal: () => {} }
    });
    assert.equal(unsupportedSvc.ensureFrameworkEnvironment('unknown').reason, 'UNSUPPORTED_FRAMEWORK');
});

test('installDependenciesWithRetry covers success and retry paths', () => {
    const calls = [];
    const optionsByCall = [];
    const svc = createInstallToolingService({
        runCommandImpl: (command, args, options) => {
            calls.push(`${command} ${args.join(' ')}`);
            optionsByCall.push(options || {});
            if (calls.length === 1) {
                return { status: 1, stdout: '', stderr: 'first fail' };
            }
            if (calls.length === 2) {
                return { status: 0, stdout: 'set registry', stderr: '' };
            }
            return { status: 0, stdout: 'installed', stderr: '' };
        },
        shellImpl: { openExternal: () => {} }
    });

    const retried = svc.installDependenciesWithRetry('D:/tmp/project');
    assert.equal(retried.ok, true);
    assert.equal(retried.retried, true);
    assert.equal(retried.logs.some((entry) => entry.event === 'mirror-fallback'), true);
    assert.equal(optionsByCall[0].timeout, 600000);
    assert.equal(optionsByCall[2].timeout, 600000);

    const immediateSvc = createInstallToolingService({
        runCommandImpl: () => ({ status: 0, stdout: 'ok', stderr: '' }),
        shellImpl: { openExternal: () => {} }
    });
    const immediate = immediateSvc.installDependenciesWithRetry('D:/tmp/project');
    assert.equal(immediate.ok, true);
    assert.equal(immediate.retried, false);
});

test('autoInstallToolWithWinget handles unsupported tool and direct success', () => {
    const unsupported = createInstallToolingService({
        checkEnvironmentImpl: () => ({ wingetInstalled: true })
    });
    const unsupportedResult = unsupported.autoInstallToolWithWinget('unknown-tool');
    assert.equal(unsupportedResult.ok, false);
    assert.equal(unsupportedResult.reason, 'UNSUPPORTED_TOOL');

    const direct = createInstallToolingService({
        checkEnvironmentImpl: () => ({ wingetInstalled: true }),
        runCommandImpl: (command, args) => {
            if (command === 'winget' && args[0] === 'install') {
                return { status: 0, stdout: 'installed', stderr: '' };
            }
            return { status: 1, stdout: '', stderr: 'unexpected' };
        }
    });
    const directResult = direct.autoInstallToolWithWinget('git');
    assert.equal(directResult.ok, true);
    assert.equal(directResult.retried, false);
});

test('ensurePnpm fallback success branch is covered', () => {
    let pnpmVisible = false;
    const svc = createInstallToolingService({
        checkEnvironmentImpl: () => ({ nodeInstalled: true, pnpmInstalled: false }),
        runCommandImpl: (command, args) => {
            if (command === 'corepack') {
                return { status: 1, stdout: '', stderr: 'corepack failed' };
            }
            if (command === 'npm' && args.join(' ') === 'config set registry https://registry.npmmirror.com') {
                return { status: 0, stdout: 'registry set', stderr: '' };
            }
            if (command === 'npm' && args.join(' ') === 'install -g pnpm') {
                pnpmVisible = true;
                return { status: 0, stdout: 'installed pnpm', stderr: '' };
            }
            return { status: 1, stdout: '', stderr: 'unexpected' };
        },
        resolveExecutableImpl: (name) => (name === 'pnpm' && pnpmVisible ? 'pnpm' : ''),
        shellImpl: { openExternal: () => {} }
    });

    const result = svc.ensurePnpm();
    assert.equal(result.ok, true);
    assert.equal(result.fallback, true);
});

test('getHugoExecutionEnv returns windows shim prepare failure when runner is missing', () => {
    const svc = createInstallToolingService({
        processImpl: {
            platform: 'win32',
            env: {
                PATH: 'C:\\Windows\\System32',
                LOCALAPPDATA: 'C:\\Users\\ming\\AppData\\Local',
                APPDATA: 'C:\\Users\\ming\\AppData\\Roaming',
                USERPROFILE: 'C:\\Users\\ming'
            },
            cwd: () => 'C:\\repo'
        },
        resolveExecutableImpl: () => '',
        fsImpl: {
            existsSync: () => false,
            mkdirSync() {},
            writeFileSync() {}
        },
        shellImpl: { openExternal: () => {} }
    });

    const result = svc.getHugoExecutionEnv();
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'SASS_SHIM_PREPARE_FAILED');
});

test('getHugoExecutionEnv on windows falls back from sass.ps1 to sass.cmd when available', () => {
    const writes = [];
    const sassPs1 = 'C:\\Users\\runneradmin\\setup-pnpm\\node_modules\\.bin\\sass.ps1';
    const sassCmd = 'C:\\Users\\runneradmin\\setup-pnpm\\node_modules\\.bin\\sass.cmd';
    const svc = createInstallToolingService({
        processImpl: {
            platform: 'win32',
            env: {
                PATH: 'C:\\Windows\\System32',
                LOCALAPPDATA: 'C:\\Users\\runneradmin\\AppData\\Local',
                APPDATA: 'C:\\Users\\runneradmin\\AppData\\Roaming',
                USERPROFILE: 'C:\\Users\\runneradmin'
            },
            cwd: () => 'C:\\repo'
        },
        resolveExecutableImpl: (name) => (name === 'sass' ? sassPs1 : ''),
        fsImpl: {
            existsSync(target) {
                return target === sassCmd;
            },
            mkdirSync() {},
            writeFileSync(target, content) {
                writes.push({ target, content });
            }
        },
        shellImpl: { openExternal: () => {} }
    });

    const result = svc.getHugoExecutionEnv();
    assert.equal(result.ok, true);
    assert.equal(writes.length >= 2, true);
    assert.ok(writes.some((entry) => entry.content.includes(`\"${sassCmd}\"`) || entry.content.includes(`"${sassCmd}"`)));
});
