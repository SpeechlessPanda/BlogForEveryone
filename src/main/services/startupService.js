const { app } = require('electron');

const LOGIN_ITEM_ARGS = ['--bfe-auto-launch'];

function getLaunchAtStartup() {
    const settings = app.getLoginItemSettings({ args: LOGIN_ITEM_ARGS });
    return Boolean(settings.openAtLogin);
}

function setLaunchAtStartup(enabled) {
    if (!app.isPackaged) {
        return { launchAtStartup: Boolean(enabled), effective: false };
    }

    app.setLoginItemSettings({
        openAtLogin: Boolean(enabled),
        openAsHidden: false,
        path: process.execPath,
        args: LOGIN_ITEM_ARGS
    });

    return { launchAtStartup: getLaunchAtStartup(), effective: true };
}

function applyLaunchAtStartupPreference(preferences) {
    if (!preferences || typeof preferences.launchAtStartup !== 'boolean') {
        return;
    }

    const current = getLaunchAtStartup();
    if (current !== preferences.launchAtStartup) {
        setLaunchAtStartup(preferences.launchAtStartup);
    }
}

module.exports = {
    getLaunchAtStartup,
    setLaunchAtStartup,
    applyLaunchAtStartupPreference
};