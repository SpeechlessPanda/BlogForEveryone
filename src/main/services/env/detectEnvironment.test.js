const test = require('node:test');
const assert = require('node:assert/strict');

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
