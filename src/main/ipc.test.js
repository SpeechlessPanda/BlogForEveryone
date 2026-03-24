const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadIpcModule({ inferredThemeId = 'unknown', framework = 'hexo' } = {}) {
    const originalLoad = Module._load;
    const handlers = new Map();
    const state = { workspaces: [] };

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'electron') {
            return {
                app: {
                    getVersion() {
                        return 'test-version';
                    },
                    isPackaged: false
                },
                ipcMain: {
                    handle(channel, handler) {
                        handlers.set(channel, handler);
                    }
                },
                dialog: {
                    async showOpenDialog() {
                        return { canceled: true, filePaths: [] };
                    }
                }
            };
        }

        if (request === './services/storeService') {
            return {
                readStore() {
                    return state;
                },
                updateStore(updater) {
                    return updater(state);
                }
            };
        }

        if (request === './services/frameworkService') {
            return {
                detectFramework() {
                    return framework;
                },
                async initProject() {
                    return { status: 0, stdout: '', stderr: '', logs: [] };
                }
            };
        }

        if (request === './services/themeService') {
            return {
                getThemeCatalog() {
                    return {};
                },
                readThemeConfig() {
                    return {};
                },
                saveThemeConfig() {},
                saveLocalAssetToBlog() {
                    return { ok: true };
                },
                async installAndApplyTheme() {
                    return { ok: true, logs: [] };
                },
                applyPreviewOverrides() {
                    return { ok: true };
                },
                inferRecognizedThemeIdFromProject() {
                    return inferredThemeId;
                }
            };
        }

        if (request === './services/frameworkToolingService') {
            return {
                async ensureFrameworkPublishPackages() {
                    return { ok: true, logs: [] };
                }
            };
        }

        if (request === './services/configValidationService') {
            return {
                validateThemeSettings() {
                    return { ok: true };
                },
                validatePublishPayload() {
                    return { ok: true, warnings: [] };
                }
            };
        }

        if (request === './services/publishService') {
            return {
                publishToGitHub() {
                    return { logs: [], pagesUrl: '' };
                }
            };
        }

        if (request === './services/githubRepoService') {
            return {
                uploadImageToRepo() {
                    return { ok: true };
                }
            };
        }

        if (request === './services/backupService') {
            return {
                backupWorkspace() {
                    return 'snapshot';
                },
                pushBackupToRepo() {
                    return [];
                }
            };
        }

        if (request === './services/envService') {
            return {
                checkEnvironment() {
                    return {};
                },
                openInstaller() {
                    return { ok: true };
                },
                autoInstallToolWithWinget() {
                    return { ok: true };
                },
                ensurePnpm() {
                    return { ok: true };
                },
                installDependenciesWithRetry() {
                    return { ok: true };
                }
            };
        }

        if (request === './services/githubAuthService') {
            return {
                beginDeviceLogin() {
                    return {};
                },
                completeDeviceLogin() {
                    return {};
                },
                loginWithDeviceCode() {
                    return {};
                },
                getAuthState() {
                    return {};
                },
                logout() {
                    return {};
                }
            };
        }

        if (request === './services/contentService') {
            return {
                createAndOpenContent() {
                    return {};
                },
                listExistingContents() {
                    return [];
                },
                readExistingContent() {
                    return {};
                },
                saveExistingContent() {
                    return {};
                },
                openExistingContent() {
                    return {};
                },
                watchSaveAndAutoPublish() {
                    return {};
                },
                getPublishJobStatus() {
                    return {};
                }
            };
        }

        if (request === './services/updateService') {
            return {
                checkForUpdatesNow() {
                    return {};
                },
                quitAndInstallUpdate() {},
                getUpdateState() {
                    return {};
                }
            };
        }

        if (request === './services/startupService') {
            return {
                getLaunchAtStartup() {
                    return false;
                },
                setLaunchAtStartup() {
                    return { launchAtStartup: false, effective: false };
                }
            };
        }

        if (request === './services/previewService') {
            return {
                async startLocalPreview() {
                    return { ok: true };
                },
                openLocalPreview() {
                    return { ok: true };
                },
                stopLocalPreview() {
                    return { ok: true, stopped: true };
                }
            };
        }

        if (request === './services/rssService') {
            return {
                listSubscriptions() {
                    return [];
                },
                async addSubscription() {
                    return [];
                },
                removeSubscription() {
                    return [];
                },
                async syncSubscriptions() {
                    return [];
                },
                exportSubscriptions() {
                    return '';
                },
                importSubscriptions() {
                    return { restored: 0, subscriptions: [] };
                },
                markItemRead() {
                    return [];
                },
                getUnreadSummary() {
                    return { totalUnread: 0, subscriptionCount: 0 };
                },
                setAutoSyncEnabled() {},
                getAutoSyncState() {
                    return { enabled: true, running: false };
                }
            };
        }

        return originalLoad(request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./ipc')];
        const ipcModule = require('./ipc');
        return { ipcModule, handlers };
    } finally {
        Module._load = originalLoad;
    }
}

test('workspace import stores inferred recognized theme id', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-ipc-import-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    const { ipcModule, handlers } = loadIpcModule({ inferredThemeId: 'stack', framework: 'hugo' });
    ipcModule.registerIpcHandlers();

    const handler = handlers.get('workspace:import');
    assert.equal(typeof handler, 'function');

    const result = await handler({}, { projectDir, name: 'Imported Blog' });
    assert.equal(result.workspace.framework, 'hugo');
    assert.equal(result.workspace.theme, 'stack');
});
