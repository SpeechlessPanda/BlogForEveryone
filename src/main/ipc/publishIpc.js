function parseGithubRepo(repoUrl) {
    const clean = String(repoUrl || '').trim().replace(/\.git$/i, '');
    const match = clean.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
    if (!match) {
        return null;
    }

    return {
        owner: match[1],
        repo: match[2]
    };
}

function persistWorkspacePublishMetadata({ readStore, updateStore, payload, result }) {
    if (typeof readStore !== 'function' || typeof updateStore !== 'function') {
        return;
    }

    const workspaces = readStore().workspaces || [];
    const target = workspaces.find((item) => item.projectDir === payload.projectDir && item.framework === payload.framework);
    if (!target) {
        return;
    }

    if (!result?.deployRepoEnsure?.ok || !payload?.repoUrl) {
        return;
    }

    const deployRepoMeta = parseGithubRepo(payload.repoUrl);
    const backupRepoMeta = parseGithubRepo(payload.backupRepoUrl);

    updateStore((state) => {
        state.workspaces = (state.workspaces || []).map((workspace) => {
            if (workspace.id !== target.id) {
                return workspace;
            }

            return {
                ...workspace,
                siteType: payload.siteType || workspace.siteType || null,
                deployRepo: deployRepoMeta ? {
                    ...(workspace.deployRepo || {}),
                    owner: deployRepoMeta.owner,
                    name: deployRepoMeta.repo,
                    url: payload.repoUrl
                } : (workspace.deployRepo || {}),
                backupRepo: payload.backupRepoUrl && backupRepoMeta ? {
                    ...(workspace.backupRepo || {}),
                    owner: backupRepoMeta.owner,
                    name: payload.backupRepoName || backupRepoMeta.repo,
                    url: payload.backupRepoUrl
                } : (workspace.backupRepo || {})
            };
        });
        return state;
    });
}

function registerPublishIpcHandlers({
    ipcMain,
    emitOperationEvent,
    validatePublishPayload,
    publishToGitHub,
    normalizePublishResult,
    readStore,
    updateStore
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
            persistWorkspacePublishMetadata({
                readStore,
                updateStore,
                payload,
                result
            });
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
