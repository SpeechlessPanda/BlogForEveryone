const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const { createEnvironmentDetector } = require('./detectEnvironment');

test('checkEnvironment computes readiness from executable resolver', () => {
    const detector = createEnvironmentDetector({
        resolveExecutableImpl: (name) => {
            if (name === 'node') return '/usr/bin/node';
            if (name === 'git') return '/usr/bin/git';
            if (name === 'pnpm') return '';
            if (name === 'hugo') return '';
            return '';
        },
        commandExistsImpl: (name) => name === 'winget'
    });

    const env = detector.checkEnvironment();
    assert.equal(env.nodeInstalled, true);
    assert.equal(env.gitInstalled, true);
    assert.equal(env.pnpmInstalled, false);
    assert.equal(env.hugoInstalled, false);
    assert.equal(env.wingetInstalled, true);
    assert.equal(env.ready, false);
});

test('resolveExecutable returns command itself when commandExists is true', () => {
    const detector = createEnvironmentDetector({
        resolveHugoExecutableImpl: () => '',
        commandExistsImpl: (name) => name === 'git',
        fsImpl: { existsSync: () => false, readdirSync: () => [] },
        pathImpl: require('path'),
        processImpl: { platform: 'linux', env: {} }
    });

    assert.equal(detector.resolveExecutable('git'), 'git');
});

test('getHugoVersionInfo handles missing executable and extended build detection', () => {
    const missing = createEnvironmentDetector().getHugoVersionInfo('');
    assert.equal(missing.ok, false);
    assert.equal(missing.isExtended, false);

    const originalLoad = Module._load;
    const modulePath = require.resolve('./detectEnvironment');

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return {
                spawnSync() {
                    return {
                        status: 0,
                        stdout: 'hugo v0.125.0+extended windows/amd64',
                        stderr: ''
                    };
                }
            };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[modulePath];
        const mod = require('./detectEnvironment');
        const info = mod.createEnvironmentDetector().getHugoVersionInfo('hugo');
        assert.equal(info.ok, true);
        assert.equal(info.isExtended, true);
        assert.match(info.version, /extended/i);
    } finally {
        Module._load = originalLoad;
        delete require.cache[modulePath];
    }
});

test('getHugoVersionInfo recognizes extended marker without plus sign', () => {
    const originalLoad = Module._load;
    const modulePath = require.resolve('./detectEnvironment');

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return {
                spawnSync() {
                    return {
                        status: 0,
                        stdout: 'hugo v0.147.0 windows/amd64 BuildDate=2026-03-29 extended',
                        stderr: ''
                    };
                }
            };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[modulePath];
        const mod = require('./detectEnvironment');
        const info = mod.createEnvironmentDetector().getHugoVersionInfo('hugo');
        assert.equal(info.ok, true);
        assert.equal(info.isExtended, true);
    } finally {
        Module._load = originalLoad;
        delete require.cache[modulePath];
    }
});

test('resolveHugoExecutable honors explicit HUGO_EXECUTABLE env override', () => {
    const originalLoad = Module._load;
    const modulePath = require.resolve('./detectEnvironment');

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return {
                spawnSync(executablePath) {
                    return {
                        status: 0,
                        stdout: executablePath === 'C:\\tools\\hugo\\hugo.exe'
                            ? 'hugo v0.147.0 windows/amd64 BuildDate=2026-03-29 extended'
                            : 'hugo v0.147.0 windows/amd64 BuildDate=2026-03-29',
                        stderr: ''
                    };
                }
            };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[modulePath];
        const mod = require('./detectEnvironment');
        const detector = mod.createEnvironmentDetector({
            fsImpl: {
                existsSync: (target) => target === 'C:\\tools\\hugo\\hugo.exe',
                readdirSync: () => []
            },
            pathImpl: { join: (...parts) => parts.join('\\') },
            processImpl: {
                platform: 'win32',
                env: {
                    HUGO_EXECUTABLE: 'C:\\tools\\hugo\\hugo.exe',
                    LOCALAPPDATA: 'C:\\Users\\ming\\AppData\\Local'
                }
            },
            commandExistsImpl: () => false
        });

        assert.equal(detector.resolveHugoExecutable({ requireExtended: true }), 'C:\\tools\\hugo\\hugo.exe');
    } finally {
        Module._load = originalLoad;
        delete require.cache[modulePath];
    }
});

