const {
    REMOTE_IMPORT_SOURCES,
    REMOTE_REPO_VISIBILITY,
    REMOTE_REPO_SOURCE_TYPES
} = require('../../shared/remoteWorkspaceContract');
const { RESULT_CODES, RESULT_CATEGORIES } = require('../../shared/operationResultContract');

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

function createValidationOperationError(key, message) {
    const error = new Error(message);
    error.operationResult = {
        ok: false,
        code: RESULT_CODES.validationFailed,
        category: RESULT_CATEGORIES.validation,
        causes: [{ key, message }]
    };
    return error;
}

async function createWorkspaceWorkflow(payload, deps) {
    const { name, projectDir, framework, theme } = payload || {};
    const {
        initProject,
        installAndApplyTheme,
        ensureFrameworkPublishPackages,
        readStore,
        updateStore,
        normalizePathForCompare,
        createWorkspaceId,
        now
    } = deps;

    const state = readStore();
    const normalizedProjectDir = normalizePathForCompare(projectDir);
    if ((state.workspaces || []).some((item) => normalizePathForCompare(item.projectDir) === normalizedProjectDir)) {
        throw new Error('该路径已存在管理记录，请勿重复创建。');
    }

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

    const workspace = {
        id: createWorkspaceId(),
        name,
        projectDir,
        framework,
        theme,
        createdAt: now(),
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
}

async function importWorkspaceFromGithubWorkflow(payload, deps) {
    const {
        localDestinationPath,
        name,
        siteType = null,
        deployRepo = null,
        backupRepo = null
    } = payload || {};
    const {
        readStore,
        updateStore,
        normalizePathForCompare,
        cloneRepositoryToDestination,
        detectFramework,
        assertSupportedImportedFramework,
        inferRecognizedThemeIdFromProject,
        importSubscriptions,
        getProjectName,
        createWorkspaceId,
        now,
        validateImportRepositoryState
    } = deps;

    const state = readStore();
    const normalizedProjectDir = normalizePathForCompare(localDestinationPath);
    if ((state.workspaces || []).some((item) => normalizePathForCompare(item.projectDir) === normalizedProjectDir)) {
        throw new Error('该路径已存在管理记录，请勿重复导入。');
    }

    const stateValidation = validateImportRepositoryState({
        hasDeployRepo: Boolean(deployRepo && deployRepo.url),
        hasBackupRepo: Boolean(backupRepo && backupRepo.url)
    });
    if (!stateValidation.ok) {
        const error = new Error(stateValidation.causes?.[0]?.message || 'GitHub 导入仓库状态不受支持。');
        error.operationResult = stateValidation;
        throw error;
    }

    const authoritativeBackupUrl = String(backupRepo?.url || '').trim();
    if (!authoritativeBackupUrl) {
        throw createValidationOperationError('github_import_backup_missing', '缺少备份仓库地址，无法执行 GitHub 导入。');
    }

    const parsedBackupRepo = parseGithubRepo(authoritativeBackupUrl);
    if (!parsedBackupRepo) {
        throw createValidationOperationError('backup_repo_invalid', '备份仓库地址格式错误，无法执行 GitHub 导入。');
    }

    cloneRepositoryToDestination({
        repoUrl: authoritativeBackupUrl,
        destinationPath: localDestinationPath
    });

    const framework = assertSupportedImportedFramework(detectFramework(localDestinationPath));
    const workspace = {
        id: createWorkspaceId(),
        name: name || getProjectName(localDestinationPath),
        projectDir: localDestinationPath,
        framework,
        theme: inferRecognizedThemeIdFromProject(localDestinationPath, framework),
        importedAt: now(),
        siteType,
        deployRepo: deployRepo || {
            owner: '',
            name: '',
            url: '',
            visibility: REMOTE_REPO_VISIBILITY.public,
            sourceType: REMOTE_REPO_SOURCE_TYPES.manualEntry
        },
        backupRepo: {
            ...(backupRepo || {}),
            owner: parsedBackupRepo.owner,
            name: parsedBackupRepo.repo
        },
        importSource: REMOTE_IMPORT_SOURCES.githubRemote,
        localProjectPath: localDestinationPath
    };

    const next = updateStore((draft) => {
        draft.workspaces.push(workspace);
        return draft;
    });

    const rssRestore = importSubscriptions({ projectDir: localDestinationPath, strategy: 'merge' });
    return { workspace, workspaces: next.workspaces, rssRestore };
}

async function importWorkspaceWorkflow(payload, deps) {
    const { projectDir, name } = payload || {};
    const {
        readStore,
        updateStore,
        normalizePathForCompare,
        detectFramework,
        assertSupportedImportedFramework,
        inferRecognizedThemeIdFromProject,
        importSubscriptions,
        getProjectName,
        createWorkspaceId,
        now
    } = deps;

    const state = readStore();
    const normalizedProjectDir = normalizePathForCompare(projectDir);
    if ((state.workspaces || []).some((item) => normalizePathForCompare(item.projectDir) === normalizedProjectDir)) {
        throw new Error('该路径已存在管理记录，请勿重复导入。');
    }

    const framework = assertSupportedImportedFramework(detectFramework(projectDir));
    const workspace = {
        id: createWorkspaceId(),
        name: name || getProjectName(projectDir),
        projectDir,
        framework,
        theme: inferRecognizedThemeIdFromProject(projectDir, framework),
        importedAt: now()
    };

    const next = updateStore((draft) => {
        draft.workspaces.push(workspace);
        return draft;
    });

    const rssRestore = importSubscriptions({ projectDir, strategy: 'merge' });
    return { workspace, workspaces: next.workspaces, rssRestore };
}

function backupWorkspaceWorkflow(payload, deps) {
    const { projectDir, backupDir, repoUrl, visibility } = payload || {};
    const { backupWorkspace, pushBackupToRepo, now } = deps;

    const snapshotDir = backupWorkspace({
        projectDir,
        backupDir,
        metadata: {
            visibility,
            createdAt: now()
        }
    });

    let pushResult = [];
    if (repoUrl) {
        pushResult = pushBackupToRepo(snapshotDir, repoUrl);
    }

    return { snapshotDir, pushResult };
}

module.exports = {
    createWorkspaceWorkflow,
    importWorkspaceWorkflow,
    backupWorkspaceWorkflow,
    importWorkspaceFromGithubWorkflow
};
