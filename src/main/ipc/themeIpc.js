function registerThemeIpcHandlers({
    ipcMain,
    getWorkspacePolicy,
    getThemeCatalog,
    readThemeConfig,
    saveThemeConfig,
    validateThemeSettings,
    saveLocalAssetToBlog,
    applyPreviewOverrides,
    uploadImageToRepo
}) {
    function resolveWorkspace(payload) {
        const policy = typeof getWorkspacePolicy === 'function' ? getWorkspacePolicy() : null;
        if (!policy || typeof policy.getManagedWorkspace !== 'function' || typeof policy.listManagedWorkspaces !== 'function') {
            throw new Error('缺少受管工作区策略，拒绝主题配置操作。');
        }

        const workspaceId = payload?.workspaceId;
        if (workspaceId) {
            return policy.getManagedWorkspace(workspaceId);
        }

        const projectDir = String(payload?.projectDir || '').trim();
        const framework = String(payload?.framework || '').trim();
        if (!projectDir || !framework) {
            throw new Error('缺少受管工作区上下文，拒绝主题配置操作。');
        }

        const normalize = typeof policy.normalizePath === 'function'
            ? (input) => policy.normalizePath(input)
            : (input) => String(input || '').trim();
        const normalizedProjectDir = normalize(projectDir);
        const matchedWorkspace = policy.listManagedWorkspaces().find((workspace) => {
            if (!workspace || !workspace.projectDir || !workspace.framework) {
                return false;
            }
            return normalize(workspace.projectDir) === normalizedProjectDir && workspace.framework === framework;
        });

        if (!matchedWorkspace) {
            throw new Error('未匹配到受管工作区，拒绝主题配置操作。');
        }

        return matchedWorkspace;
    }

    function withCanonicalWorkspace(payload) {
        const workspace = resolveWorkspace(payload);
        return {
            ...(payload || {}),
            workspaceId: workspace.id,
            projectDir: workspace.projectDir,
            framework: workspace.framework
        };
    }

    function withCanonicalUploadPayload(payload) {
        const canonicalPayload = withCanonicalWorkspace(payload);
        const policy = typeof getWorkspacePolicy === 'function' ? getWorkspacePolicy() : null;
        if (!policy || typeof policy.assertPathWithinWorkspace !== 'function') {
            throw new Error('缺少受管工作区路径策略，拒绝上传主题图片。');
        }

        return {
            ...canonicalPayload,
            localFilePath: policy.assertPathWithinWorkspace(
                canonicalPayload.workspaceId,
                canonicalPayload.localFilePath,
                '上传主题图片'
            )
        };
    }

    ipcMain.handle('theme:catalog', async () => getThemeCatalog());

    ipcMain.handle('theme:getConfig', async (_event, payload) => {
        const workspace = resolveWorkspace(payload);
        return readThemeConfig(workspace.projectDir, workspace.framework);
    });

    ipcMain.handle('theme:saveConfig', async (_event, payload) => {
        const workspace = resolveWorkspace(payload);
        saveThemeConfig(workspace.projectDir, workspace.framework, payload?.nextConfig);
        return { success: true };
    });

    ipcMain.handle('theme:validateSettings', async (_event, payload) => {
        return validateThemeSettings(payload);
    });

    ipcMain.handle('theme:saveLocalAsset', async (_event, payload) => {
        return saveLocalAssetToBlog(withCanonicalWorkspace(payload));
    });

    ipcMain.handle('theme:applyPreviewOverrides', async (_event, payload) => {
        return applyPreviewOverrides(withCanonicalWorkspace(payload));
    });

    ipcMain.handle('theme:uploadImageToGithub', async (_event, payload) => {
        return uploadImageToRepo(withCanonicalUploadPayload(payload));
    });
}

module.exports = {
    registerThemeIpcHandlers
};
