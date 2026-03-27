const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

function loadWorkspaceIpcModule({
    framework = 'hugo',
    inferredThemeId = 'stack',
    workflowCreateResult,
    workflowImportResult,
    workflowBackupResult,
    workflowGithubImportResult,
    initialState,
    workspacePolicy,
    githubRepoListResult,
    githubEnsureResult,
    importPayloadValidationResult
} = {}) {
    const originalLoad = Module._load;
    const handlers = new Map();
    const state = initialState || { workspaces: [] };
    const workflowCreateCalls = [];
    const workflowImportCalls = [];
    const workflowBackupCalls = [];
    const workflowGithubImportCalls = [];
    const githubListCalls = [];
    const githubEnsureCalls = [];

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === '../services/storeService') {
            return {
                readStore() {
                    return state;
                },
                updateStore(updater) {
                    return updater(state);
                }
            };
        }

        if (request === '../services/frameworkService') {
            return {
                detectFramework() {
                    return framework;
                },
                initProject() {
                    throw new Error('initProject should not be called in import test');
                }
            };
        }

        if (request === '../services/themeService') {
            return {
                installAndApplyTheme() {
                    throw new Error('installAndApplyTheme should not be called in import test');
                },
                inferRecognizedThemeIdFromProject() {
                    return inferredThemeId;
                }
            };
        }

        if (request === '../services/frameworkToolingService') {
            return {
                ensureFrameworkPublishPackages() {
                    throw new Error('ensureFrameworkPublishPackages should not be called in import test');
                }
            };
        }

        if (request === '../services/backupService') {
            return {
                backupWorkspace() {
                    throw new Error('backupWorkspace should not be called in import test');
                },
                pushBackupToRepo() {
                    throw new Error('pushBackupToRepo should not be called in import test');
                }
            };
        }

        if (request === '../services/rssService') {
            return {
                importSubscriptions() {
                    return { restored: 0, subscriptions: [] };
                }
            };
        }

        if (request === '../services/githubRepoService') {
            return {
                listUserRepositories(payload) {
                    githubListCalls.push(payload);
                    return githubRepoListResult;
                },
                ensureRemoteRepositories(payload) {
                    githubEnsureCalls.push(payload);
                    return githubEnsureResult;
                }
            };
        }

        if (request === '../services/configValidationService') {
            return {
                validateGithubImportPayload(payload) {
                    return importPayloadValidationResult || { ok: true, normalizedPayload: payload };
                }
            };
        }

        if (request === '../policies/workspaceImportPolicy') {
            return {
                assertSupportedImportedFramework(value) {
                    return value;
                }
            };
        }

        if (request === '../app/workspaceWorkflowService') {
            return {
                createWorkspaceWorkflow(payload) {
                    workflowCreateCalls.push(payload);
                    return workflowCreateResult;
                },
                importWorkspaceWorkflow(payload) {
                    workflowImportCalls.push(payload);
                    return workflowImportResult;
                },
                backupWorkspaceWorkflow(payload) {
                    workflowBackupCalls.push(payload);
                    return workflowBackupResult;
                },
                importWorkspaceFromGithubWorkflow(payload) {
                    workflowGithubImportCalls.push(payload);
                    return workflowGithubImportResult;
                }
            };
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        delete require.cache[require.resolve('./workspaceIpc')];
        const workspaceIpc = require('./workspaceIpc');
        return {
            handlers,
            workflowCreateCalls,
            workflowImportCalls,
            workflowBackupCalls,
            workflowGithubImportCalls,
            githubListCalls,
            githubEnsureCalls,
            register() {
                workspaceIpc.registerWorkspaceIpcHandlers({
                    ipcMain: {
                        handle(channel, handler) {
                            handlers.set(channel, handler);
                        }
                    },
                    getWorkspacePolicy() {
                        return workspacePolicy || {
                            assertPathWithinWorkspace(_id, targetPath) {
                                return targetPath;
                            }
                        };
                    }
                });
            }
        };
    } finally {
        Module._load = originalLoad;
    }
}

test('workspace create delegates to workflow boundary with thin payload passthrough', async () => {
    const workflowCreateResult = {
        workspace: { id: 'created-1', projectDir: '/tmp/created-1', framework: 'hugo', theme: 'stack' },
        workspaces: [{ id: 'created-1', projectDir: '/tmp/created-1', framework: 'hugo', theme: 'stack' }]
    };

    const moduleRef = loadWorkspaceIpcModule({ workflowCreateResult });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:create');
    assert.equal(typeof handler, 'function');

    const payload = {
        name: 'Created Blog',
        projectDir: path.resolve('/tmp/created-1'),
        framework: 'hugo',
        theme: 'stack'
    };
    const result = await handler({}, payload);

    assert.equal(moduleRef.workflowCreateCalls.length, 1);
    assert.deepEqual(moduleRef.workflowCreateCalls[0], payload);
    assert.deepEqual(result, workflowCreateResult);
});