test('resolveHugoExecutable prefers extended candidates and checks version when required', () => {
    const localAppData = 'C:\\Users\\ming\\AppData\\Local';
    const linksDir = `${localAppData}\\Microsoft\\WinGet\\Links`;
    const packagesDir = `${localAppData}\\Microsoft\\WinGet\\Packages`;
    const extendedPath = `${linksDir}\\hugo_extended.exe`;
    const plainPath = `${linksDir}\\hugo.exe`;
    const packageExtendedPath = `${packagesDir}\\Hugo.HugoExtended_MING\\hugo_extended.exe`;

    const fsImpl = {
        existsSync(target) {
            return target === extendedPath || target === plainPath || target === packagesDir || target === packageExtendedPath;
        },
        readdirSync(target) {
            if (target !== packagesDir) {
                return [];
            }
            return [
                { name: 'Hugo.HugoExtended_MING', isDirectory: () => true },
                { name: 'NotHugo.Package', isDirectory: () => true },
                { name: 'readme.txt', isDirectory: () => false }
            ];
        }
    };

    const pathImpl = {
        join: (...parts) => parts.join('\\')
    };

    const detector = createEnvironmentDetector({
        fsImpl,
        pathImpl,
        processImpl: { platform: 'win32', env: { LOCALAPPDATA: localAppData } },
        commandExistsImpl: () => false
    });

    const preferred = detector.resolveHugoExecutable({ requireExtended: false });
    assert.match(preferred, /extended/i);

    const required = detector.resolveHugoExecutable({ requireExtended: true });
    assert.equal(required, '');
});

test('resolveExecutable finds pnpm and winget package binaries on windows and handles package-scan failure', () => {
    const localAppData = 'C:\\Users\\ming\\AppData\\Local';
    const userProfile = 'C:\\Users\\ming';
    const appData = 'C:\\Users\\ming\\AppData\\Roaming';
    const pnpmCmd = `${userProfile}\\.pnpm\\pnpm.cmd`;
    const gitExe = `${localAppData}\\Microsoft\\WinGet\\Packages\\Git.Git_MING\\git.exe`;
    const packagesDir = `${localAppData}\\Microsoft\\WinGet\\Packages`;

    const fsImpl = {
        existsSync(target) {
            return target === pnpmCmd || target === gitExe || target === packagesDir;
        },
        readdirSync(target) {
            if (target === packagesDir) {
                return [{ name: 'Git.Git_MING', isDirectory: () => true }];
            }
            return [];
        }
    };

    const pathImpl = {
        join: (...parts) => parts.join('\\')
    };

    const detector = createEnvironmentDetector({
        fsImpl,
        pathImpl,
        processImpl: {
            platform: 'win32',
            env: {
                LOCALAPPDATA: localAppData,
                USERPROFILE: userProfile,
                APPDATA: appData,
                PNPM_HOME: ''
            }
        },
        commandExistsImpl: () => false
    });

    assert.equal(detector.resolveExecutable('pnpm'), pnpmCmd);
    assert.equal(detector.resolveExecutable('git'), gitExe);

    const failingFs = {
        existsSync(target) {
            return target === packagesDir;
        },
        readdirSync() {
            throw new Error('denied');
        }
    };
    const detectorWithFailure = createEnvironmentDetector({
        fsImpl: failingFs,
        pathImpl,
        processImpl: {
            platform: 'win32',
            env: { LOCALAPPDATA: localAppData, USERPROFILE: userProfile, APPDATA: appData }
        },
        commandExistsImpl: () => false
    });

    assert.equal(detectorWithFailure.resolveExecutable('git'), '');
});

