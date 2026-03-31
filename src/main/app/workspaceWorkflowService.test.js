const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createWorkspaceWorkflow,
    importWorkspaceWorkflow,
    backupWorkspaceWorkflow,
    importWorkspaceFromGithubWorkflow
} = require('./workspaceWorkflowService');
const {
    REMOTE_IMPORT_SOURCES,
    REMOTE_REPO_SOURCE_TYPES,
    REMOTE_SITE_TYPES
} = require('../../shared/remoteWorkspaceContract');

test('workspace workflow service exposes orchestration entry points for create/import/backup', () => {
    const workflowService = require('./workspaceWorkflowService');

    assert.equal(typeof workflowService.createWorkspaceWorkflow, 'function');
    assert.equal(typeof workflowService.importWorkspaceWorkflow, 'function');
    assert.equal(typeof workflowService.backupWorkspaceWorkflow, 'function');
});

test('create workspace delegates init/theme/tooling and persists composed workspace record', async () => {
    const callOrder = [];
    const state = { workspaces: [] };

    const deps = {
        initProject: async ({ framework, projectDir }) => {
            callOrder.push('initProject');
            assert.equal(framework, 'hugo');
            assert.equal(projectDir, '/tmp/new-site');
            return { status: 0, stdout: 'init ok', stderr: '', logs: ['init-log'] };
        },
        installAndApplyTheme: async ({ projectDir, framework, themeId }) => {
            callOrder.push('installAndApplyTheme');
            assert.equal(projectDir, '/tmp/new-site');
            assert.equal(framework, 'hugo');
            assert.equal(themeId, 'stack');
            return { ok: true, logs: ['theme-log'] };
        },
        ensureFrameworkPublishPackages: async ({ projectDir, framework, themeId }) => {
            callOrder.push('ensureFrameworkPublishPackages');
            assert.equal(projectDir, '/tmp/new-site');
            assert.equal(framework, 'hugo');
            assert.equal(themeId, 'stack');
            return { ok: true, logs: ['tooling-log'] };
        },
        readStore: () => state,
        updateStore: (updater) => updater(state),
        normalizePathForCompare: (value) => value,
        createWorkspaceId: () => 'ws-1',
        now: () => '2026-01-01T00:00:00.000Z'
    };

    const result = await createWorkspaceWorkflow(
        {
            name: 'My Blog',
            projectDir: '/tmp/new-site',
            framework: 'hugo',
            theme: 'stack'
        },
        deps
    );

    assert.deepEqual(callOrder, ['initProject', 'installAndApplyTheme', 'ensureFrameworkPublishPackages']);
    assert.equal(result.workspace.id, 'ws-1');
    assert.equal(result.workspace.name, 'My Blog');
    assert.equal(result.workspace.projectDir, '/tmp/new-site');
    assert.equal(result.workspace.framework, 'hugo');
    assert.equal(result.workspace.theme, 'stack');
    assert.equal(result.workspace.createdAt, '2026-01-01T00:00:00.000Z');
    assert.deepEqual(result.workspace.initLogs, ['init-log', 'theme-log', 'tooling-log']);
    assert.equal(result.workspaces.length, 1);
});

test('create workspace rejects duplicate path before running init/theme/tooling side effects', async () => {
    let initCalls = 0;
    let themeCalls = 0;
    let toolingCalls = 0;

    await assert.rejects(
        createWorkspaceWorkflow(
            {
                name: 'Duplicated Blog',
                projectDir: '/tmp/dup-site',
                framework: 'hugo',
                theme: 'stack'
            },
            {
                initProject: async () => {
                    initCalls += 1;
                    return { status: 0, stdout: '', stderr: '', logs: [] };
                },
                installAndApplyTheme: async () => {
                    themeCalls += 1;
                    return { ok: true, logs: [] };
                },
                ensureFrameworkPublishPackages: async () => {
                    toolingCalls += 1;
                    return { ok: true, logs: [] };
                },
                readStore: () => ({
                    workspaces: [{ id: 'existing', projectDir: '/tmp/dup-site' }]
                }),
                updateStore: () => {
                    throw new Error('updateStore should not run on duplicate create path');
                },
                normalizePathForCompare: (value) => String(value || ''),
                createWorkspaceId: () => 'never-used',
                now: () => 'never-used'
            }
        ),
        /该路径已存在管理记录，请勿重复创建。/
    );

    assert.equal(initCalls, 0);
    assert.equal(themeCalls, 0);
    assert.equal(toolingCalls, 0);
});

