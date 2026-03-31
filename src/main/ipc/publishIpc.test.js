const test = require('node:test');
const assert = require('node:assert/strict');

const { registerPublishIpcHandlers } = require('./publishIpc');

function createHarness(overrides = {}) {
  const handlers = new Map();
  const events = [];
  const storeState = overrides.storeState || { workspaces: [] };
  const publishCalls = [];

  registerPublishIpcHandlers({
        ipcMain: {
            handle(channel, handler) {
                handlers.set(channel, handler);
            }
        },
        emitOperationEvent(sender, payload) {
            sender.send('ops:event', payload);
            events.push(payload);
        },
    validatePublishPayload: () => ({ ok: true, warnings: [] }),
    publishToGitHub: (payload) => {
      publishCalls.push(payload);
      return { ok: true, status: 'success' };
    },
    normalizePublishResult: (result) => result,
    getWorkspacePolicy: () => ({
      getManagedWorkspace(workspaceId) {
        const workspace = (storeState.workspaces || []).find((item) => item.id === workspaceId);
        if (!workspace) {
          throw new Error('未找到受管工作区。');
        }
        return workspace;
      },
    }),
    readStore: () => storeState,
    updateStore(mutator) {
      const next = mutator(storeState) || storeState;
      storeState.workspaces = next.workspaces || storeState.workspaces;
      return storeState;
    },
    ...overrides
  });

    return {
        handlers,
        events,
        publishCalls,
    invoke(payload) {
            const handler = handlers.get('publish:github');
            return handler({
                sender: {
                    send(_channel, eventPayload) {
                        events.push(eventPayload);
                    }
                }
            }, payload);
    }
  };
}

test('publish IPC returns combined envelope and surfaces partial_success explicitly', async () => {
    const storeState = {
      workspaces: [{ id: 'ws-1', projectDir: 'D:/tmp/project', framework: 'hugo' }],
    };
    const harness = createHarness({
        storeState,
        publishToGitHub: () => ({
            ok: false,
            status: 'partial_success',
            deployRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
            backupRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
            deployPublish: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
            backupPush: { ok: false, code: 'runtime_error', category: 'runtime', userMessage: 'backup failed' }
        })
    });

    const response = await harness.invoke({
        workspaceId: 'ws-1',
        projectDir: 'D:/tmp/project',
        framework: 'hugo',
        siteType: 'project-pages',
        login: 'alice',
        deployRepoName: 'docs-site',
        backupRepoName: 'BFE',
        repoUrl: 'https://github.com/alice/docs-site.git',
        backupRepoUrl: 'https://github.com/alice/BFE.git'
    });

    assert.equal(response.status, 'partial_success');
    assert.equal(response.deployPublish.ok, true);
    assert.equal(response.backupPush.ok, false);
    const terminalEvent = harness.events.findLast((entry) => entry.scope === 'publish');
    assert.equal(terminalEvent.status, 'partial_success');
    assert.equal(terminalEvent.phase, 'partial_success');
});

test('publish IPC propagates validation failure details', async () => {
    const storeState = {
      workspaces: [{ id: 'ws-1', projectDir: 'D:/tmp/project', framework: 'hugo' }],
    };
    const harness = createHarness({
        storeState,
        validatePublishPayload: () => ({
            ok: false,
            errors: ['deploy repo invalid'],
            operationResult: {
                ok: false,
                code: 'validation_failed',
                category: 'validation',
                causes: [{ key: 'deploy_repo_invalid', message: 'deploy repo invalid' }]
            }
        })
    });

    await assert.rejects(
        harness.invoke({ workspaceId: 'ws-1', projectDir: 'D:/tmp/project', framework: 'hugo' }),
        (error) => {
            assert.equal(error.operationResult?.code, 'validation_failed');
            assert.equal(error.operationResult?.causes?.[0]?.key, 'deploy_repo_invalid');
            return true;
        }
    );

    const failedEvent = harness.events.find((entry) => entry.scope === 'publish' && entry.phase === 'failed');
    assert.equal(Boolean(failedEvent), true);
    assert.equal(failedEvent.message, 'deploy repo invalid');
});

