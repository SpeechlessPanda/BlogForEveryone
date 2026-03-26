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
    assert.equal(options.webPreferences.sandbox, false);
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