test('import workspace delegates framework/theme/rss extraction and persists inferred workspace fields', async () => {
    const state = { workspaces: [] };
    const trace = [];

    const result = await importWorkspaceWorkflow(
        { projectDir: '/tmp/imported', name: '' },
        {
            readStore: () => state,
            updateStore: (updater) => updater(state),
            normalizePathForCompare: (value) => value,
            detectFramework: (projectDir) => {
                trace.push(['detectFramework', projectDir]);
                return 'hugo';
            },
            assertSupportedImportedFramework: (framework) => {
                trace.push(['assertSupportedImportedFramework', framework]);
                return framework;
            },
            inferRecognizedThemeIdFromProject: (projectDir, framework) => {
                trace.push(['inferRecognizedThemeIdFromProject', projectDir, framework]);
                return 'stack';
            },
            importSubscriptions: ({ projectDir, strategy }) => {
                trace.push(['importSubscriptions', projectDir, strategy]);
                return { restored: 2, subscriptions: [{ title: 'A' }, { title: 'B' }] };
            },
            getProjectName: (projectDir) => {
                trace.push(['getProjectName', projectDir]);
                return 'imported';
            },
            createWorkspaceId: () => 'ws-import-1',
            now: () => '2026-01-01T00:00:00.000Z'
        }
    );

    assert.equal(result.workspace.id, 'ws-import-1');
    assert.equal(result.workspace.name, 'imported');
    assert.equal(result.workspace.projectDir, '/tmp/imported');
    assert.equal(result.workspace.framework, 'hugo');
    assert.equal(result.workspace.theme, 'stack');
    assert.equal(result.workspace.importedAt, '2026-01-01T00:00:00.000Z');
    assert.deepEqual(result.rssRestore, { restored: 2, subscriptions: [{ title: 'A' }, { title: 'B' }] });
    assert.equal(result.workspaces.length, 1);
    assert.deepEqual(trace, [
        ['detectFramework', '/tmp/imported'],
        ['assertSupportedImportedFramework', 'hugo'],
        ['getProjectName', '/tmp/imported'],
        ['inferRecognizedThemeIdFromProject', '/tmp/imported', 'hugo'],
        ['importSubscriptions', '/tmp/imported', 'merge']
    ]);
});

test('backup workspace delegates snapshot metadata and repo push orchestration', () => {
    let backupCall = null;
    let pushCall = null;

    const result = backupWorkspaceWorkflow(
        {
            projectDir: '/tmp/source-site',
            backupDir: '/tmp/backups',
            repoUrl: 'https://example.com/repo.git',
            visibility: 'private'
        },
        {
            backupWorkspace: (payload) => {
                backupCall = payload;
                return '/tmp/backups/snapshot-1';
            },
            pushBackupToRepo: (snapshotDir, repoUrl) => {
                pushCall = { snapshotDir, repoUrl };
                return ['git init', 'git push'];
            },
            now: () => '2026-01-01T00:00:00.000Z'
        }
    );

    assert.deepEqual(backupCall, {
        projectDir: '/tmp/source-site',
        backupDir: '/tmp/backups',
        metadata: {
            visibility: 'private',
            createdAt: '2026-01-01T00:00:00.000Z'
        }
    });
    assert.deepEqual(pushCall, {
        snapshotDir: '/tmp/backups/snapshot-1',
        repoUrl: 'https://example.com/repo.git'
    });
    assert.deepEqual(result, {
        snapshotDir: '/tmp/backups/snapshot-1',
        pushResult: ['git init', 'git push']
    });
});

test('github-direct import clones from backup repo as authoritative source and persists remote metadata', async () => {
    const state = { workspaces: [] };
    const cloneCalls = [];

    const result = await importWorkspaceFromGithubWorkflow(
        {
            name: 'Imported from backup',
            localDestinationPath: '/tmp/import-target',
            siteType: REMOTE_SITE_TYPES.projectPages,
            deployRepo: {
                owner: 'alice',
                name: 'alice-blog',
                url: 'https://github.com/alice/alice-blog.git',
                visibility: 'public',
                sourceType: REMOTE_REPO_SOURCE_TYPES.existing
            },
            backupRepo: {
                owner: 'alice',
                name: 'my-archive',
                url: 'https://github.com/alice/my-archive.git',
                visibility: 'private',
                sourceType: REMOTE_REPO_SOURCE_TYPES.existing
            }
        },
        {
            readStore: () => state,
            updateStore: (updater) => updater(state),
            normalizePathForCompare: (value) => value,
            cloneRepositoryToDestination: async ({ repoUrl, destinationPath }) => {
                cloneCalls.push({ repoUrl, destinationPath });
                return { ok: true };
            },
            detectFramework: () => 'hugo',
            assertSupportedImportedFramework: (framework) => framework,
            inferRecognizedThemeIdFromProject: () => 'stack',
            importSubscriptions: () => ({ restored: 0, subscriptions: [] }),
            getProjectName: () => 'import-target',
            createWorkspaceId: () => 'ws-github-1',
            now: () => '2026-01-01T00:00:00.000Z',
            validateImportRepositoryState: () => ({ ok: true })
        }
    );

    assert.deepEqual(cloneCalls, [{ repoUrl: 'https://github.com/alice/my-archive.git', destinationPath: '/tmp/import-target' }]);
    assert.equal(result.workspace.importSource, REMOTE_IMPORT_SOURCES.githubRemote);
    assert.equal(result.workspace.backupRepo.name, 'my-archive');
    assert.equal(result.workspace.deployRepo.name, 'alice-blog');
    assert.equal(result.workspace.localProjectPath, '/tmp/import-target');
});

