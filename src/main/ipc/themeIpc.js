function registerThemeIpcHandlers({
    ipcMain,
    getThemeCatalog,
    readThemeConfig,
    saveThemeConfig,
    validateThemeSettings,
    saveLocalAssetToBlog,
    applyPreviewOverrides,
    uploadImageToRepo
}) {
    ipcMain.handle('theme:catalog', async () => getThemeCatalog());

    ipcMain.handle('theme:getConfig', async (_event, payload) => {
        const { projectDir, framework } = payload || {};
        return readThemeConfig(projectDir, framework);
    });

    ipcMain.handle('theme:saveConfig', async (_event, payload) => {
        const { projectDir, framework, nextConfig } = payload || {};
        saveThemeConfig(projectDir, framework, nextConfig);
        return { success: true };
    });

    ipcMain.handle('theme:validateSettings', async (_event, payload) => {
        return validateThemeSettings(payload);
    });

    ipcMain.handle('theme:saveLocalAsset', async (_event, payload) => {
        return saveLocalAssetToBlog(payload);
    });

    ipcMain.handle('theme:applyPreviewOverrides', async (_event, payload) => {
        return applyPreviewOverrides(payload);
    });

    ipcMain.handle('theme:uploadImageToGithub', async (_event, payload) => {
        return uploadImageToRepo(payload);
    });
}

module.exports = {
    registerThemeIpcHandlers
};
