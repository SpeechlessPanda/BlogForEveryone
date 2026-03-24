const path = require('path');

const {
    createAndOpenContent,
    listExistingContents,
    readExistingContent,
    saveExistingContent,
    openExistingContent,
    watchSaveAndAutoPublish,
    getPublishJobStatus
} = require('../services/contentService');

function resolveContentFilePath(payload, workspace) {
    const { contentId, filePath } = payload || {};
    if (typeof contentId === 'string' && contentId.trim()) {
        return path.resolve(workspace.projectDir, contentId);
    }
    if (typeof filePath === 'string' && filePath.trim()) {
        return path.resolve(filePath);
    }
    throw new Error('缺少内容标识，无法定位文件。');
}

function resolveWorkspace(policy, payload) {
    const workspaceId = payload?.workspaceId;
    return policy.getManagedWorkspace(workspaceId);
}

function registerContentIpcHandlers({ ipcMain, getWorkspacePolicy }) {
    ipcMain.handle('content:createAndOpen', async (_event, payload) => {
        const policy = getWorkspacePolicy();
        const workspace = resolveWorkspace(policy, payload);
        const allowedRoots = policy.getAllowedContentRoots(workspace.id);
        return createAndOpenContent({
            ...payload,
            projectDir: workspace.projectDir,
            framework: workspace.framework,
            allowedRoots
        });
    });

    ipcMain.handle('content:listExisting', async (_event, payload) => {
        const policy = getWorkspacePolicy();
        const workspace = resolveWorkspace(policy, payload);
        return listExistingContents({
            projectDir: workspace.projectDir,
            framework: workspace.framework
        });
    });

    ipcMain.handle('content:readExisting', async (_event, payload) => {
        const policy = getWorkspacePolicy();
        const workspace = resolveWorkspace(policy, payload);
        const resolvedPath = resolveContentFilePath(payload, workspace);
        policy.assertContentPathAllowed(workspace.id, resolvedPath, 'read');
        return readExistingContent({
            filePath: resolvedPath,
            allowedRoots: policy.getAllowedContentRoots(workspace.id)
        });
    });

    ipcMain.handle('content:saveExisting', async (_event, payload) => {
        const policy = getWorkspacePolicy();
        const workspace = resolveWorkspace(policy, payload);
        const resolvedPath = resolveContentFilePath(payload, workspace);
        policy.assertContentPathAllowed(workspace.id, resolvedPath, 'write');
        return saveExistingContent({
            filePath: resolvedPath,
            title: payload?.title,
            body: payload?.body,
            allowedRoots: policy.getAllowedContentRoots(workspace.id)
        });
    });

    ipcMain.handle('content:openExisting', async (_event, payload) => {
        const policy = getWorkspacePolicy();
        const workspace = resolveWorkspace(policy, payload);
        const resolvedPath = resolveContentFilePath(payload, workspace);
        policy.assertContentPathAllowed(workspace.id, resolvedPath, 'open');
        return openExistingContent({
            filePath: resolvedPath,
            allowedRoots: policy.getAllowedContentRoots(workspace.id)
        });
    });

    ipcMain.handle('content:watchAndAutoPublish', async (_event, payload) => {
        const policy = getWorkspacePolicy();
        const workspace = resolveWorkspace(policy, payload);
        const resolvedPath = resolveContentFilePath(payload, workspace);
        policy.assertContentPathAllowed(workspace.id, resolvedPath, 'watch');
        return watchSaveAndAutoPublish({
            ...payload,
            filePath: resolvedPath,
            projectDir: workspace.projectDir,
            framework: workspace.framework,
            allowedRoots: policy.getAllowedContentRoots(workspace.id)
        });
    });

    ipcMain.handle('content:getPublishJobStatus', async (_event, payload) => {
        return getPublishJobStatus(payload.jobId);
    });
}

module.exports = {
    registerContentIpcHandlers
};
