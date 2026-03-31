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
        getWorkspacePolicy: () => ({
            getManagedWorkspace() {
                throw new Error('缺少受管工作区 ID。');
            }
        }),
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
    await assert.rejects(() => installDepsHandler({}, undefined), /受管工作区/);

    assert.deepEqual(openResult, { ok: true, tool: undefined });
    assert.deepEqual(installResult, { ok: true, tool: undefined });
    assert.equal(installDependenciesCallCount, 0);
});

test('project:installDependencies resolves canonical managed workspace path before installer runs', async () => {
    const harness = createIpcMainHarness();
    const installCalls = [];

    registerEnvIpcHandlers({
        ipcMain: harness.ipcMain,
        checkEnvironment: () => ({ ready: true }),
        openInstaller: () => ({ ok: true }),
        autoInstallToolWithWinget: () => ({ ok: true }),
        ensurePnpm: () => ({ ok: true }),
        getWorkspacePolicy: () => ({
            getManagedWorkspace(workspaceId) {
                assert.equal(workspaceId, 'ws-1');
                return {
                    id: 'ws-1',
                    projectDir: 'D:/managed/workspace'
                };
            }
        }),
        installDependenciesWithRetry: (projectDir) => {
            installCalls.push(projectDir);
            return { ok: true, projectDir };
        }
    });

    const handler = harness.handlers.get('project:installDependencies');
    const result = await handler({}, {
        workspaceId: 'ws-1',
        projectDir: 'D:/untrusted/path'
    });

    assert.deepEqual(installCalls, ['D:/managed/workspace']);
    assert.deepEqual(result, { ok: true, projectDir: 'D:/managed/workspace' });
});

test('theme:getConfig and theme:saveConfig reject missing managed workspace context', async () => {
    const harness = createIpcMainHarness();
    const readCalls = [];
    const saveCalls = [];

    registerThemeIpcHandlers({
        ipcMain: harness.ipcMain,
        getWorkspacePolicy: () => ({
            getManagedWorkspace() {
                throw new Error('缺少受管工作区 ID。');
            },
            listManagedWorkspaces() {
                return [];
            }
        }),
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

    await assert.rejects(() => getConfigHandler({}, undefined), /受管工作区/);
    await assert.rejects(() => saveConfigHandler({}, undefined), /受管工作区/);

    assert.deepEqual(readCalls, []);
    assert.deepEqual(saveCalls, []);
});

test('theme:uploadImageToGithub rejects missing managed workspace context before upload service runs', async () => {
    const harness = createIpcMainHarness();
    const uploadCalls = [];

    registerThemeIpcHandlers({
        ipcMain: harness.ipcMain,
        getWorkspacePolicy: () => ({
            getManagedWorkspace() {
                throw new Error('缺少受管工作区 ID。');
            },
            listManagedWorkspaces() {
                return [];
            },
            normalizePath(inputPath) {
                return String(inputPath || '').trim();
            },
            assertPathWithinWorkspace() {
                throw new Error('路径越界，拒绝上传主题图片操作。');
            }
        }),
        getThemeCatalog: async () => [],
        readThemeConfig: async () => ({}),
        saveThemeConfig: () => {},
        validateThemeSettings: async () => ({ ok: true }),
        saveLocalAssetToBlog: async () => ({ ok: true }),
        applyPreviewOverrides: async () => ({ ok: true }),
        uploadImageToRepo: async (payload) => {
            uploadCalls.push(payload);
            return { ok: true };
        }
    });

    const uploadHandler = harness.handlers.get('theme:uploadImageToGithub');

    await assert.rejects(
        () => uploadHandler({}, undefined),
        /受管工作区/
    );

    assert.deepEqual(uploadCalls, []);
});
