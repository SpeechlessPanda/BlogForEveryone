const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const { REMOTE_SITE_TYPES } = require('../../shared/remoteWorkspaceContract');
const { RESULT_CODES, RESULT_CATEGORIES } = require('../../shared/operationResultContract');

function loadGithubRepoService({
    accessToken = 'token-123',
    fetchImpl,
    spawnSyncImpl
} = {}) {
    const originalLoad = Module._load;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === './githubAuthService') {
            return {
                getAccessTokenForPrivilegedUse() {
                    return accessToken;
                }
            };
        }

        if (request === 'child_process') {
            return {
                spawnSync: spawnSyncImpl || (() => ({ status: 0, stdout: '', stderr: '' }))
            };
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    const originalFetch = global.fetch;
    global.fetch = fetchImpl;

    delete require.cache[require.resolve('./githubRepoService')];
    const service = require('./githubRepoService');

    return {
        service,
        restore() {
            Module._load = originalLoad;
            global.fetch = originalFetch;
        }
    };
}

function createJsonResponse({ ok = true, status = 200, body = {} } = {}) {
    return {
        ok,
        status,
        async text() {
            return JSON.stringify(body);
        }
    };
}

function createTextResponse({ ok = true, status = 200, text = '' } = {}) {
    return {
        ok,
        status,
        async text() {
            return text;
        }
    };
}

test('listUserRepositories returns selectable repositories for authenticated user', async (t) => {
    const fetchCalls = [];
    const harness = loadGithubRepoService({
        fetchImpl: async (url, options = {}) => {
            fetchCalls.push({ url, options });
            assert.match(url, /https:\/\/api\.github\.com\/user\/repos/);
            return createJsonResponse({
                body: [
                    {
                        name: 'alice.github.io',
                        private: false,
                        clone_url: 'https://github.com/alice/alice.github.io.git',
                        owner: { login: 'alice' }
                    },
                    {
                        name: 'project-backup',
                        private: true,
                        clone_url: 'https://github.com/alice/project-backup.git',
                        owner: { login: 'alice' }
                    }
                ]
            });
        }
    });
    t.after(() => harness.restore());

    const result = await harness.service.listUserRepositories();
    assert.equal(fetchCalls.length, 1);
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], {
        owner: 'alice',
        name: 'alice.github.io',
        url: 'https://github.com/alice/alice.github.io.git',
        visibility: 'public'
    });
});

test('requestGithub falls back to raw response text when GitHub returns non-JSON body', async (t) => {
    const harness = loadGithubRepoService({
        fetchImpl: async () => createTextResponse({
            ok: false,
            status: 502,
            text: 'upstream gateway exploded'
        })
    });
    t.after(() => harness.restore());

    await assert.rejects(
        harness.service.listUserRepositories(),
        (error) => {
            assert.match(error.message, /upstream gateway exploded/);
            assert.deepEqual(error.responseBody, { message: 'upstream gateway exploded' });
            assert.equal(error.status, 502);
            return true;
        }
    );
});

test('ensureRemoteRepositories optionally creates deploy and backup repos with one-cause failure mapping', async (t) => {
    const createCalls = [];
    const harness = loadGithubRepoService({
        fetchImpl: async (url, options = {}) => {
            if (url.includes('/user/repos') && options.method === 'POST') {
                const requestBody = JSON.parse(options.body);
                createCalls.push(requestBody.name);
                if (requestBody.name === 'project-backup') {
                    return createJsonResponse({
                        ok: false,
                        status: 422,
                        body: { message: 'Repository creation failed' }
                    });
                }
                return createJsonResponse({
                    status: 201,
                    body: {
                        name: requestBody.name,
                        clone_url: `https://github.com/alice/${requestBody.name}.git`,
                        owner: { login: 'alice' },
                        private: requestBody.private
                    }
                });
            }

            return createJsonResponse({
                body: { login: 'alice' }
            });
        }
    });
    t.after(() => harness.restore());

    await assert.rejects(
        harness.service.ensureRemoteRepositories({
            login: 'alice',
            siteType: REMOTE_SITE_TYPES.userPages,
            deployRepoName: '',
            backupRepoName: 'project-backup',
            createDeployRepo: true,
            createBackupRepo: true
        }),
        (error) => {
            assert.equal(error.operationResult.code, RESULT_CODES.conflict);
            assert.equal(error.operationResult.category, RESULT_CATEGORIES.conflict);
            assert.equal(error.operationResult.causes.length, 1);
            assert.equal(error.operationResult.causes[0].key, 'backup_repo_create_failed');
            return true;
        }
    );

    assert.deepEqual(createCalls, ['alice.github.io', 'project-backup']);
});

