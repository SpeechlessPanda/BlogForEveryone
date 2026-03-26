const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAppIpcHandlers } = require('./appIpc');

function createHarness(overrides = {}) {
    const handlers = new Map();
    const dialogCalls = [];
    const setLaunchCalls = [];
    const setAutoSyncCalls = [];
    const storeState = {
        preferences: {
            generateBlogRss: true,
            autoSyncRssSubscriptions: true,
            launchAtStartup: false
        }
    };

    const deps = {
        ipcMain: {
            handle(channel, handler) {
                handlers.set(channel, handler);
            }
        },
        app: {
            getVersion: () => '1.2.0',
            isPackaged: true
        },
        dialog: {
            async showOpenDialog(options) {
                dialogCalls.push(options);
                return { canceled: true, filePaths: [] };
            }
        },
        checkEnvironment: () => ({ node: true }),
        getUpdateState: () => ({ status: 'idle' }),
        readStore: () => storeState,
        getLaunchAtStartup: () => true,
        updateStore: (mutator) => {
            const next = mutator(storeState) || storeState;
            storeState.preferences = next.preferences;
            return storeState;
        },
        setLaunchAtStartup: (enabled) => {
            setLaunchCalls.push(enabled);
            return { launchAtStartup: enabled, effective: true };
        },
        setAutoSyncEnabled: (enabled) => {
            setAutoSyncCalls.push(enabled);
        },
        getAutoSyncState: () => ({ enabled: storeState.preferences.autoSyncRssSubscriptions !== false }),
        checkForUpdatesNow: async () => ({ ok: true }),
        quitAndInstallUpdate: async () => ({ installed: true }),
        ...overrides
    };

    registerAppIpcHandlers(deps);

    return {
        handlers,
        dialogCalls,
        setLaunchCalls,
        setAutoSyncCalls,
        storeState
    };
}

test('app:getState and app:getUpdateState expose app status', async () => {
    const harness = createHarness();
    const getState = harness.handlers.get('app:getState');
    const getUpdateState = harness.handlers.get('app:getUpdateState');

    const state = await getState();
    const updateState = await getUpdateState();

    assert.deepEqual(state, {
        appName: 'BlogForEveryone',
        version: '1.2.0',
        env: { node: true }
    });
    assert.deepEqual(updateState, { status: 'idle' });
});

test('app:getPreferences applies defaults and launch fallback', async () => {
    const harness = createHarness({
        readStore: () => ({ preferences: { autoSyncRssSubscriptions: false } }),
        getLaunchAtStartup: () => false
    });
    const handler = harness.handlers.get('app:getPreferences');

    const preferences = await handler();
    assert.deepEqual(preferences, {
        autoSyncRssSubscriptions: false,
        generateBlogRss: true,
        launchAtStartup: false
    });
});

test('app:savePreferences uses safe payload defaults when payload missing', async () => {
    const harness = createHarness({
        readStore: () => ({ preferences: {} }),
        updateStore: (mutator) => {
            const state = { preferences: {} };
            const next = mutator(state) || state;
            return { preferences: next.preferences };
        }
    });
    const handler = harness.handlers.get('app:savePreferences');

    const result = await handler({}, undefined);

    assert.deepEqual(result, {
        preferences: {
            generateBlogRss: true,
            autoSyncRssSubscriptions: true,
            launchAtStartup: false
        },
        rssAutoSync: { enabled: true },
        launchAtStartup: { launchAtStartup: true, effective: true }
    });
    assert.equal(harness.setLaunchCalls.length, 0);
    assert.deepEqual(harness.setAutoSyncCalls, [true]);
});

test('app:savePreferences persists explicit toggles and startup setting', async () => {
    const harness = createHarness();
    const handler = harness.handlers.get('app:savePreferences');

    const result = await handler({}, {
        generateBlogRss: false,
        autoSyncRssSubscriptions: false,
        launchAtStartup: false
    });

    assert.deepEqual(result, {
        preferences: {
            generateBlogRss: false,
            autoSyncRssSubscriptions: false,
            launchAtStartup: false
        },
        rssAutoSync: { enabled: false },
        launchAtStartup: { launchAtStartup: false, effective: true }
    });
    assert.deepEqual(harness.setLaunchCalls, [false]);
    assert.deepEqual(harness.setAutoSyncCalls, [false]);
});

test('app:update actions delegate to updater services', async () => {
    const harness = createHarness({
        checkForUpdatesNow: async () => ({ ok: true, source: 'manual' }),
        quitAndInstallUpdate: async () => ({ ok: true, action: 'install-now' })
    });
    const checkNow = harness.handlers.get('app:checkUpdatesNow');
    const installNow = harness.handlers.get('app:installUpdateNow');

    assert.deepEqual(await checkNow(), { ok: true, source: 'manual' });
    assert.deepEqual(await installNow(), { ok: true, action: 'install-now' });
});

test('app:pickDirectory returns canceled payload and default title', async () => {
    const harness = createHarness();
    const handler = harness.handlers.get('app:pickDirectory');

    const result = await handler({}, undefined);

    assert.deepEqual(result, { canceled: true, path: '' });
    assert.deepEqual(harness.dialogCalls[0], {
        title: '选择文件夹',
        defaultPath: undefined,
        properties: ['openDirectory', 'createDirectory']
    });
});

test('app:pickDirectory returns selected path with custom payload', async () => {
    const harness = createHarness({
        dialog: {
            async showOpenDialog(options) {
                harness.dialogCalls.push(options);
                return { canceled: false, filePaths: ['D:/blogs/my-blog'] };
            }
        }
    });
    const handler = harness.handlers.get('app:pickDirectory');

    const result = await handler({}, { title: '选择工作区目录', defaultPath: 'D:/blogs' });

    assert.deepEqual(result, { canceled: false, path: 'D:/blogs/my-blog' });
    assert.deepEqual(harness.dialogCalls[0], {
        title: '选择工作区目录',
        defaultPath: 'D:/blogs',
        properties: ['openDirectory', 'createDirectory']
    });
});

test('app:pickFile handles canceled and selected branches', async () => {
    const dialogCalls = [];
    const responses = [
        { canceled: true, filePaths: [] },
        { canceled: false, filePaths: ['D:/themes/cover.png'] }
    ];
    const harness = createHarness({
        dialog: {
            async showOpenDialog(options) {
                dialogCalls.push(options);
                return responses.shift();
            }
        }
    });
    const handler = harness.handlers.get('app:pickFile');

    const canceled = await handler({}, undefined);
    const selected = await handler({}, {
        title: '选择图片文件',
        defaultPath: 'D:/themes',
        filters: [{ name: 'Images', extensions: ['png', 'jpg'] }]
    });

    assert.deepEqual(canceled, { canceled: true, path: '' });
    assert.deepEqual(selected, { canceled: false, path: 'D:/themes/cover.png' });
    assert.deepEqual(dialogCalls[0], {
        title: '选择文件',
        defaultPath: undefined,
        filters: undefined,
        properties: ['openFile']
    });
    assert.deepEqual(dialogCalls[1], {
        title: '选择图片文件',
        defaultPath: 'D:/themes',
        filters: [{ name: 'Images', extensions: ['png', 'jpg'] }],
        properties: ['openFile']
    });
});
