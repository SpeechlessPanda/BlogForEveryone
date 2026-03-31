const fs = require('fs');
const path = require('path');

const { readStore, updateStore } = require('../services/storeService');
const { detectFramework, initProject } = require('../services/frameworkService');
const { installAndApplyTheme, inferRecognizedThemeIdFromProject } = require('../services/themeService');
const { ensureFrameworkPublishPackages } = require('../services/frameworkToolingService');
const { backupWorkspace, pushBackupToRepo } = require('../services/backupService');
const {
    listUserRepositories,
    ensureRemoteRepositories,
    cloneRepositoryToDestination
} = require('../services/githubRepoService');
const { importSubscriptions } = require('../services/rssService');
const {
    validateGithubImportPayload,
    validateGithubImportRepositoryState
} = require('../services/configValidationService');
const { assertSupportedImportedFramework } = require('../policies/workspaceImportPolicy');
const { normalizePath, normalizeForCompare } = require('../policies/workspacePathPolicy');
const {
    createWorkspaceWorkflow,
    importWorkspaceWorkflow,
    backupWorkspaceWorkflow,
    importWorkspaceFromGithubWorkflow
} = require('../app/workspaceWorkflowService');
const { RESULT_CODES, RESULT_CATEGORIES } = require('../../shared/operationResultContract');

function createIpcValidationError(key, message) {
    const error = new Error(message);
    error.operationResult = {
        ok: false,
        code: RESULT_CODES.validationFailed,
        category: RESULT_CATEGORIES.validation,
        causes: [{ key, message }]
    };
    return error;
}

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

    ipcMain.handle('workspace:listGithubRepos', async (_event, payload) => {
        return listUserRepositories(payload);
    });

    ipcMain.handle('workspace:createGithubRepos', async (_event, payload) => {
        return ensureRemoteRepositories(payload);
    });

    ipcMain.handle('workspace:importFromGithub', async (_event, payload) => {
        const validation = validateGithubImportPayload(payload);
        if (!validation.ok) {
            const message = validation.causes?.[0]?.message || 'GitHub 导入参数校验失败。';
            const error = new Error(message);
            error.operationResult = validation;
            throw error;
        }

        const normalizedPayload = validation.normalizedPayload || payload || {};
        const safeProjectDir = assertWorkspaceCandidatePath(
            normalizedPayload.localDestinationPath,
            'GitHub 导入工程',
            { mustExist: false }
        );

        const parentDir = path.dirname(safeProjectDir);
        if (!fs.existsSync(parentDir)) {
            throw createIpcValidationError(
                'destination_parent_not_found',
                '导入目标路径的父目录不存在，请先创建父目录后重试。'
            );
        }

        if (fs.existsSync(safeProjectDir)) {
            const stats = fs.statSync(safeProjectDir);
            if (!stats.isDirectory()) {
                throw createIpcValidationError('destination_path_not_directory', '导入目标路径不是目录，无法执行 GitHub 导入。');
            }

            const entries = fs.readdirSync(safeProjectDir);
            if (entries.length > 0) {
                throw createIpcValidationError('destination_directory_not_empty', '导入目标目录非空，请选择空目录或新目录。');
            }
        }

        return importWorkspaceFromGithubWorkflow(
            {
                ...normalizedPayload,
                localDestinationPath: safeProjectDir
            },
            {
                readStore,
                updateStore,
                normalizePathForCompare: normalizeForCompare,
                cloneRepositoryToDestination,
                detectFramework,
                assertSupportedImportedFramework,
                inferRecognizedThemeIdFromProject,
                importSubscriptions,
                getProjectName: path.basename,
                createWorkspaceId: () => Date.now().toString(),
                now: () => new Date().toISOString(),
                validateImportRepositoryState: validateGithubImportRepositoryState
            }
        );
    });

    ipcMain.handle('workspace:backup', async (_event, payload) => {
        const policy = getWorkspacePolicy();
        const workspace = policy.getManagedWorkspace(payload?.workspaceId);
        const candidateProjectDir = payload?.projectDir || workspace.projectDir;
        const safeProjectDir = policy.assertPathWithinWorkspace(workspace.id, candidateProjectDir, 'backup');

        return backupWorkspaceWorkflow({
            ...payload,
            workspaceId: workspace.id,
            projectDir: safeProjectDir,
            framework: workspace.framework
        }, {
            backupWorkspace,
            pushBackupToRepo,
            now: () => new Date().toISOString()
        });
    });
}

module.exports = {
    registerWorkspaceIpcHandlers
};
