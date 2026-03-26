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
