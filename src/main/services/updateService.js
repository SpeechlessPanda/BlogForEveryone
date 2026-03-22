const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./storeService');

const isDev = process.env.NODE_ENV === 'development';
const updatesDisabled = isDev || !app.isPackaged;

const updateState = {
    status: 'idle',
    message: '未检测更新',
    hasUpdate: false,
    downloaded: false,
    version: app.getVersion(),
    latestVersion: null,
    percent: 0,
    error: null
};

let boundWindow = null;
let initialized = false;
const STARTUP_META_FILE = path.join(DATA_DIR, 'startup-meta.json');
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function ensureStartupMeta() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(STARTUP_META_FILE)) {
        const initialMeta = {
            initializedAt: new Date().toISOString(),
            lastAutoUpdateCheckAt: 0
        };
        fs.writeFileSync(STARTUP_META_FILE, JSON.stringify(initialMeta, null, 2), 'utf-8');
    }
}

function readStartupMeta() {
    ensureStartupMeta();
    const raw = fs.readFileSync(STARTUP_META_FILE, 'utf-8');
    return JSON.parse(raw);
}

function writeStartupMeta(nextMeta) {
    ensureStartupMeta();
    fs.writeFileSync(STARTUP_META_FILE, JSON.stringify(nextMeta, null, 2), 'utf-8');
}

function markAutoUpdateCheckedNow() {
    const meta = readStartupMeta();
    meta.lastAutoUpdateCheckAt = Date.now();
    writeStartupMeta(meta);
}

function shouldAutoCheckNow() {
    const meta = readStartupMeta();
    const lastCheckAt = Number(meta.lastAutoUpdateCheckAt || 0);
    return Date.now() - lastCheckAt >= AUTO_CHECK_INTERVAL_MS;
}

function snapshot() {
    return {
        ...updateState
    };
}

function emitState() {
    if (!boundWindow || boundWindow.isDestroyed()) {
        return;
    }
    boundWindow.webContents.send('app:updateStatus', snapshot());
}

function setState(patch) {
    Object.assign(updateState, patch);
    emitState();
}

function setupUpdaterEvents() {
    autoUpdater.on('checking-for-update', () => {
        setState({
            status: 'checking',
            message: '正在检查新版本...',
            error: null,
            percent: 0
        });
    });

    autoUpdater.on('update-available', (info) => {
        setState({
            status: 'downloading',
            message: `发现新版本 ${info.version}，正在后台下载...`,
            hasUpdate: true,
            latestVersion: info.version,
            downloaded: false,
            error: null
        });
    });

    autoUpdater.on('update-not-available', () => {
        setState({
            status: 'up-to-date',
            message: '当前已是最新版本',
            hasUpdate: false,
            downloaded: false,
            latestVersion: null,
            percent: 0,
            error: null
        });
    });

    autoUpdater.on('download-progress', (progress) => {
        setState({
            status: 'downloading',
            message: `更新下载中：${Math.round(progress.percent || 0)}%`,
            percent: Number(progress.percent || 0)
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        setState({
            status: 'downloaded',
            message: `新版本 ${info.version} 已下载，重启应用后自动安装`,
            hasUpdate: true,
            downloaded: true,
            latestVersion: info.version,
            percent: 100,
            error: null
        });
    });

    autoUpdater.on('error', (error) => {
        setState({
            status: 'error',
            message: '自动更新失败，请稍后重试',
            error: String(error?.message || error || 'unknown error')
        });
    });
}

function initAutoUpdate(mainWindow) {
    boundWindow = mainWindow;
    ensureStartupMeta();

    if (updatesDisabled) {
        setState({
            status: 'disabled',
            message: '当前运行模式不执行自动更新',
            error: null
        });
        return;
    }

    if (!initialized) {
        autoUpdater.autoDownload = true;
        // Keep update installation fully explicit to avoid perceived re-install popups.
        autoUpdater.autoInstallOnAppQuit = false;
        setupUpdaterEvents();
        initialized = true;
    }

    setState({
        status: 'ready',
        message: '自动更新已启用',
        error: null
    });

    if (!shouldAutoCheckNow()) {
        setState({
            status: 'ready',
            message: '自动更新已启用（本次启动跳过自动检查，加速启动）',
            error: null
        });
        return;
    }

    autoUpdater.checkForUpdates().catch((error) => {
        setState({
            status: 'error',
            message: '自动更新检查失败',
            error: String(error?.message || error || 'unknown error')
        });
    });
    markAutoUpdateCheckedNow();
}

async function checkForUpdatesNow() {
    if (updatesDisabled) {
        setState({
            status: 'disabled',
            message: '当前运行模式不执行自动更新',
            error: null
        });
        return snapshot();
    }

    await autoUpdater.checkForUpdates();
    markAutoUpdateCheckedNow();
    return snapshot();
}

function quitAndInstallUpdate() {
    autoUpdater.quitAndInstall();
}

function getUpdateState() {
    return snapshot();
}

module.exports = {
    initAutoUpdate,
    checkForUpdatesNow,
    quitAndInstallUpdate,
    getUpdateState
};
