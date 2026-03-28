const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const publishService = require('./publishService');
const { normalizePublishResult } = require('../policies/publishResultPolicy');

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

function loadPublishServiceWithMocks({
    spawnSyncImpl,
    runCommandImpl,
    normalizePublishResultImpl,
    ensureRemoteRepositoriesImpl,
    backupWorkspaceImpl,
    pushBackupToRepoOutcomeImpl,
    getAccessTokenForPrivilegedUseImpl
} = {}) {
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
        if (request === './githubRepoService') {
            return {
                ensureRemoteRepositories: ensureRemoteRepositoriesImpl || ((payload) => payload)
            };
        }
        if (request === './backupService') {
            return {
                backupWorkspace: backupWorkspaceImpl || (() => '/tmp/snapshot'),
                pushBackupToRepoOutcome: pushBackupToRepoOutcomeImpl || (() => ({ ok: true, logs: [] }))
            };
        }
        if (request === './githubAuthService') {
            return {
                getAccessTokenForPrivilegedUse: getAccessTokenForPrivilegedUseImpl || (() => 'token-123')
            };
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

test('actions mode is retry-safe for no-op commit and existing origin remote', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-idempotent-'));
    const spawnCalls = [];
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: normalizePublishResult,
        spawnSyncImpl(command, args) {
            spawnCalls.push(`${command} ${args.join(' ')}`);

            if (args[0] === 'init') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') return { status: 0, stdout: 'alice\n', stderr: '' };
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') return { status: 0, stdout: 'alice@example.com\n', stderr: '' };
            if (args[0] === 'add') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'commit') return { status: 1, stdout: '', stderr: 'nothing to commit, working tree clean' };
            if (args[0] === 'branch') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'remote' && args[1] === 'set-url') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'push') return { status: 0, stdout: 'pushed', stderr: '' };

            return { status: 0, stdout: '', stderr: '' };
        }
    });

    try {
        const result = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: 'https://github.com/alice/docs-site.git'
        });

        assert.equal(result.ok, true);
        assert.equal(result.reason, undefined);
        assert.equal(result.pagesUrl, 'https://alice.github.io/docs-site/');
        const commitLog = result.logs.find((entry) => entry.args && entry.args[0] === 'commit');
        assert.equal(commitLog?.code, 0);
        assert.equal(commitLog?.benign, true);
        assert.equal(commitLog?.reason, 'noop_commit');
        assert.equal(result.logs.some((entry) => entry.args && entry.args[0] === 'push' && entry.code === 0), true);
        assert.equal(spawnCalls.some((line) => line.includes('git remote set-url origin https://github.com/alice/docs-site.git')), true);
        assert.equal(spawnCalls.some((line) => line.includes('git push -u origin main')), true);
    } finally {
        harness.cleanup();
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});

test('actions mode is retry-safe when origin is missing and remote add fallback succeeds', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-missing-origin-'));
    const spawnCalls = [];
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: normalizePublishResult,
        spawnSyncImpl(command, args) {
            spawnCalls.push(`${command} ${args.join(' ')}`);

            if (args[0] === 'init') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') return { status: 0, stdout: 'alice\n', stderr: '' };
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') return { status: 0, stdout: 'alice@example.com\n', stderr: '' };
            if (args[0] === 'add' && args[1] === '.') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'commit') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'branch') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'remote' && args[1] === 'set-url') return { status: 1, stdout: '', stderr: 'error: No such remote origin' };
            if (args[0] === 'remote' && args[1] === 'add') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'push') return { status: 0, stdout: 'pushed', stderr: '' };

            return { status: 0, stdout: '', stderr: '' };
        }
    });

    try {
        const result = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: 'https://github.com/alice/docs-site.git'
        });

        assert.equal(result.ok, true);
        assert.equal(result.reason, undefined);
        assert.equal(result.pagesUrl, 'https://alice.github.io/docs-site/');
        const setUrlLog = result.logs.find((entry) => entry.args && entry.args[0] === 'remote' && entry.args[1] === 'set-url');
        assert.equal(setUrlLog?.code, 0);
        assert.equal(setUrlLog?.benign, true);
        assert.equal(setUrlLog?.reason, 'missing_origin_remote');
        assert.equal(result.logs.some((entry) => entry.args && entry.args[0] === 'remote' && entry.args[1] === 'add' && entry.code === 0), true);
        assert.equal(result.logs.some((entry) => entry.args && entry.args[0] === 'push' && entry.code === 0), true);
        assert.equal(spawnCalls.some((line) => line.includes('git remote add origin https://github.com/alice/docs-site.git')), true);
        assert.equal(spawnCalls.some((line) => line.includes('git push -u origin main')), true);
    } finally {
        harness.cleanup();
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});