test('ensureRemoteRepositories maps deploy creation failure when both create flags are true', async (t) => {
    const createCalls = [];
    const harness = loadGithubRepoService({
        fetchImpl: async (url, options = {}) => {
            if (url.includes('/user/repos') && options.method === 'POST') {
                const requestBody = JSON.parse(options.body);
                createCalls.push(requestBody.name);
                if (requestBody.name === 'alice.github.io') {
                    return createJsonResponse({
                        ok: false,
                        status: 422,
                        body: { message: 'Repository already exists' }
                    });
                }

                return createJsonResponse({
                    status: 201,
                    body: {
                        name: requestBody.name,
                        clone_url: `https://github.com/alice/${requestBody.name}.git`,
                        owner: { login: 'alice' },
                        private: requestBody.private
                    }
                });
            }

            return createJsonResponse({
                body: { login: 'alice' }
            });
        }
    });
    t.after(() => harness.restore());

    await assert.rejects(
        harness.service.ensureRemoteRepositories({
            login: 'alice',
            siteType: REMOTE_SITE_TYPES.userPages,
            deployRepoName: '',
            createDeployRepo: true,
            createBackupRepo: true
        }),
        (error) => {
            assert.equal(error.operationResult.code, RESULT_CODES.conflict);
            assert.equal(error.operationResult.category, RESULT_CATEGORIES.conflict);
            assert.equal(error.operationResult.causes.length, 1);
            assert.equal(error.operationResult.causes[0].key, 'deploy_repo_create_failed');
            return true;
        }
    );

    assert.deepEqual(createCalls, ['alice.github.io']);
});

test('cloneRepositoryToDestination uses transient auth for GitHub clone without leaking token', () => {
    const spawnCalls = [];
    const harness = loadGithubRepoService({
        spawnSyncImpl(command, args, options) {
            spawnCalls.push({ command, args, options });
            return { status: 0, stdout: 'ok', stderr: '' };
        },
        fetchImpl: async () => createJsonResponse({ body: {} })
    });

    try {
        const result = harness.service.cloneRepositoryToDestination({
            repoUrl: 'https://github.com/alice/BFE.git',
            destinationPath: 'D:/tmp/restore-target'
        });

        assert.equal(result.ok, true);
        assert.equal(spawnCalls.length, 1);
        const [call] = spawnCalls;
        assert.deepEqual(call.args, ['clone', 'https://github.com/alice/BFE.git', 'D:/tmp/restore-target']);
        assert.equal(typeof call.options.env.GIT_CONFIG_COUNT, 'string');
        assert.match(call.options.env.GIT_CONFIG_KEY_0, /^http\..*\.extraheader$/);
        assert.match(call.options.env.GIT_CONFIG_VALUE_0, /^AUTHORIZATION: basic\s+/i);
        assert.equal(call.options.env.GIT_CONFIG_VALUE_0.includes('token-123'), false);
        assert.equal(JSON.stringify(result.logs).includes('token-123'), false);
        assert.equal(result.logs[0].command.includes('token-123'), false);
    } finally {
        harness.restore();
    }
});

test('cloneRepositoryToDestination preserves structured failure behavior when git clone fails', () => {
    const harness = loadGithubRepoService({
        spawnSyncImpl() {
            return { status: 128, stdout: '', stderr: 'fatal: could not read Username' };
        },
        fetchImpl: async () => createJsonResponse({ body: {} })
    });

    try {
        assert.throws(
            () => harness.service.cloneRepositoryToDestination({
                repoUrl: 'https://github.com/alice/BFE.git',
                destinationPath: 'D:/tmp/restore-target'
            }),
            (error) => {
                assert.equal(error.operationResult?.code, RESULT_CODES.runtimeError);
                assert.equal(error.operationResult?.category, RESULT_CATEGORIES.runtime);
                assert.equal(error.operationResult?.causes?.[0]?.key, 'github_clone_failed');
                return true;
            }
        );
    } finally {
        harness.restore();
    }
});
