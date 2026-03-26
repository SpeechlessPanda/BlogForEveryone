const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

function loadWorkspaceIpcModule({
    framework = 'hugo',
    inferredThemeId = 'stack',
    workflowCreateResult,
    workflowImportResult,
    workflowBackupResult
} = {}) {
    const originalLoad = Module._load;
    const handlers = new Map();
    const state = { workspaces: [] };
    const workflowCreateCalls = [];
    const workflowImportCalls = [];
    const workflowBackupCalls = [];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === '../services/storeService') {
            return {
                readStore() {
                    return state;
                },
                updateStore(updater) {
                    return updater(state);
                }
            };
        }

        if (request === '../services/frameworkService') {
            return {
                detectFramework() {
                    return framework;
                },
                initProject() {
                    throw new Error('initProject should not be called in import test');
                }
            };
        }

        if (request === '../services/themeService') {
            return {
                installAndApplyTheme() {
                    throw new Error('installAndApplyTheme should not be called in import test');
                },
                inferRecognizedThemeIdFromProject() {
                    return inferredThemeId;
                }
            };
        }

        if (request === '../services/frameworkToolingService') {
            return {
                ensureFrameworkPublishPackages() {
                    throw new Error('ensureFrameworkPublishPackages should not be called in import test');
                }
            };
        }

        if (request === '../services/backupService') {
            return {
                backupWorkspace() {
                    throw new Error('backupWorkspace should not be called in import test');
                },
                pushBackupToRepo() {
                    throw new Error('pushBackupToRepo should not be called in import test');
                }
            };
        }

        if (request === '../services/rssService') {
            return {
                importSubscriptions() {
                    return { restored: 0, subscriptions: [] };
                }
            };
        }

        if (request === '../policies/workspaceImportPolicy') {
            return {
                assertSupportedImportedFramework(value) {
                    return value;
                }
            };
        }

        if (request === '../app/workspaceWorkflowService') {
            return {
                createWorkspaceWorkflow(payload) {
                    workflowCreateCalls.push(payload);
                    return workflowCreateResult;
                },
                importWorkspaceWorkflow(payload) {
                    workflowImportCalls.push(payload);
                    return workflowImportResult;
                },
                backupWorkspaceWorkflow(payload) {
                    workflowBackupCalls.push(payload);
                    return workflowBackupResult;
                }
            };
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./workspaceIpc')];
        const workspaceIpc = require('./workspaceIpc');
        return {
            handlers,
            workflowCreateCalls,
            workflowImportCalls,
            workflowBackupCalls,
            register() {
                workspaceIpc.registerWorkspaceIpcHandlers({
                    ipcMain: {
                        handle(channel, handler) {
                            handlers.set(channel, handler);
                        }
                    },
                    getWorkspacePolicy() {
                        return {
                            assertPathWithinWorkspace(_id, targetPath) {
                                return targetPath;
                            }
                        };
                    }
                });
            }
        };
    } finally {
        Module._load = originalLoad;
    }
}

test('workspace create delegates to workflow boundary with thin payload passthrough', async () => {
    const workflowCreateResult = {
        workspace: { id: 'created-1', projectDir: '/tmp/created-1', framework: 'hugo', theme: 'stack' },
        workspaces: [{ id: 'created-1', projectDir: '/tmp/created-1', framework: 'hugo', theme: 'stack' }]
    };

    const moduleRef = loadWorkspaceIpcModule({ workflowCreateResult });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:create');
    assert.equal(typeof handler, 'function');

    const payload = {
        name: 'Created Blog',
        projectDir: path.resolve('/tmp/created-1'),
        framework: 'hugo',
        theme: 'stack'
    };
    const result = await handler({}, payload);

    assert.equal(moduleRef.workflowCreateCalls.length, 1);
    assert.deepEqual(moduleRef.workflowCreateCalls[0], payload);
    assert.deepEqual(result, workflowCreateResult);
});

test('workspace import delegates orchestration to workspace workflow service boundary', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-workspace-import-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    const workflowImportResult = {
        workspace: { id: 'from-workflow', projectDir, framework: 'hugo', theme: 'stack' },
        workspaces: [{ id: 'from-workflow', projectDir, framework: 'hugo', theme: 'stack' }],
        rssRestore: { restored: 1, subscriptions: [{ title: 'from-workflow' }] }
    };

    const moduleRef = loadWorkspaceIpcModule({
        framework: 'hugo',
        inferredThemeId: 'stack',
        workflowImportResult
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:import');
    assert.equal(typeof handler, 'function');

    const result = await handler({}, { projectDir, name: 'Imported Blog' });
    assert.equal(moduleRef.workflowImportCalls.length, 1);
    assert.deepEqual(moduleRef.workflowImportCalls[0], { projectDir, name: 'Imported Blog' });
    assert.deepEqual(result, workflowImportResult);
});

test('workspace import rejects relative user path before workflow orchestration', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-workspace-import-relative-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    const relativeProjectDir = path.relative(process.cwd(), projectDir);
    assert.equal(path.isAbsolute(relativeProjectDir), false);

    const moduleRef = loadWorkspaceIpcModule({
        workflowImportResult: {
            workspace: { id: 'unexpected', projectDir, framework: 'hugo', theme: 'stack' },
            workspaces: [{ id: 'unexpected', projectDir, framework: 'hugo', theme: 'stack' }],
            rssRestore: { restored: 0, subscriptions: [] }
        }
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:import');
    assert.equal(typeof handler, 'function');

    await assert.rejects(
        handler({}, { projectDir: relativeProjectDir, name: 'Relative Import' }),
        /工程路径必须为绝对路径，无法导入工程。/
    );

    assert.equal(moduleRef.workflowImportCalls.length, 0);
});

test('workspace backup delegates orchestration to workflow boundary', async () => {
    const workflowBackupResult = {
        snapshotDir: '/tmp/backup/snapshot-1',
        pushResult: ['git push']
    };

    const moduleRef = loadWorkspaceIpcModule({ workflowBackupResult });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:backup');
    assert.equal(typeof handler, 'function');

    const payload = {
        projectDir: '/tmp/source-site',
        backupDir: '/tmp/backup',
        repoUrl: 'https://example.com/repo.git',
        visibility: 'private'
    };
    const result = await handler({}, payload);

    assert.equal(moduleRef.workflowBackupCalls.length, 1);
    assert.deepEqual(moduleRef.workflowBackupCalls[0], payload);
    assert.deepEqual(result, workflowBackupResult);
});