test('actions mode still fails on real commit errors and does not push', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-commit-fail-'));
    const spawnCalls = [];
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        spawnSyncImpl(command, args) {
            spawnCalls.push(`${command} ${args.join(' ')}`);

            if (args[0] === 'init') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') return { status: 0, stdout: 'alice\n', stderr: '' };
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') return { status: 0, stdout: 'alice@example.com\n', stderr: '' };
            if (args[0] === 'add') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'commit') return { status: 1, stdout: '', stderr: 'fatal: could not lock config file' };

            return { status: 0, stdout: '', stderr: '' };
        }
    });

    try {
        const result = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: 'https://github.com/alice/docs-site.git'
        });

        assert.equal(result.logs.some((entry) => entry.args && entry.args[0] === 'commit' && entry.code === 1), true);
        assert.equal(spawnCalls.some((line) => line.includes('git push -u origin main')), false);
    } finally {
        harness.cleanup();
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});

test('actions mode fails when updating existing origin remote fails', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-remote-fail-'));
    const spawnCalls = [];
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        spawnSyncImpl(command, args) {
            spawnCalls.push(`${command} ${args.join(' ')}`);

            if (args[0] === 'init') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') return { status: 0, stdout: 'alice\n', stderr: '' };
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') return { status: 0, stdout: 'alice@example.com\n', stderr: '' };
            if (args[0] === 'add') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'commit') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'branch') return { status: 0, stdout: '', stderr: '' };
            if (args[0] === 'remote' && args[1] === 'set-url') return { status: 1, stdout: '', stderr: 'fatal: not a git repository' };

            return { status: 0, stdout: '', stderr: '' };
        }
    });

    try {
        const result = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: 'https://github.com/alice/docs-site.git'
        });

        assert.equal(result.logs.some((entry) => entry.args && entry.args[0] === 'remote' && entry.args[1] === 'set-url' && entry.code === 1), true);
        assert.equal(spawnCalls.some((line) => line.includes('git push -u origin main')), false);
    } finally {
        harness.cleanup();
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
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

test('coordinated publish enforces user-pages deploy repo naming as <login>.github.io', async () => {
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        ensureRemoteRepositoriesImpl: () => {
            throw new Error('should not run ensure step when naming validation fails');
        }
    });

    try {
        const payload = {
            projectDir: 'D:/tmp/project',
            framework: 'hugo',
            siteType: 'user-pages',
            login: 'alice',
            deployRepoName: 'not-allowed-name',
            backupRepoName: 'BFE',
            repoUrl: 'https://github.com/alice/not-allowed-name.git',
            backupRepoUrl: 'https://github.com/alice/BFE.git'
        };

        const result = await harness.loaded.publishToGitHub(payload);
        assert.equal(result.ok, false);
        assert.equal(result.status, 'failed');
        assert.equal(result.deployRepoEnsure?.ok, false);
        assert.match(result.deployRepoEnsure?.userMessage || '', /alice\.github\.io/);
    } finally {
        harness.cleanup();
    }
});

test('coordinated publish allows project-pages custom deploy repo names', async () => {
    const ensureCalls = [];
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        ensureRemoteRepositoriesImpl: (payload) => {
            ensureCalls.push(payload);
            return {
                deployRepo: payload.deployRepo || {
                    owner: 'alice',
                    name: payload.deployRepoName || 'docs-site',
                    url: 'https://github.com/alice/docs-site.git'
                },
                backupRepo: payload.backupRepo || {
                    owner: 'alice',
                    name: 'BFE',
                    url: 'https://github.com/alice/BFE.git'
                }
            };
        },
        pushBackupToRepoOutcomeImpl: () => ({ ok: true, logs: [] })
    });

    try {
        const result = await harness.loaded.publishToGitHub({
            projectDir: 'D:/tmp/project',
            framework: 'hugo',
            siteType: 'project-pages',
            login: 'alice',
            deployRepoName: 'docs-site',
            backupRepoName: 'BFE',
            repoUrl: 'https://github.com/alice/docs-site.git',
            backupRepoUrl: 'https://github.com/alice/BFE.git',
            gitUserName: 'alice',
            gitUserEmail: 'alice@example.com'
        });

        assert.equal(result.deployRepoEnsure?.ok, true);
        assert.equal(result.status, 'success');
        assert.equal(ensureCalls.length >= 2, true);
    } finally {
        harness.cleanup();
    }
});

