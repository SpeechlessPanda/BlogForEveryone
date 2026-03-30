const { contextBridge, ipcRenderer } = require('electron');

function invokeAuth(channel, payload) {
    return ipcRenderer.invoke(channel, payload);
}

function createBfeApi({ ipcRenderer: shellIpcRenderer }) {
    function invokeAuthWithRenderer(channel, payload) {
        return shellIpcRenderer.invoke(channel, payload);
    }

    return {
        getAppState: () => shellIpcRenderer.invoke('app:getState'),
        getPreferences: () => shellIpcRenderer.invoke('app:getPreferences'),
        savePreferences: (payload) => shellIpcRenderer.invoke('app:savePreferences', payload),
        getUpdateState: () => shellIpcRenderer.invoke('app:getUpdateState'),
        checkUpdatesNow: () => shellIpcRenderer.invoke('app:checkUpdatesNow'),
        installUpdateNow: () => shellIpcRenderer.invoke('app:installUpdateNow'),
        onUpdateStatus: (listener) => {
            const handler = (_event, payload) => listener(payload);
            shellIpcRenderer.on('app:updateStatus', handler);
            return () => {
                shellIpcRenderer.removeListener('app:updateStatus', handler);
            };
        },
        getEnvironmentStatus: () => shellIpcRenderer.invoke('env:status'),
        openInstaller: (payload) => shellIpcRenderer.invoke('env:openInstaller', payload),
        autoInstallTool: (payload) => shellIpcRenderer.invoke('env:autoInstallTool', payload),
        ensurePnpm: () => shellIpcRenderer.invoke('env:ensurePnpm'),
        installProjectDependencies: (payload) => shellIpcRenderer.invoke('project:installDependencies', payload),
        beginGithubDeviceLogin: (payload) => invokeAuthWithRenderer('githubAuth:beginDeviceLogin', payload),
        completeGithubDeviceLogin: (payload) => invokeAuthWithRenderer('githubAuth:completeDeviceLogin', payload),
        githubLoginWithDeviceCode: (payload) => invokeAuthWithRenderer('githubAuth:loginWithDeviceCode', payload),
        getGithubAuthState: () => invokeAuthWithRenderer('githubAuth:getState'),
        githubLogout: () => invokeAuthWithRenderer('githubAuth:logout'),

        listWorkspaces: () => shellIpcRenderer.invoke('workspace:list'),
        createWorkspace: (payload) => shellIpcRenderer.invoke('workspace:create', payload),
        removeWorkspace: (payload) => shellIpcRenderer.invoke('workspace:remove', payload),
        importWorkspace: (payload) => shellIpcRenderer.invoke('workspace:import', payload),
        listGithubRepos: (payload) => shellIpcRenderer.invoke('workspace:listGithubRepos', payload),
        createGithubRepos: (payload) => shellIpcRenderer.invoke('workspace:createGithubRepos', payload),
        importWorkspaceFromGithub: (payload) => shellIpcRenderer.invoke('workspace:importFromGithub', payload),
        backupWorkspace: (payload) => shellIpcRenderer.invoke('workspace:backup', payload),
        pickDirectory: (payload) => shellIpcRenderer.invoke('app:pickDirectory', payload),
        pickFile: (payload) => shellIpcRenderer.invoke('app:pickFile', payload),

        getThemeCatalog: () => shellIpcRenderer.invoke('theme:catalog'),
        getThemeConfig: (payload) => shellIpcRenderer.invoke('theme:getConfig', payload),
        validateThemeSettings: (payload) => shellIpcRenderer.invoke('theme:validateSettings', payload),
        saveThemeConfig: (payload) => shellIpcRenderer.invoke('theme:saveConfig', payload),
        uploadThemeImageToGithub: (payload) => shellIpcRenderer.invoke('theme:uploadImageToGithub', payload),
        saveThemeLocalAsset: (payload) => shellIpcRenderer.invoke('theme:saveLocalAsset', payload),
        applyThemePreviewOverrides: (payload) => shellIpcRenderer.invoke('theme:applyPreviewOverrides', payload),

        publishToGitHub: (payload) => shellIpcRenderer.invoke('publish:github', payload),
        startLocalPreview: (payload) => shellIpcRenderer.invoke('preview:start', payload),
        openLocalPreview: (payload) => shellIpcRenderer.invoke('preview:open', payload),
        stopLocalPreview: (payload) => shellIpcRenderer.invoke('preview:stop', payload),
        createAndOpenContent: (payload) => shellIpcRenderer.invoke('content:createAndOpen', payload),
        listExistingContents: (payload) => shellIpcRenderer.invoke('content:listExisting', payload),
        readExistingContent: (payload) => shellIpcRenderer.invoke('content:readExisting', payload),
        saveExistingContent: (payload) => shellIpcRenderer.invoke('content:saveExisting', payload),
        openExistingContent: (payload) => shellIpcRenderer.invoke('content:openExisting', payload),
        watchAndAutoPublish: (payload) => shellIpcRenderer.invoke('content:watchAndAutoPublish', payload),
        publishSavedContent: (payload) => shellIpcRenderer.invoke('content:publishSavedContent', payload),
        getPublishJobStatus: (payload) => shellIpcRenderer.invoke('content:getPublishJobStatus', payload),

        listSubscriptions: () => shellIpcRenderer.invoke('rss:listSubscriptions'),
        addSubscription: (payload) => shellIpcRenderer.invoke('rss:addSubscription', payload),
        removeSubscription: (payload) => shellIpcRenderer.invoke('rss:removeSubscription', payload),
        syncSubscriptions: () => shellIpcRenderer.invoke('rss:syncSubscriptions'),
        markSubscriptionItemRead: (payload) => shellIpcRenderer.invoke('rss:markItemRead', payload),
        getRssUnreadSummary: () => shellIpcRenderer.invoke('rss:getUnreadSummary'),
        exportSubscriptions: (payload) => shellIpcRenderer.invoke('rss:exportSubscriptions', payload),
        importSubscriptions: (payload) => shellIpcRenderer.invoke('rss:importSubscriptions', payload),
        onOperationEvent: (listener) => {
            const handler = (_event, payload) => listener(payload);
            shellIpcRenderer.on('ops:event', handler);
            return () => {
                shellIpcRenderer.removeListener('ops:event', handler);
            };
        }
    };
}

function exposeBfeApi({ contextBridge: shellContextBridge, ipcRenderer: shellIpcRenderer }) {
    const api = createBfeApi({ ipcRenderer: shellIpcRenderer });
    shellContextBridge.exposeInMainWorld('bfeApi', api);
    return api;
}

if (contextBridge && typeof contextBridge.exposeInMainWorld === 'function' && ipcRenderer) {
    exposeBfeApi({ contextBridge, ipcRenderer });
}

module.exports = {
    createBfeApi,
    exposeBfeApi,
    invokeAuth
};
