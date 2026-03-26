const fs = require('fs');
const path = require('path');

const { readStore, updateStore } = require('../services/storeService');
const { detectFramework, initProject } = require('../services/frameworkService');
const { installAndApplyTheme, inferRecognizedThemeIdFromProject } = require('../services/themeService');
const { ensureFrameworkPublishPackages } = require('../services/frameworkToolingService');
const { backupWorkspace, pushBackupToRepo } = require('../services/backupService');
const { importSubscriptions } = require('../services/rssService');
const { assertSupportedImportedFramework } = require('../policies/workspaceImportPolicy');
const { normalizePath, normalizeForCompare } = require('../policies/workspacePathPolicy');
const {
    createWorkspaceWorkflow,
    importWorkspaceWorkflow,
    backupWorkspaceWorkflow
} = require('../app/workspaceWorkflowService');

function assertWorkspaceCandidatePath(projectDir, action, options = {}) {
    const mustExist = options.mustExist !== false;
    if (!projectDir) {
        throw new Error(`缺少工程路径，无法${action}。`);
    }

    const inputPath = String(projectDir);
    if (!path.isAbsolute(inputPath)) {
        throw new Error(`工程路径必须为绝对路径，无法${action}。`);
    }
    const resolved = normalizePath(inputPath);

    if (mustExist) {
        if (!fs.existsSync(resolved)) {
            throw new Error(`导入目录不存在，无法${action}。`);
        }
        if (!fs.statSync(resolved).isDirectory()) {
            throw new Error(`工程路径不是目录，无法${action}。`);
        }
    }

    return resolved;
}

function registerWorkspaceIpcHandlers({ ipcMain, getWorkspacePolicy }) {
    ipcMain.handle('workspace:list', async () => {
        const list = readStore().workspaces || [];
        return list.map((ws) => ({
            ...ws,
            localExists: fs.existsSync(ws.projectDir)
        }));
    });

    ipcMain.handle('workspace:create', async (_event, payload) => {
        const { projectDir } = payload || {};
        assertWorkspaceCandidatePath(projectDir, '创建工程', { mustExist: false });
        return createWorkspaceWorkflow(payload, {
            initProject,
            installAndApplyTheme,
            ensureFrameworkPublishPackages,
            readStore,
            updateStore,
            normalizeForCompare,
            createWorkspaceId: () => Date.now().toString(),
            now: () => new Date().toISOString()
        });
    });

    ipcMain.handle('workspace:remove', async (_event, payload) => {
        const { id, deleteLocal } = payload || {};
        if (!id) {
            throw new Error('缺少工程 ID');
        }

        const state = readStore();
        const target = (state.workspaces || []).find((item) => item.id === id);
        if (!target) {
            return { removed: false, reason: 'not-found', workspaces: state.workspaces || [] };
        }

        if (deleteLocal && target.projectDir && fs.existsSync(target.projectDir)) {
            const policy = getWorkspacePolicy();
            const safeTargetPath = policy.assertPathWithinWorkspace(id, target.projectDir, 'delete');
            fs.rmSync(safeTargetPath, { recursive: true, force: true });
        }

        const next = updateStore((draft) => {
            draft.workspaces = (draft.workspaces || []).filter((item) => item.id !== id);
            return draft;
        });

        return {
            removed: true,
            deletedLocal: Boolean(deleteLocal),
            workspaces: next.workspaces || []
        };
    });

    ipcMain.handle('workspace:import', async (_event, payload) => {
        const { projectDir, name } = payload || {};
        const safeProjectDir = assertWorkspaceCandidatePath(projectDir, '导入工程', { mustExist: true });
        return importWorkspaceWorkflow(
            { projectDir: safeProjectDir, name },
            {
                readStore,
                updateStore,
                normalizeForCompare,
                detectFramework,
                assertSupportedImportedFramework,
                inferRecognizedThemeIdFromProject,
                importSubscriptions,
                getProjectName: path.basename,
                createWorkspaceId: () => Date.now().toString(),
                now: () => new Date().toISOString()
            }
        );
    });

    ipcMain.handle('workspace:backup', async (_event, payload) => {
        return backupWorkspaceWorkflow(payload, {
            backupWorkspace,
            pushBackupToRepo,
            now: () => new Date().toISOString()
        });
    });
}

module.exports = {
    registerWorkspaceIpcHandlers
};
