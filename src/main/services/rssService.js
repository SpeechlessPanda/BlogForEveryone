const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { Notification } = require('electron');
const { readStore, writeStore } = require('./storeService');

const parser = new Parser();
let syncTimer = null;
let syncEnabled = true;

function listSubscriptions() {
    const state = readStore();
    return state.subscriptions || [];
}

function addSubscription({ url, title }) {
    const state = readStore();
    const exists = state.subscriptions.find((item) => item.url === url);
    if (exists) {
        return state.subscriptions;
    }

    state.subscriptions.push({
        id: Date.now().toString(),
        url,
        title: title || url,
        lastItemGuid: null,
        unreadCount: 0,
        latestItems: []
    });

    writeStore(state);
    return state.subscriptions;
}

function removeSubscription({ id }) {
    const state = readStore();
    state.subscriptions = state.subscriptions.filter((item) => item.id !== id);
    writeStore(state);
    return state.subscriptions;
}

async function syncSubscriptions() {
    const state = readStore();

    for (const sub of state.subscriptions) {
        try {
            const feed = await parser.parseURL(sub.url);
            const items = (feed.items || []).slice(0, 20);
            const newest = items[0];
            const newestGuid = newest ? newest.guid || newest.link || newest.title : null;

            if (newestGuid && sub.lastItemGuid && newestGuid !== sub.lastItemGuid) {
                sub.unreadCount += 1;
                new Notification({
                    title: 'BlogForEveryone 订阅更新',
                    body: `${sub.title} 发布了新内容`
                }).show();
            }

            sub.lastItemGuid = newestGuid;
            sub.latestItems = items.map((item) => ({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                contentSnippet: item.contentSnippet || ''
            }));
        } catch (error) {
            sub.lastError = error.message;
        }
    }

    writeStore(state);
    return state.subscriptions;
}

function exportSubscriptions({ projectDir }) {
    const state = readStore();
    const targetDir = path.join(projectDir, '.bfe');
    fs.mkdirSync(targetDir, { recursive: true });

    const filePath = path.join(targetDir, 'subscriptions.bundle.json');
    fs.writeFileSync(filePath, JSON.stringify(state.subscriptions, null, 2), 'utf-8');

    return filePath;
}

function importSubscriptions({ projectDir, strategy = 'merge' }) {
    const filePath = path.join(projectDir, '.bfe', 'subscriptions.bundle.json');
    if (!fs.existsSync(filePath)) {
        return { restored: 0, subscriptions: listSubscriptions() };
    }

    const incoming = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const state = readStore();

    if (strategy === 'overwrite') {
        state.subscriptions = incoming;
    } else {
        const existingMap = new Map(state.subscriptions.map((item) => [item.url, item]));
        for (const item of incoming) {
            if (!existingMap.has(item.url)) {
                state.subscriptions.push(item);
            }
        }
    }

    writeStore(state);
    return { restored: incoming.length, subscriptions: state.subscriptions };
}

function startAutoSync(intervalMs = 10 * 60 * 1000) {
    syncEnabled = true;
    if (syncTimer) {
        clearInterval(syncTimer);
    }

    syncTimer = setInterval(async () => {
        try {
            await syncSubscriptions();
        } catch (error) {
            // Keep background polling resilient; errors are stored in subscription state.
        }
    }, intervalMs);
}

function stopAutoSync() {
    syncEnabled = false;
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
}

function setAutoSyncEnabled(enabled, intervalMs = 10 * 60 * 1000) {
    if (enabled) {
        startAutoSync(intervalMs);
        return;
    }
    stopAutoSync();
}

function getAutoSyncState() {
    return {
        enabled: syncEnabled,
        running: Boolean(syncTimer)
    };
}

module.exports = {
    listSubscriptions,
    addSubscription,
    removeSubscription,
    syncSubscriptions,
    exportSubscriptions,
    importSubscriptions,
    startAutoSync,
    stopAutoSync,
    setAutoSyncEnabled,
    getAutoSyncState
};
