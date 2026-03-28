const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

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

function createWorkspacePolicy(workspaces, options = {}) {
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
        },
        normalizePath(inputPath) {
            if (typeof options.normalizePath === 'function') {
                return options.normalizePath(inputPath);
            }
            return path.resolve(String(inputPath || ''));
        },
        assertPathWithinWorkspace(workspaceId, candidatePath, action) {
            if (typeof options.assertPathWithinWorkspace === 'function') {
                return options.assertPathWithinWorkspace(workspaceId, candidatePath, action);
            }
            return path.resolve(String(candidatePath || ''));
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

test('theme:uploadImageToGithub rejects unmanaged payload and forwards canonicalized localFilePath', async () => {
    const harness = createIpcMainHarness();
    const uploadCalls = [];
    const managedWorkspace = {
        id: 'ws-upload',
        projectDir: 'D:/managed/blog-c',
        framework: 'hexo'
    };

    registerThemeIpcHandlers({
        ipcMain: harness.ipcMain,
        getWorkspacePolicy: () => createWorkspacePolicy([managedWorkspace], {
            assertPathWithinWorkspace(workspaceId, candidatePath, action) {
                assert.equal(workspaceId, 'ws-upload');
                assert.equal(action, '上传主题图片');
                if (String(candidatePath || '').includes('..\\outside') || String(candidatePath || '').includes('../outside')) {
                    throw new Error('路径越界，拒绝上传主题图片操作。');
                }
                return 'D:/managed/blog-c/source/images/canonical.png';
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
        () => uploadHandler({}, { projectDir: 'D:/unmanaged/blog', framework: 'hexo', localFilePath: 'D:/tmp/a.png' }),
        /未匹配到受管工作区|缺少受管工作区/
    );

    await assert.rejects(
        () => uploadHandler({}, {
            workspaceId: 'ws-upload',
            projectDir: 'D:/renderer/spoofed',
            framework: 'hugo',
            localFilePath: 'D:/managed/blog-c/..\\outside\\escape.png',
            owner: 'alice',
            repo: 'blog',
            branch: 'main',
            targetDir: 'assets/images'
        }),
        /路径越界/
    );

    await uploadHandler({}, {
        workspaceId: 'ws-upload',
        projectDir: 'D:/renderer/spoofed',
        framework: 'hugo',
        localFilePath: 'D:/managed/blog-c/source/images/raw.png',
        owner: 'alice',
        repo: 'blog',
        branch: 'main',
        targetDir: 'assets/images'
    });

    assert.equal(uploadCalls.length, 1);
    assert.equal(uploadCalls[0].workspaceId, 'ws-upload');
    assert.equal(uploadCalls[0].projectDir, 'D:/managed/blog-c');
    assert.equal(uploadCalls[0].framework, 'hexo');
    assert.equal(uploadCalls[0].localFilePath, 'D:/managed/blog-c/source/images/canonical.png');
});
