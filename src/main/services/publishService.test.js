const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const publishService = require('./publishService');

test('Hugo workflow uses inferred project-pages base URL', () => {
    const workflow = publishService.__test__.buildWorkflowContent({
        framework: 'hugo',
        repoUrl: 'https://github.com/ming/my-blog.git'
    });

    assert.match(workflow, /run: hugo --baseURL https:\/\/ming\.github\.io\/my-blog\//);
});

test('Hexo workflow command remains unchanged', () => {
    const workflow = publishService.__test__.buildWorkflowContent({
        framework: 'hexo',
        repoUrl: 'https://github.com/ming/ming.github.io.git'
    });

    assert.match(workflow, /run: pnpm dlx hexo generate/);
});

test('Hexo publish path routes commands through safe runCommand contract', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-'));
    fs.writeFileSync(path.join(projectDir, '_config.yml'), '', 'utf-8');

    const publishServicePath = require.resolve('./publishService');
    const runCommandPath = require.resolve('./env/runCommand');
    const childProcessPath = require.resolve('child_process');

    const originalPublishServiceCache = require.cache[publishServicePath];
    const originalRunCommandCache = require.cache[runCommandPath];
    const originalSpawnSync = require('child_process').spawnSync;

    const safeRunnerCalls = [];
    let unsafeSpawnSyncCalled = false;

    require.cache[runCommandPath] = {
        ...originalRunCommandCache,
        exports: {
            runCommand(command, args, options) {
                safeRunnerCalls.push({ command, args, options });
                return { status: 0, stdout: '', stderr: '' };
            }
        }
    };

    require('child_process').spawnSync = function patchedSpawnSync() {
        unsafeSpawnSyncCalled = true;
        return { status: 0, stdout: '', stderr: '' };
    };

    delete require.cache[publishServicePath];
    const isolatedPublishService = require('./publishService');

    try {
        isolatedPublishService.publishToGitHub({
            projectDir,
            framework: 'hexo',
            repoUrl: 'https://github.com/ming/ming.github.io.git',
            publishMode: 'hexo-deploy'
        });

        assert.equal(unsafeSpawnSyncCalled, false);
        assert.deepEqual(
            safeRunnerCalls.map(({ command, args }) => `${command} ${args.join(' ')}`),
            [
                'pnpm add hexo-deployer-git',
                'pnpm exec hexo clean',
                'pnpm exec hexo generate',
                'pnpm exec hexo deploy'
            ]
        );
        assert.ok(safeRunnerCalls.every(({ options }) => options && options.cwd === projectDir));
    } finally {
        require('child_process').spawnSync = originalSpawnSync;

        if (originalRunCommandCache) {
            require.cache[runCommandPath] = originalRunCommandCache;
        } else {
            delete require.cache[runCommandPath];
        }

        if (originalPublishServiceCache) {
            require.cache[publishServicePath] = originalPublishServiceCache;
        } else {
            delete require.cache[publishServicePath];
        }
    }
});

function loadPublishServiceWithMocks({ spawnSyncImpl, runCommandImpl, normalizePublishResultImpl } = {}) {
    const originalLoad = Module._load;
    const servicePath = require.resolve('./publishService');

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return { spawnSync: spawnSyncImpl || (() => ({ status: 0, stdout: '', stderr: '' })) };
        }
        if (request === './env/runCommand') {
            return { runCommand: runCommandImpl || (() => ({ status: 0, stdout: '', stderr: '' })) };
        }
        if (request === '../policies/publishResultPolicy') {
            return { normalizePublishResult: normalizePublishResultImpl || ((payload) => payload) };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[servicePath];
    const loaded = require('./publishService');

    return {
        loaded,
        cleanup() {
            Module._load = originalLoad;
            delete require.cache[servicePath];
        }
    };
}

test('publishToGitHub rejects hexo-deploy mode for non-hexo frameworks', () => {
    assert.throws(
        () => publishService.publishToGitHub({
            projectDir: 'D:/tmp/project',
            framework: 'hugo',
            repoUrl: 'https://github.com/a/b.git',
            publishMode: 'hexo-deploy'
        }),
        /仅支持 Hexo/
    );
});

