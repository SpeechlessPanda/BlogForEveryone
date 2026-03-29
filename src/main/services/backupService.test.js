const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

function loadBackupServiceWithRssStub() {
    const originalLoad = Module._load;
    let exportCalled = false;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === './rssService') {
            return {
                exportSubscriptions({ projectDir }) {
                    exportCalled = true;
                    const bfeDir = path.join(projectDir, '.bfe');
                    fs.mkdirSync(bfeDir, { recursive: true });
                    const bundlePath = path.join(bfeDir, 'subscriptions.bundle.json');
                    fs.writeFileSync(bundlePath, JSON.stringify([{ url: 'https://example.com/rss.xml' }], null, 2), 'utf-8');
                    return bundlePath;
                }
            };
        }

        return originalLoad(request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./backupService')];
        const service = require('./backupService');
        return {
            service,
            wasExportCalled() {
                return exportCalled;
            }
        };
    } finally {
        Module._load = originalLoad;
    }
}

test('backupWorkspace exports RSS bundle into snapshot', (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-backup-project-'));
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-backup-target-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
        fs.rmSync(backupDir, { recursive: true, force: true });
    });

    fs.writeFileSync(path.join(projectDir, 'README.md'), '# blog', 'utf-8');

    const { service, wasExportCalled } = loadBackupServiceWithRssStub();
    const snapshotDir = service.backupWorkspace({
        projectDir,
        backupDir,
        metadata: { source: 'test' }
    });

    assert.equal(wasExportCalled(), true);

    const bundlePath = path.join(snapshotDir, '.bfe', 'subscriptions.bundle.json');
    assert.equal(fs.existsSync(bundlePath), true);
});

test('pushBackupToRepo routes git commands through safe runCommand contract', () => {
    const originalLoad = Module._load;
    const runCommandCalls = [];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return {
                spawnSync() {
                    throw new Error('raw spawnSync should not be used for backup push commands');
                }
            };
        }

        if (request === './env/runCommand') {
            return {
                runCommand(command, args, options) {
                    runCommandCalls.push({ command, args, options });
                    return {
                        status: 0,
                        stdout: `ok ${command} ${args.join(' ')}`,
                        stderr: ''
                    };
                }
            };
        }

        return originalLoad(request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./backupService')];
        const { pushBackupToRepo } = require('./backupService');

        const snapshotDir = '/tmp/snapshot';
        const repoUrl = 'https://example.com/repo.git';
        const logs = pushBackupToRepo(snapshotDir, repoUrl);

        assert.deepEqual(runCommandCalls, [
            { command: 'git', args: ['init'], options: { cwd: snapshotDir } },
            { command: 'git', args: ['add', '.'], options: { cwd: snapshotDir } },
            { command: 'git', args: ['commit', '-m', 'chore: backup blog workspace'], options: { cwd: snapshotDir } },
            { command: 'git', args: ['branch', '-M', 'main'], options: { cwd: snapshotDir } },
            { command: 'git', args: ['remote', 'add', 'origin', repoUrl], options: { cwd: snapshotDir } },
            { command: 'git', args: ['push', '-u', 'origin', 'main'], options: { cwd: snapshotDir } }
        ]);

        assert.equal(logs.length, 6);
        assert.deepEqual(logs[0], {
            bin: 'git',
            args: ['init'],
            code: 0,
            stdout: 'ok git init',
            stderr: ''
        });
    } finally {
        Module._load = originalLoad;
        delete require.cache[require.resolve('./backupService')];
    }
});

