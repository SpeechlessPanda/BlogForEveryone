function registerRssIpcHandlers({
    ipcMain,
    getWorkspacePolicy,
    listSubscriptions,
    addSubscription,
    removeSubscription,
    syncSubscriptions,
    markItemRead,
    getUnreadSummary,
    exportSubscriptions,
    importSubscriptions
}) {
    ipcMain.handle('rss:listSubscriptions', async () => listSubscriptions());
    ipcMain.handle('rss:addSubscription', async (_event, payload) => addSubscription(payload));
    ipcMain.handle('rss:removeSubscription', async (_event, payload) => removeSubscription(payload));
    ipcMain.handle('rss:syncSubscriptions', async () => syncSubscriptions());
    ipcMain.handle('rss:markItemRead', async (_event, payload) => markItemRead(payload));
    ipcMain.handle('rss:getUnreadSummary', async () => getUnreadSummary());
    ipcMain.handle('rss:exportSubscriptions', async (_event, payload) => {
        const policy = getWorkspacePolicy();
        const workspace = policy.getManagedWorkspace(payload?.workspaceId);
        return exportSubscriptions({ projectDir: workspace.projectDir });
    });
    ipcMain.handle('rss:importSubscriptions', async (_event, payload) => {
        const policy = getWorkspacePolicy();
        const workspace = policy.getManagedWorkspace(payload?.workspaceId);
        return importSubscriptions({
            projectDir: workspace.projectDir,
            strategy: payload?.strategy
        });
    });
}

module.exports = {
    registerRssIpcHandlers
};