test('hexo-deploy mode surfaces install/clean/generate/deploy failures with logs', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-hexo-fail-'));
    fs.writeFileSync(path.join(projectDir, '_config.yml'), '', 'utf-8');

    try {
        const scenarios = [
            { failAt: 0, expected: /安装 hexo-deployer-git 失败/ },
            { failAt: 1, expected: /Hexo clean 失败/ },
            { failAt: 2, expected: /Hexo generate 失败/ },
            { failAt: 3, expected: /Hexo deploy 失败/ }
        ];

        scenarios.forEach(({ failAt, expected }) => {
            const calls = [];
            const harness = loadPublishServiceWithMocks({
                runCommandImpl(command, args) {
                    const index = calls.length;
                    calls.push({ command, args });
                    return {
                        status: index === failAt ? 1 : 0,
                        stdout: index === failAt ? '' : 'ok',
                        stderr: index === failAt ? 'failed' : ''
                    };
                },
                normalizePublishResultImpl: (payload) => payload
            });

            try {
                assert.throws(
                    () => harness.loaded.publishToGitHub({
                        projectDir,
                        framework: 'hexo',
                        repoUrl: 'https://github.com/ming/blog.git',
                        publishMode: 'hexo-deploy'
                    }),
                    expected
                );
            } finally {
                harness.cleanup();
            }
        });
    } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});

test('actions mode returns git logs and stops command chain on first failure', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-actions-'));
    const workflowDir = path.join(projectDir, '.github', 'workflows');

    const spawnCalls = [];
    const harness = loadPublishServiceWithMocks({
        spawnSyncImpl(command, args) {
            spawnCalls.push(`${command} ${args.join(' ')}`);
            if (args[0] === 'init') {
                return { status: 0, stdout: 'init', stderr: '' };
            }
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') {
                return { status: 0, stdout: 'ming\n', stderr: '' };
            }
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') {
                return { status: 0, stdout: 'ming@example.com\n', stderr: '' };
            }
            if (args[0] === 'add') {
                return { status: 1, stdout: '', stderr: 'add failed' };
            }
            return { status: 0, stdout: 'ok', stderr: '' };
        },
        normalizePublishResultImpl: (payload) => payload
    });

    try {
        const result = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: 'https://github.com/ming/sample.git'
        });

        assert.equal(result.mode, 'actions');
        assert.equal(result.pagesUrl, 'https://ming.github.io/sample/');
        assert.equal(result.logs.some((entry) => entry.args && entry.args[0] === 'add' && entry.code === 1), true);
        assert.equal(fs.existsSync(path.join(workflowDir, 'deploy.yml')), true);
    } finally {
        harness.cleanup();
        fs.rmSync(projectDir, { recursive: true, force: true });
    }

    assert.equal(spawnCalls.some((line) => line.includes('push -u origin main')), false);
});

test('actions mode surfaces git identity missing and set-failed branches', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-identity-'));

    try {
        const missingIdentityHarness = loadPublishServiceWithMocks({
            spawnSyncImpl(command, args) {
                if (args[0] === 'init') {
                    return { status: 0, stdout: '', stderr: '' };
                }
                if (args[0] === 'config' && args[1] === '--get') {
                    return { status: 0, stdout: '', stderr: '' };
                }
                return { status: 0, stdout: '', stderr: '' };
            },
            normalizePublishResultImpl: (payload) => payload
        });

        try {
            assert.throws(
                () => missingIdentityHarness.loaded.publishToGitHub({
                    projectDir,
                    framework: 'hugo',
                    repoUrl: 'https://github.com/ming/missing.git'
                }),
                /发布前需要 Git 身份信息/
            );
        } finally {
            missingIdentityHarness.cleanup();
        }

        const setFailHarness = loadPublishServiceWithMocks({
            spawnSyncImpl(command, args) {
                if (args[0] === 'init') return { status: 0, stdout: '', stderr: '' };
                if (args[0] === 'config' && args[1] === '--get') return { status: 0, stdout: '', stderr: '' };
                if (args[0] === 'config' && args[2] === 'payload-name') return { status: 1, stdout: '', stderr: 'set failed' };
                return { status: 0, stdout: '', stderr: '' };
            },
            normalizePublishResultImpl: (payload) => payload
        });

        try {
            assert.throws(
                () => setFailHarness.loaded.publishToGitHub({
                    projectDir,
                    framework: 'hugo',
                    repoUrl: 'https://github.com/ming/setfail.git',
                    gitUserName: 'payload-name',
                    gitUserEmail: 'payload@example.com'
                }),
                /设置 Git 提交用户名失败/
            );
        } finally {
            setFailHarness.cleanup();
        }
    } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});