test('workspace import delegates orchestration to workspace workflow service boundary', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-workspace-import-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    const workflowImportResult = {
        workspace: { id: 'from-workflow', projectDir, framework: 'hugo', theme: 'stack' },
        workspaces: [{ id: 'from-workflow', projectDir, framework: 'hugo', theme: 'stack' }],
        rssRestore: { restored: 1, subscriptions: [{ title: 'from-workflow' }] }
    };

    const moduleRef = loadWorkspaceIpcModule({
        framework: 'hugo',
        inferredThemeId: 'stack',
        workflowImportResult
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:import');
    assert.equal(typeof handler, 'function');

    const result = await handler({}, { projectDir, name: 'Imported Blog' });
    assert.equal(moduleRef.workflowImportCalls.length, 1);
    assert.deepEqual(moduleRef.workflowImportCalls[0], { projectDir, name: 'Imported Blog' });
    assert.deepEqual(result, workflowImportResult);
});

test('workspace import rejects relative user path before workflow orchestration', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-workspace-import-relative-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    const relativeProjectDir = path.join('relative-import-root', path.basename(projectDir));
    assert.equal(path.isAbsolute(relativeProjectDir), false);

    const moduleRef = loadWorkspaceIpcModule({
        workflowImportResult: {
            workspace: { id: 'unexpected', projectDir, framework: 'hugo', theme: 'stack' },
            workspaces: [{ id: 'unexpected', projectDir, framework: 'hugo', theme: 'stack' }],
            rssRestore: { restored: 0, subscriptions: [] }
        }
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:import');
    assert.equal(typeof handler, 'function');

    await assert.rejects(
        handler({}, { projectDir: relativeProjectDir, name: 'Relative Import' }),
        /工程路径必须为绝对路径，无法导入工程。/
    );

    assert.equal(moduleRef.workflowImportCalls.length, 0);
});

test('workspace:listGithubRepos delegates to github repo service listing boundary', async () => {
    const listResult = [
        { owner: 'alice', name: 'alice.github.io', url: 'https://github.com/alice/alice.github.io.git', visibility: 'public' },
        { owner: 'alice', name: 'BFE', url: 'https://github.com/alice/BFE.git', visibility: 'private' }
    ];

    const moduleRef = loadWorkspaceIpcModule({ githubRepoListResult: listResult });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:listGithubRepos');
    const result = await handler({}, { includePrivate: true });

    assert.deepEqual(moduleRef.githubListCalls[0], { includePrivate: true });
    assert.deepEqual(result, listResult);
});

test('workspace:createGithubRepos delegates optional deploy/backup creation payload', async () => {
    const ensureResult = {
        deployRepo: { owner: 'alice', name: 'alice.github.io', url: 'https://github.com/alice/alice.github.io.git', visibility: 'public' },
        backupRepo: { owner: 'alice', name: 'BFE', url: 'https://github.com/alice/BFE.git', visibility: 'private' }
    };
    const moduleRef = loadWorkspaceIpcModule({ githubEnsureResult: ensureResult });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:createGithubRepos');
    const payload = {
        login: 'alice',
        siteType: 'user-pages',
        createDeployRepo: true,
        createBackupRepo: true
    };
    const result = await handler({}, payload);

    assert.deepEqual(moduleRef.githubEnsureCalls[0], payload);
    assert.deepEqual(result, ensureResult);
});

test('workspace:importFromGithub validates destination first and does not call workflow on invalid input', async () => {
    const moduleRef = loadWorkspaceIpcModule({
        workflowGithubImportResult: { workspace: { id: 'unused' }, workspaces: [] },
        importPayloadValidationResult: {
            ok: false,
            code: 'validation_failed',
            category: 'validation',
            causes: [{ key: 'destination_path_invalid', message: 'invalid destination' }]
        }
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:importFromGithub');
    await assert.rejects(
        handler({}, { localDestinationPath: 'relative/path' }),
        /invalid destination/
    );

    assert.equal(moduleRef.workflowGithubImportCalls.length, 0);
});

test('workspace:importFromGithub returns one-cause structured failure when destination path is an existing file', async (t) => {
    const filePath = path.join(os.tmpdir(), `bfe-github-import-file-${Date.now()}.txt`);
    fs.writeFileSync(filePath, 'not-a-directory', 'utf-8');
    t.after(() => {
        fs.rmSync(filePath, { force: true });
    });

    const moduleRef = loadWorkspaceIpcModule({
        workflowGithubImportResult: { workspace: { id: 'unused' }, workspaces: [] },
        importPayloadValidationResult: {
            ok: true,
            normalizedPayload: {
                localDestinationPath: filePath,
                backupRepo: { owner: 'alice', name: 'BFE', url: 'https://github.com/alice/BFE.git' },
                deployRepo: null
            }
        }
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:importFromGithub');
    await assert.rejects(
        handler({}, { localDestinationPath: filePath }),
        (error) => {
            assert.equal(error.operationResult.ok, false);
            assert.equal(error.operationResult.causes.length, 1);
            assert.equal(error.operationResult.causes[0].key, 'destination_path_not_directory');
            return true;
        }
    );

    assert.equal(moduleRef.workflowGithubImportCalls.length, 0);
});

test('workspace:importFromGithub returns one-cause structured failure when destination directory is non-empty', async (t) => {
    const nonEmptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-github-import-non-empty-'));
    fs.writeFileSync(path.join(nonEmptyDir, 'seed.txt'), 'seed', 'utf-8');
    t.after(() => {
        fs.rmSync(nonEmptyDir, { recursive: true, force: true });
    });

    const moduleRef = loadWorkspaceIpcModule({
        workflowGithubImportResult: { workspace: { id: 'unused' }, workspaces: [] },
        importPayloadValidationResult: {
            ok: true,
            normalizedPayload: {
                localDestinationPath: nonEmptyDir,
                backupRepo: { owner: 'alice', name: 'BFE', url: 'https://github.com/alice/BFE.git' },
                deployRepo: null
            }
        }
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:importFromGithub');
    await assert.rejects(
        handler({}, { localDestinationPath: nonEmptyDir }),
        (error) => {
            assert.equal(error.operationResult.ok, false);
            assert.equal(error.operationResult.causes.length, 1);
            assert.equal(error.operationResult.causes[0].key, 'destination_directory_not_empty');
            return true;
        }
    );

    assert.equal(moduleRef.workflowGithubImportCalls.length, 0);
});

test('workspace:importFromGithub rejects new destination when parent directory is missing before clone/import', async () => {
    const missingParent = path.join(os.tmpdir(), `bfe-github-missing-parent-${Date.now()}`);
    const destinationPath = path.join(missingParent, 'child-project');

    const moduleRef = loadWorkspaceIpcModule({
        workflowGithubImportResult: { workspace: { id: 'unused' }, workspaces: [] },
        importPayloadValidationResult: {
            ok: true,
            normalizedPayload: {
                localDestinationPath: destinationPath,
                backupRepo: { owner: 'alice', name: 'BFE', url: 'https://github.com/alice/BFE.git' },
                deployRepo: null
            }
        }
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:importFromGithub');
    await assert.rejects(
        handler({}, { localDestinationPath: destinationPath }),
        (error) => {
            assert.equal(error.operationResult.ok, false);
            assert.equal(error.operationResult.causes.length, 1);
            assert.equal(error.operationResult.causes[0].key, 'destination_parent_not_found');
            return true;
        }
    );

    assert.equal(moduleRef.workflowGithubImportCalls.length, 0);
});

test('workspace:importFromGithub delegates to github import workflow and keeps zip fallback out of IPC surface', async () => {
    const importTargetPath = path.join(os.tmpdir(), 'import-target');
    const workflowGithubImportResult = {
        workspace: {
            id: 'ws-github-1',
            projectDir: importTargetPath,
            importSource: 'github-remote'
        },
        workspaces: [{ id: 'ws-github-1', projectDir: importTargetPath }],
        rssRestore: { restored: 1, subscriptions: [] }
    };

    const moduleRef = loadWorkspaceIpcModule({
        workflowGithubImportResult,
        importPayloadValidationResult: {
            ok: true,
            normalizedPayload: {
                localDestinationPath: importTargetPath,
                backupRepo: { owner: 'alice', name: 'BFE', url: 'https://github.com/alice/BFE.git' },
                deployRepo: null
            }
        }
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:importFromGithub');
    const result = await handler({}, { localDestinationPath: importTargetPath });

    assert.equal(typeof moduleRef.handlers.get('workspace:importFromGithubArchive'), 'undefined');
    assert.equal(moduleRef.workflowGithubImportCalls.length, 1);
    assert.equal(path.isAbsolute(moduleRef.workflowGithubImportCalls[0].localDestinationPath), true);
    assert.equal(
        path.normalize(moduleRef.workflowGithubImportCalls[0].localDestinationPath),
        path.normalize(importTargetPath)
    );
    assert.deepEqual(moduleRef.workflowGithubImportCalls[0].backupRepo, {
        owner: 'alice',
        name: 'BFE',
        url: 'https://github.com/alice/BFE.git'
    });
    assert.equal(moduleRef.workflowGithubImportCalls[0].deployRepo, null);
    assert.deepEqual(result, workflowGithubImportResult);
});

test('workspace backup delegates orchestration to workflow boundary', async () => {
    const workflowBackupResult = {
        snapshotDir: '/tmp/backup/snapshot-1',
        pushResult: ['git push']
    };

    const moduleRef = loadWorkspaceIpcModule({ workflowBackupResult });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:backup');
    assert.equal(typeof handler, 'function');

    const payload = {
        projectDir: '/tmp/source-site',
        backupDir: '/tmp/backup',
        repoUrl: 'https://example.com/repo.git',
        visibility: 'private'
    };
    const result = await handler({}, payload);

    assert.equal(moduleRef.workflowBackupCalls.length, 1);
    assert.deepEqual(moduleRef.workflowBackupCalls[0], payload);
    assert.deepEqual(result, workflowBackupResult);
});

test('workspace:list includes localExists flag for each workspace', async (t) => {
    const existingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-workspace-list-existing-'));
    const missingDir = path.join(existingDir, 'missing-subdir');
    t.after(() => {
        fs.rmSync(existingDir, { recursive: true, force: true });
    });

    const moduleRef = loadWorkspaceIpcModule({
        initialState: {
            workspaces: [
                { id: 'w1', projectDir: existingDir },
                { id: 'w2', projectDir: missingDir }
            ]
        }
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:list');
    const list = await handler();

    assert.equal(list.length, 2);
    assert.deepEqual(list.map((item) => item.localExists), [true, false]);
});

test('workspace:create rejects missing and relative paths before workflow call', async () => {
    const moduleRef = loadWorkspaceIpcModule({ workflowCreateResult: { ok: true } });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:create');
    await assert.rejects(handler({}, { name: 'NoPath' }), /缺少工程路径，无法创建工程。/);
    await assert.rejects(
        handler({}, { name: 'RelativePath', projectDir: 'relative/path' }),
        /工程路径必须为绝对路径，无法创建工程。/
    );
    assert.equal(moduleRef.workflowCreateCalls.length, 0);
});

test('workspace:remove validates id, handles not-found and delete-local branches', async (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-workspace-remove-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    const policyCalls = [];
    const moduleRef = loadWorkspaceIpcModule({
        initialState: {
            workspaces: [{ id: 'w-remove', projectDir }]
        },
        workspacePolicy: {
            assertPathWithinWorkspace(id, targetPath, action) {
                policyCalls.push({ id, targetPath, action });
                return targetPath;
            }
        }
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:remove');

    await assert.rejects(handler({}, {}), /缺少工程 ID/);

    const notFound = await handler({}, { id: 'missing', deleteLocal: true });
    assert.equal(notFound.removed, false);
    assert.equal(notFound.reason, 'not-found');

    const removed = await handler({}, { id: 'w-remove', deleteLocal: true });
    assert.equal(removed.removed, true);
    assert.equal(removed.deletedLocal, true);
    assert.equal(policyCalls.length, 1);
    assert.deepEqual(policyCalls[0], {
        id: 'w-remove',
        targetPath: projectDir,
        action: 'delete'
    });
});

test('workspace:import rejects missing path and non-directory path', async (t) => {
    const moduleRef = loadWorkspaceIpcModule({
        workflowImportResult: {
            workspace: { id: 'unused', projectDir: '/tmp', framework: 'hugo', theme: 'stack' },
            workspaces: []
        }
    });
    moduleRef.register();

    const handler = moduleRef.handlers.get('workspace:import');
    await assert.rejects(handler({}, { projectDir: '', name: 'NoPath' }), /缺少工程路径，无法导入工程。/);

    const filePath = path.join(os.tmpdir(), `bfe-import-file-${Date.now()}.txt`);
    fs.writeFileSync(filePath, 'not-a-directory', 'utf-8');
    t.after(() => {
        fs.rmSync(filePath, { force: true });
    });

    await assert.rejects(handler({}, { projectDir: filePath, name: 'FilePath' }), /工程路径不是目录，无法导入工程。/);
    assert.equal(moduleRef.workflowImportCalls.length, 0);
});
