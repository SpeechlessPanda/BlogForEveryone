const fs = require('fs');
const path = require('path');
const electron = require('electron');
const { hydrateWorkspaceRemoteMetadata } = require('../../shared/remoteWorkspaceContract');

const app = electron?.app;
const safeStorage = electron?.safeStorage;

const USER_DATA_DIR = app && typeof app.getPath === 'function'
    ? app.getPath('userData')
    : path.join(process.cwd(), '.tmp-user-data');
const DATA_DIR = path.join(USER_DATA_DIR, 'bfe-data');
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
                autoSyncRssSubscriptions: true,
                launchAtStartup: false
            }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    }
}

function readStore() {
    ensureStore();
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return normalizeStoreState(JSON.parse(raw));
}

function writeStore(nextStore) {
    ensureStore();
    const normalized = normalizeStoreState(nextStore);
    fs.writeFileSync(DB_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
}

function updateStore(mutator) {
    const state = readStore();
    const next = mutator(state) || state;
    const normalized = normalizeStoreState(next);
    writeStore(normalized);
    return normalized;
}

function normalizeStoreState(state) {
    const source = state && typeof state === 'object' ? state : {};
    const workspaces = Array.isArray(source.workspaces) ? source.workspaces : [];

    return {
        ...source,
        workspaces: workspaces.map((workspace) => hydrateWorkspaceRemoteMetadata(workspace))
    };
}

function hasLegacyPlaintextTokenFields(authRecord) {
    if (!authRecord) {
        return false;
    }

    return Boolean(authRecord.accessToken || authRecord.tokenType || authRecord.scope);
}

function createGithubAuthStorage(options = {}) {
    const secureStorage = options.safeStorage;
    const readStoreImpl = options.readStore;
    const updateStoreImpl = options.updateStore;

    function isEncryptionAvailable() {
        return Boolean(
            secureStorage
            && typeof secureStorage.isEncryptionAvailable === 'function'
            && secureStorage.isEncryptionAvailable()
        );
    }

    function saveGithubAuthSession(payload = {}) {
        const accessToken = String(payload.accessToken || '');
        if (!accessToken) {
            throw new Error('缺少 access token，无法保存 GitHub 登录状态。');
        }

        if (!isEncryptionAvailable()) {
            throw new Error('当前系统不支持安全凭据存储，无法安全保存 GitHub 登录，请在支持系统钥匙串后重试。');
        }

        const encrypted = secureStorage.encryptString(JSON.stringify({
            tokenType: payload.tokenType || null,
            accessToken,
            scope: payload.scope || ''
        }));

        updateStoreImpl((state) => {
            state.githubAuth = {
                user: payload.user || null,
                loggedInAt: payload.loggedInAt || new Date().toISOString(),
                permissionSummary: payload.permissionSummary || null,
                reauthRequired: false
            };
            state.githubAuthSecure = {
                version: 1,
                ciphertext: Buffer.from(encrypted).toString('base64'),
                updatedAt: new Date().toISOString()
            };
            return state;
        });
    }

    function scrubLegacyPlaintextFields() {
        updateStoreImpl((state) => {
            if (!state.githubAuth) {
                return state;
            }

            delete state.githubAuth.accessToken;
            delete state.githubAuth.tokenType;
            delete state.githubAuth.scope;
            state.githubAuth.reauthRequired = true;
            return state;
        });
    }

    function readGithubAuthRecord() {
        const state = readStoreImpl();
        const authRecord = state.githubAuth || null;
        if (!authRecord) {
            return null;
        }

        let reauthRequired = Boolean(authRecord.reauthRequired);
        if (hasLegacyPlaintextTokenFields(authRecord)) {
            scrubLegacyPlaintextFields();
            reauthRequired = true;
        }

        const secureRecord = state.githubAuthSecure;
        const hasSecureToken = Boolean(secureRecord && secureRecord.ciphertext);
        if (!hasSecureToken || !isEncryptionAvailable()) {
            reauthRequired = Boolean(authRecord.user) || reauthRequired;
        }

        return {
            user: authRecord.user || null,
            loggedInAt: authRecord.loggedInAt || null,
            permissionSummary: authRecord.permissionSummary || null,
            reauthRequired
        };
    }

    function readGithubAccessToken() {
        const state = readStoreImpl();
        const secureRecord = state.githubAuthSecure;
        if (!secureRecord || !secureRecord.ciphertext) {
            throw new Error('请先完成 GitHub 登录。');
        }

        if (!isEncryptionAvailable()) {
            throw new Error('当前系统不支持安全凭据存储解密，请重新登录。');
        }

        let parsed;
        try {
            const decrypted = secureStorage.decryptString(Buffer.from(secureRecord.ciphertext, 'base64'));
            parsed = JSON.parse(decrypted);
        } catch {
            throw new Error('GitHub 安全凭据已损坏，请重新登录。');
        }

        if (!parsed || !parsed.accessToken) {
            throw new Error('GitHub 登录信息缺失，请重新登录。');
        }

        return parsed.accessToken;
    }

    function clearGithubAuthSession() {
        updateStoreImpl((state) => {
            state.githubAuth = null;
            state.githubAuthSecure = null;
            return state;
        });
    }

    return {
        saveGithubAuthSession,
        readGithubAuthRecord,
        readGithubAccessToken,
        clearGithubAuthSession
    };
}

const githubAuthStorage = createGithubAuthStorage({
    safeStorage,
    readStore,
    updateStore
});

module.exports = {
    readStore,
    writeStore,
    updateStore,
    normalizeStoreState,
    createGithubAuthStorage,
    saveGithubAuthSession: githubAuthStorage.saveGithubAuthSession,
    readGithubAuthRecord: githubAuthStorage.readGithubAuthRecord,
    readGithubAccessToken: githubAuthStorage.readGithubAccessToken,
    clearGithubAuthSession: githubAuthStorage.clearGithubAuthSession,
    DATA_DIR
};