test('infer pages url handles root repo, project repo, missing and non-github URL cases', () => {
    const harness = loadPublishServiceWithMocks({ normalizePublishResultImpl: (payload) => payload });
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-pages-'));

    try {
        const root = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: 'https://github.com/ming/ming.github.io.git',
            gitUserName: 'ming',
            gitUserEmail: 'ming@example.com'
        });
        assert.equal(root.pagesUrl, 'https://ming.github.io/');

        const project = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: 'git@github.com:ming/docs-site.git',
            gitUserName: 'ming',
            gitUserEmail: 'ming@example.com'
        });
        assert.equal(project.pagesUrl, 'https://ming.github.io/docs-site/');

        const invalid = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: 'https://gitlab.com/ming/docs-site.git',
            gitUserName: 'ming',
            gitUserEmail: 'ming@example.com'
        });
        assert.equal(invalid.pagesUrl, '');

        const missing = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: '',
            gitUserName: 'ming',
            gitUserEmail: 'ming@example.com'
        });
        assert.equal(missing.pagesUrl, '');
    } finally {
        harness.cleanup();
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});

test('actions mode covers git init failure and email set failure branches', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-extra-'));

    try {
        const initFailHarness = loadPublishServiceWithMocks({
            spawnSyncImpl(command, args) {
                if (args[0] === 'init') {
                    return { status: 1, stdout: '', stderr: 'init failed' };
                }
                return { status: 0, stdout: '', stderr: '' };
            },
            normalizePublishResultImpl: (payload) => payload
        });
        try {
            const result = initFailHarness.loaded.publishToGitHub({
                projectDir,
                framework: 'hugo',
                repoUrl: 'https://github.com/ming/initfail.git'
            });
            assert.equal(result.logs[0].args[0], 'init');
            assert.equal(result.logs[0].code, 1);
        } finally {
            initFailHarness.cleanup();
        }

        const emailFailHarness = loadPublishServiceWithMocks({
            spawnSyncImpl(command, args) {
                if (args[0] === 'init') return { status: 0, stdout: '', stderr: '' };
                if (args[0] === 'config' && args[1] === '--get') return { status: 0, stdout: '', stderr: '' };
                if (args[0] === 'config' && args[2] === 'payload-name') return { status: 0, stdout: '', stderr: '' };
                if (args[0] === 'config' && args[2] === 'payload@example.com') return { status: 1, stdout: '', stderr: 'bad email' };
                return { status: 0, stdout: '', stderr: '' };
            },
            normalizePublishResultImpl: (payload) => payload
        });
        try {
            assert.throws(
                () => emailFailHarness.loaded.publishToGitHub({
                    projectDir,
                    framework: 'hugo',
                    repoUrl: 'https://github.com/ming/emailfail.git',
                    gitUserName: 'payload-name',
                    gitUserEmail: 'payload@example.com'
                }),
                /设置 Git 提交邮箱失败/
            );
        } finally {
            emailFailHarness.cleanup();
        }
    } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});

test('actions mode uses global git identity fallback when local config is missing', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-global-'));

    const harness = loadPublishServiceWithMocks({
        spawnSyncImpl(command, args) {
            if (args[0] === 'init') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'config' && args[1] === '--global' && args[3] === 'user.name') return { status: 0, stdout: 'global-name\n', stderr: '' };
            if (args[0] === 'config' && args[1] === '--global' && args[3] === 'user.email') return { status: 0, stdout: 'global@example.com\n', stderr: '' };
            return { status: 0, stdout: '', stderr: '' };
        },
        normalizePublishResultImpl: (payload) => payload
    });

    try {
        const result = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: 'https://github.com/ming/global.git'
        });
        assert.equal(result.logs.some((entry) => entry.stage === 'git-identity' && /global-name/.test(entry.message)), true);
    } finally {
        harness.cleanup();
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});
