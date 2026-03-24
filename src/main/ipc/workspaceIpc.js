const fs = require('fs');
const path = require('path');

const { readStore, updateStore } = require('../services/storeService');
const { detectFramework, initProject } = require('../services/frameworkService');
const { installAndApplyTheme, inferRecognizedThemeIdFromProject } = require('../services/themeService');
const { ensureFrameworkPublishPackages } = require('../services/frameworkToolingService');
const { backupWorkspace, pushBackupToRepo } = require('../services/backupService');
const { importSubscriptions } = require('../services/rssService');
const { assertSupportedImportedFramework } = require('../policies/workspaceImportPolicy');

function normalizePathForCompare(inputPath) {
    const resolved = path.resolve(String(inputPath || ''));
    if (fs.existsSync(resolved)) {
        try {
            const real = fs.realpathSync.native(resolved);
            return process.platform === 'win32' ? real.toLowerCase() : real;
        } catch {
            const real = fs.realpathSync(resolved);
            return process.platform === 'win32' ? real.toLowerCase() : real;
        }
    }
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertWorkspaceCandidatePath(projectDir, action, options = {}) {
    const mustExist = options.mustExist !== false;
    if (!projectDir) {
        throw new Error(`缺少工程路径，无法${action}。`);
    }

    const resolved = path.resolve(projectDir);
    if (!path.isAbsolute(resolved)) {
        throw new Error(`工程路径必须为绝对路径，无法${action}。`);
    }

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
        const { name, projectDir, framework, theme } = payload || {};
        assertWorkspaceCandidatePath(projectDir, '创建工程', { mustExist: false });
        const initResult = await initProject({ framework, projectDir });

        if (initResult.status !== 0) {
            const detail = [initResult.stderr, initResult.stdout].filter(Boolean).join('\n').trim();
            throw new Error(`初始化工程失败（${framework}）：${detail || '未知错误'}`);
        }

        const themeSetup = await installAndApplyTheme({
            projectDir,
            framework,
            themeId: theme
        });
        if (!themeSetup.ok) {
            throw new Error(`主题初始化失败（${theme}）：${themeSetup.message || '未知错误'}`);
        }

        const toolingSetup = await ensureFrameworkPublishPackages({
            projectDir,
            framework,
            themeId: theme
        });
        if (!toolingSetup.ok) {
            throw new Error(`发布依赖初始化失败：${toolingSetup.message || '未知错误'}`);
        }

        const state = readStore();
        const normalizedProjectDir = normalizePathForCompare(projectDir);
        if ((state.workspaces || []).some((item) => normalizePathForCompare(item.projectDir) === normalizedProjectDir)) {
            throw new Error('该路径已存在管理记录，请勿重复创建。');
        }

        const workspace = {
            id: Date.now().toString(),
            name,
            projectDir,
            framework,
            theme,
            createdAt: new Date().toISOString(),
            initCode: initResult.status,
            initStdout: initResult.stdout,
            initStderr: initResult.stderr,
            initLogs: [...(initResult.logs || []), ...(themeSetup.logs || []), ...(toolingSetup.logs || [])]
        };

        const next = updateStore((draft) => {
            draft.workspaces.push(workspace);
            return draft;
        });

        return { workspace, workspaces: next.workspaces };
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
        const state = readStore();
        const normalizedProjectDir = normalizePathForCompare(safeProjectDir);
        if ((state.workspaces || []).some((item) => normalizePathForCompare(item.projectDir) === normalizedProjectDir)) {
            throw new Error('该路径已存在管理记录，请勿重复导入。');
        }

        const framework = assertSupportedImportedFramework(detectFramework(safeProjectDir));
        const workspace = {
            id: Date.now().toString(),
            name: name || path.basename(safeProjectDir),
            projectDir: safeProjectDir,
            framework,
            theme: inferRecognizedThemeIdFromProject(safeProjectDir, framework),
            importedAt: new Date().toISOString()
        };

        const next = updateStore((draft) => {
            draft.workspaces.push(workspace);
            return draft;
        });

        const rssRestore = importSubscriptions({ projectDir: safeProjectDir, strategy: 'merge' });
        return { workspace, workspaces: next.workspaces, rssRestore };
    });

    ipcMain.handle('workspace:backup', async (_event, payload) => {
        const { projectDir, backupDir, repoUrl, visibility } = payload || {};
        const snapshotDir = backupWorkspace({
            projectDir,
            backupDir,
            metadata: {
                visibility,
                createdAt: new Date().toISOString()
            }
        });

        let pushResult = [];
        if (repoUrl) {
            pushResult = pushBackupToRepo(snapshotDir, repoUrl);
        }

        return { snapshotDir, pushResult };
    });
}

module.exports = {
    registerWorkspaceIpcHandlers
};