test('resolveHugoExecutable supports injected resolver and extended candidate verification', () => {
    const injected = createEnvironmentDetector({
        resolveHugoExecutableImpl: () => 'custom-hugo'
    });
    assert.equal(injected.resolveHugoExecutable({ requireExtended: true }), 'custom-hugo');

    const originalLoad = Module._load;
    const modulePath = require.resolve('./detectEnvironment');
    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return {
                spawnSync() {
                    return {
                        status: 0,
                        stdout: 'hugo v0.125.0+extended linux/amd64',
                        stderr: ''
                    };
                }
            };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[modulePath];
        const mod = require('./detectEnvironment');
        const detector = mod.createEnvironmentDetector({
            fsImpl: {
                existsSync: () => false,
                readdirSync: () => []
            },
            pathImpl: { join: (...parts) => parts.join('\\') },
            processImpl: { platform: 'linux', env: {} },
            commandExistsImpl: (name) => name === 'hugo_extended'
        });
        assert.equal(detector.resolveHugoExecutable({ requireExtended: true }), 'hugo_extended');
    } finally {
        Module._load = originalLoad;
        delete require.cache[modulePath];
    }
});

test('resolveHugoExecutable tolerates package scan errors on windows and returns empty when none found', () => {
    const localAppData = 'C:\\Users\\ming\\AppData\\Local';
    const packagesDir = `${localAppData}\\Microsoft\\WinGet\\Packages`;
    const detector = createEnvironmentDetector({
        fsImpl: {
            existsSync(target) {
                return target === packagesDir;
            },
            readdirSync() {
                throw new Error('scan failed');
            }
        },
        pathImpl: { join: (...parts) => parts.join('\\') },
        processImpl: { platform: 'win32', env: { LOCALAPPDATA: localAppData } },
        commandExistsImpl: () => false
    });

    assert.equal(detector.resolveHugoExecutable({ requireExtended: false }), '');
});

test('resolveExecutable returns winget links path and empty fallback branches', () => {
    const localAppData = 'C:\\Users\\ming\\AppData\\Local';
    const linksGit = `${localAppData}\\Microsoft\\WinGet\\Links\\git.exe`;
    const packagesDir = `${localAppData}\\Microsoft\\WinGet\\Packages`;

    const detector = createEnvironmentDetector({
        fsImpl: {
            existsSync(target) {
                return target === linksGit || target === packagesDir;
            },
            readdirSync(target) {
                if (target === packagesDir) {
                    return [
                        { name: 'readme.txt', isDirectory: () => false },
                        { name: 'OpenJS.NodeJS.LTS_MING', isDirectory: () => true }
                    ];
                }
                return [];
            }
        },
        pathImpl: { join: (...parts) => parts.join('\\') },
        processImpl: {
            platform: 'win32',
            env: { LOCALAPPDATA: localAppData, USERPROFILE: 'C:\\Users\\ming', APPDATA: 'C:\\Users\\ming\\AppData\\Roaming' }
        },
        commandExistsImpl: () => false
    });

    assert.equal(detector.resolveExecutable('git'), linksGit);
    assert.equal(detector.resolveExecutable('unknowncmd'), '');
});

test('resolveHugoExecutable deduplicates candidate list and resolveExecutable pnpm empty fallback', () => {
    const detector = createEnvironmentDetector({
        fsImpl: {
            existsSync: () => false,
            readdirSync: () => []
        },
        pathImpl: { join: (...parts) => parts.join('\\') },
        processImpl: {
            platform: 'win32',
            env: { LOCALAPPDATA: 'C:\\Users\\ming\\AppData\\Local', USERPROFILE: '', APPDATA: '', PNPM_HOME: '' }
        },
        commandExistsImpl: (name) => name === 'hugo_extended'
    });

    assert.equal(detector.resolveHugoExecutable({ requireExtended: false }), 'hugo_extended');
    assert.equal(detector.resolveExecutable('pnpm'), '');
});

test('resolveHugoExecutable ignores empty win32 candidates from malformed joins', () => {
    const detector = createEnvironmentDetector({
        fsImpl: {
            existsSync: () => false,
            readdirSync: () => []
        },
        pathImpl: {
            join() {
                return '';
            }
        },
        processImpl: {
            platform: 'win32',
            env: { LOCALAPPDATA: 'C:\\Users\\ming\\AppData\\Local' }
        },
        commandExistsImpl: () => false
    });

    assert.equal(detector.resolveHugoExecutable({ requireExtended: false }), '');
});
