const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadRunNodeCoverageModuleForTests({ spawnSyncImpl } = {}) {
    const filePath = path.join(__dirname, 'run-node-coverage.js');
    const mod = new Module(filePath, module);
    mod.filename = filePath;
    mod.paths = Module._nodeModulePaths(path.dirname(filePath));

    const originalLoad = Module._load;
    const childProcessModule = originalLoad('child_process', module, false);
    Module._load = function patchedLoad(request) {
        if (request === 'child_process') {
            return {
                ...childProcessModule,
                spawnSync: spawnSyncImpl || childProcessModule.spawnSync
            };
        }
        return originalLoad.apply(this, arguments);
    };

    delete require.cache[filePath];
    mod._compile(fs.readFileSync(filePath, 'utf8'), filePath);

    return {
        runNodeCoverageModule: mod.exports,
        restore() {
            Module._load = originalLoad;
        }
    };
}

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

test('package script contracts include Task 1 gate scripts', () => {
    const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
    const packageJson = loadJson(packageJsonPath);

    assert.equal(packageJson.scripts['test:unit'], 'pnpm exec node --test');
    assert.equal(packageJson.scripts['test:coverage'], 'node scripts/run-node-coverage.js');
    assert.equal(packageJson.scripts['test:e2e:workspace'], 'node scripts/verify-real-workspace.js');
    assert.equal(packageJson.scripts['verify:premerge'], 'pnpm run test:coverage && pnpm exec node --test && pnpm run build:renderer && pnpm run test:e2e:ui');
    assert.equal(packageJson.scripts['verify:release'], 'pnpm run verify:git-clean && pnpm run verify:premerge && pnpm run test:e2e:workspace && pnpm run package:signed');
});

test('check-node-coverage parser enforces all files 75/75/75 thresholds', () => {
    const checkCoveragePath = path.join(__dirname, 'check-node-coverage.js');
    // eslint-disable-next-line global-require
    const checkCoverage = require(checkCoveragePath);

    const coverageText = [
        '-------------------------|---------|----------|---------|---------|-------------------',
        'File                     | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s ',
        '-------------------------|---------|----------|---------|---------|-------------------',
        'All files                |   74.99 |    75.00 |   76.00 |   74.99 |',
        '-------------------------|---------|----------|---------|---------|-------------------'
    ].join('\n');

    const summary = checkCoverage.parseAllFilesCoverage(coverageText);
    assert.deepEqual(summary, {
        lines: 74.99,
        branches: 75,
        functions: 76
    });

    const violations = checkCoverage.findThresholdViolations(summary);
    assert.deepEqual(violations, ['lines']);

    const failureText = checkCoverage.formatThresholdFailure(violations, summary);
    assert.match(failureText, /^NODE_COVERAGE_THRESHOLD_FAILED\s+metric=lines\s+required=75\s+actual=74.99$/m);
});

test('check-node-coverage parser accepts GitHub log comment-prefixed all files rows', () => {
    const checkCoveragePath = path.join(__dirname, 'check-node-coverage.js');
    // eslint-disable-next-line global-require
    const checkCoverage = require(checkCoveragePath);

    const coverageText = [
        '# -------------------------------------------------------------------',
        '# all files                |  94.42 |    84.59 |   80.16 |',
        '# -------------------------------------------------------------------'
    ].join('\n');

    const summary = checkCoverage.parseAllFilesCoverage(coverageText);
    assert.deepEqual(summary, {
        lines: 94.42,
        branches: 84.59,
        functions: 80.16
    });
});

test('run-node-coverage preserves node test failure while still checking thresholds', async () => {
    const spawnCalls = [];
    const loaded = loadRunNodeCoverageModuleForTests({
        spawnSyncImpl: (command, args, options) => {
            spawnCalls.push({ command, args, options });
            if (command === process.execPath && Array.isArray(args) && args.includes('--experimental-test-coverage')) {
                return {
                    status: 1,
                    stdout: Buffer.from('All files                |   90.00 |    90.00 |   90.00 |   90.00 |\n'),
                    stderr: Buffer.from('')
                };
            }

            return {
                status: 0,
                stdout: Buffer.from(''),
                stderr: Buffer.from('')
            };
        }
    });

    try {
        const code = await loaded.runNodeCoverageModule.runCoverageOnceForTests();
        assert.equal(code, 1);
        assert.equal(spawnCalls.length, 2);
        assert.equal(spawnCalls[1].args[0], path.join(__dirname, 'check-node-coverage.js'));
    } finally {
        loaded.restore();
    }
});