test('pushBackupToRepo stops issuing git commands after first non-zero status', () => {
    const originalLoad = Module._load;
    const runCommandCalls = [];
    const responses = [
        { status: 0, stdout: 'ok git init', stderr: '' },
        { status: 1, stdout: '', stderr: 'fatal: add failed' },
        { status: 0, stdout: 'ok git commit', stderr: '' }
    ];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'child_process') {
            return {
                spawnSync() {
                    throw new Error('raw spawnSync should not be used for backup push commands');
                }
            };
        }

        if (request === './env/runCommand') {
            return {
                runCommand(command, args, options) {
                    runCommandCalls.push({ command, args, options });
                    return responses[runCommandCalls.length - 1] ?? { status: 0, stdout: 'unexpected extra command', stderr: '' };
                }
            };
        }

        return originalLoad(request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./backupService')];
        const { pushBackupToRepo } = require('./backupService');

        const snapshotDir = '/tmp/snapshot';
        const repoUrl = 'https://example.com/repo.git';
        const logs = pushBackupToRepo(snapshotDir, repoUrl);

        assert.deepEqual(runCommandCalls, [
            { command: 'git', args: ['init'], options: { cwd: snapshotDir } },
            { command: 'git', args: ['add', '.'], options: { cwd: snapshotDir } }
        ]);

        assert.deepEqual(logs, [
            { bin: 'git', args: ['init'], code: 0, stdout: 'ok git init', stderr: '' },
            { bin: 'git', args: ['add', '.'], code: 1, stdout: '', stderr: 'fatal: add failed' }
        ]);
    } finally {
        Module._load = originalLoad;
        delete require.cache[require.resolve('./backupService')];
    }
});

test('pushBackupToRepoOutcome returns structured success envelope and preserves command logs', () => {
    const originalLoad = Module._load;
    const runCommandCalls = [];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === './env/runCommand') {
            return {
                runCommand(command, args, options) {
                    runCommandCalls.push({ command, args, options });
                    return {
                        status: 0,
                        stdout: `ok ${command} ${args.join(' ')}`,
                        stderr: ''
                    };
                }
            };
        }

        if (request === './rssService') {
            return {
                exportSubscriptions() {
                    return '';
                }
            };
        }

        return originalLoad(request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./backupService')];
        const { pushBackupToRepoOutcome } = require('./backupService');

        const result = pushBackupToRepoOutcome('/tmp/snapshot', 'https://example.com/repo.git');
        assert.equal(result.ok, true);
        assert.equal(result.code, 'ok');
        assert.equal(result.category, 'runtime');
        assert.equal(Array.isArray(result.logs), true);
        assert.equal(result.logs.length, 6);
        assert.equal(runCommandCalls.length, 6);
    } finally {
        Module._load = originalLoad;
        delete require.cache[require.resolve('./backupService')];
    }
});

test('pushBackupToRepoOutcome returns structured failure envelope without flattening', () => {
    const originalLoad = Module._load;
    const responses = [
        { status: 0, stdout: 'ok init', stderr: '' },
        { status: 1, stdout: '', stderr: 'fatal add failed' }
    ];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === './env/runCommand') {
            return {
                runCommand() {
                    return responses.shift() || { status: 0, stdout: 'ok', stderr: '' };
                }
            };
        }

        if (request === './rssService') {
            return {
                exportSubscriptions() {
                    return '';
                }
            };
        }

        return originalLoad(request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./backupService')];
        const { pushBackupToRepoOutcome } = require('./backupService');

        const result = pushBackupToRepoOutcome('/tmp/snapshot', 'https://example.com/repo.git');
        assert.equal(result.ok, false);
        assert.equal(result.code, 'runtime_error');
        assert.equal(result.category, 'runtime');
        assert.equal(result.logs.length, 2);
        assert.match(result.userMessage || '', /备份/);
        assert.equal(Array.isArray(result.causes), true);
        assert.equal(result.causes.length, 1);
        assert.match(result.causes[0]?.message || '', /fatal add failed/);
    } finally {
        Module._load = originalLoad;
        delete require.cache[require.resolve('./backupService')];
    }
});

test('backupWorkspace rejects nested backupDir inside projectDir', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-backup-project-nested-'));
    const nestedBackupDir = path.join(projectDir, '.bfe-backup');

    const { service } = loadBackupServiceWithRssStub();

    try {
        assert.throws(
            () => service.backupWorkspace({
                projectDir,
                backupDir: nestedBackupDir,
                metadata: { source: 'test' }
            }),
            /备份目录不能位于项目目录内部/
        );
    } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
    }
});

