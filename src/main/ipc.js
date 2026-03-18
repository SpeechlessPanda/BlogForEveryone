const { app, ipcMain, dialog } = require('electron');
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
const { getLaunchAtStartup, setLaunchAtStartup } = require('./services/startupService');
const {
    listSubscriptions,
    addSubscription,
    removeSubscription,
    syncSubscriptions,
    exportSubscriptions,
    importSubscriptions,
    markItemRead,
    getUnreadSummary,
    setAutoSyncEnabled,
    getAutoSyncState
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
        const next = updateStore((state) => {
            const current = state.preferences || {};
            state.preferences = {
                generateBlogRss: payload.generateBlogRss ?? current.generateBlogRss ?? true,
                autoSyncRssSubscriptions: payload.autoSyncRssSubscriptions ?? current.autoSyncRssSubscriptions ?? true,
                launchAtStartup: payload.launchAtStartup ?? current.launchAtStartup ?? false
            };
            return state;
        });

        let launchSetting = { launchAtStartup: getLaunchAtStartup(), effective: app.isPackaged };
        if (typeof payload.launchAtStartup === 'boolean') {
            launchSetting = setLaunchAtStartup(payload.launchAtStartup);
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
        const list = readStore().workspaces || [];
        return list.map((ws) => ({
            ...ws,
            localExists: fs.existsSync(ws.projectDir)
        }));
    });

    ipcMain.handle('workspace:create', async (_event, payload) => {
        const { name, projectDir, framework, theme } = payload;
        const initResult = await initProject({ framework, projectDir });

        if (initResult.status !== 0) {
            const detail = [initResult.stderr, initResult.stdout].filter(Boolean).join('\n').trim();
            throw new Error(`初始化工程失败（${framework}）：${detail || '未知错误'}`);
        }

        const state = readStore();
        if ((state.workspaces || []).some((item) => item.projectDir === projectDir)) {
            throw new Error('该路径已存在管理记录，请勿重复创建。');
        }

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

    ipcMain.handle('workspace:remove', async (_event, payload) => {
        const { id, deleteLocal } = payload || {};
        if (!id) {
            throw new Error('缺少工程 ID');
        }

        const state = readStore();
        const target = (state.workspaces || []).find((item) => item.id === id);
        if (!target) {
            return { removed: false, reason: 'not-found', workspaces: state.workspaces || [] };
        }

        if (deleteLocal && target.projectDir && fs.existsSync(target.projectDir)) {
            fs.rmSync(target.projectDir, { recursive: true, force: true });
        }

        const next = updateStore((draft) => {
            draft.workspaces = (draft.workspaces || []).filter((item) => item.id !== id);
            return draft;
        });

        return {
            removed: true,
            deletedLocal: Boolean(deleteLocal),
            workspaces: next.workspaces || []
        };
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
    ipcMain.handle('rss:markItemRead', async (_event, payload) => markItemRead(payload));
    ipcMain.handle('rss:getUnreadSummary', async () => getUnreadSummary());
    ipcMain.handle('rss:exportSubscriptions', async (_event, payload) => exportSubscriptions(payload));
    ipcMain.handle('rss:importSubscriptions', async (_event, payload) => importSubscriptions(payload));
}

module.exports = {
    registerIpcHandlers
};
