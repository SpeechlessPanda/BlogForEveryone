const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

function loadRssServiceHarness(initialState = null) {
    const state = initialState || { subscriptions: [] };
    const parserQueue = [];
    const notifications = [];
    let now = 1700000000000;

    const originalLoad = Module._load;

    class MockParser {
        async parseURL(url) {
            if (parserQueue.length === 0) {
                throw new Error(`unexpected parseURL call for ${url}`);
            }

            const next = parserQueue.shift();
            if (next && next.error) {
                throw next.error;
            }

            return next;
        }
    }

    function MockNotification(payload) {
        this.payload = payload;
    }
    MockNotification.prototype.show = function show() {
        notifications.push(this.payload);
    };

    Date.now = () => {
        now += 1;
        return now;
    };

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'rss-parser') {
            return MockParser;
        }
        if (request === 'electron') {
            return { Notification: MockNotification };
        }
        if (request === './storeService') {
            return {
                readStore() {
                    return state;
                },
                writeStore(nextState) {
                    Object.assign(state, nextState);
                }
            };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    const servicePath = require.resolve('./rssService');
    delete require.cache[servicePath];
    const service = require('./rssService');

    return {
        service,
        state,
        parserQueue,
        notifications,
        cleanup() {
            Module._load = originalLoad;
            delete require.cache[servicePath];
        }
    };
}

test('rss service exposes test seam for parser and timers', () => {
    const harness = loadRssServiceHarness();
    try {
        assert.ok(harness.service.__test__, 'expected __test__ seam export');
        assert.equal(typeof harness.service.__test__.setParserForTests, 'function');
        assert.equal(typeof harness.service.__test__.resetAutoSyncStateForTests, 'function');
    } finally {
        harness.cleanup();
    }
});

test('addSubscription fetches initial feed and avoids duplicates', async () => {
    const harness = loadRssServiceHarness({ subscriptions: [] });
    try {
        harness.parserQueue.push({
            items: [
                { guid: 'g-2', title: 'two', link: 'https://example.com/2', pubDate: '2026-03-26' },
                { guid: 'g-1', title: 'one', link: 'https://example.com/1', pubDate: '2026-03-25' }
            ]
        });

        const first = await harness.service.addSubscription({ url: 'https://example.com/rss.xml', title: 'Example' });
        assert.equal(first.length, 1);
        assert.equal(first[0].title, 'Example');
        assert.equal(first[0].latestItems.length, 2);
        assert.equal(first[0].lastItemGuid, 'g-2');
        assert.equal(first[0].unreadCount, 0);

        const second = await harness.service.addSubscription({ url: 'https://example.com/rss.xml', title: 'Duplicate title' });
        assert.equal(second.length, 1);
        assert.equal(second[0].title, 'Example');
    } finally {
        harness.cleanup();
    }
});

test('addSubscription persists parser failures into lastError', async () => {
    const harness = loadRssServiceHarness({ subscriptions: [] });
    try {
        harness.parserQueue.push({ error: new Error('rss unreachable') });
        const list = await harness.service.addSubscription({ url: 'https://broken.example/rss.xml', title: '' });
        assert.equal(list[0].title, 'https://broken.example/rss.xml');
        assert.match(list[0].lastError, /rss unreachable/);
    } finally {
        harness.cleanup();
    }
});

test('syncSubscriptions tracks unread and emits notification for new items', async () => {
    const harness = loadRssServiceHarness({
        subscriptions: [{
            id: 'sub-1',
            url: 'https://example.com/rss.xml',
            title: 'Example Feed',
            lastItemGuid: 'g-1',
            unreadItemKeys: [],
            readItemKeys: ['g-3']
        }]
    });

    try {
        harness.parserQueue.push({
            items: [
                { guid: 'g-4', title: 'four', link: 'https://example.com/4', pubDate: '2026-03-26' },
                { guid: 'g-3', title: 'three', link: 'https://example.com/3', pubDate: '2026-03-25' },
                { guid: 'g-1', title: 'one', link: 'https://example.com/1', pubDate: '2026-03-24' }
            ]
        });

        const synced = await harness.service.syncSubscriptions();
        assert.equal(synced[0].lastItemGuid, 'g-4');
        assert.deepEqual(synced[0].unreadItemKeys, ['g-4']);
        assert.equal(synced[0].unreadCount, 1);
        assert.equal(harness.notifications.length, 1);
        assert.match(harness.notifications[0].body, /新增 1 篇文章/);
    } finally {
        harness.cleanup();
    }
});

