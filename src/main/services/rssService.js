const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { Notification } = require('electron');
const { readStore, writeStore } = require('./storeService');

const parser = new Parser();
let syncTimer = null;
let syncEnabled = true;

function getItemKey(item) {
    return item?.guid || item?.id || item?.link || item?.title || '';
}

function normalizeSubscription(sub) {
    if (!Array.isArray(sub.readItemKeys)) {
        sub.readItemKeys = [];
    }
    if (!Array.isArray(sub.unreadItemKeys)) {
        sub.unreadItemKeys = [];
    }
    sub.unreadCount = sub.unreadItemKeys.length;
    return sub;
}

function listSubscriptions() {
    const state = readStore();
    const list = state.subscriptions || [];
    list.forEach(normalizeSubscription);
    return list;
}

async function addSubscription({ url, title }) {
    const state = readStore();
    const exists = state.subscriptions.find((item) => item.url === url);
    if (exists) {
        return state.subscriptions;
    }

    const newSub = {
        id: Date.now().toString(),
        url,
        title: title || url,
        lastItemGuid: null,
        unreadCount: 0,
        unreadItemKeys: [],
        readItemKeys: [],
        latestItems: []
    };

    state.subscriptions.push(newSub);

    // First subscription should immediately fetch the latest feed snapshot.
    try {
        const feed = await parser.parseURL(url);
        const items = (feed.items || []).slice(0, 20);
        const latestItemRecords = items.map((item) => ({
            key: getItemKey(item),
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            contentSnippet: item.contentSnippet || ''
        }));
        newSub.latestItems = latestItemRecords;
        newSub.lastItemGuid = items[0] ? items[0].guid || items[0].link || items[0].title : null;
        newSub.unreadItemKeys = [];
        newSub.unreadCount = 0;
    } catch (error) {
        newSub.lastError = error.message;
    }

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
        normalizeSubscription(sub);
        try {
            const feed = await parser.parseURL(sub.url);
            const items = (feed.items || []).slice(0, 20);
            const newest = items[0];
            const newestGuid = newest ? newest.guid || newest.link || newest.title : null;

            const previousLastGuid = sub.lastItemGuid;
            const readSet = new Set(sub.readItemKeys || []);
            const unreadSet = new Set(sub.unreadItemKeys || []);

            const latestItemRecords = items.map((item) => ({
                key: getItemKey(item),
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                contentSnippet: item.contentSnippet || ''
            }));

            let newCount = 0;
            if (newestGuid && previousLastGuid && newestGuid !== previousLastGuid) {
                for (const post of latestItemRecords) {
                    if (!post.key) {
                        continue;
                    }
                    if (post.key === previousLastGuid) {
                        break;
                    }
                    if (!readSet.has(post.key) && !unreadSet.has(post.key)) {
                        unreadSet.add(post.key);
                        newCount += 1;
                    }
                }
            }

            if (newCount > 0) {
                new Notification({
                    title: 'BlogForEveryone 订阅更新',
                    body: `${sub.title} 新增 ${newCount} 篇文章`
                }).show();
            }

            sub.lastItemGuid = newestGuid;
            sub.latestItems = latestItemRecords;
            sub.unreadItemKeys = Array.from(unreadSet);
            sub.unreadCount = sub.unreadItemKeys.length;
        } catch (error) {
            sub.lastError = error.message;
        }
    }

    writeStore(state);
    return state.subscriptions;
}

function markItemRead({ subscriptionId, itemKey }) {
    if (!subscriptionId || !itemKey) {
        throw new Error('缺少标记已读参数');
    }

    const state = readStore();
    const target = (state.subscriptions || []).find((item) => item.id === subscriptionId);
    if (!target) {
        return listSubscriptions();
    }

    normalizeSubscription(target);
    target.unreadItemKeys = target.unreadItemKeys.filter((key) => key !== itemKey);
    if (!target.readItemKeys.includes(itemKey)) {
        target.readItemKeys.push(itemKey);
    }
    target.unreadCount = target.unreadItemKeys.length;

    writeStore(state);
    return state.subscriptions;
}

function getUnreadSummary() {
    const subs = listSubscriptions();
    const totalUnread = subs.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0);
    return {
        totalUnread,
        subscriptionCount: subs.length
    };
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

function startAutoSync(intervalMs = 60 * 60 * 1000) {
    syncEnabled = true;
    if (syncTimer) {
        clearInterval(syncTimer);
    }

    syncTimer = setInterval(async () => {
        try {
            await syncSubscriptions();
        } catch {
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

function setAutoSyncEnabled(enabled, intervalMs = 60 * 60 * 1000) {
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
    markItemRead,
    getUnreadSummary,
    startAutoSync,
    stopAutoSync,
    setAutoSyncEnabled,
    getAutoSyncState
};