test('coordinated publish enforces fixed backup repo name BFE', async () => {
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        ensureRemoteRepositoriesImpl: () => {
            throw new Error('should not run ensure step when backup naming validation fails');
        }
    });

    try {
        const result = await harness.loaded.publishToGitHub({
            projectDir: 'D:/tmp/project',
            framework: 'hugo',
            siteType: 'project-pages',
            login: 'alice',
            deployRepoName: 'docs-site',
            backupRepoName: 'BACKUP-ALT',
            repoUrl: 'https://github.com/alice/docs-site.git',
            backupRepoUrl: 'https://github.com/alice/BACKUP-ALT.git'
        });

        assert.equal(result.ok, false);
        assert.equal(result.backupRepoEnsure?.ok, false);
        assert.match(result.backupRepoEnsure?.userMessage || '', /BFE/);
    } finally {
        harness.cleanup();
    }
});

test('coordinated publish executes deterministic order and preserves child outcomes', async () => {
    const callOrder = [];
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        ensureRemoteRepositoriesImpl: (payload) => {
            if (payload.createBackupRepo) {
                callOrder.push('ensure-backup');
                return {
                    deployRepo: payload.deployRepo,
                    backupRepo: {
                        owner: 'alice',
                        name: 'BFE',
                        url: 'https://github.com/alice/BFE.git'
                    }
                };
            }

            callOrder.push('ensure-deploy');
            return {
                deployRepo: {
                    owner: 'alice',
                    name: 'docs-site',
                    url: 'https://github.com/alice/docs-site.git'
                },
                backupRepo: payload.backupRepo
            };
        },
        spawnSyncImpl(command, args) {
            if (command === 'git' && args[0] === 'init') {
                callOrder.push('deploy-publish');
            }

            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') {
                return { status: 0, stdout: 'alice\n', stderr: '' };
            }
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') {
                return { status: 0, stdout: 'alice@example.com\n', stderr: '' };
            }

            return { status: 0, stdout: 'ok', stderr: '' };
        },
        backupWorkspaceImpl: () => '/tmp/snapshot',
        pushBackupToRepoOutcomeImpl: () => {
            callOrder.push('backup-push');
            return { ok: true, logs: [{ code: 0 }] };
        }
    });

    try {
        const result = await harness.loaded.publishToGitHub({
            projectDir: 'D:/tmp/project',
            framework: 'hugo',
            siteType: 'project-pages',
            login: 'alice',
            deployRepoName: 'docs-site',
            backupRepoName: 'BFE',
            repoUrl: 'https://github.com/alice/docs-site.git',
            backupRepoUrl: 'https://github.com/alice/BFE.git',
            createDeployRepo: true,
            createBackupRepo: true,
            backupDir: 'D:/tmp/backup'
        });

        assert.deepEqual(callOrder, ['ensure-deploy', 'ensure-backup', 'deploy-publish', 'backup-push']);
        assert.equal(result.deployRepoEnsure?.ok, true);
        assert.equal(result.backupRepoEnsure?.ok, true);
        assert.equal(result.deployPublish?.ok, true);
        assert.equal(result.backupPush?.ok, true);
        assert.equal(result.status, 'success');
    } finally {
        harness.cleanup();
    }
});

test('coordinated publish marks deploy repo ensure as failure when ensured repo url is missing', async () => {
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: normalizePublishResult,
        ensureRemoteRepositoriesImpl: async (payload) => {
            if (payload.createBackupRepo) {
                return {
                    deployRepo: payload.deployRepo,
                    backupRepo: {
                        owner: 'alice',
                        name: 'BFE',
                        url: 'https://github.com/alice/BFE.git'
                    }
                };
            }

            return {
                deployRepo: {
                    owner: 'alice',
                    name: 'docs-site',
                    url: ''
                },
                backupRepo: payload.backupRepo
            };
        }
    });

    try {
        const result = await harness.loaded.publishToGitHub({
            projectDir: 'D:/tmp/project',
            framework: 'hugo',
            siteType: 'project-pages',
            login: 'alice',
            deployRepoName: 'docs-site',
            backupRepoName: 'BFE',
            repoUrl: 'https://github.com/alice/docs-site.git',
            backupRepoUrl: 'https://github.com/alice/BFE.git',
            createDeployRepo: true,
            createBackupRepo: true
        });

        assert.equal(result.ok, false);
        assert.equal(result.status, 'failed');
        assert.equal(result.deployRepoEnsure?.ok, false);
        assert.equal(result.deployRepoEnsure?.code, 'runtime_error');
        assert.equal(result.deployRepoEnsure?.category, 'runtime');
        assert.match(result.deployRepoEnsure?.userMessage || '', /发布仓库准备失败/);
    } finally {
        harness.cleanup();
    }
});

