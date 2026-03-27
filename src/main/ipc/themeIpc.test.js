const test = require('node:test');
const assert = require('node:assert/strict');

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

function createWorkspacePolicy(workspaces) {
    return {
        getManagedWorkspace(workspaceId) {
            if (!workspaceId) {
                throw new Error('缺少受管工作区 ID。');
            }
            const matched = workspaces.find((item) => item.id === workspaceId);
            if (!matched) {
                throw new Error('未找到受管工作区。');
            }
            return matched;
        },
        listManagedWorkspaces() {
            return workspaces;
        }
    };
}

test('theme:getConfig resolves managed workspace by workspaceId and rewrites context', async () => {
    const harness = createIpcMainHarness();
    const readCalls = [];
    const managedWorkspace = {
        id: 'ws-1',
        projectDir: 'D:/managed/blog-a',
        framework: 'hugo'
    };

    registerThemeIpcHandlers({
        ipcMain: harness.ipcMain,
        getWorkspacePolicy: () => createWorkspacePolicy([managedWorkspace]),
        getThemeCatalog: async () => [],
        readThemeConfig: async (projectDir, framework) => {
            readCalls.push({ projectDir, framework });
            return { ok: true };
        },
        saveThemeConfig: () => {},
        validateThemeSettings: async () => ({ ok: true }),
        saveLocalAssetToBlog: async () => ({ ok: true }),
        applyPreviewOverrides: async () => ({ ok: true }),
        uploadImageToRepo: async () => ({ ok: true })
    });

    const handler = harness.handlers.get('theme:getConfig');
    const result = await handler({}, {
        workspaceId: 'ws-1',
        projectDir: 'D:/spoofed/path',
        framework: 'hexo'
    });

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(readCalls, [{ projectDir: 'D:/managed/blog-a', framework: 'hugo' }]);
});

test('theme:saveLocalAsset and theme:applyPreviewOverrides reject unmanaged payload', async () => {
    const harness = createIpcMainHarness();

    registerThemeIpcHandlers({
        ipcMain: harness.ipcMain,
        getWorkspacePolicy: () => createWorkspacePolicy([]),
        getThemeCatalog: async () => [],
        readThemeConfig: async () => ({}),
        saveThemeConfig: () => {},
        validateThemeSettings: async () => ({ ok: true }),
        saveLocalAssetToBlog: async () => ({ ok: true }),
        applyPreviewOverrides: async () => ({ ok: true }),
        uploadImageToRepo: async () => ({ ok: true })
    });

    const saveAssetHandler = harness.handlers.get('theme:saveLocalAsset');
    const applyPreviewHandler = harness.handlers.get('theme:applyPreviewOverrides');

    await assert.rejects(
        () => saveAssetHandler({}, { projectDir: 'D:/unmanaged/blog', framework: 'hugo' }),
        /未匹配到受管工作区/
    );
    await assert.rejects(
        () => applyPreviewHandler({}, { workspaceId: 'missing-id' }),
        /未找到受管工作区/
    );
});

test('theme:saveLocalAsset and theme:applyPreviewOverrides rewrite payload to canonical workspace context', async () => {
    const harness = createIpcMainHarness();
    const saveAssetCalls = [];
    const applyPreviewCalls = [];
    const managedWorkspace = {
        id: 'ws-asset',
        projectDir: 'D:/managed/blog-b',
        framework: 'hexo'
    };

    registerThemeIpcHandlers({
        ipcMain: harness.ipcMain,
        getWorkspacePolicy: () => createWorkspacePolicy([managedWorkspace]),
        getThemeCatalog: async () => [],
        readThemeConfig: async () => ({}),
        saveThemeConfig: () => {},
        validateThemeSettings: async () => ({ ok: true }),
        saveLocalAssetToBlog: async (payload) => {
            saveAssetCalls.push(payload);
            return { ok: true };
        },
        applyPreviewOverrides: async (payload) => {
            applyPreviewCalls.push(payload);
            return { ok: true };
        },
        uploadImageToRepo: async () => ({ ok: true })
    });

    const saveAssetHandler = harness.handlers.get('theme:saveLocalAsset');
    const applyPreviewHandler = harness.handlers.get('theme:applyPreviewOverrides');

    await saveAssetHandler({}, {
        workspaceId: 'ws-asset',
        projectDir: 'D:/renderer/spoofed',
        framework: 'hugo',
        localFilePath: 'D:/tmp/a.png'
    });
    await applyPreviewHandler({}, {
        projectDir: 'D:/managed/blog-b',
        framework: 'hexo',
        themeId: 'next'
    });

    assert.equal(saveAssetCalls.length, 1);
    assert.equal(saveAssetCalls[0].projectDir, 'D:/managed/blog-b');
    assert.equal(saveAssetCalls[0].framework, 'hexo');

    assert.equal(applyPreviewCalls.length, 1);
    assert.equal(applyPreviewCalls[0].projectDir, 'D:/managed/blog-b');
    assert.equal(applyPreviewCalls[0].framework, 'hexo');
});
