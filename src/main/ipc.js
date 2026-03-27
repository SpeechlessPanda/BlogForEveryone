const { app, ipcMain, dialog } = require('electron');
const { readStore, updateStore } = require('./services/storeService');
const { getThemeCatalog, readThemeConfig, saveThemeConfig, saveLocalAssetToBlog, applyPreviewOverrides } = require('./services/themeService');
const { validateThemeSettings, validatePublishPayload } = require('./services/configValidationService');
const { publishToGitHub } = require('./services/publishService');
const { uploadImageToRepo } = require('./services/githubRepoService');
const {
    checkEnvironment,
    openInstaller,
    autoInstallToolWithWinget,
    ensurePnpm,
    installDependenciesWithRetry
} = require('./services/envService');
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
const { createWorkspacePathPolicy } = require('./policies/workspacePathPolicy');
const { registerWorkspaceIpcHandlers } = require('./ipc/workspaceIpc');
const { registerContentIpcHandlers } = require('./ipc/contentIpc');
const { registerAuthIpcHandlers } = require('./ipc/authIpc');
const { registerAppIpcHandlers } = require('./ipc/appIpc');
const { registerEnvIpcHandlers } = require('./ipc/envIpc');
const { registerThemeIpcHandlers } = require('./ipc/themeIpc');
const { registerPublishIpcHandlers } = require('./ipc/publishIpc');
const { registerPreviewIpcHandlers } = require('./ipc/previewIpc');
const { registerRssIpcHandlers } = require('./ipc/rssIpc');
const { normalizePublishResult } = require('./policies/publishResultPolicy');
const { evaluatePreviewOpenResult, evaluatePreviewStopResult } = require('./policies/previewStatePolicy');

function registerIpcHandlers() {
    const getWorkspacePolicy = () => createWorkspacePathPolicy({
        getManagedWorkspaces: () => readStore().workspaces || []
    });

    function emitOperationEvent(sender, payload) {
        sender.send('ops:event', {
            ts: new Date().toISOString(),
            ...payload
        });
    }

    registerAppIpcHandlers({
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
        quitAndInstallUpdate,
        emitOperationEvent
    });

    registerEnvIpcHandlers({
        ipcMain,
        checkEnvironment,
        openInstaller,
        autoInstallToolWithWinget,
        ensurePnpm,
        installDependenciesWithRetry,
        emitOperationEvent
    });

    registerAuthIpcHandlers({ ipcMain });
    registerWorkspaceIpcHandlers({ ipcMain, getWorkspacePolicy });

    registerThemeIpcHandlers({
        ipcMain,
        getWorkspacePolicy,
        getThemeCatalog,
        readThemeConfig,
        saveThemeConfig,
        validateThemeSettings,
        saveLocalAssetToBlog,
        applyPreviewOverrides,
        uploadImageToRepo,
        emitOperationEvent
    });

    registerPublishIpcHandlers({
        ipcMain,
        emitOperationEvent,
        validatePublishPayload,
        publishToGitHub,
        normalizePublishResult
    });

    registerPreviewIpcHandlers({
        ipcMain,
        emitOperationEvent,
        startLocalPreview,
        openLocalPreview,
        stopLocalPreview,
        evaluatePreviewOpenResult,
        evaluatePreviewStopResult
    });

    registerContentIpcHandlers({ ipcMain, getWorkspacePolicy });

    registerRssIpcHandlers({
        ipcMain,
        listSubscriptions,
        addSubscription,
        removeSubscription,
        syncSubscriptions,
        markItemRead,
        getUnreadSummary,
        exportSubscriptions,
        importSubscriptions,
        emitOperationEvent
    });
}

module.exports = {
    registerIpcHandlers
};
