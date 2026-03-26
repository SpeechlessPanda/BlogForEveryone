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
    backupWorkspaceWorkflow
};
