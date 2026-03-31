const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

function loadContentIpcWithMocks(overrides = {}) {
    const originalLoad = Module._load;
    const handlers = new Map();
    const calls = {
        getPublishJobStatus: []
    };

    const contentServiceMock = {
        createAndOpenContent: async () => ({ ok: true }),
        listExistingContents: async () => [],
        readExistingContent: async () => ({ ok: true }),
        saveExistingContent: async () => ({ ok: true }),
        openExistingContent: async () => ({ ok: true }),
        watchSaveAndAutoPublish: async () => ({ jobId: 'watch-job', status: 'watching' }),
        publishSavedContent: async () => ({ jobId: 'publish-job', status: 'publishing' }),
        getPublishJobStatus: (jobId) => {
            calls.getPublishJobStatus.push(jobId);
            return { jobId, workspaceId: 'ws-1', status: 'watching' };
        },
        ...overrides.contentService
    };

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === '../services/contentService') {
            return contentServiceMock;
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[require.resolve('./contentIpc')];
    const { registerContentIpcHandlers } = require('./contentIpc');
    Module._load = originalLoad;

    registerContentIpcHandlers({
        ipcMain: {
            handle(channel, handler) {
                handlers.set(channel, handler);
            }
        },
        getWorkspacePolicy: () => ({
            getManagedWorkspace(workspaceId) {
                if (workspaceId === 'ws-1') {
                    return { id: 'ws-1', projectDir: 'D:/blogs/demo', framework: 'hexo' };
                }
                if (workspaceId === 'ws-2') {
                    return { id: 'ws-2', projectDir: 'D:/blogs/other', framework: 'hugo' };
                }
                throw new Error('未找到受管工作区。');
            },
            getAllowedContentRoots() {
                return ['D:/blogs/demo/source'];
            },
            assertContentPathAllowed(_workspaceId, candidatePath) {
                return candidatePath;
            }
        })
    });

    return { handlers, calls };
}

test('content:getPublishJobStatus enforces workspace-scoped visibility', async () => {
    const harness = loadContentIpcWithMocks({
        contentService: {
            getPublishJobStatus: () => ({ jobId: 'job-1', workspaceId: 'ws-2', status: 'done' })
        }
    });
    const handler = harness.handlers.get('content:getPublishJobStatus');

    const result = await handler({}, {
        workspaceId: 'ws-1',
        jobId: 'job-1'
    });

    assert.equal(result, null);
});

test('content:getPublishJobStatus returns status when job belongs to managed workspace', async () => {
    const harness = loadContentIpcWithMocks({
        contentService: {
            getPublishJobStatus: (jobId) => ({ jobId, workspaceId: 'ws-1', status: 'publishing' })
        }
    });
    const handler = harness.handlers.get('content:getPublishJobStatus');

    const result = await handler({}, {
        workspaceId: 'ws-1',
        jobId: 'job-1'
    });

    assert.deepEqual(result, {
        jobId: 'job-1',
        workspaceId: 'ws-1',
        status: 'publishing'
    });
});

test('content:getPublishJobStatus rejects unknown workspace before status lookup', async () => {
    const harness = loadContentIpcWithMocks();
    const handler = harness.handlers.get('content:getPublishJobStatus');

    await assert.rejects(
        () => handler({}, { workspaceId: 'missing', jobId: 'job-1' }),
        /受管工作区/
    );
    assert.deepEqual(harness.calls.getPublishJobStatus, []);
});
