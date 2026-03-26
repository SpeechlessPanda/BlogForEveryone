const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const { summarizeScope } = require('./githubAuthService');

test('summarizeScope supports whitespace-delimited scopes', () => {
    const summary = summarizeScope('repo read:user user:email');
    assert.deepEqual(summary, {
        canReadProfile: true,
        canPublishToGithub: true
    });
});

test('summarizeScope supports comma-delimited scopes', () => {
    const summary = summarizeScope('repo,read:user,user:email');
    assert.deepEqual(summary, {
        canReadProfile: true,
        canPublishToGithub: true
    });
});

test('summarizeScope supports mixed delimiters and still detects read-only profile scopes', () => {
    const summary = summarizeScope('read:user, user:email');
    assert.deepEqual(summary, {
        canReadProfile: true,
        canPublishToGithub: false
    });
});

function withImmediateTimers(run) {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    global.setTimeout = (handler) => {
        handler();
        return 1;
    };
    global.clearTimeout = () => {};

    return Promise.resolve()
        .then(run)
        .finally(() => {
            global.setTimeout = originalSetTimeout;
            global.clearTimeout = originalClearTimeout;
        });
}

function loadGithubAuthHarness({ queueByUrl = {}, evaluateDecision = { allowed: true, normalizedUrl: 'https://github.com/login/device' } } = {}) {
    const originalLoad = Module._load;
    const servicePath = require.resolve('./githubAuthService');
    const savedSessions = [];
    const openedUrls = [];
    const authRecord = { user: { login: 'saved-user' } };
    let accessToken = 'saved-token';

    const netMock = {
        request({ url }) {
            const requestListeners = new Map();

            return {
                setHeader() {},
                on(event, handler) {
                    requestListeners.set(event, handler);
                },
                write() {},
                destroy(error) {
                    const onError = requestListeners.get('error');
                    if (onError) {
                        onError(error);
                    }
                },
                end() {
                    const queue = queueByUrl[url] || [];
                    const next = queue.shift();
                    if (!next) {
                        const onError = requestListeners.get('error');
                        if (onError) {
                            onError(new Error(`unexpected request for ${url}`));
                        }
                        return;
                    }

                    if (next.requestError) {
                        const onError = requestListeners.get('error');
                        if (onError) {
                            onError(next.requestError);
                        }
                        return;
                    }

                    const responseListeners = new Map();
                    const response = {
                        statusCode: next.statusCode ?? 200,
                        on(event, handler) {
                            responseListeners.set(event, handler);
                        }
                    };

                    const onResponse = requestListeners.get('response');
                    if (onResponse) {
                        onResponse(response);
                    }

                    if (next.responseError) {
                        const onResponseError = responseListeners.get('error');
                        if (onResponseError) {
                            onResponseError(next.responseError);
                        }
                        return;
                    }

                    const onData = responseListeners.get('data');
                    if (onData) {
                        const chunks = Array.isArray(next.bodyChunks) ? next.bodyChunks : [next.body || ''];
                        chunks.forEach((chunk) => onData(Buffer.from(chunk)));
                    }
                    const onEnd = responseListeners.get('end');
                    if (onEnd) {
                        onEnd();
                    }
                }
            };
        }
    };

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'electron') {
            return {
                shell: {
                    openExternal(url) {
                        openedUrls.push(url);
                    }
                },
                net: netMock
            };
        }
        if (request === './storeService') {
            return {
                saveGithubAuthSession(payload) {
                    savedSessions.push(payload);
                    accessToken = payload.accessToken;
                },
                readGithubAuthRecord() {
                    return authRecord;
                },
                readGithubAccessToken() {
                    return accessToken;
                },
                clearGithubAuthSession() {
                    accessToken = null;
                }
            };
        }
        if (request === '../policies/externalUrlPolicy') {
            return {
                evaluateExternalUrl: () => evaluateDecision,
                EXTERNAL_URL_RULES: { githubDeviceVerification: {} }
            };
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[servicePath];
    const service = require('./githubAuthService');

    return {
        service,
        savedSessions,
        openedUrls,
        cleanup() {
            Module._load = originalLoad;
            delete require.cache[servicePath];
        }
    };
}

test('beginDeviceLogin opens trusted verification URL and returns flow payload', async () => {
    const harness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/device/code': [{
                statusCode: 200,
                body: JSON.stringify({
                    device_code: 'dc-1',
                    user_code: 'uc-1',
                    verification_uri: 'https://github.com/login/device',
                    verification_uri_complete: 'https://github.com/login/device?user_code=uc-1',
                    interval: 1,
                    expires_in: 900
                })
            }]
        },
        evaluateDecision: { allowed: true, normalizedUrl: 'https://github.com/login/device?user_code=uc-1' }
    });

    try {
        const result = await harness.service.beginDeviceLogin({ clientId: 'cid' });
        assert.equal(result.ok, true);
        assert.equal(result.deviceCode, 'dc-1');
        assert.equal(harness.openedUrls[0], 'https://github.com/login/device?user_code=uc-1');
    } finally {
        harness.cleanup();
    }
});