test('coordinated publish marks backup repo ensure as failure when ensured repo url is missing', async () => {
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: normalizePublishResult,
        ensureRemoteRepositoriesImpl: async (payload) => {
            if (payload.createBackupRepo) {
                return {
                    deployRepo: payload.deployRepo,
                    backupRepo: {
                        owner: 'alice',
                        name: 'BFE',
                        url: ''
                    }
                };
            }

            return {
                deployRepo: {
                    owner: 'alice',
                    name: 'docs-site',
                    url: 'https://github.com/alice/docs-site.git'
                },
                backupRepo: payload.backupRepo
            };
        }
    });

    try {
        const result = await harness.loaded.publishToGitHub({
            projectDir: 'D:/tmp/project',
            framework: 'hugo',
            siteType: 'project-pages',
            login: 'alice',
            deployRepoName: 'docs-site',
            backupRepoName: 'BFE',
            repoUrl: 'https://github.com/alice/docs-site.git',
            backupRepoUrl: 'https://github.com/alice/BFE.git',
            createDeployRepo: true,
            createBackupRepo: true
        });

        assert.equal(result.ok, false);
        assert.equal(result.status, 'failed');
        assert.equal(result.backupRepoEnsure?.ok, false);
        assert.equal(result.backupRepoEnsure?.code, 'runtime_error');
        assert.equal(result.backupRepoEnsure?.category, 'runtime');
        assert.match(result.backupRepoEnsure?.userMessage || '', /备份仓库准备失败/);
    } finally {
        harness.cleanup();
    }
});

test('coordinated publish returns partial_success when deploy succeeds but backup push fails', async () => {
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        ensureRemoteRepositoriesImpl: (payload) => ({
            deployRepo: payload.deployRepo || {
                owner: 'alice',
                name: 'docs-site',
                url: 'https://github.com/alice/docs-site.git'
            },
            backupRepo: payload.backupRepo || {
                owner: 'alice',
                name: 'BFE',
                url: 'https://github.com/alice/BFE.git'
            }
        }),
        spawnSyncImpl(command, args) {
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') {
                return { status: 0, stdout: 'alice\n', stderr: '' };
            }
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') {
                return { status: 0, stdout: 'alice@example.com\n', stderr: '' };
            }
            return { status: 0, stdout: 'ok', stderr: '' };
        },
        backupWorkspaceImpl: () => '/tmp/snapshot',
        pushBackupToRepoOutcomeImpl: () => ({
            ok: false,
            code: 'runtime_error',
            category: 'runtime',
            userMessage: '备份推送失败',
            logs: [{ code: 1, stderr: 'fatal' }]
        })
    });

    try {
        const result = await harness.loaded.publishToGitHub({
            projectDir: 'D:/tmp/project',
            framework: 'hugo',
            siteType: 'project-pages',
            login: 'alice',
            deployRepoName: 'docs-site',
            backupRepoName: 'BFE',
            repoUrl: 'https://github.com/alice/docs-site.git',
            backupRepoUrl: 'https://github.com/alice/BFE.git',
            backupDir: 'D:/tmp/backup'
        });

        assert.equal(result.deployPublish?.ok, true);
        assert.equal(result.backupPush?.ok, false);
        assert.equal(result.status, 'partial_success');
        assert.equal(result.reason, undefined);
    } finally {
        harness.cleanup();
    }
});

