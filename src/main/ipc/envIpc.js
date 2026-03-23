function registerEnvIpcHandlers({
    ipcMain,
    checkEnvironment,
    openInstaller,
    autoInstallToolWithWinget,
    ensurePnpm,
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
        const projectDir = payload?.projectDir;
        if (!projectDir) {
            return {
                ok: false,
                reason: 'PROJECT_DIR_MISSING',
                message: '缺少项目目录，无法安装依赖。'
            };
        }
        return installDependenciesWithRetry(projectDir);
    });
}

module.exports = {
    registerEnvIpcHandlers
};
