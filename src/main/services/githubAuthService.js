const { shell } = require('electron');
const { updateStore, readStore } = require('./storeService');

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_API = 'https://api.github.com/user';

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postForm(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(body).toString()
    });

    const json = await response.json();
    if (!response.ok) {
        throw new Error(json.error_description || 'GitHub OAuth request failed');
    }
    return json;
}

async function getJson(url, token) {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'User-Agent': 'BlogForEveryone'
        }
    });

    if (!response.ok) {
        const raw = await response.text();
        throw new Error(`GitHub API error: ${raw}`);
    }

    return response.json();
}

async function startDeviceFlow({ clientId, scope = 'repo read:user user:email' }) {
    if (!clientId) {
        throw new Error('缺少 GitHub OAuth Client ID');
    }

    const result = await postForm(GITHUB_DEVICE_CODE_URL, {
        client_id: clientId,
        scope
    });

    return result;
}

async function pollForAccessToken({ clientId, deviceCode, interval, expiresIn }) {
    const start = Date.now();
    let waitSeconds = interval || 5;

    while (Date.now() - start < (expiresIn || 900) * 1000) {
        await delay(waitSeconds * 1000);

        const result = await postForm(GITHUB_ACCESS_TOKEN_URL, {
            client_id: clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        });

        if (result.access_token) {
            return result;
        }

        if (result.error === 'authorization_pending') {
            continue;
        }

        if (result.error === 'slow_down') {
            waitSeconds += 5;
            continue;
        }

        if (result.error === 'access_denied') {
            throw new Error('用户取消了授权');
        }

        if (result.error === 'expired_token') {
            throw new Error('设备码已过期，请重试登录');
        }

        throw new Error(result.error_description || 'GitHub OAuth 轮询失败');
    }

    throw new Error('设备码登录超时，请重试');
}

async function loginWithDeviceCode({ clientId, scope }) {
    const flow = await startDeviceFlow({ clientId, scope });

    if (flow.verification_uri_complete) {
        shell.openExternal(flow.verification_uri_complete);
    } else if (flow.verification_uri) {
        shell.openExternal(flow.verification_uri);
    }

    const tokenResult = await pollForAccessToken({
        clientId,
        deviceCode: flow.device_code,
        interval: flow.interval,
        expiresIn: flow.expires_in
    });

    const user = await getJson(GITHUB_USER_API, tokenResult.access_token);

    updateStore((state) => {
        state.githubAuth = {
            tokenType: tokenResult.token_type,
            accessToken: tokenResult.access_token,
            scope: tokenResult.scope,
            user: {
                id: user.id,
                login: user.login,
                name: user.name,
                avatarUrl: user.avatar_url,
                htmlUrl: user.html_url
            },
            loggedInAt: new Date().toISOString()
        };
        return state;
    });

    return {
        ok: true,
        user: {
            login: user.login,
            name: user.name,
            avatarUrl: user.avatar_url,
            htmlUrl: user.html_url
        },
        scope: tokenResult.scope
    };
}

function getAuthState() {
    const state = readStore();
    return state.githubAuth || null;
}

function logout() {
    updateStore((state) => {
        state.githubAuth = null;
        return state;
    });
    return { ok: true };
}

module.exports = {
    loginWithDeviceCode,
    getAuthState,
    logout
};