test('coordinated publish preserves upstream operationResult causes inside child outcome', async () => {
    const operationResult = {
        ok: false,
        code: 'conflict',
        category: 'conflict',
        userMessage: '发布仓库已存在且不可复用。',
        causes: [{ code: 'repo_conflict', message: 'repository already exists' }],
        rootCause: {
            step: 'ensure_deploy_repo',
            retryable: false
        }
    };

    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        ensureRemoteRepositoriesImpl: () => {
            const error = new Error('ensure failed');
            error.operationResult = operationResult;
            throw error;
        }
    });

    try {
        const result = await harness.loaded.publishToGitHub({
            projectDir: 'D:/tmp/project',
            framework: 'hugo',
            siteType: 'project-pages',
            login: 'alice',
            deployRepoName: 'docs-site',
            backupRepoName: 'BFE',
            repoUrl: 'https://github.com/alice/docs-site.git',
            backupRepoUrl: 'https://github.com/alice/BFE.git'
        });

        assert.equal(result.ok, false);
        assert.equal(result.status, 'failed');
        assert.equal(result.deployRepoEnsure?.ok, false);
        assert.deepEqual(result.deployRepoEnsure?.causes, operationResult.causes);
        assert.deepEqual(result.deployRepoEnsure?.rootCause, operationResult.rootCause);
    } finally {
        harness.cleanup();
    }
});

test('coordinated publish awaits async ensureRemoteRepositories and uses ensured URLs for deploy and backup', async () => {
    const callOrder = [];
    const spawnCalls = [];
    const backupPushCalls = [];
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        ensureRemoteRepositoriesImpl: async (payload) => {
            callOrder.push(payload.createBackupRepo ? 'ensure-backup:start' : 'ensure-deploy:start');
            await new Promise((resolve) => setTimeout(resolve, 10));
            callOrder.push(payload.createBackupRepo ? 'ensure-backup:end' : 'ensure-deploy:end');
            if (payload.createBackupRepo) {
                return {
                    deployRepo: payload.deployRepo,
                    backupRepo: {
                        owner: 'alice',
                        name: 'BFE',
                        url: 'https://github.com/alice/BFE-ensured.git'
                    }
                };
            }
            return {
                deployRepo: {
                    owner: 'alice',
                    name: 'docs-site',
                    url: 'https://github.com/alice/docs-site-ensured.git'
                },
                backupRepo: payload.backupRepo
            };
        },
        spawnSyncImpl(command, args) {
            if (command === 'git') {
                spawnCalls.push(args);
            }
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') {
                return { status: 0, stdout: 'alice\n', stderr: '' };
            }
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') {
                return { status: 0, stdout: 'alice@example.com\n', stderr: '' };
            }
            return { status: 0, stdout: 'ok', stderr: '' };
        },
        backupWorkspaceImpl: () => '/tmp/snapshot',
        pushBackupToRepoOutcomeImpl: (_snapshotDir, backupRepoUrl) => {
            backupPushCalls.push(backupRepoUrl);
            return { ok: true, logs: [] };
        }
    });

    try {
        const result = await harness.loaded.publishToGitHub({
            projectDir: 'D:/tmp/project',
            framework: 'hugo',
            siteType: 'project-pages',
            login: 'alice',
            deployRepoName: 'docs-site',
            backupRepoName: 'BFE',
            repoUrl: 'https://github.com/alice/docs-site.git',
            backupRepoUrl: 'https://github.com/alice/BFE.git',
            createDeployRepo: true,
            createBackupRepo: true,
            backupDir: 'D:/tmp/backup'
        });

        assert.deepEqual(callOrder, ['ensure-deploy:start', 'ensure-deploy:end', 'ensure-backup:start', 'ensure-backup:end']);
        const remoteSetUrlCall = spawnCalls.find((args) => args[0] === 'remote' && args[1] === 'set-url' && args[2] === 'origin');
        assert.equal(remoteSetUrlCall?.[3], 'https://github.com/alice/docs-site-ensured.git');
        assert.deepEqual(backupPushCalls, ['https://github.com/alice/BFE-ensured.git']);
        assert.equal(result.ok, true);
    } finally {
        harness.cleanup();
    }
});