test('github-direct import succeeds when backup exists even if deploy repo is missing', async () => {
    const result = await importWorkspaceFromGithubWorkflow(
        {
            localDestinationPath: '/tmp/backup-only',
            siteType: REMOTE_SITE_TYPES.projectPages,
            deployRepo: null,
            backupRepo: {
                owner: 'alice',
                name: 'backup-only',
                url: 'https://github.com/alice/backup-only.git',
                visibility: 'private',
                sourceType: REMOTE_REPO_SOURCE_TYPES.existing
            }
        },
        {
            readStore: () => ({ workspaces: [] }),
            updateStore: (updater) => updater({ workspaces: [] }),
            normalizePathForCompare: (value) => value,
            cloneRepositoryToDestination: async () => ({ ok: true }),
            detectFramework: () => 'hexo',
            assertSupportedImportedFramework: (framework) => framework,
            inferRecognizedThemeIdFromProject: () => 'landscape',
            importSubscriptions: () => ({ restored: 0, subscriptions: [] }),
            getProjectName: () => 'backup-only',
            createWorkspaceId: () => 'ws-github-2',
            now: () => '2026-01-01T00:00:00.000Z',
            validateImportRepositoryState: () => ({ ok: true })
        }
    );

    assert.equal(result.workspace.importSource, REMOTE_IMPORT_SOURCES.githubRemote);
    assert.equal(result.workspace.deployRepo.name, '');
    assert.equal(result.workspace.backupRepo.name, 'backup-only');
});

test('github-direct import rejects deploy-exists-but-backup-missing with one-cause failure', async () => {
    await assert.rejects(
        importWorkspaceFromGithubWorkflow(
            {
                localDestinationPath: '/tmp/invalid-import-state',
                siteType: REMOTE_SITE_TYPES.projectPages,
                deployRepo: {
                    owner: 'alice',
                    name: 'alice-blog',
                    url: 'https://github.com/alice/alice-blog.git',
                    visibility: 'public',
                    sourceType: REMOTE_REPO_SOURCE_TYPES.existing
                },
                backupRepo: null
            },
            {
                readStore: () => ({ workspaces: [] }),
                updateStore: () => {
                    throw new Error('updateStore should not run when import state is unsupported');
                },
                normalizePathForCompare: (value) => value,
                cloneRepositoryToDestination: async () => {
                    throw new Error('clone should not run when backup repo is missing');
                },
                detectFramework: () => 'hugo',
                assertSupportedImportedFramework: (framework) => framework,
                inferRecognizedThemeIdFromProject: () => 'stack',
                importSubscriptions: () => ({ restored: 0, subscriptions: [] }),
                getProjectName: () => 'invalid-import-state',
                createWorkspaceId: () => 'ws-never',
                now: () => '2026-01-01T00:00:00.000Z',
                validateImportRepositoryState: () => ({
                    ok: false,
                    code: 'validation_failed',
                    category: 'validation',
                    causes: [{ key: 'github_import_backup_missing', message: 'backup missing' }]
                })
            }
        ),
        (error) => {
            assert.equal(error.operationResult.causes.length, 1);
            assert.equal(error.operationResult.causes[0].key, 'github_import_backup_missing');
            return true;
        }
    );
});

test('github-direct import accepts non-BFE backup repo metadata and persists parsed repo name', async () => {
    const cloneCalls = [];
    const result = await importWorkspaceFromGithubWorkflow(
        {
            localDestinationPath: '/tmp/non-bfe-backup',
            siteType: REMOTE_SITE_TYPES.projectPages,
            deployRepo: null,
            backupRepo: {
                owner: 'alice',
                name: 'archive-repo',
                url: 'https://github.com/alice/archive-repo.git',
                visibility: 'private',
                sourceType: REMOTE_REPO_SOURCE_TYPES.existing
            }
        },
        {
            readStore: () => ({ workspaces: [] }),
            updateStore: (updater) => updater({ workspaces: [] }),
            normalizePathForCompare: (value) => value,
            cloneRepositoryToDestination: async ({ repoUrl, destinationPath }) => {
                cloneCalls.push({ repoUrl, destinationPath });
                return { ok: true };
            },
            detectFramework: () => 'hugo',
            assertSupportedImportedFramework: (framework) => framework,
            inferRecognizedThemeIdFromProject: () => 'stack',
            importSubscriptions: () => ({ restored: 0, subscriptions: [] }),
            getProjectName: () => 'non-bfe-backup',
            createWorkspaceId: () => 'ws-non-bfe',
            now: () => '2026-01-01T00:00:00.000Z',
            validateImportRepositoryState: () => ({ ok: true })
        }
    );

    assert.deepEqual(cloneCalls, [{ repoUrl: 'https://github.com/alice/archive-repo.git', destinationPath: '/tmp/non-bfe-backup' }]);
    assert.equal(result.workspace.backupRepo.name, 'archive-repo');
});
