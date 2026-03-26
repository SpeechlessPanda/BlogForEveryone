const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const publishService = require('./publishService');

test('Hugo workflow uses inferred project-pages base URL', () => {
    const workflow = publishService.__test__.buildWorkflowContent({
        framework: 'hugo',
        repoUrl: 'https://github.com/ming/my-blog.git'
    });

    assert.match(workflow, /run: hugo --baseURL https:\/\/ming\.github\.io\/my-blog\//);
});

test('Hexo workflow command remains unchanged', () => {
    const workflow = publishService.__test__.buildWorkflowContent({
        framework: 'hexo',
        repoUrl: 'https://github.com/ming/ming.github.io.git'
    });

    assert.match(workflow, /run: pnpm dlx hexo generate/);
});

test('Hexo publish path routes commands through safe runCommand contract', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-service-'));
    fs.writeFileSync(path.join(projectDir, '_config.yml'), '', 'utf-8');

    const publishServicePath = require.resolve('./publishService');
    const runCommandPath = require.resolve('./env/runCommand');
    const childProcessPath = require.resolve('child_process');

    const originalPublishServiceCache = require.cache[publishServicePath];
    const originalRunCommandCache = require.cache[runCommandPath];
    const originalSpawnSync = require('child_process').spawnSync;

    const safeRunnerCalls = [];
    let unsafeSpawnSyncCalled = false;

    require.cache[runCommandPath] = {
        ...originalRunCommandCache,
        exports: {
            runCommand(command, args, options) {
                safeRunnerCalls.push({ command, args, options });
                return { status: 0, stdout: '', stderr: '' };
            }
        }
    };

    require('child_process').spawnSync = function patchedSpawnSync() {
        unsafeSpawnSyncCalled = true;
        return { status: 0, stdout: '', stderr: '' };
    };

    delete require.cache[publishServicePath];
    const isolatedPublishService = require('./publishService');

    try {
        isolatedPublishService.publishToGitHub({
            projectDir,
            framework: 'hexo',
            repoUrl: 'https://github.com/ming/ming.github.io.git',
            publishMode: 'hexo-deploy'
        });

        assert.equal(unsafeSpawnSyncCalled, false);
        assert.deepEqual(
            safeRunnerCalls.map(({ command, args }) => `${command} ${args.join(' ')}`),
            [
                'pnpm add hexo-deployer-git',
                'pnpm exec hexo clean',
                'pnpm exec hexo generate',
                'pnpm exec hexo deploy'
            ]
        );
        assert.ok(safeRunnerCalls.every(({ options }) => options && options.cwd === projectDir));
    } finally {
        require('child_process').spawnSync = originalSpawnSync;

        if (originalRunCommandCache) {
            require.cache[runCommandPath] = originalRunCommandCache;
        } else {
            delete require.cache[runCommandPath];
        }

        if (originalPublishServiceCache) {
            require.cache[publishServicePath] = originalPublishServiceCache;
        } else {
            delete require.cache[publishServicePath];
        }
    }
});
