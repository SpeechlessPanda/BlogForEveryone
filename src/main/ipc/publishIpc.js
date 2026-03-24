function registerPublishIpcHandlers({
    ipcMain,
    emitOperationEvent,
    validatePublishPayload,
    publishToGitHub,
    normalizePublishResult
}) {
    ipcMain.handle('publish:github', async (event, payload) => {
        const opId = `publish-${Date.now()}`;
        const validation = validatePublishPayload(payload);
        if (!validation.ok) {
            emitOperationEvent(event.sender, {
                opId,
                scope: 'publish',
                phase: 'failed',
                message: validation.errors.join('；')
            });
            throw new Error(validation.errors.join('；'));
        }

        emitOperationEvent(event.sender, {
            opId,
            scope: 'publish',
            phase: 'started',
            framework: payload.framework,
            mode: payload.publishMode || 'actions',
            message: '开始发布流程。'
        });

        try {
            const result = normalizePublishResult(publishToGitHub(payload));
            emitOperationEvent(event.sender, {
                opId,
                scope: 'publish',
                phase: result.ok ? 'succeeded' : 'failed',
                framework: payload.framework,
                mode: payload.publishMode || 'actions',
                pagesUrl: result.ok ? (result.pagesUrl || '') : '',
                message: result.ok ? '发布流程完成。' : (result.message || '发布流程失败。')
            });
            return {
                ...result,
                opId,
                validationWarnings: validation.warnings || []
            };
        } catch (error) {
            emitOperationEvent(event.sender, {
                opId,
                scope: 'publish',
                phase: 'failed',
                framework: payload.framework,
                mode: payload.publishMode || 'actions',
                message: String(error?.message || error)
            });
            throw error;
        }
    });
}

module.exports = {
    registerPublishIpcHandlers
};