test('beginDeviceLogin blocks untrusted verification URL', async () => {
    const harness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/device/code': [{
                statusCode: 200,
                body: JSON.stringify({ device_code: 'dc-1', user_code: 'uc-1', verification_uri: 'https://github.com/login/device' })
            }]
        },
        evaluateDecision: { allowed: false, normalizedUrl: '' }
    });

    try {
        await assert.rejects(
            () => harness.service.beginDeviceLogin({ clientId: 'cid' }),
            /验证链接不受信任/
        );
    } finally {
        harness.cleanup();
    }
});

test('beginDeviceLogin rejects missing client id', async () => {
    const harness = loadGithubAuthHarness();
    try {
        await assert.rejects(() => harness.service.beginDeviceLogin({ clientId: '' }), /缺少 GitHub OAuth Client ID/);
    } finally {
        harness.cleanup();
    }
});

test('completeDeviceLogin saves session on successful token and user fetch', async () => {
    const harness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/oauth/access_token': [
                { statusCode: 200, body: JSON.stringify({ error: 'authorization_pending' }) },
                { statusCode: 200, body: JSON.stringify({ access_token: 'token-1', token_type: 'bearer', scope: 'repo read:user' }) }
            ],
            'https://api.github.com/user': [{
                statusCode: 200,
                body: JSON.stringify({ id: 101, login: 'alice', name: 'Alice', avatar_url: 'https://img', html_url: 'https://github.com/alice' })
            }]
        }
    });

    try {
        await withImmediateTimers(async () => {
            const result = await harness.service.completeDeviceLogin({
                clientId: 'cid',
                deviceCode: 'dc-1',
                interval: 1,
                expiresIn: 100
            });

            assert.equal(result.ok, true);
            assert.equal(result.user.login, 'alice');
            assert.equal(result.permissionSummary.canPublishToGithub, true);
        });

        assert.equal(harness.savedSessions.length, 1);
        assert.equal(harness.savedSessions[0].accessToken, 'token-1');
    } finally {
        harness.cleanup();
    }
});

test('completeDeviceLogin handles slow_down, network jitter and eventual success', async () => {
    const harness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/oauth/access_token': [
                { requestError: Object.assign(new Error('network reset by peer'), { code: 'ETIMEDOUT' }) },
                { statusCode: 200, body: JSON.stringify({ error: 'slow_down' }) },
                { statusCode: 200, body: JSON.stringify({ access_token: 'token-2', token_type: 'bearer', scope: 'read:user user:email' }) }
            ],
            'https://api.github.com/user': [{
                statusCode: 200,
                body: JSON.stringify({ id: 202, login: 'bob', name: 'Bob', avatar_url: 'https://img2', html_url: 'https://github.com/bob' })
            }]
        }
    });

    try {
        await withImmediateTimers(async () => {
            const result = await harness.service.completeDeviceLogin({
                clientId: 'cid',
                deviceCode: 'dc-2',
                interval: 1,
                expiresIn: 100
            });
            assert.equal(result.ok, true);
            assert.equal(result.permissionSummary.canPublishToGithub, false);
            assert.equal(result.permissionSummary.canReadProfile, true);
        });
    } finally {
        harness.cleanup();
    }
});

test('completeDeviceLogin rejects missing required args', async () => {
    const harness = loadGithubAuthHarness();
    try {
        await assert.rejects(() => harness.service.completeDeviceLogin({ clientId: '', deviceCode: 'dc' }), /缺少完成登录所需参数/);
        await assert.rejects(() => harness.service.completeDeviceLogin({ clientId: 'cid', deviceCode: '' }), /缺少完成登录所需参数/);
    } finally {
        harness.cleanup();
    }
});