test('syncSubscriptions stores parse errors without throwing', async () => {
    const harness = loadRssServiceHarness({
        subscriptions: [{
            id: 'sub-2',
            url: 'https://broken.example/rss.xml',
            title: 'Broken Feed',
            lastItemGuid: null,
            unreadItemKeys: [],
            readItemKeys: []
        }]
    });

    try {
        harness.parserQueue.push({ error: new Error('feed timeout') });
        const synced = await harness.service.syncSubscriptions();
        assert.match(synced[0].lastError, /feed timeout/);
    } finally {
        harness.cleanup();
    }
});

test('markItemRead validates required args and is idempotent', () => {
    const harness = loadRssServiceHarness({
        subscriptions: [{
            id: 'sub-3',
            url: 'https://example.com/rss.xml',
            title: 'Readable',
            unreadItemKeys: ['k-1'],
            readItemKeys: []
        }]
    });

    try {
        assert.throws(() => harness.service.markItemRead({ subscriptionId: '', itemKey: 'k-1' }), /缺少标记已读参数/);
        assert.throws(() => harness.service.markItemRead({ subscriptionId: 'sub-3', itemKey: '' }), /缺少标记已读参数/);

        const once = harness.service.markItemRead({ subscriptionId: 'sub-3', itemKey: 'k-1' });
        assert.equal(once[0].unreadCount, 0);
        assert.deepEqual(once[0].readItemKeys, ['k-1']);

        const twice = harness.service.markItemRead({ subscriptionId: 'sub-3', itemKey: 'k-1' });
        assert.deepEqual(twice[0].readItemKeys, ['k-1']);
    } finally {
        harness.cleanup();
    }
});

test('markItemRead returns normalized list when subscription is missing', () => {
    const harness = loadRssServiceHarness({ subscriptions: [{ id: 'a', url: 'u', title: 't' }] });
    try {
        const list = harness.service.markItemRead({ subscriptionId: 'missing', itemKey: 'k' });
        assert.equal(list.length, 1);
        assert.equal(list[0].unreadCount, 0);
        assert.deepEqual(list[0].unreadItemKeys, []);
        assert.deepEqual(list[0].readItemKeys, []);
    } finally {
        harness.cleanup();
    }
});

test('export and import subscriptions support merge and overwrite', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rss-bundle-'));
    const harness = loadRssServiceHarness({
        subscriptions: [{ id: 's1', url: 'https://a.example/rss.xml', title: 'A' }]
    });

    try {
        const bundlePath = harness.service.exportSubscriptions({ projectDir });
        assert.equal(path.basename(bundlePath), 'subscriptions.bundle.json');
        assert.equal(fs.existsSync(bundlePath), true);

        fs.writeFileSync(bundlePath, JSON.stringify([
            { id: 'incoming-a', url: 'https://a.example/rss.xml', title: 'A incoming' },
            { id: 'incoming-b', url: 'https://b.example/rss.xml', title: 'B incoming' }
        ], null, 2), 'utf-8');

        const merged = harness.service.importSubscriptions({ projectDir, strategy: 'merge' });
        assert.equal(merged.restored, 2);
        assert.equal(merged.subscriptions.length, 2);

        const overwritten = harness.service.importSubscriptions({ projectDir, strategy: 'overwrite' });
        assert.equal(overwritten.subscriptions.length, 2);
        assert.equal(overwritten.subscriptions[0].id, 'incoming-a');
    } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
        harness.cleanup();
    }
});

test('importSubscriptions returns current state when bundle file is missing', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rss-import-missing-'));
    const harness = loadRssServiceHarness({ subscriptions: [{ id: 's2', url: 'https://x.example/rss.xml', title: 'X' }] });

    try {
        const result = harness.service.importSubscriptions({ projectDir });
        assert.equal(result.restored, 0);
        assert.equal(result.subscriptions.length, 1);
    } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
        harness.cleanup();
    }
});

