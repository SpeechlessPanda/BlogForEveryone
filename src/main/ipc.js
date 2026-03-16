const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { readStore, updateStore } = require('./services/storeService');
const { detectFramework, initProject } = require('./services/frameworkService');
const { getThemeCatalog, readThemeConfig, saveThemeConfig, saveLocalAssetToBlog } = require('./services/themeService');
const { publishToGitHub } = require('./services/publishService');
const { uploadImageToRepo } = require('./services/githubRepoService');
const { backupWorkspace, pushBackupToRepo } = require('./services/backupService');
const {
    checkEnvironment,
    openInstaller,
    autoInstallToolWithWinget,
    ensurePnpm,
    installDependenciesWithRetry
} = require('./services/envService');
const { beginDeviceLogin, completeDeviceLogin, loginWithDeviceCode, getAuthState, logout } = require('./services/githubAuthService');
const { createAndOpenContent, watchSaveAndAutoPublish, getPublishJobStatus } = require('./services/contentService');
const { checkForUpdatesNow, quitAndInstallUpdate, getUpdateState } = require('./services/updateService');
const {
    listSubscriptions,
    addSubscription,
    removeSubscription,
    syncSubscriptions,
    exportSubscriptions,
    importSubscriptions
} = require('./services/rssService');

function registerIpcHandlers() {
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

    ipcMain.handle('app:checkUpdatesNow', async () => {
        return checkForUpdatesNow();
    });

    ipcMain.handle('app:installUpdateNow', async () => {
        quitAndInstallUpdate();
        return { ok: true };
    });

    ipcMain.handle('env:status', async () => checkEnvironment());

    ipcMain.handle('env:openInstaller', async (_event, payload) => {
        return openInstaller(payload.tool);
    });

    ipcMain.handle('env:autoInstallTool', async (_event, payload) => {
        return autoInstallToolWithWinget(payload.tool);
    });

    ipcMain.handle('env:ensurePnpm', async () => {
        return ensurePnpm();
    });

    ipcMain.handle('project:installDependencies', async (_event, payload) => {
        return installDependenciesWithRetry(payload.projectDir);
    });

    ipcMain.handle('githubAuth:beginDeviceLogin', async (_event, payload) => {
        return beginDeviceLogin(payload);
    });

    ipcMain.handle('githubAuth:completeDeviceLogin', async (_event, payload) => {
        return completeDeviceLogin(payload);
    });

    ipcMain.handle('githubAuth:loginWithDeviceCode', async (_event, payload) => {
        return loginWithDeviceCode(payload);
    });

    ipcMain.handle('githubAuth:getState', async () => {
        return getAuthState();
    });

    ipcMain.handle('githubAuth:logout', async () => {
        return logout();
    });

    ipcMain.handle('workspace:list', async () => {
        return readStore().workspaces || [];
    });

    ipcMain.handle('workspace:create', async (_event, payload) => {
        const { name, projectDir, framework, theme } = payload;
        const initResult = await initProject({ framework, projectDir });

        const workspace = {
            id: Date.now().toString(),
            name,
            projectDir,
            framework,
            theme,
            createdAt: new Date().toISOString(),
            initCode: initResult.status,
            initStdout: initResult.stdout,
            initStderr: initResult.stderr,
            initLogs: initResult.logs || []
        };

        const next = updateStore((state) => {
            state.workspaces.push(workspace);
            return state;
        });

        return { workspace, workspaces: next.workspaces };
    });

    ipcMain.handle('workspace:import', async (_event, payload) => {
        const { projectDir, name } = payload;
        if (!fs.existsSync(projectDir)) {
            throw new Error('导入目录不存在');
        }

        const framework = detectFramework(projectDir);
        const workspace = {
            id: Date.now().toString(),
            name: name || path.basename(projectDir),
            projectDir,
            framework,
            theme: 'unknown',
            importedAt: new Date().toISOString()
        };

        const next = updateStore((state) => {
            state.workspaces.push(workspace);
            return state;
        });

        const rssRestore = importSubscriptions({ projectDir, strategy: 'merge' });
        return { workspace, workspaces: next.workspaces, rssRestore };
    });

    ipcMain.handle('workspace:backup', async (_event, payload) => {
        const { projectDir, backupDir, repoUrl, visibility } = payload;
        const snapshotDir = backupWorkspace({
            projectDir,
            backupDir,
            metadata: {
                visibility,
                createdAt: new Date().toISOString()
            }
        });

        let pushResult = [];
        if (repoUrl) {
            pushResult = pushBackupToRepo(snapshotDir, repoUrl);
        }

        return { snapshotDir, pushResult };
    });

    ipcMain.handle('theme:catalog', async () => getThemeCatalog());

    ipcMain.handle('theme:getConfig', async (_event, payload) => {
        const { projectDir, framework } = payload;
        return readThemeConfig(projectDir, framework);
    });

    ipcMain.handle('theme:saveConfig', async (_event, payload) => {
        const { projectDir, framework, nextConfig } = payload;
        saveThemeConfig(projectDir, framework, nextConfig);
        return { success: true };
    });

    ipcMain.handle('theme:saveLocalAsset', async (_event, payload) => {
        return saveLocalAssetToBlog(payload);
    });

    ipcMain.handle('theme:uploadImageToGithub', async (_event, payload) => {
        return uploadImageToRepo(payload);
    });

    ipcMain.handle('publish:github', async (_event, payload) => {
        const result = publishToGitHub(payload);
        return result;
    });

    ipcMain.handle('content:createAndOpen', async (_event, payload) => {
        return createAndOpenContent(payload);
    });

    ipcMain.handle('content:watchAndAutoPublish', async (_event, payload) => {
        return watchSaveAndAutoPublish(payload);
    });

    ipcMain.handle('content:getPublishJobStatus', async (_event, payload) => {
        return getPublishJobStatus(payload.jobId);
    });

    ipcMain.handle('rss:listSubscriptions', async () => listSubscriptions());
    ipcMain.handle('rss:addSubscription', async (_event, payload) => addSubscription(payload));
    ipcMain.handle('rss:removeSubscription', async (_event, payload) => removeSubscription(payload));
    ipcMain.handle('rss:syncSubscriptions', async () => syncSubscriptions());
    ipcMain.handle('rss:exportSubscriptions', async (_event, payload) => exportSubscriptions(payload));
    ipcMain.handle('rss:importSubscriptions', async (_event, payload) => importSubscriptions(payload));
}

module.exports = {
    registerIpcHandlers
};
