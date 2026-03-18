const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipc');
const { setAutoSyncEnabled } = require('./services/rssService');
const { readStore } = require('./services/storeService');
const { initAutoUpdate } = require('./services/updateService');
const { applyLaunchAtStartupPreference } = require('./services/startupService');

const isDev = process.env.NODE_ENV === 'development';

app.setPath('sessionData', path.join(app.getPath('userData'), 'session-data'));

function resolveAppIconPath() {
    if (process.platform === 'win32') {
        if (isDev) {
            return path.join(app.getAppPath(), 'build', 'icon.ico');
        }

        return undefined;
    }

    return path.join(__dirname, '../img/icon.jpg');
}

function createMainWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 1080,
        minHeight: 720,
        autoHideMenuBar: true,
        icon: resolveAppIconPath(),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools({ mode: 'detach' });
        return win;
    }

    win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
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