test('coordinated publish defaults backupDir to safe location outside project when omitted', async () => {
    const projectDir = path.join(os.tmpdir(), 'bfe-safe-default-project');
    const captured = [];
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        ensureRemoteRepositoriesImpl: async (payload) => ({
            deployRepo: payload.deployRepo || {
                owner: 'alice',
                name: 'docs-site',
                url: 'https://github.com/alice/docs-site.git'
            },
            backupRepo: payload.backupRepo || {
                owner: 'alice',
                name: 'BFE',
                url: 'https://github.com/alice/BFE.git'
            }
        }),
        spawnSyncImpl(command, args) {
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') {
                return { status: 0, stdout: 'alice\n', stderr: '' };
            }
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') {
                return { status: 0, stdout: 'alice@example.com\n', stderr: '' };
            }
            return { status: 0, stdout: 'ok', stderr: '' };
        },
        backupWorkspaceImpl: ({ backupDir }) => {
            captured.push(backupDir);
            return '/tmp/snapshot';
        },
        pushBackupToRepoOutcomeImpl: () => ({ ok: true, logs: [] })
    });

    try {
        await harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            siteType: 'project-pages',
            login: 'alice',
            deployRepoName: 'docs-site',
            backupRepoName: 'BFE',
            repoUrl: 'https://github.com/alice/docs-site.git',
            backupRepoUrl: 'https://github.com/alice/BFE.git'
        });

        const expected = path.join(path.dirname(projectDir), '.bfe-backup', path.basename(projectDir));
        assert.equal(captured.length, 1);
        assert.equal(captured[0], expected);
        assert.equal(captured[0].startsWith(path.join(projectDir, path.sep)), false);
        assert.notEqual(captured[0], projectDir);
    } finally {
        harness.cleanup();
    }
});

test('actions mode injects transient GitHub auth for push without leaking token in logs', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-auth-'));
    const spawnCalls = [];
    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        getAccessTokenForPrivilegedUseImpl: () => 'gho_publish_secret_token',
        spawnSyncImpl(command, args, options) {
            spawnCalls.push({ command, args, options });
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.name') {
                return { status: 0, stdout: 'alice\n', stderr: '' };
            }
            if (args[0] === 'config' && args[1] === '--get' && args[2] === 'user.email') {
                return { status: 0, stdout: 'alice@example.com\n', stderr: '' };
            }
            return { status: 0, stdout: 'ok', stderr: '' };
        }
    });

    try {
        const result = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hugo',
            repoUrl: 'https://github.com/alice/docs-site.git'
        });

        const pushCall = spawnCalls.find((entry) => entry.args[0] === 'push');
        assert.equal(Boolean(pushCall), true);
        assert.equal(typeof pushCall.options.env.GIT_CONFIG_COUNT, 'string');
        assert.match(pushCall.options.env.GIT_CONFIG_KEY_0, /^http\..*\.extraheader$/);
        assert.match(pushCall.options.env.GIT_CONFIG_VALUE_0, /^AUTHORIZATION: basic\s+/i);
        assert.equal(pushCall.options.env.GIT_CONFIG_VALUE_0.includes('gho_publish_secret_token'), false);
        assert.equal(JSON.stringify(result.logs).includes('gho_publish_secret_token'), false);
    } finally {
        harness.cleanup();
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});

test('hexo-deploy mode injects transient GitHub auth for deploy without leaking token in logs', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-hexo-auth-'));
    fs.writeFileSync(path.join(projectDir, '_config.yml'), '', 'utf-8');
    const runCalls = [];

    const harness = loadPublishServiceWithMocks({
        normalizePublishResultImpl: (payload) => payload,
        getAccessTokenForPrivilegedUseImpl: () => 'gho_hexo_secret_token',
        runCommandImpl(command, args, options) {
            runCalls.push({ command, args, options });
            return { status: 0, stdout: 'ok', stderr: '' };
        }
    });

    try {
        const result = harness.loaded.publishToGitHub({
            projectDir,
            framework: 'hexo',
            repoUrl: 'https://github.com/alice/blog.git',
            publishMode: 'hexo-deploy'
        });

        const deployCall = runCalls.find((entry) => entry.command === 'pnpm' && entry.args.join(' ') === 'exec hexo deploy');
        assert.equal(Boolean(deployCall), true);
        assert.equal(typeof deployCall.options.env.GIT_CONFIG_COUNT, 'string');
        assert.match(deployCall.options.env.GIT_CONFIG_KEY_0, /^http\..*\.extraheader$/);
        assert.match(deployCall.options.env.GIT_CONFIG_VALUE_0, /^AUTHORIZATION: basic\s+/i);
        assert.equal(deployCall.options.env.GIT_CONFIG_VALUE_0.includes('gho_hexo_secret_token'), false);
        assert.equal(JSON.stringify(result.logs).includes('gho_hexo_secret_token'), false);
    } finally {
        harness.cleanup();
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});
