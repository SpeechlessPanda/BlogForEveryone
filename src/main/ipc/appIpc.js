function registerAppIpcHandlers({
    ipcMain,
    app,
    dialog,
    checkEnvironment,
    getUpdateState,
    readStore,
    getLaunchAtStartup,
    updateStore,
    setLaunchAtStartup,
    setAutoSyncEnabled,
    getAutoSyncState,
    checkForUpdatesNow,
    quitAndInstallUpdate
}) {
    ipcMain.handle('app:getState', async () => {
        return {
            appName: 'BlogForEveryone',
            version: app.getVersion(),
            env: checkEnvironment()
        };
    });

    ipcMain.handle('app:getUpdateState', async () => {
        return getUpdateState();
    });

    ipcMain.handle('app:getPreferences', async () => {
        const state = readStore();
        const launchAtStartup = getLaunchAtStartup();
        const current = state.preferences || {};
        return {
            ...current,
            generateBlogRss: current.generateBlogRss ?? true,
            autoSyncRssSubscriptions: current.autoSyncRssSubscriptions ?? true,
            launchAtStartup: current.launchAtStartup ?? launchAtStartup
        };
    });

    ipcMain.handle('app:savePreferences', async (_event, payload) => {
        const safePayload = payload || {};
        const next = updateStore((state) => {
            const current = state.preferences || {};
            state.preferences = {
                generateBlogRss: safePayload.generateBlogRss ?? current.generateBlogRss ?? true,
                autoSyncRssSubscriptions: safePayload.autoSyncRssSubscriptions ?? current.autoSyncRssSubscriptions ?? true,
                launchAtStartup: safePayload.launchAtStartup ?? current.launchAtStartup ?? false
            };
            return state;
        });

        let launchSetting = { launchAtStartup: getLaunchAtStartup(), effective: app.isPackaged };
        if (typeof safePayload.launchAtStartup === 'boolean') {
            launchSetting = setLaunchAtStartup(safePayload.launchAtStartup);
            next.preferences.launchAtStartup = launchSetting.launchAtStartup;
        }

        setAutoSyncEnabled(next.preferences.autoSyncRssSubscriptions !== false);
        return {
            preferences: next.preferences,
            rssAutoSync: getAutoSyncState(),
            launchAtStartup: launchSetting
        };
    });

    ipcMain.handle('app:checkUpdatesNow', async () => {
        return checkForUpdatesNow();
    });

    ipcMain.handle('app:installUpdateNow', async () => {
        return quitAndInstallUpdate();
    });

    ipcMain.handle('app:pickDirectory', async (_event, payload) => {
        const result = await dialog.showOpenDialog({
            title: payload?.title || '选择文件夹',
            defaultPath: payload?.defaultPath,
            properties: ['openDirectory', 'createDirectory']
        });

        if (result.canceled || !result.filePaths?.length) {
            return { canceled: true, path: '' };
        }
        return { canceled: false, path: result.filePaths[0] };
    });

    ipcMain.handle('app:pickFile', async (_event, payload) => {
        const result = await dialog.showOpenDialog({
            title: payload?.title || '选择文件',
            defaultPath: payload?.defaultPath,
            filters: payload?.filters,
            properties: ['openFile']
        });

        if (result.canceled || !result.filePaths?.length) {
            return { canceled: true, path: '' };
        }
        return { canceled: false, path: result.filePaths[0] };
    });
}

module.exports = {
    registerAppIpcHandlers
};
