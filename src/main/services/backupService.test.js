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
