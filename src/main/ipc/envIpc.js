function registerEnvIpcHandlers({
    ipcMain,
    checkEnvironment,
    openInstaller,
    autoInstallToolWithWinget,
    ensurePnpm,
    getWorkspacePolicy,
    installDependenciesWithRetry
}) {
    ipcMain.handle('env:status', async () => checkEnvironment());

    ipcMain.handle('env:openInstaller', async (_event, payload) => {
        return openInstaller(payload?.tool);
    });

    ipcMain.handle('env:autoInstallTool', async (_event, payload) => {
        return autoInstallToolWithWinget(payload?.tool);
    });

    ipcMain.handle('env:ensurePnpm', async () => {
        return ensurePnpm();
    });

    ipcMain.handle('project:installDependencies', async (_event, payload) => {
        const policy = getWorkspacePolicy();
        const workspace = policy.getManagedWorkspace(payload?.workspaceId);
        return installDependenciesWithRetry(workspace.projectDir);
    });
}

module.exports = {
    registerEnvIpcHandlers
};
