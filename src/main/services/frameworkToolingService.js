const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { MIRROR_REGISTRY } = require('./envService');

function runCommandAsync(command, args = [], options = {}) {
    return new Promise((resolve) => {
        const timeoutMs = Number(options.timeoutMs || 0);
        const { timeoutMs: _timeoutMs, ...spawnOptions } = options;

        const child = spawn(command, args, {
            shell: true,
            windowsHide: true,
            ...spawnOptions
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr?.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        let timer = null;
        if (timeoutMs > 0) {
            timer = setTimeout(() => {
                child.kill();
                resolve({ status: 1, stdout, stderr: `${stderr}${stderr ? '\n' : ''}timeout after ${timeoutMs}ms` });
            }, timeoutMs);
        }

        child.on('error', (error) => {
            if (timer) {
                clearTimeout(timer);
            }
            resolve({ status: 1, stdout, stderr: `${stderr}${stderr ? '\n' : ''}${String(error.message || error)}` });
        });

        child.on('close', (code) => {
            if (timer) {
                clearTimeout(timer);
            }
            resolve({ status: code ?? 1, stdout, stderr });
        });
    });
}

async function runPnpmWithMirrorRetry(args, options = {}) {
    const logs = [];
    const first = await runCommandAsync('pnpm', args, { timeoutMs: 180000, ...options });
    logs.push({ command: `pnpm ${args.join(' ')}`, status: first.status, stdout: first.stdout, stderr: first.stderr });
    if (first.status === 0) {
        return { ok: true, logs, retried: false };
    }

    logs.push({
        event: 'mirror-fallback',
        message: '依赖安装首次失败，已切换 pnpm 镜像后重试。',
        registry: MIRROR_REGISTRY
    });

    const setMirror = await runCommandAsync('pnpm', ['config', 'set', 'registry', MIRROR_REGISTRY], {
        timeoutMs: 120000,
        ...options
    });
    logs.push({
        command: `pnpm config set registry ${MIRROR_REGISTRY}`,
        status: setMirror.status,
        stdout: setMirror.stdout,
        stderr: setMirror.stderr
    });

    const second = await runCommandAsync('pnpm', args, { timeoutMs: 180000, ...options });
    logs.push({ command: `pnpm ${args.join(' ')} (retry)`, status: second.status, stdout: second.stdout, stderr: second.stderr });

    return { ok: second.status === 0, logs, retried: true };
}

function getFrameworkPackages(framework, _themeId) {
    if (framework === 'hexo') {
        return ['hexo-deployer-git', 'hexo-generator-feed'];
    }
    return [];
}

async function ensureFrameworkPublishPackages(payload) {
    const { projectDir, framework, themeId } = payload || {};
    const logs = [];

    const packageJsonPath = path.join(projectDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        logs.push({ stage: 'publish-tooling', message: '未检测到 package.json，跳过发布依赖安装。' });
        return { ok: true, skipped: true, logs };
    }

    const packages = getFrameworkPackages(framework, themeId);
    if (!packages.length) {
        logs.push({ stage: 'publish-tooling', message: `框架 ${framework} 无额外发布依赖。` });
        return { ok: true, skipped: true, logs };
    }

    const result = await runPnpmWithMirrorRetry(['add', ...packages], { cwd: projectDir });
    logs.push(...result.logs);

    if (!result.ok) {
        return {
            ok: false,
            reason: 'PUBLISH_PACKAGES_INSTALL_FAILED',
            message: `发布依赖安装失败（${framework}）。`,
            logs
        };
    }

    logs.push({ stage: 'publish-tooling', message: `已安装发布依赖：${packages.join(', ')}` });
    return { ok: true, logs };
}

module.exports = {
    ensureFrameworkPublishPackages
};