test('backupWorkspace snapshot excludes .git directory content', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-backup-project-git-'));
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-backup-target-git-'));

    const gitDir = path.join(projectDir, '.git');
    fs.mkdirSync(path.join(gitDir, 'objects'), { recursive: true });
    fs.writeFileSync(path.join(gitDir, 'config'), 'secret-config', 'utf-8');
    fs.writeFileSync(path.join(gitDir, 'objects', 'packfile'), 'secret-pack', 'utf-8');
    fs.writeFileSync(path.join(projectDir, 'README.md'), '# blog', 'utf-8');

    const { service } = loadBackupServiceWithRssStub();

    try {
        const snapshotDir = service.backupWorkspace({
            projectDir,
            backupDir,
            metadata: { source: 'test' }
        });

        assert.equal(fs.existsSync(path.join(snapshotDir, '.git')), false);
        assert.equal(fs.existsSync(path.join(snapshotDir, 'README.md')), true);
    } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
        fs.rmSync(backupDir, { recursive: true, force: true });
    }
});

test('pushBackupToRepo injects transient GitHub auth for push without leaking token into logs', () => {
    const originalLoad = Module._load;
    const runCommandCalls = [];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === './env/runCommand') {
            return {
                runCommand(command, args, options) {
                    runCommandCalls.push({ command, args, options });
                    return {
                        status: 0,
                        stdout: '',
                        stderr: ''
                    };
                }
            };
        }

        if (request === './githubAuthService') {
            return {
                getAccessTokenForPrivilegedUse() {
                    return 'gho_super_secret_token';
                }
            };
        }

        return originalLoad(request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./backupService')];
        const { pushBackupToRepo } = require('./backupService');

        const snapshotDir = '/tmp/snapshot';
        const repoUrl = 'https://github.com/alice/BFE.git';
        const logs = pushBackupToRepo(snapshotDir, repoUrl);

        const pushCall = runCommandCalls.find((entry) => entry.args[0] === 'push');
        assert.equal(Boolean(pushCall), true);
        assert.equal(typeof pushCall.options.env.GIT_CONFIG_COUNT, 'string');
        assert.match(pushCall.options.env.GIT_CONFIG_KEY_0, /^http\..*\.extraheader$/);
        assert.match(pushCall.options.env.GIT_CONFIG_VALUE_0, /^AUTHORIZATION: basic\s+/i);
        assert.equal(pushCall.options.env.GIT_CONFIG_VALUE_0.includes('gho_super_secret_token'), false);

        assert.equal(JSON.stringify(logs).includes('gho_super_secret_token'), false);
        assert.equal(pushCall.args.join(' ').includes('gho_super_secret_token'), false);
    } finally {
        Module._load = originalLoad;
        delete require.cache[require.resolve('./backupService')];
    }
});

test('pushBackupToRepo configures git identity before commit when identity is provided', () => {
    const originalLoad = Module._load;
    const runCommandCalls = [];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === './env/runCommand') {
            return {
                runCommand(command, args, options) {
                    runCommandCalls.push({ command, args, options });
                    return {
                        status: 0,
                        stdout: '',
                        stderr: ''
                    };
                }
            };
        }

        if (request === './githubAuthService') {
            return {
                getAccessTokenForPrivilegedUse() {
                    return 'gho_super_secret_token';
                }
            };
        }

        return originalLoad(request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./backupService')];
        const { pushBackupToRepo } = require('./backupService');

        pushBackupToRepo('/tmp/snapshot', 'https://github.com/alice/BFE.git', {
            name: 'alice',
            email: 'alice@example.com'
        });

        assert.deepEqual(runCommandCalls.map((entry) => ({ command: entry.command, args: entry.args })), [
            { command: 'git', args: ['init'] },
            { command: 'git', args: ['config', 'user.name', 'alice'] },
            { command: 'git', args: ['config', 'user.email', 'alice@example.com'] },
            { command: 'git', args: ['add', '.'] },
            { command: 'git', args: ['commit', '-m', 'chore: backup blog workspace'] },
            { command: 'git', args: ['branch', '-M', 'main'] },
            { command: 'git', args: ['remote', 'add', 'origin', 'https://github.com/alice/BFE.git'] },
            { command: 'git', args: ['push', '-u', 'origin', 'main'] }
        ]);
    } finally {
        Module._load = originalLoad;
        delete require.cache[require.resolve('./backupService')];
    }
});
