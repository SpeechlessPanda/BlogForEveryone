const { app, ipcMain, dialog, shell } = require('electron');
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
const { evaluateExternalUrl, EXTERNAL_URL_RULES } = require('./policies/externalUrlPolicy');

const TRUSTED_CHANNEL_PREFIXES = [
    'app:',
    'env:',
    'preview:',
    'publish:',
    'theme:',
    'project:',
    'workspace:',
    'rss:',
    'content:',
    'githubAuth:'
];

function isTrustedIpcSender(event) {
    const frameUrl = String(event?.senderFrame?.url || event?.sender?.getURL?.() || '').trim();
    if (!frameUrl) {
        return false;
    }

    if (frameUrl.startsWith('file://')) {
        return true;
    }

    if (process.env.NODE_ENV === 'development' && /^https?:\/\/localhost(?::\d+)?\//i.test(frameUrl)) {
        return true;
    }

    return false;
}

function shouldGuardChannel(channel) {
    return TRUSTED_CHANNEL_PREFIXES.some((prefix) => String(channel || '').startsWith(prefix));
}

function createTrustedIpcMain(ipcMain) {
    return {
        ...ipcMain,
        handle(channel, handler) {
            if (!shouldGuardChannel(channel)) {
                return ipcMain.handle(channel, handler);
            }

            return ipcMain.handle(channel, async (event, ...args) => {
                if (!isTrustedIpcSender(event)) {
                    throw new Error('IPC sender is not trusted');
                }
                return handler(event, ...args);
            });
        }
    };
}

function registerIpcHandlers() {
    const trustedIpcMain = createTrustedIpcMain(ipcMain);

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
        ipcMain: trustedIpcMain,
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
        ipcMain: trustedIpcMain,
        checkEnvironment,
        openInstaller,
        autoInstallToolWithWinget,
        ensurePnpm,
        getWorkspacePolicy,
        installDependenciesWithRetry,
        emitOperationEvent
    });

    registerAuthIpcHandlers({ ipcMain: trustedIpcMain });
    registerWorkspaceIpcHandlers({ ipcMain: trustedIpcMain, getWorkspacePolicy });

    registerThemeIpcHandlers({
        ipcMain: trustedIpcMain,
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
         ipcMain: trustedIpcMain,
         emitOperationEvent,
         validatePublishPayload,
         publishToGitHub,
         normalizePublishResult,
         getWorkspacePolicy,
         readStore,
         updateStore
     });

    registerPreviewIpcHandlers({
        ipcMain: trustedIpcMain,
        emitOperationEvent,
        startLocalPreview,
        openLocalPreview,
        stopLocalPreview,
        evaluatePreviewOpenResult,
        evaluatePreviewStopResult
    });

    registerContentIpcHandlers({ ipcMain: trustedIpcMain, getWorkspacePolicy });

    registerRssIpcHandlers({
        ipcMain: trustedIpcMain,
        getWorkspacePolicy,
        listSubscriptions,
        addSubscription,
        removeSubscription,
        syncSubscriptions,
        markItemRead,
        getUnreadSummary,
        exportSubscriptions,
        importSubscriptions,
        evaluateExternalUrl,
        openExternal: (url) => shell.openExternal(url),
        externalUrlRule: EXTERNAL_URL_RULES.rssArticle,
        emitOperationEvent
    });
}

module.exports = {
    registerIpcHandlers
};
