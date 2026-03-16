const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

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
        autoUpdater.autoInstallOnAppQuit = true;
        setupUpdaterEvents();
        initialized = true;
    }

    setState({
        status: 'ready',
        message: '自动更新已启用',
        error: null
    });

    autoUpdater.checkForUpdates().catch((error) => {
        setState({
            status: 'error',
            message: '自动更新检查失败',
            error: String(error?.message || error || 'unknown error')
        });
    });
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