test('completeDeviceLogin maps access_denied, expired_token and generic polling errors', async () => {
    const deniedHarness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/oauth/access_token': [
                { statusCode: 200, body: JSON.stringify({ error: 'access_denied' }) }
            ]
        }
    });

    try {
        await withImmediateTimers(async () => {
            await assert.rejects(
                () => deniedHarness.service.completeDeviceLogin({ clientId: 'cid', deviceCode: 'dc-3', interval: 1, expiresIn: 100 }),
                /用户取消了授权/
            );
        });
    } finally {
        deniedHarness.cleanup();
    }

    const expiredHarness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/oauth/access_token': [
                { statusCode: 200, body: JSON.stringify({ error: 'expired_token' }) }
            ]
        }
    });

    try {
        await withImmediateTimers(async () => {
            await assert.rejects(
                () => expiredHarness.service.completeDeviceLogin({ clientId: 'cid', deviceCode: 'dc-4', interval: 1, expiresIn: 100 }),
                /设备码已过期/
            );
        });
    } finally {
        expiredHarness.cleanup();
    }

    const genericHarness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/oauth/access_token': [
                { statusCode: 200, body: JSON.stringify({ error: 'unknown_error', error_description: 'custom oauth failure' }) }
            ]
        }
    });

    try {
        await withImmediateTimers(async () => {
            await assert.rejects(
                () => genericHarness.service.completeDeviceLogin({ clientId: 'cid', deviceCode: 'dc-5', interval: 1, expiresIn: 100 }),
                /custom oauth failure/
            );
        });
    } finally {
        genericHarness.cleanup();
    }
});

test('beginDeviceLogin maps oauth app configuration and client id errors', async () => {
    const flowDisabled = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/device/code': [{
                statusCode: 400,
                body: JSON.stringify({ error_description: 'Device Flow must be explicitly enabled for this App' })
            }]
        }
    });

    try {
        await assert.rejects(
            () => flowDisabled.service.beginDeviceLogin({ clientId: 'cid' }),
            /未启用 Device Flow/
        );
    } finally {
        flowDisabled.cleanup();
    }

    const badClientId = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/device/code': [{
                statusCode: 401,
                body: JSON.stringify({ error_description: 'incorrect_client_credentials' })
            }]
        }
    });

    try {
        await assert.rejects(
            () => badClientId.service.beginDeviceLogin({ clientId: 'cid' }),
            /Client ID 无效/
        );
    } finally {
        badClientId.cleanup();
    }
});

test('beginDeviceLogin supports querystring oauth responses', async () => {
    const harness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/device/code': [{
                statusCode: 200,
                body: 'device_code=dc-qs&user_code=uc-qs&verification_uri=https%3A%2F%2Fgithub.com%2Flogin%2Fdevice'
            }]
        }
    });

    try {
        const result = await harness.service.beginDeviceLogin({ clientId: 'cid' });
        assert.equal(result.deviceCode, 'dc-qs');
        assert.equal(result.userCode, 'uc-qs');
    } finally {
        harness.cleanup();
    }
});

test('completeDeviceLogin fails when github user API returns non-ok', async () => {
    const harness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/oauth/access_token': [
                { statusCode: 200, body: JSON.stringify({ access_token: 'token-9', token_type: 'bearer', scope: 'repo' }) }
            ],
            'https://api.github.com/user': [
                { statusCode: 500, body: 'github failed' }
            ]
        }
    });

    try {
        await withImmediateTimers(async () => {
            await assert.rejects(
                () => harness.service.completeDeviceLogin({ clientId: 'cid', deviceCode: 'dc', interval: 1, expiresIn: 100 }),
                /获取 GitHub 用户信息失败/
            );
        });
    } finally {
        harness.cleanup();
    }
});

test('loginWithDeviceCode orchestrates begin + complete and state helpers work', async () => {
    const harness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/device/code': [{
                statusCode: 200,
                body: JSON.stringify({
                    device_code: 'dc-orch',
                    user_code: 'uc-orch',
                    verification_uri: 'https://github.com/login/device',
                    interval: 1,
                    expires_in: 100
                })
            }],
            'https://github.com/login/oauth/access_token': [
                { statusCode: 200, body: JSON.stringify({ access_token: 'token-orch', token_type: 'bearer', scope: 'repo' }) }
            ],
            'https://api.github.com/user': [{
                statusCode: 200,
                body: JSON.stringify({ id: 1, login: 'orch', name: 'Orchestrated', avatar_url: 'https://img3', html_url: 'https://github.com/orch' })
            }]
        }
    });

    try {
        await withImmediateTimers(async () => {
            const result = await harness.service.loginWithDeviceCode({ clientId: 'cid' });
            assert.equal(result.ok, true);
            assert.equal(result.user.login, 'orch');
        });

        assert.deepEqual(harness.service.getAuthState(), { user: { login: 'saved-user' } });
        assert.equal(harness.service.getAccessTokenForPrivilegedUse(), 'token-orch');
        assert.deepEqual(harness.service.logout(), { ok: true });
        assert.equal(harness.service.getAccessTokenForPrivilegedUse(), null);
    } finally {
        harness.cleanup();
    }
});

