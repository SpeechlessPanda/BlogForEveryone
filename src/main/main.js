const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipc');
const { startAutoSync } = require('./services/rssService');
const { initAutoUpdate } = require('./services/updateService');

const isDev = process.env.NODE_ENV === 'development';

function createMainWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 1080,
        minHeight: 720,
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
    registerIpcHandlers();
    startAutoSync();
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
