const { beginDeviceLogin, completeDeviceLogin, loginWithDeviceCode, getAuthState, logout } = require('../services/githubAuthService');
const { toRendererAuthState } = require('../policies/authStatePolicy');

function registerAuthIpcHandlers({ ipcMain }) {
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
        return toRendererAuthState(getAuthState());
    });

    ipcMain.handle('githubAuth:logout', async () => {
        return logout();
    });
}

module.exports = {
    registerAuthIpcHandlers
};
