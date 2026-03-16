const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bfeApi', {
    getAppState: () => ipcRenderer.invoke('app:getState'),
    getEnvironmentStatus: () => ipcRenderer.invoke('env:status'),
    openInstaller: (payload) => ipcRenderer.invoke('env:openInstaller', payload),
    autoInstallTool: (payload) => ipcRenderer.invoke('env:autoInstallTool', payload),
    ensurePnpm: () => ipcRenderer.invoke('env:ensurePnpm'),
    installProjectDependencies: (payload) => ipcRenderer.invoke('project:installDependencies', payload),
    beginGithubDeviceLogin: (payload) => ipcRenderer.invoke('githubAuth:beginDeviceLogin', payload),
    completeGithubDeviceLogin: (payload) => ipcRenderer.invoke('githubAuth:completeDeviceLogin', payload),
    githubLoginWithDeviceCode: (payload) => ipcRenderer.invoke('githubAuth:loginWithDeviceCode', payload),
    getGithubAuthState: () => ipcRenderer.invoke('githubAuth:getState'),
    githubLogout: () => ipcRenderer.invoke('githubAuth:logout'),

    listWorkspaces: () => ipcRenderer.invoke('workspace:list'),
    createWorkspace: (payload) => ipcRenderer.invoke('workspace:create', payload),
    importWorkspace: (payload) => ipcRenderer.invoke('workspace:import', payload),
    backupWorkspace: (payload) => ipcRenderer.invoke('workspace:backup', payload),

    getThemeCatalog: () => ipcRenderer.invoke('theme:catalog'),
    getThemeConfig: (payload) => ipcRenderer.invoke('theme:getConfig', payload),
    saveThemeConfig: (payload) => ipcRenderer.invoke('theme:saveConfig', payload),
    uploadThemeImageToGithub: (payload) => ipcRenderer.invoke('theme:uploadImageToGithub', payload),
    saveThemeLocalAsset: (payload) => ipcRenderer.invoke('theme:saveLocalAsset', payload),

    publishToGitHub: (payload) => ipcRenderer.invoke('publish:github', payload),
    createAndOpenContent: (payload) => ipcRenderer.invoke('content:createAndOpen', payload),
    watchAndAutoPublish: (payload) => ipcRenderer.invoke('content:watchAndAutoPublish', payload),
    getPublishJobStatus: (payload) => ipcRenderer.invoke('content:getPublishJobStatus', payload),

    listSubscriptions: () => ipcRenderer.invoke('rss:listSubscriptions'),
    addSubscription: (payload) => ipcRenderer.invoke('rss:addSubscription', payload),
    removeSubscription: (payload) => ipcRenderer.invoke('rss:removeSubscription', payload),
    syncSubscriptions: () => ipcRenderer.invoke('rss:syncSubscriptions'),
    exportSubscriptions: (payload) => ipcRenderer.invoke('rss:exportSubscriptions', payload),
    importSubscriptions: (payload) => ipcRenderer.invoke('rss:importSubscriptions', payload)
});
