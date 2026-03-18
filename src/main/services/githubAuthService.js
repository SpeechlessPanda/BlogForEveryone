const { shell, net } = require('electron');
const { updateStore, readStore } = require('./storeService');

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_API = 'https://api.github.com/user';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeGithubOAuthErrorMessage(message) {
    const text = String(message || '');
    if (text.includes('Device Flow must be explicitly enabled for this App')) {
        return '当前 GitHub OAuth App 未启用 Device Flow，请在 OAuth App 设置里勾选 Enable Device Flow 后重试。';
    }

    if (text.includes('incorrect_client_credentials')) {
        return 'Client ID 无效，请确认复制的是 GitHub OAuth App 的 Client ID（不是 Client Secret）。';
    }

    return text;
}

function requestWithElectronNet({ url, method = 'GET', headers = {}, body = null, timeoutMs = REQUEST_TIMEOUT_MS }) {
    return new Promise((resolve, reject) => {
        const req = net.request({
            method,
            url
        });

        Object.entries(headers || {}).forEach(([key, value]) => {
            req.setHeader(key, value);
        });

        const timeout = setTimeout(() => {
            req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        req.on('response', (response) => {
            const chunks = [];

            response.on('data', (chunk) => {
                chunks.push(Buffer.from(chunk));
            });

            response.on('end', () => {
                clearTimeout(timeout);
                const raw = Buffer.concat(chunks).toString('utf-8');
                resolve({
                    ok: response.statusCode >= 200 && response.statusCode < 300,
                    status: response.statusCode,
                    body: raw
                });
            });

            response.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });

        req.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function postForm(url, body) {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            const response = await requestWithElectronNet({
                url,
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'BlogForEveryone'
                },
                body: new URLSearchParams(body).toString(),
                timeoutMs: REQUEST_TIMEOUT_MS
            });

            const raw = response.body;
            let payload;
            try {
                payload = JSON.parse(raw);
            } catch {
                const qs = new URLSearchParams(raw);
                payload = Object.fromEntries(qs.entries());
            }

            if (!response.ok) {
                const detail = payload.error_description || payload.error || 'GitHub OAuth request failed';
                throw new Error(normalizeGithubOAuthErrorMessage(detail));
            }

            return payload;
        } catch (error) {
            lastError = error;
            if (!isTransientNetworkError(error) || attempt === MAX_RETRIES) {
                break;
            }
            await delay(1000 * attempt);
        }
    }

    throw new Error(`GitHub OAuth 请求失败：${lastError?.message || 'unknown error'}`);
}

async function getJson(url, token) {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            const response = await requestWithElectronNet({
                url,
                method: 'GET',
                headers: {
                    Accept: 'application/vnd.github+json',
                    Authorization: `Bearer ${token}`,
                    'User-Agent': 'BlogForEveryone'
                },
                timeoutMs: REQUEST_TIMEOUT_MS
            });

            if (!response.ok) {
                const raw = response.body;
                throw new Error(`GitHub API error: ${raw}`);
            }

            return JSON.parse(response.body);
        } catch (error) {
            lastError = error;
            if (!isTransientNetworkError(error) || attempt === MAX_RETRIES) {
                break;
            }
            await delay(1000 * attempt);
        }
    }

    throw new Error(`获取 GitHub 用户信息失败：${lastError?.message || 'unknown error'}`);
}

function isTransientNetworkError(error) {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return (
        message.includes('fetch failed') ||
        message.includes('request timeout') ||
        message.includes('timed out') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('etimedout') ||
        message.includes('enotfound') ||
        message.includes('err_name_not_resolved') ||
        message.includes('err_internet_disconnected') ||
        message.includes('err_proxy_connection_failed') ||
        message.includes('err_tunnel_connection_failed') ||
        message.includes('socket') ||
        message.includes('network') ||
        message.includes('tls') ||
        code.includes('err_')
    );
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

        let result;
        try {
            result = await postForm(GITHUB_ACCESS_TOKEN_URL, {
                client_id: clientId,
                device_code: deviceCode,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            });
        } catch (error) {
            if (isTransientNetworkError(error)) {
                // Network jitter should not terminate the device flow; continue polling.
                continue;
            }
            throw error;
        }

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

async function finalizeLogin({ clientId, flow }) {
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

async function beginDeviceLogin({ clientId, scope }) {
    const flow = await startDeviceFlow({ clientId, scope });

    if (flow.verification_uri_complete) {
        shell.openExternal(flow.verification_uri_complete);
    } else if (flow.verification_uri) {
        shell.openExternal(flow.verification_uri);
    }

    return {
        ok: true,
        deviceCode: flow.device_code,
        userCode: flow.user_code,
        verificationUri: flow.verification_uri,
        verificationUriComplete: flow.verification_uri_complete,
        interval: flow.interval,
        expiresIn: flow.expires_in
    };
}

async function completeDeviceLogin({ clientId, deviceCode, interval, expiresIn }) {
    if (!clientId || !deviceCode) {
        throw new Error('缺少完成登录所需参数');
    }

    return finalizeLogin({
        clientId,
        flow: {
            device_code: deviceCode,
            interval,
            expires_in: expiresIn
        }
    });
}

async function loginWithDeviceCode({ clientId, scope }) {
    const begin = await beginDeviceLogin({ clientId, scope });
    return completeDeviceLogin({
        clientId,
        deviceCode: begin.deviceCode,
        interval: begin.interval,
        expiresIn: begin.expiresIn
    });
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
    beginDeviceLogin,
    completeDeviceLogin,
    loginWithDeviceCode,
    getAuthState,
    logout
};
