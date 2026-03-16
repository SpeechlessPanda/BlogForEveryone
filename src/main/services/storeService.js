const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DATA_DIR = path.join(app.getPath('userData'), 'bfe-data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureStore() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
        const initial = {
            workspaces: [],
            subscriptions: [],
            notifications: [],
            preferences: {
                generateBlogRss: true,
                autoSyncRssSubscriptions: true
            }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    }
}

function readStore() {
    ensureStore();
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
}

function writeStore(nextStore) {
    ensureStore();
    fs.writeFileSync(DB_FILE, JSON.stringify(nextStore, null, 2), 'utf-8');
}

function updateStore(mutator) {
    const state = readStore();
    const next = mutator(state) || state;
    writeStore(next);
    return next;
}

module.exports = {
    readStore,
    writeStore,
    updateStore,
    DATA_DIR
};
