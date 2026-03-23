const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

function loadFrameworkServiceWithMocks(envServiceMock) {
    const originalLoad = Module._load;
    const servicePath = path.join(__dirname, 'frameworkService.js');
    const mocks = {
        './envService': envServiceMock
    };

    Module._load = function patchedLoad(request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(mocks, request)) {
            return mocks[request];
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[servicePath];
    const loaded = require('./frameworkService');
    Module._load = originalLoad;
    return loaded;
}

test('initProject recovers hexo partial init when retry hits non-empty directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-service-'));
    const projectDir = path.join(tmpDir, 'hexo-site');
    fs.mkdirSync(path.join(projectDir, 'scaffolds'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'source'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, '_config.yml'), 'title: test\n', 'utf8');
    fs.writeFileSync(path.join(projectDir, 'package.json'), '{"name":"hexo-site"}', 'utf8');

    let installCalledWith = null;
    const { initProject } = loadFrameworkServiceWithMocks({
        ensureFrameworkEnvironment: () => ({ ok: true, logs: [{ step: 'ensure-pnpm', ok: true }] }),
        runPnpmDlxWithRetry: () => ({
            retried: true,
            result: {
                status: 1,
                stdout: 'INFO  Start blogging with Hexo!\n',
                stderr: 'FATAL target not empty\nError: target not empty'
            },
            logs: [{ command: 'pnpm dlx hexo init ...', status: 1 }]
        }),
        installDependenciesWithRetry: (dir) => {
            installCalledWith = dir;
            return { ok: true, logs: [{ command: 'pnpm install', status: 0 }] };
        },
        resolveExecutable: () => 'hugo'
    });

    const result = await initProject({ framework: 'hexo', projectDir });

    assert.equal(installCalledWith, projectDir);
    assert.equal(result.status, 0);
    assert.equal(result.recoveredFromPartialInit, true);
    assert.equal(result.retried, true);
    assert.match(result.stderr, /target not empty/i);
    assert.ok(result.logs.some((entry) => entry.event === 'hexo-init-recovery' && entry.ok === true));

    fs.rmSync(tmpDir, { recursive: true, force: true });
});
