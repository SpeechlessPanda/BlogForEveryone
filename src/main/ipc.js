const { app, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { readStore, updateStore } = require('./services/storeService');
const { detectFramework, initProject } = require('./services/frameworkService');
const { getThemeCatalog, readThemeConfig, saveThemeConfig, saveLocalAssetToBlog, installAndApplyTheme, applyPreviewOverrides } = require('./services/themeService');
const { ensureFrameworkPublishPackages } = require('./services/frameworkToolingService');
const { validateThemeSettings, validatePublishPayload } = require('./services/configValidationService');
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
const {
    createAndOpenContent,
    listExistingContents,
    readExistingContent,
    saveExistingContent,
    openExistingContent,
    watchSaveAndAutoPublish,
    getPublishJobStatus
} = require('./services/contentService');
const { checkForUpdatesNow, quitAndInstallUpdate, getUpdateState } = require('./services/updateService');
const { getLaunchAtStartup, setLaunchAtStartup } = require('./services/startupService');
const { startLocalPreview, openLocalPreview, stopLocalPreview } = require('./services/previewService');
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
    function emitOperationEvent(sender, payload) {
        sender.send('ops:event', {
            ts: new Date().toISOString(),
            ...payload
        });
    }

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

        const themeSetup = await installAndApplyTheme({
            projectDir,
            framework,
            themeId: theme
        });
        if (!themeSetup.ok) {
            throw new Error(`主题初始化失败（${theme}）：${themeSetup.message || '未知错误'}`);
        }

        const toolingSetup = await ensureFrameworkPublishPackages({
            projectDir,
            framework,
            themeId: theme
        });
        if (!toolingSetup.ok) {
            throw new Error(`发布依赖初始化失败：${toolingSetup.message || '未知错误'}`);
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
            initLogs: [...(initResult.logs || []), ...(themeSetup.logs || []), ...(toolingSetup.logs || [])]
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

    ipcMain.handle('publish:github', async (event, payload) => {
        const opId = `publish-${Date.now()}`;
        const validation = validatePublishPayload(payload);
        if (!validation.ok) {
            emitOperationEvent(event.sender, {
                opId,
                scope: 'publish',
                phase: 'failed',
                message: validation.errors.join('；')
            });
            throw new Error(validation.errors.join('；'));
        }

        emitOperationEvent(event.sender, {
            opId,
            scope: 'publish',
            phase: 'started',
            framework: payload.framework,
            mode: payload.publishMode || 'actions',
            message: '开始发布流程。'
        });

        try {
            const result = publishToGitHub(payload);
            emitOperationEvent(event.sender, {
                opId,
                scope: 'publish',
                phase: 'succeeded',
                framework: payload.framework,
                mode: payload.publishMode || 'actions',
                pagesUrl: result.pagesUrl || '',
                message: '发布流程完成。'
            });
            return {
                ...result,
                opId,
                validationWarnings: validation.warnings || []
            };
        } catch (error) {
            emitOperationEvent(event.sender, {
                opId,
                scope: 'publish',
                phase: 'failed',
                framework: payload.framework,
                mode: payload.publishMode || 'actions',
                message: String(error?.message || error)
            });
            throw error;
        }
    });

    ipcMain.handle('preview:start', async (event, payload) => {
        const opId = `preview-${Date.now()}`;
        emitOperationEvent(event.sender, {
            opId,
            scope: 'preview',
            phase: 'started',
            framework: payload?.framework,
            message: '开始启动本地预览。'
        });
        const result = await startLocalPreview(payload);
        emitOperationEvent(event.sender, {
            opId,
            scope: 'preview',
            phase: result.ok ? 'succeeded' : 'failed',
            framework: payload?.framework,
            url: result.url || '',
            message: result.ok ? '本地预览已启动。' : (result.message || '预览启动失败。')
        });
        return { ...result, opId };
    });

    ipcMain.handle('preview:open', async (event, payload) => {
        const opId = `preview-open-${Date.now()}`;
        const result = openLocalPreview(payload);
        emitOperationEvent(event.sender, {
            opId,
            scope: 'preview',
            phase: 'succeeded',
            framework: payload?.framework,
            url: result.url || '',
            message: '已打开本地预览地址。'
        });
        return { ...result, opId };
    });

    ipcMain.handle('preview:stop', async (event, payload) => {
        const opId = `preview-stop-${Date.now()}`;
        const result = stopLocalPreview(payload);
        emitOperationEvent(event.sender, {
            opId,
            scope: 'preview',
            phase: 'succeeded',
            framework: payload?.framework,
            message: result.stopped ? '已停止本地预览。' : '当前没有正在运行的预览进程。'
        });
        return { ...result, opId };
    });

    ipcMain.handle('content:createAndOpen', async (_event, payload) => {
        return createAndOpenContent(payload);
    });

    ipcMain.handle('content:listExisting', async (_event, payload) => {
        return listExistingContents(payload);
    });

    ipcMain.handle('content:readExisting', async (_event, payload) => {
        return readExistingContent(payload);
    });

    ipcMain.handle('content:saveExisting', async (_event, payload) => {
        return saveExistingContent(payload);
    });

    ipcMain.handle('content:openExisting', async (_event, payload) => {
        return openExistingContent(payload);
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
