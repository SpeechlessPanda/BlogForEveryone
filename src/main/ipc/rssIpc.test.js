const test = require('node:test');
const assert = require('node:assert/strict');

const { registerRssIpcHandlers } = require('./rssIpc');

function createHarness() {
    const handlers = new Map();
    const calls = {
        exportSubscriptions: [],
        importSubscriptions: [],
        evaluateExternalUrl: [],
        openExternal: []
    };

    registerRssIpcHandlers({
        ipcMain: {
            handle(channel, handler) {
                handlers.set(channel, handler);
            }
        },
        getWorkspacePolicy: () => ({
            getManagedWorkspace(workspaceId) {
                if (workspaceId === 'ws-1') {
                    return {
                        id: 'ws-1',
                        projectDir: 'D:/managed/workspace'
                    };
                }
                throw new Error('未找到受管工作区。');
            }
        }),
        listSubscriptions: async () => [],
        addSubscription: async () => ({}),
        removeSubscription: async () => ({}),
        syncSubscriptions: async () => ({}),
        markItemRead: async () => ({}),
        getUnreadSummary: async () => ({ totalUnread: 0 }),
        exportSubscriptions: async (payload) => {
            calls.exportSubscriptions.push(payload);
            return 'D:/managed/workspace/.bfe/subscriptions.bundle.json';
        },
        importSubscriptions: async (payload) => {
            calls.importSubscriptions.push(payload);
            return { restored: 1, subscriptions: [] };
        },
        evaluateExternalUrl(url) {
            calls.evaluateExternalUrl.push(url);
            if (String(url).includes('denied.example')) {
                return { allowed: false, reason: 'HOST_NOT_ALLOWED' };
            }
            return { allowed: true, normalizedUrl: String(url) };
        },
        openExternal: async (url) => {
            calls.openExternal.push(url);
        },
        externalUrlRule: { allowedProtocols: ['https:'] }
    });

    return { handlers, calls };
}

test('rss export/import resolve canonical managed workspace directory', async () => {
    const harness = createHarness();
    const exportHandler = harness.handlers.get('rss:exportSubscriptions');
    const importHandler = harness.handlers.get('rss:importSubscriptions');

    await exportHandler({}, {
        workspaceId: 'ws-1',
        projectDir: 'D:/untrusted/path'
    });

    await importHandler({}, {
        workspaceId: 'ws-1',
        projectDir: 'D:/another/untrusted/path',
        strategy: 'overwrite'
    });

    assert.deepEqual(harness.calls.exportSubscriptions, [{ projectDir: 'D:/managed/workspace' }]);
    assert.deepEqual(harness.calls.importSubscriptions, [{ projectDir: 'D:/managed/workspace', strategy: 'overwrite' }]);
});

test('rss export/import reject unknown or missing managed workspace context', async () => {
    const harness = createHarness();
    const exportHandler = harness.handlers.get('rss:exportSubscriptions');
    const importHandler = harness.handlers.get('rss:importSubscriptions');

    await assert.rejects(() => exportHandler({}, {}), /受管工作区/);
    await assert.rejects(() => importHandler({}, { workspaceId: 'missing' }), /受管工作区/);
    assert.deepEqual(harness.calls.exportSubscriptions, []);
    assert.deepEqual(harness.calls.importSubscriptions, []);
});

test('rss openArticle validates and opens via main-process guard', async () => {
    const harness = createHarness();
    const openHandler = harness.handlers.get('rss:openArticle');

    const result = await openHandler({}, { url: 'https://example.com/posts/1' });

    assert.deepEqual(result, { opened: true, url: 'https://example.com/posts/1' });
    assert.deepEqual(harness.calls.evaluateExternalUrl, ['https://example.com/posts/1']);
    assert.deepEqual(harness.calls.openExternal, ['https://example.com/posts/1']);
});

test('rss openArticle rejects urls blocked by guard policy', async () => {
    const harness = createHarness();
    const openHandler = harness.handlers.get('rss:openArticle');

    await assert.rejects(
        () => openHandler({}, { url: 'https://denied.example/posts/2' }),
        /外部链接不受信任/
    );

    assert.deepEqual(harness.calls.evaluateExternalUrl, ['https://denied.example/posts/2']);
    assert.deepEqual(harness.calls.openExternal, []);
});
