const test = require('node:test');
const assert = require('node:assert/strict');

const { registerRssIpcHandlers } = require('./rssIpc');

function createHarness() {
    const handlers = new Map();
    const calls = {
        exportSubscriptions: [],
        importSubscriptions: []
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
        }
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
