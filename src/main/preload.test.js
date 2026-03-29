const test = require('node:test');
const assert = require('node:assert/strict');

test('preload exposes createBfeApi and exposeBfeApi for contract testing', () => {
    const preload = require('./preload');

    assert.equal(typeof preload.createBfeApi, 'function');
    assert.equal(typeof preload.exposeBfeApi, 'function');
});

test('createBfeApi routes auth channels and listener cleanup through injected ipcRenderer', () => {
    const listenerEntries = [];
    const removedEntries = [];
    const invokeCalls = [];
    const ipcRenderer = {
        invoke(channel, payload) {
            invokeCalls.push({ channel, payload });
            return { channel, payload };
        },
        on(channel, handler) {
            listenerEntries.push({ channel, handler });
        },
        removeListener(channel, handler) {
            removedEntries.push({ channel, handler });
        }
    };

    const { createBfeApi } = require('./preload');
    const api = createBfeApi({ ipcRenderer });

    api.beginGithubDeviceLogin({ clientId: 'abc' });
    api.completeGithubDeviceLogin({ deviceCode: 'def' });
    api.githubLoginWithDeviceCode({ userCode: 'ghi' });
    api.getGithubAuthState();
    api.githubLogout();

    assert.deepEqual(
        invokeCalls.map(({ channel }) => channel),
        [
            'githubAuth:beginDeviceLogin',
            'githubAuth:completeDeviceLogin',
            'githubAuth:loginWithDeviceCode',
            'githubAuth:getState',
            'githubAuth:logout'
        ]
    );

    const disposeUpdate = api.onUpdateStatus(() => {});
    const disposeOps = api.onOperationEvent(() => {});

    assert.equal(listenerEntries.length, 2);
    assert.deepEqual(listenerEntries.map(({ channel }) => channel), ['app:updateStatus', 'ops:event']);

    disposeUpdate();
    disposeOps();

    assert.deepEqual(
        removedEntries.map(({ channel }) => channel),
        ['app:updateStatus', 'ops:event']
    );
    assert.equal(removedEntries[0].handler, listenerEntries[0].handler);
    assert.equal(removedEntries[1].handler, listenerEntries[1].handler);
});

test('exposeBfeApi publishes the generated API on window.bfeApi', () => {
    const exposed = [];
    const contextBridge = {
        exposeInMainWorld(name, value) {
            exposed.push({ name, value });
        }
    };
    const ipcRenderer = {
        invoke() {},
        on() {},
        removeListener() {}
    };

    const { exposeBfeApi } = require('./preload');
    exposeBfeApi({ contextBridge, ipcRenderer });

    assert.equal(exposed.length, 1);
    assert.equal(exposed[0].name, 'bfeApi');
    assert.equal(typeof exposed[0].value.getAppState, 'function');
    assert.equal(typeof exposed[0].value.listWorkspaces, 'function');
    assert.equal(typeof exposed[0].value.getThemeCatalog, 'function');
    assert.equal(typeof exposed[0].value.createAndOpenContent, 'function');
    assert.equal(typeof exposed[0].value.publishSavedContent, 'function');
    assert.equal(typeof exposed[0].value.listSubscriptions, 'function');
});
