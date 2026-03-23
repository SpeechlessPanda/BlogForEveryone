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
