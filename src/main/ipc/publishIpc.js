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
            const operationResult = validation.operationResult || null;
            const validationMessage = operationResult?.causes?.[0]?.message || validation.errors.join('；');
            emitOperationEvent(event.sender, {
                opId,
                scope: 'publish',
                phase: 'failed',
                status: 'failed',
                message: validationMessage
            });
            const validationError = new Error(validationMessage);
            if (operationResult) {
                validationError.operationResult = operationResult;
            }
            throw validationError;
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
            const publishResult = await publishToGitHub(payload);
            const result = normalizePublishResult(publishResult);
            const eventPhase = result.status === 'partial_success'
                ? 'partial_success'
                : (result.ok ? 'succeeded' : 'failed');
            emitOperationEvent(event.sender, {
                opId,
                scope: 'publish',
                phase: eventPhase,
                status: result.status || (result.ok ? 'success' : 'failed'),
                framework: payload.framework,
                mode: payload.publishMode || 'actions',
                pagesUrl: result.ok ? (result.pagesUrl || '') : '',
                message: result.status === 'partial_success'
                    ? '发布与备份部分成功。'
                    : (result.ok ? '发布流程完成。' : (result.message || '发布流程失败。'))
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