test('beginDeviceLogin preserves unknown oauth error text and handles response stream errors', async () => {
    const unknownErrorHarness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/device/code': [{
                statusCode: 400,
                body: JSON.stringify({ error: 'weird_oauth_error' })
            }]
        }
    });

    try {
        await assert.rejects(
            () => unknownErrorHarness.service.beginDeviceLogin({ clientId: 'cid' }),
            /weird_oauth_error/
        );
    } finally {
        unknownErrorHarness.cleanup();
    }

    const responseErrorHarness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/device/code': [{
                statusCode: 200,
                responseError: new Error('response stream error')
            }]
        }
    });

    try {
        await assert.rejects(
            () => responseErrorHarness.service.beginDeviceLogin({ clientId: 'cid' }),
            /response stream error/
        );
    } finally {
        responseErrorHarness.cleanup();
    }
});

test('completeDeviceLogin retries transient user API errors and times out expired polling sessions', async () => {
    const retryUserApiHarness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/oauth/access_token': [
                { statusCode: 200, body: JSON.stringify({ access_token: 'token-retry', token_type: 'bearer', scope: 'repo' }) }
            ],
            'https://api.github.com/user': [
                { requestError: Object.assign(new Error('network unavailable'), { code: 'ECONNRESET' }) },
                { statusCode: 200, body: JSON.stringify({ id: 1, login: 'retry', name: 'Retry', avatar_url: 'a', html_url: 'b' }) }
            ]
        }
    });

    try {
        await withImmediateTimers(async () => {
            const result = await retryUserApiHarness.service.completeDeviceLogin({
                clientId: 'cid',
                deviceCode: 'dc-r',
                interval: 1,
                expiresIn: 100
            });
            assert.equal(result.ok, true);
            assert.equal(result.user.login, 'retry');
        });
    } finally {
        retryUserApiHarness.cleanup();
    }

    const timeoutHarness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/oauth/access_token': [
                { statusCode: 200, body: JSON.stringify({ error: 'authorization_pending' }) },
                { statusCode: 200, body: JSON.stringify({ error: 'authorization_pending' }) }
            ]
        }
    });
    try {
        const originalDateNow = Date.now;
        let tick = 0;
        Date.now = () => {
            tick += 2000;
            return tick;
        };

        try {
            await withImmediateTimers(async () => {
                await assert.rejects(
                    () => timeoutHarness.service.completeDeviceLogin({
                        clientId: 'cid',
                        deviceCode: 'dc-timeout',
                        interval: 1,
                        expiresIn: 1
                    }),
                    /设备码登录超时/
                );
            });
        } finally {
            Date.now = originalDateNow;
        }
    } finally {
        timeoutHarness.cleanup();
    }
});

test('completeDeviceLogin continues polling after wrapped transient oauth failures', async () => {
    const harness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/oauth/access_token': [
                { requestError: Object.assign(new Error('network unstable 1'), { code: 'ETIMEDOUT' }) },
                { requestError: Object.assign(new Error('network unstable 2'), { code: 'ECONNRESET' }) },
                { requestError: Object.assign(new Error('network unstable 3'), { code: 'ENOTFOUND' }) },
                { statusCode: 200, body: JSON.stringify({ access_token: 'token-after-wrap', token_type: 'bearer', scope: 'repo' }) }
            ],
            'https://api.github.com/user': [
                { statusCode: 200, body: JSON.stringify({ id: 77, login: 'wrapped', name: 'Wrapped', avatar_url: 'x', html_url: 'y' }) }
            ]
        }
    });

    try {
        await withImmediateTimers(async () => {
            const result = await harness.service.completeDeviceLogin({
                clientId: 'cid',
                deviceCode: 'dc-wrap',
                interval: 1,
                expiresIn: 100
            });
            assert.equal(result.ok, true);
            assert.equal(result.user.login, 'wrapped');
        });
    } finally {
        harness.cleanup();
    }
});

test('completeDeviceLogin surfaces non-transient oauth polling failures', async () => {
    const harness = loadGithubAuthHarness({
        queueByUrl: {
            'https://github.com/login/oauth/access_token': [
                { requestError: new Error('permission denied by upstream proxy') }
            ]
        }
    });

    try {
        await withImmediateTimers(async () => {
            await assert.rejects(
                () => harness.service.completeDeviceLogin({
                    clientId: 'cid',
                    deviceCode: 'dc-hard-fail',
                    interval: 1,
                    expiresIn: 100
                }),
                /GitHub OAuth 请求失败：permission denied by upstream proxy/
            );
        });
    } finally {
        harness.cleanup();
    }
});
