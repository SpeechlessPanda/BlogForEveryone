function registerPreviewIpcHandlers({
    ipcMain,
    emitOperationEvent,
    startLocalPreview,
    openLocalPreview,
    stopLocalPreview,
    evaluatePreviewOpenResult,
    evaluatePreviewStopResult
}) {
    ipcMain.handle('preview:start', async (event, payload) => {
        const opId = `preview-${Date.now()}`;
        emitOperationEvent(event.sender, {
            opId,
            scope: 'preview',
            phase: 'started',
            framework: payload?.framework,
            message: '开始启动本地预览。'
        });
        const result = await startLocalPreview(payload);
        emitOperationEvent(event.sender, {
            opId,
            scope: 'preview',
            phase: result.ok ? 'succeeded' : 'failed',
            framework: payload?.framework,
            url: result.url || '',
            message: result.ok ? '本地预览已启动。' : (result.message || '预览启动失败。')
        });
        return { ...result, opId };
    });

    ipcMain.handle('preview:open', async (event, payload) => {
        const opId = `preview-open-${Date.now()}`;
        const result = evaluatePreviewOpenResult(openLocalPreview(payload));
        emitOperationEvent(event.sender, {
            opId,
            scope: 'preview',
            phase: result.phase,
            framework: payload?.framework,
            url: result.url || '',
            message: result.message
        });
        return { ...result, opId };
    });

    ipcMain.handle('preview:stop', async (event, payload) => {
        const opId = `preview-stop-${Date.now()}`;
        const result = evaluatePreviewStopResult(await stopLocalPreview(payload));
        emitOperationEvent(event.sender, {
            opId,
            scope: 'preview',
            phase: result.phase,
            framework: payload?.framework,
            message: result.message
        });
        return { ...result, opId };
    });
}

module.exports = {
    registerPreviewIpcHandlers
};
