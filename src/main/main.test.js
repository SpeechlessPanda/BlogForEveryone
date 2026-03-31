const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

function loadMainWithMocks() {
    const browserWindowCalls = [];
    const loadUrlCalls = [];
    const loadFileCalls = [];

    const mocks = {
        electron: {
            app: {
                getPath: () => 'D:/tmp/user-data',
                setPath: () => {},
                whenReady: () => ({ then: () => {} }),
                on: () => {}
            },
            BrowserWindow: function BrowserWindow(options) {
                browserWindowCalls.push(options);
                return {
                    webContents: {
                        setWindowOpenHandler: () => {},
                        openDevTools: () => {}
                    },
                    setIcon: () => {},
                    loadURL: (url) => loadUrlCalls.push(url),
                    loadFile: (file) => loadFileCalls.push(file)
                };
            },
            Menu: { setApplicationMenu: () => {} },
            shell: { openExternal: () => {} },
            nativeImage: {
                createFromPath: () => ({ isEmpty: () => true })
            }
        },
        './ipc': { registerIpcHandlers: () => {} },
        './services/rssService': { setAutoSyncEnabled: () => {} },
        './services/storeService': { readStore: () => ({ preferences: {} }) },
        './services/updateService': { initAutoUpdate: () => {} },
        './services/startupService': { applyLaunchAtStartupPreference: () => {} },
        './policies/externalUrlPolicy': {
            evaluateExternalUrl: () => ({ allowed: false, normalizedUrl: '' }),
            EXTERNAL_URL_RULES: { windowOpen: {} }
        }
    };

    const originalLoad = Module._load;
    Module._load = function patchedLoad(request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) {
            return mocks[request];
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    let mainModule;
    try {
        const mainPath = path.join(__dirname, 'main.js');
        delete require.cache[mainPath];
        mainModule = require('./main');
    } finally {
        Module._load = originalLoad;
    }

    return {
        mainModule,
        browserWindowCalls,
        loadUrlCalls,
        loadFileCalls
    };
}

function loadMainLifecycleHarness({
    platform = process.platform,
    allWindows = [],
    externalDecision = { allowed: true, normalizedUrl: 'https://example.com' },
    iconExists = true,
    iconEmpty = false
} = {}) {
    const appOnHandlers = new Map();
    const browserWindows = [];
    const openExternalCalls = [];
    const autoSyncCalls = [];
    const startupCalls = [];
    const updateCalls = [];
    const evaluateCalls = [];
    let readyHandler = null;
    let quitCalls = 0;

    const originalLoad = Module._load;
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    const originalResourcesPath = Object.getOwnPropertyDescriptor(process, 'resourcesPath');

    Object.defineProperty(process, 'platform', {
        configurable: true,
        value: platform
    });
    Object.defineProperty(process, 'resourcesPath', {
        configurable: true,
        value: 'D:/tmp/resources'
    });

    const mocks = {
        electron: {
            app: {
                getPath: () => 'D:/tmp/user-data',
                getAppPath: () => 'D:/tmp/app',
                setPath: () => {},
                setAppUserModelId: () => {},
                whenReady: () => ({ then(cb) { readyHandler = cb; } }),
                on(event, cb) {
                    appOnHandlers.set(event, cb);
                },
                quit() {
                    quitCalls += 1;
                }
            },
            BrowserWindow: function BrowserWindow(options) {
                const handlers = {};
                const win = {
                    options,
                    webContents: {
                        setWindowOpenHandler(handler) {
                            handlers.windowOpen = handler;
                        },
                        on(eventName, handler) {
                            handlers[eventName] = handler;
                        },
                        openDevTools: () => {}
                    },
                    setIcon: () => {},
                    loadURL: () => {},
                    loadFile: () => {},
                    __handlers: handlers
                };
                browserWindows.push(win);
                return win;
            },
            Menu: { setApplicationMenu: () => {} },
            shell: {
                openExternal(url) {
                    openExternalCalls.push(url);
                }
            },
            nativeImage: {
                createFromPath: () => ({ isEmpty: () => iconEmpty })
            }
        },
        fs: {
            existsSync: () => iconExists
        },
        './ipc': { registerIpcHandlers: () => {} },
        './services/rssService': {
            setAutoSyncEnabled(value) {
                autoSyncCalls.push(value);
            }
        },
        './services/storeService': {
            readStore: () => ({ preferences: { autoSyncRssSubscriptions: false, launchAtStartup: true } })
        },
        './services/updateService': {
            initAutoUpdate(win) {
                updateCalls.push(win);
            }
        },
        './services/startupService': {
            applyLaunchAtStartupPreference(pref) {
                startupCalls.push(pref);
            }
        },
        './policies/externalUrlPolicy': {
            evaluateExternalUrl(url) {
                evaluateCalls.push(url);
                return externalDecision;
            },
            EXTERNAL_URL_RULES: { windowOpen: {} }
        }
    };

    mocks.electron.BrowserWindow.getAllWindows = () => allWindows;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) {
            return mocks[request];
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    const mainPath = path.join(__dirname, 'main.js');
    delete require.cache[mainPath];
    require('./main');

    return {
        readyHandler,
        appOnHandlers,
        browserWindows,
        openExternalCalls,
        autoSyncCalls,
        startupCalls,
        updateCalls,
        evaluateCalls,
        getQuitCalls() {
            return quitCalls;
        },
        cleanup() {
            Module._load = originalLoad;
            delete require.cache[mainPath];
            if (originalPlatform) {
                Object.defineProperty(process, 'platform', originalPlatform);
            }
            if (originalResourcesPath) {
                Object.defineProperty(process, 'resourcesPath', originalResourcesPath);
            }
        }
    };
}

test('main window BrowserWindow options contract is pinned', () => {
    const harness = loadMainWithMocks();

    const options = harness.mainModule.buildMainWindowOptions();

    assert.equal(options.width, 1280);
    assert.equal(options.height, 860);
    assert.equal(options.minWidth, 1080);
    assert.equal(options.minHeight, 720);
    assert.equal(options.autoHideMenuBar, true);
    assert.equal(path.basename(options.webPreferences.preload), 'preload.js');
    assert.equal(options.webPreferences.contextIsolation, true);
    assert.equal(options.webPreferences.nodeIntegration, false);
    assert.equal(options.webPreferences.sandbox, true);
});

test('main window loading contract uses dev URL and prod file', () => {
    const harness = loadMainWithMocks();
    let devToolsCalls = 0;

    const devWin = {
        loadURL: (url) => harness.loadUrlCalls.push(url),
        loadFile: (file) => harness.loadFileCalls.push(file),
        webContents: { openDevTools: () => { devToolsCalls += 1; } }
    };
    harness.mainModule.loadMainWindowContent(devWin, { isDev: true });

    assert.deepEqual(harness.loadUrlCalls, ['http://localhost:5173']);
    assert.equal(harness.loadFileCalls.length, 0);
    assert.equal(devToolsCalls, 1);

    const prodWin = {
        loadURL: (url) => harness.loadUrlCalls.push(url),
        loadFile: (file) => harness.loadFileCalls.push(file),
        webContents: { openDevTools: () => {} }
    };
    harness.mainModule.loadMainWindowContent(prodWin, { isDev: false });

    assert.equal(harness.loadUrlCalls.length, 1);
    assert.equal(
        harness.loadFileCalls[0],
        path.join(__dirname, '../../dist/renderer/index.html')
    );
});

test('main bootstrap registers lifecycle hooks and applies preferences', () => {
    const harness = loadMainLifecycleHarness({ platform: 'win32', allWindows: [] });

    try {
        harness.readyHandler();

        assert.equal(harness.autoSyncCalls[0], false);
        assert.equal(harness.startupCalls.length, 1);
        assert.equal(harness.browserWindows.length >= 1, true);
        assert.equal(harness.updateCalls.length >= 1, true);

        const firstWindow = harness.browserWindows[0];
        assert.equal(Boolean(firstWindow.options.icon), true);

        const decision = firstWindow.__handlers.windowOpen({ url: 'https://example.com/docs' });
        assert.deepEqual(decision, { action: 'deny' });
        assert.equal(harness.evaluateCalls.length, 1);
        assert.equal(harness.openExternalCalls[0], 'https://example.com');
    } finally {
        harness.cleanup();
    }
});

test('main activate handler creates new window only when none exist', () => {
    const harness = loadMainLifecycleHarness({ platform: 'win32', allWindows: [] });
    try {
        harness.readyHandler();
        const before = harness.browserWindows.length;
        harness.appOnHandlers.get('activate')();
        assert.equal(harness.browserWindows.length, before + 1);
    } finally {
        harness.cleanup();
    }

    const noCreateHarness = loadMainLifecycleHarness({ platform: 'win32', allWindows: [{ id: 1 }] });
    try {
        noCreateHarness.readyHandler();
        const before = noCreateHarness.browserWindows.length;
        noCreateHarness.appOnHandlers.get('activate')();
        assert.equal(noCreateHarness.browserWindows.length, before);
    } finally {
        noCreateHarness.cleanup();
    }
});

test('window-all-closed quits on non-darwin and keeps app alive on darwin', () => {
    const winHarness = loadMainLifecycleHarness({ platform: 'win32' });
    try {
        winHarness.appOnHandlers.get('window-all-closed')();
        assert.equal(winHarness.getQuitCalls(), 1);
    } finally {
        winHarness.cleanup();
    }

    const macHarness = loadMainLifecycleHarness({ platform: 'darwin' });
    try {
        macHarness.appOnHandlers.get('window-all-closed')();
        assert.equal(macHarness.getQuitCalls(), 0);
    } finally {
        macHarness.cleanup();
    }
});

test('main bootstrap tolerates missing or empty icon candidates', () => {
    const missingHarness = loadMainLifecycleHarness({ platform: 'win32', iconExists: false });
    try {
        missingHarness.readyHandler();
        assert.equal(missingHarness.browserWindows[0].options.icon, undefined);
    } finally {
        missingHarness.cleanup();
    }

    const emptyHarness = loadMainLifecycleHarness({ platform: 'win32', iconExists: true, iconEmpty: true });
    try {
        emptyHarness.readyHandler();
        assert.equal(emptyHarness.browserWindows[0].options.icon, undefined);
    } finally {
        emptyHarness.cleanup();
    }
});

test('window-open handler blocks untrusted urls without opening external browser', () => {
    const harness = loadMainLifecycleHarness({
        platform: 'win32',
        externalDecision: { allowed: false, normalizedUrl: '' }
    });

    try {
        harness.readyHandler();
        const firstWindow = harness.browserWindows[0];
        const decision = firstWindow.__handlers.windowOpen({ url: 'https://evil.example.com' });
        assert.deepEqual(decision, { action: 'deny' });
        assert.equal(harness.openExternalCalls.length, 0);
    } finally {
        harness.cleanup();
    }
});

test('will-navigate blocks unexpected same-window navigation', () => {
    const harness = loadMainLifecycleHarness({ platform: 'win32' });

    try {
        harness.readyHandler();
        const firstWindow = harness.browserWindows[0];
        const navigateHandler = firstWindow.__handlers['will-navigate'];
        let prevented = false;
        const event = {
            preventDefault() {
                prevented = true;
            }
        };

        navigateHandler(event, 'https://evil.example.com/phishing');
        assert.equal(prevented, true);
    } finally {
        harness.cleanup();
    }
});

test('will-navigate allows app-local urls', () => {
    const harness = loadMainLifecycleHarness({ platform: 'win32' });

    try {
        harness.readyHandler();
        const firstWindow = harness.browserWindows[0];
        const navigateHandler = firstWindow.__handlers['will-navigate'];
        let prevented = false;
        const event = {
            preventDefault() {
                prevented = true;
            }
        };

        navigateHandler(event, 'file:///index.html#/tutorial');
        assert.equal(prevented, false);
    } finally {
        harness.cleanup();
    }
});