test('publish IPC keeps child outcomes in success response envelope', async () => {
    const storeState = {
      workspaces: [{ id: 'ws-1', projectDir: 'D:/tmp/project', framework: 'hexo' }],
    };
    const harness = createHarness({
        storeState,
        publishToGitHub: () => ({
            ok: true,
            status: 'success',
            deployRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
            backupRepoEnsure: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
            deployPublish: { ok: true, code: 'ok', category: 'runtime', userMessage: '' },
            backupPush: { ok: true, code: 'ok', category: 'runtime', userMessage: '' }
        })
    });

    const response = await harness.invoke({
        workspaceId: 'ws-1',
        projectDir: 'D:/tmp/project',
        framework: 'hexo',
        siteType: 'user-pages',
        login: 'alice',
        deployRepoName: 'alice.github.io',
        backupRepoName: 'BFE',
        repoUrl: 'https://github.com/alice/alice.github.io.git',
        backupRepoUrl: 'https://github.com/alice/BFE.git'
    });

    assert.equal(response.status, 'success');
    assert.equal(response.deployRepoEnsure.ok, true);
    assert.equal(response.backupRepoEnsure.ok, true);
    assert.equal(response.deployPublish.ok, true);
    assert.equal(response.backupPush.ok, true);
});

test('publish IPC awaits async publishToGitHub before normalizing and emitting final phase', async () => {
    const callOrder = [];
    const harness = createHarness({
        storeState: {
          workspaces: [{ id: 'ws-1', projectDir: 'D:/tmp/project', framework: 'hugo' }],
        },
        publishToGitHub: async () => {
            callOrder.push('publish-start');
            await new Promise((resolve) => setTimeout(resolve, 10));
            callOrder.push('publish-resolve');
            return {
                ok: true,
                status: 'success',
                pagesUrl: 'https://alice.github.io/docs-site/',
                deployPublish: { ok: true },
                backupPush: { ok: true }
            };
        },
        normalizePublishResult: (result) => {
            callOrder.push('normalize');
            return result;
        }
    });

    const response = await harness.invoke({
        workspaceId: 'ws-1',
        projectDir: 'D:/tmp/project',
        framework: 'hugo',
        repoUrl: 'https://github.com/alice/docs-site.git'
    });

    assert.deepEqual(callOrder, ['publish-start', 'publish-resolve', 'normalize']);
    assert.equal(response.status, 'success');
    assert.equal(response.pagesUrl, 'https://alice.github.io/docs-site/');
    const terminalEvent = harness.events.findLast((entry) => entry.scope === 'publish');
    assert.equal(terminalEvent.phase, 'succeeded');
  assert.equal(terminalEvent.status, 'success');
});

test('publish IPC persists workspace remote metadata after successful publish', async () => {
  const storeState = {
    workspaces: [
      {
        id: 'ws-1',
        name: 'Demo',
        projectDir: 'D:/tmp/project',
        framework: 'hugo',
      },
    ],
  };
  const harness = createHarness({
    storeState,
    publishToGitHub: () => ({
      ok: true,
      status: 'success',
      pagesUrl: 'https://alice.github.io/',
      deployRepoEnsure: { ok: true },
      backupRepoEnsure: { ok: true },
      deployPublish: { ok: true },
      backupPush: { ok: true },
    }),
  });

  await harness.invoke({
    workspaceId: 'ws-1',
    projectDir: 'D:/tmp/project',
    framework: 'hugo',
    siteType: 'user-pages',
    login: 'alice',
    deployRepoName: 'alice.github.io',
    backupRepoName: 'BFE',
    repoUrl: 'https://github.com/alice/alice.github.io.git',
    backupRepoUrl: 'https://github.com/alice/BFE.git',
  });

  assert.deepEqual(storeState.workspaces[0].siteType, 'user-pages');
  assert.equal(storeState.workspaces[0].deployRepo.owner, 'alice');
  assert.equal(storeState.workspaces[0].deployRepo.name, 'alice.github.io');
  assert.equal(storeState.workspaces[0].deployRepo.url, 'https://github.com/alice/alice.github.io.git');
  assert.equal(storeState.workspaces[0].backupRepo.owner, 'alice');
  assert.equal(storeState.workspaces[0].backupRepo.name, 'BFE');
  assert.equal(storeState.workspaces[0].backupRepo.url, 'https://github.com/alice/BFE.git');
});

test('publish IPC uses canonical workspace context and rejects unknown workspace', async () => {
  const storeState = {
    workspaces: [{ id: 'ws-1', projectDir: 'D:/managed/project', framework: 'hugo' }],
  };
  const harness = createHarness({ storeState });

  await harness.invoke({
    workspaceId: 'ws-1',
    projectDir: 'D:/untrusted/project',
    framework: 'hexo',
    repoUrl: 'https://github.com/alice/docs-site.git',
  });

  assert.equal(harness.publishCalls.length, 1);
  assert.equal(harness.publishCalls[0].projectDir, 'D:/managed/project');
  assert.equal(harness.publishCalls[0].framework, 'hugo');

  await assert.rejects(
    () => harness.invoke({
      workspaceId: 'missing',
      projectDir: 'D:/tmp/project',
      framework: 'hugo',
      repoUrl: 'https://github.com/alice/docs-site.git',
    }),
    /受管工作区/
  );
});
