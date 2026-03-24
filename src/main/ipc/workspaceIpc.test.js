const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

function loadWorkspaceIpcModule({ framework = 'hugo', inferredThemeId = 'stack' } = {}) {
    const originalLoad = Module._load;
    const handlers = new Map();
    const state = { workspaces: [] };

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

        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./workspaceIpc')];
        const workspaceIpc = require('./workspaceIpc');
        return {
            handlers,
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

test('workspace import stores inferred recognized theme id', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-workspace-import-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    const moduleRef = loadWorkspaceIpcModule({ framework: 'hugo', inferredThemeId: 'stack' });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:import');
    assert.equal(typeof handler, 'function');

    const result = await handler({}, { projectDir, name: 'Imported Blog' });
    assert.equal(result.workspace.framework, 'hugo');
    assert.equal(result.workspace.theme, 'stack');
});