test('removeSubscription deletes by id and getUnreadSummary aggregates unread counts', () => {
    const harness = loadRssServiceHarness({
        subscriptions: [
            { id: 'a', url: 'https://a/rss.xml', title: 'A', unreadItemKeys: ['1', '2'], readItemKeys: [] },
            { id: 'b', url: 'https://b/rss.xml', title: 'B', unreadItemKeys: ['3'], readItemKeys: [] }
        ]
    });

    try {
        const summaryBefore = harness.service.getUnreadSummary();
        assert.equal(summaryBefore.totalUnread, 3);
        assert.equal(summaryBefore.subscriptionCount, 2);

        const next = harness.service.removeSubscription({ id: 'a' });
        assert.equal(next.length, 1);
        assert.equal(next[0].id, 'b');

        const summaryAfter = harness.service.getUnreadSummary();
        assert.equal(summaryAfter.totalUnread, 1);
        assert.equal(summaryAfter.subscriptionCount, 1);
    } finally {
        harness.cleanup();
    }
});

test('startAutoSync, stopAutoSync and setAutoSyncEnabled manage timer lifecycle', async () => {
    const harness = loadRssServiceHarness({
        subscriptions: [{ id: 't1', url: 'https://timer/rss.xml', title: 'Timer', unreadItemKeys: [], readItemKeys: [] }]
    });

    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    const timers = [];
    const cleared = [];

    global.setInterval = (handler, interval) => {
        const token = { id: timers.length + 1, interval, handler };
        timers.push(token);
        return token;
    };
    global.clearInterval = (token) => {
        cleared.push(token);
    };

    try {
        harness.service.__test__.setParserForTests({
            async parseURL() {
                return { items: [] };
            }
        });

        harness.service.startAutoSync(1234);
        let state = harness.service.getAutoSyncState();
        assert.equal(state.enabled, true);
        assert.equal(state.running, true);
        assert.equal(timers[0].interval, 1234);

        await timers[0].handler();

        harness.service.startAutoSync(2222);
        assert.equal(cleared.length, 1);
        assert.equal(timers[1].interval, 2222);

        harness.service.setAutoSyncEnabled(false);
        state = harness.service.getAutoSyncState();
        assert.equal(state.enabled, false);
        assert.equal(state.running, false);

        harness.service.setAutoSyncEnabled(true, 3333);
        state = harness.service.getAutoSyncState();
        assert.equal(state.enabled, true);
        assert.equal(state.running, true);
        assert.equal(timers.at(-1).interval, 3333);

        harness.service.__test__.setParserForTests(null);
        harness.service.__test__.resetAutoSyncStateForTests();
        state = harness.service.getAutoSyncState();
        assert.equal(state.enabled, true);
        assert.equal(state.running, false);
    } finally {
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        harness.cleanup();
    }
});

test('syncSubscriptions skips feed items without stable key', async () => {
    const harness = loadRssServiceHarness({
        subscriptions: [{
            id: 'sub-key-skip',
            url: 'https://example.com/rss.xml',
            title: 'Key Skip',
            lastItemGuid: 'old-guid',
            unreadItemKeys: [],
            readItemKeys: []
        }]
    });

    try {
        harness.parserQueue.push({
            items: [
                { guid: 'new-guid', id: '', link: 'https://example.com/new', title: 'new', pubDate: '2026-03-26' },
                { guid: '', id: '', link: '', title: '', pubDate: '2026-03-26' },
                { guid: 'old-guid', title: 'old', link: 'https://example.com/old', pubDate: '2026-03-25' }
            ]
        });

        const synced = await harness.service.syncSubscriptions();
        assert.equal(synced[0].unreadCount, 1);
        assert.deepEqual(synced[0].unreadItemKeys, ['new-guid']);
    } finally {
        harness.cleanup();
    }
});

test('startAutoSync swallows background sync errors', async () => {
    const harness = loadRssServiceHarness({});

    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    let scheduled = null;

    global.setInterval = (handler) => {
        scheduled = handler;
        return { id: 1 };
    };
    global.clearInterval = () => {};

    try {
        harness.service.__test__.setParserForTests({
            async parseURL() {
                throw new Error('background parse failed');
            }
        });

        harness.service.startAutoSync(1000);
        await assert.doesNotReject(async () => {
            await scheduled();
        });
    } finally {
        harness.service.stopAutoSync();
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
        harness.cleanup();
    }
});
