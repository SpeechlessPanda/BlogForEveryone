const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

function loadIpcWithMocks({
    openLocalPreviewResult,
    stopLocalPreviewResult = { ok: true, stopped: true },
    publishToGitHubResult = { ok: true, logs: [] }
}) {
    const handlers = new Map();
    const events = [];
    const registrarCalls = [];

    const mocks = {
        electron: {
            app: { getVersion: () => '1.1.0' },
            dialog: {},
            ipcMain: {
                handle(channel, handler) {
                    handlers.set(channel, handler);
                }
            }
        },
        './services/storeService': {
            readStore: () => ({ preferences: {}, workspaces: [] }),
            updateStore: (updater) => updater({ preferences: {} })
        },
        './services/themeService': {
            getThemeCatalog: async () => [],
            readThemeConfig: async () => ({}),
            saveThemeConfig: () => {},
            saveLocalAssetToBlog: async () => ({}),
            applyPreviewOverrides: async () => ({})
        },
        './services/configValidationService': {
            validateThemeSettings: async () => ({ ok: true }),
            validatePublishPayload: () => ({ ok: true, warnings: [] })
        },
        './services/publishService': {
            publishToGitHub: () => publishToGitHubResult
        },
        './services/githubRepoService': {
            uploadImageToRepo: async () => ({ ok: true })
        },
        './services/envService': {
            checkEnvironment: () => ({}),
            openInstaller: () => ({ ok: true }),
            autoInstallToolWithWinget: () => ({ ok: true }),
            ensurePnpm: () => ({ ok: true }),
            installDependenciesWithRetry: () => ({ ok: true })
        },
        './services/updateService': {
            checkForUpdatesNow: async () => ({}),
            quitAndInstallUpdate: () => ({ ok: true }),
            getUpdateState: () => ({ status: 'ready' })
        },
        './services/startupService': {
            getLaunchAtStartup: () => false,
            setLaunchAtStartup: () => ({ launchAtStartup: false, effective: false })
        },
        './services/previewService': {
            startLocalPreview: async () => ({ ok: true }),
            openLocalPreview: () => openLocalPreviewResult,
            stopLocalPreview: () => stopLocalPreviewResult
        },
        './services/rssService': {
            listSubscriptions: async () => [],
            addSubscription: async () => ({}),
            removeSubscription: async () => ({}),
            syncSubscriptions: async () => ({}),
            exportSubscriptions: async () => ({}),
            importSubscriptions: async () => ({}),
            markItemRead: async () => ({}),
            getUnreadSummary: async () => ({ totalUnread: 0 }),
            setAutoSyncEnabled: () => {},
            getAutoSyncState: () => ({})
        },
        './policies/workspacePathPolicy': {
            createWorkspacePathPolicy: () => ({})
        },
        './ipc/workspaceIpc': {
            registerWorkspaceIpcHandlers: (args) => {
                registrarCalls.push({ name: 'workspace', args });
            }
        },
        './ipc/contentIpc': {
            registerContentIpcHandlers: (args) => {
                registrarCalls.push({ name: 'content', args });
            }
        },
        './ipc/authIpc': {
            registerAuthIpcHandlers: (args) => {
                registrarCalls.push({ name: 'auth', args });
            }
        },
        './ipc/appIpc': {
            registerAppIpcHandlers: (args) => {
                registrarCalls.push({ name: 'app', args });
            }
        },
        './ipc/envIpc': {
            registerEnvIpcHandlers: (args) => {
                registrarCalls.push({ name: 'env', args });
            }
        },
        './ipc/themeIpc': {
            registerThemeIpcHandlers: (args) => {
                registrarCalls.push({ name: 'theme', args });
            }
        },
        './ipc/previewIpc': {
            registerPreviewIpcHandlers: (args) => {
                registrarCalls.push({ name: 'preview', args });
                args.ipcMain.handle('preview:open', async (event, payload) => {
                    const opId = `preview-open-${Date.now()}`;
                    const result = args.evaluatePreviewOpenResult(args.openLocalPreview(payload));
                    args.emitOperationEvent(event.sender, {
                        opId,
                        scope: 'preview',
                        phase: result.phase,
                        framework: payload?.framework,
                        url: result.url || '',
                        message: result.message
                    });
                    return { ...result, opId };
                });

                args.ipcMain.handle('preview:stop', async (event, payload) => {
                    const opId = `preview-stop-${Date.now()}`;
                    const result = args.evaluatePreviewStopResult(args.stopLocalPreview(payload));
                    args.emitOperationEvent(event.sender, {
                        opId,
                        scope: 'preview',
                        phase: result.phase,
                        framework: payload?.framework,
                        message: result.message
                    });
                    return { ...result, opId };
                });
            }
        },
        './ipc/publishIpc': {
            registerPublishIpcHandlers: (args) => {
                registrarCalls.push({ name: 'publish', args });
                args.ipcMain.handle('publish:github', async (event, payload) => {
                    const opId = `publish-${Date.now()}`;
                    const validation = args.validatePublishPayload(payload);
                    if (!validation.ok) {
                        args.emitOperationEvent(event.sender, {
                            opId,
                            scope: 'publish',
                            phase: 'failed',
                            message: validation.errors.join('；')
                        });
                        throw new Error(validation.errors.join('；'));
                    }

                    args.emitOperationEvent(event.sender, {
                        opId,
                        scope: 'publish',
                        phase: 'started',
                        framework: payload.framework,
                        mode: payload.publishMode || 'actions',
                        message: '开始发布流程。'
                    });

                    const result = args.normalizePublishResult(args.publishToGitHub(payload));
                    args.emitOperationEvent(event.sender, {
                        opId,
                        scope: 'publish',
                        phase: result.ok ? 'succeeded' : 'failed',
                        framework: payload.framework,
                        mode: payload.publishMode || 'actions',
                        pagesUrl: result.ok ? (result.pagesUrl || '') : '',
                        message: result.ok ? '发布流程完成。' : (result.message || '发布流程失败。')
                    });

                    return {
                        ...result,
                        opId,
                        validationWarnings: validation.warnings || []
                    };
                });
            }
        },
        './ipc/rssIpc': {
            registerRssIpcHandlers: (args) => {
                registrarCalls.push({ name: 'rss', args });
            }
        }
    };

    const originalLoad = Module._load;
    Module._load = function patchedLoad(request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) {
            return mocks[request];
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    const ipcPath = path.join(__dirname, 'ipc.js');
    delete require.cache[ipcPath];
    const ipcModule = require('./ipc');
    Module._load = originalLoad;

    ipcModule.registerIpcHandlers();

    return {
        invokePublish: async (payload) => {
            const handler = handlers.get('publish:github');
            const event = {
                sender: {
                    send(_channel, payloadBody) {
                        events.push(payloadBody);
                    }
                }
            };
            const response = await handler(event, payload);
            return { response, events };
        },
        invokePreviewOpen: async (payload) => {
            const handler = handlers.get('preview:open');
            const event = {
                sender: {
                    send(_channel, payloadBody) {
                        events.push(payloadBody);
                    }
                }
            };
            const response = await handler(event, payload);
            return { response, events };
        },
        invokePreviewStop: async (payload) => {
            const handler = handlers.get('preview:stop');
            const event = {
                sender: {
                    send(_channel, payloadBody) {
                        events.push(payloadBody);
                    }
                }
            };
            const response = await handler(event, payload);
            return { response, events };
        },
        registrarCalls
    };
}

test('ipc registers domain registrar modules as aggregator', () => {
    const harness = loadIpcWithMocks({
        openLocalPreviewResult: { ok: true, url: 'http://localhost:4000/' }
    });

    const registeredDomains = new Set(harness.registrarCalls.map((item) => item.name));

    assert.equal(registeredDomains.has('auth'), true);
    assert.equal(registeredDomains.has('app'), true);
    assert.equal(registeredDomains.has('env'), true);
    assert.equal(registeredDomains.has('theme'), true);
    assert.equal(registeredDomains.has('preview'), true);
    assert.equal(registeredDomains.has('publish'), true);
    assert.equal(registeredDomains.has('rss'), true);
    assert.equal(registeredDomains.has('workspace'), true);
    assert.equal(registeredDomains.has('content'), true);
});

test('ipc passes shared dependencies into domain registrars', () => {
    const harness = loadIpcWithMocks({
        openLocalPreviewResult: { ok: true, url: 'http://localhost:4000/' }
    });

    const appRegistrar = harness.registrarCalls.find((item) => item.name === 'app');
    const envRegistrar = harness.registrarCalls.find((item) => item.name === 'env');
    const themeRegistrar = harness.registrarCalls.find((item) => item.name === 'theme');
    const previewRegistrar = harness.registrarCalls.find((item) => item.name === 'preview');
    const publishRegistrar = harness.registrarCalls.find((item) => item.name === 'publish');
    const rssRegistrar = harness.registrarCalls.find((item) => item.name === 'rss');

    assert.equal(typeof appRegistrar?.args?.ipcMain?.handle, 'function');
    assert.equal(typeof appRegistrar?.args?.emitOperationEvent, 'function');
    assert.equal(typeof envRegistrar?.args?.ipcMain?.handle, 'function');
    assert.equal(typeof themeRegistrar?.args?.ipcMain?.handle, 'function');
    assert.equal(typeof previewRegistrar?.args?.emitOperationEvent, 'function');
    assert.equal(typeof publishRegistrar?.args?.emitOperationEvent, 'function');
    assert.equal(typeof rssRegistrar?.args?.ipcMain?.handle, 'function');
});

test('preview:open emits failed event when preview url is blocked', async () => {
    const harness = loadIpcWithMocks({
        openLocalPreviewResult: {
            ok: false,
            reason: 'PREVIEW_URL_BLOCKED',
            message: '预览地址不受信任，已阻止打开。'
        }
    });

    const { events } = await harness.invokePreviewOpen({ framework: 'hexo' });

    assert.equal(events.length, 1);
    assert.equal(events[0].scope, 'preview');
    assert.equal(events[0].phase, 'failed');
    assert.equal(events[0].message, '预览地址不受信任，已阻止打开。');
});

test('publish:github emits failed event when publish result is not ok', async () => {
    const harness = loadIpcWithMocks({
        openLocalPreviewResult: { ok: true, url: 'http://localhost:4000/' },
        publishToGitHubResult: {
            ok: false,
            mode: 'actions',
            message: 'Git push 失败。',
            logs: []
        }
    });

    const { response, events } = await harness.invokePublish({
        projectDir: 'D:/tmp/project',
        framework: 'hexo',
        repoUrl: 'https://github.com/example/example.github.io.git',
        publishMode: 'actions'
    });

    assert.equal(response.ok, false);
    assert.equal(events.length, 2);
    assert.equal(events[1].scope, 'publish');
    assert.equal(events[1].phase, 'failed');
    assert.equal(events[1].message, 'Git push 失败。');
});

test('preview:stop emits failed event when no running preview process exists', async () => {
    const harness = loadIpcWithMocks({
        openLocalPreviewResult: { ok: true, url: 'http://localhost:4000/' },
        stopLocalPreviewResult: {
            ok: false,
            stopped: false,
            reason: 'PREVIEW_NOT_RUNNING',
            message: '当前没有正在运行的预览进程。'
        }
    });

    const { response, events } = await harness.invokePreviewStop({
        projectDir: 'D:/tmp/project',
        framework: 'hexo'
    });

    assert.equal(response.ok, false);
    assert.equal(events.length, 1);
    assert.equal(events[0].scope, 'preview');
    assert.equal(events[0].phase, 'failed');
    assert.equal(events[0].message, '当前没有正在运行的预览进程。');
});
