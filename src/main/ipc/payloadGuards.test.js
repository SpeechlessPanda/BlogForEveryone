const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAppIpcHandlers } = require('./appIpc');
const { registerEnvIpcHandlers } = require('./envIpc');
const { registerThemeIpcHandlers } = require('./themeIpc');

function createIpcMainHarness() {
    const handlers = new Map();
    return {
        ipcMain: {
            handle(channel, handler) {
                handlers.set(channel, handler);
            }
        },
        handlers
    };
}

test('app:savePreferences does not crash when payload is missing', async () => {
    const harness = createIpcMainHarness();

    registerAppIpcHandlers({
        ipcMain: harness.ipcMain,
        app: { getVersion: () => '1.1.0', isPackaged: false },
        dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
        checkEnvironment: () => ({}),
        getUpdateState: () => ({ status: 'idle' }),
        readStore: () => ({ preferences: {} }),
        getLaunchAtStartup: () => false,
        updateStore: (updater) => updater({ preferences: {} }),
        setLaunchAtStartup: () => ({ launchAtStartup: false, effective: false }),
        setAutoSyncEnabled: () => {},
        getAutoSyncState: () => ({ enabled: true }),
        checkForUpdatesNow: async () => ({ ok: true }),
        quitAndInstallUpdate: () => ({ ok: true })
    });

    const handler = harness.handlers.get('app:savePreferences');
    const result = await handler({}, undefined);

    assert.equal(result.preferences.generateBlogRss, true);
    assert.equal(result.preferences.autoSyncRssSubscriptions, true);
    assert.equal(result.preferences.launchAtStartup, false);
});

test('env handlers do not crash when payload is missing', async () => {
    const harness = createIpcMainHarness();
    let installDependenciesCallCount = 0;

    registerEnvIpcHandlers({
        ipcMain: harness.ipcMain,
        checkEnvironment: () => ({ ready: true }),
        openInstaller: (tool) => ({ ok: true, tool }),
        autoInstallToolWithWinget: (tool) => ({ ok: true, tool }),
        ensurePnpm: () => ({ ok: true }),
        installDependenciesWithRetry: (projectDir) => {
            installDependenciesCallCount += 1;
            return { ok: true, projectDir };
        }
    });

    const openInstallerHandler = harness.handlers.get('env:openInstaller');
    const autoInstallHandler = harness.handlers.get('env:autoInstallTool');
    const installDepsHandler = harness.handlers.get('project:installDependencies');

    const openResult = await openInstallerHandler({}, undefined);
    const installResult = await autoInstallHandler({}, undefined);
    const depsResult = await installDepsHandler({}, undefined);

    assert.deepEqual(openResult, { ok: true, tool: undefined });
    assert.deepEqual(installResult, { ok: true, tool: undefined });
    assert.deepEqual(depsResult, {
        ok: false,
        reason: 'PROJECT_DIR_MISSING',
        message: '缺少项目目录，无法安装依赖。'
    });
    assert.equal(installDependenciesCallCount, 0);
});

test('theme:getConfig and theme:saveConfig do not crash when payload is missing', async () => {
    const harness = createIpcMainHarness();
    const readCalls = [];
    const saveCalls = [];

    registerThemeIpcHandlers({
        ipcMain: harness.ipcMain,
        getThemeCatalog: async () => [],
        readThemeConfig: async (projectDir, framework) => {
            readCalls.push({ projectDir, framework });
            return { ok: true };
        },
        saveThemeConfig: (projectDir, framework, nextConfig) => {
            saveCalls.push({ projectDir, framework, nextConfig });
        },
        validateThemeSettings: async () => ({ ok: true }),
        saveLocalAssetToBlog: async () => ({ ok: true }),
        applyPreviewOverrides: async () => ({ ok: true }),
        uploadImageToRepo: async () => ({ ok: true })
    });

    const getConfigHandler = harness.handlers.get('theme:getConfig');
    const saveConfigHandler = harness.handlers.get('theme:saveConfig');

    const getResult = await getConfigHandler({}, undefined);
    const saveResult = await saveConfigHandler({}, undefined);

    assert.deepEqual(getResult, { ok: true });
    assert.deepEqual(saveResult, { success: true });
    assert.deepEqual(readCalls, [{ projectDir: undefined, framework: undefined }]);
    assert.deepEqual(saveCalls, [{ projectDir: undefined, framework: undefined, nextConfig: undefined }]);
});
