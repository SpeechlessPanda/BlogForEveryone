const { app, BrowserWindow, Menu, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerIpcHandlers } = require('./ipc');
const { setAutoSyncEnabled } = require('./services/rssService');
const { readStore } = require('./services/storeService');
const { initAutoUpdate } = require('./services/updateService');
const { applyLaunchAtStartupPreference } = require('./services/startupService');
const { evaluateExternalUrl, EXTERNAL_URL_RULES } = require('./policies/externalUrlPolicy');

const isDev = process.env.NODE_ENV === 'development';

app.setPath('sessionData', path.join(app.getPath('userData'), 'session-data'));

function resolveAppIcon() {
    const iconCandidates = process.platform === 'win32'
        ? [
            path.join(app.getAppPath(), 'build', 'icon.ico'),
            path.join(app.getAppPath(), 'src', 'img', 'icon.ico'),
            path.join(__dirname, '../img/icon.ico'),
            path.join(app.getAppPath(), 'src', 'img', 'icon.jpg'),
            path.join(__dirname, '../img/icon.jpg'),
            path.join(process.resourcesPath, 'app.asar', 'src', 'img', 'icon.ico'),
            path.join(process.resourcesPath, 'app.asar', 'src', 'img', 'icon.jpg')
        ]
        : [path.join(__dirname, '../img/icon.jpg')];

    for (const iconPath of iconCandidates) {
        if (!fs.existsSync(iconPath)) {
            continue;
        }

        const image = nativeImage.createFromPath(iconPath);
        if (!image.isEmpty()) {
            return { image, iconPath };
        }
    }

    return { image: undefined, iconPath: undefined };
}

function buildMainWindowOptions(resolvedIcon) {
    return {
        width: 1280,
        height: 860,
        minWidth: 1080,
        minHeight: 720,
        autoHideMenuBar: true,
        icon: resolvedIcon?.image,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    };
}

function loadMainWindowContent(win, { isDev: shouldUseDevServer }) {
    if (shouldUseDevServer) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools({ mode: 'detach' });
        return;
    }

    win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
}

function createMainWindow() {
    const resolvedIcon = resolveAppIcon();
    const win = new BrowserWindow(buildMainWindowOptions(resolvedIcon));

    if (process.platform === 'win32' && resolvedIcon.image) {
        win.setIcon(resolvedIcon.image);
    }

    win.webContents.setWindowOpenHandler(({ url }) => {
        const decision = evaluateExternalUrl(url, EXTERNAL_URL_RULES.windowOpen);
        if (decision.allowed) {
            shell.openExternal(decision.normalizedUrl);
        }
        return { action: 'deny' };
    });

    loadMainWindowContent(win, { isDev });
    return win;
}

app.whenReady().then(() => {
    app.setAppUserModelId('com.blogforeveryone.app');
    Menu.setApplicationMenu(null);
    registerIpcHandlers();
    const state = readStore();
    setAutoSyncEnabled(state.preferences?.autoSyncRssSubscriptions !== false);
    applyLaunchAtStartupPreference(state.preferences || {});
    const win = createMainWindow();
    initAutoUpdate(win);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            const nextWin = createMainWindow();
            initAutoUpdate(nextWin);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

module.exports = {
    buildMainWindowOptions,
    loadMainWindowContent
};
