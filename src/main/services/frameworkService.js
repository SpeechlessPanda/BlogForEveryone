const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { checkEnvironment } = require('./envService');

function detectFramework(projectDir) {
    const hasHexoConfig = fs.existsSync(path.join(projectDir, '_config.yml'));
    const hasHugoConfig = fs.existsSync(path.join(projectDir, 'hugo.toml')) || fs.existsSync(path.join(projectDir, 'config.toml'));

    if (hasHexoConfig) {
        return 'hexo';
    }
    if (hasHugoConfig) {
        return 'hugo';
    }
    return 'unknown';
}

function runSpawnCommand(command, args, options = {}) {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            shell: true,
            ...options
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr?.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('close', (code) => {
            resolve({ status: code ?? 1, stdout, stderr });
        });

        child.on('error', (error) => {
            resolve({ status: 1, stdout, stderr: `${stderr}\n${error.message}`.trim() });
        });
    });
}

async function runWithMirrorRetry(command, args, options = {}) {
    const first = await runSpawnCommand(command, args, options);
    const logs = [{ command: `${command} ${args.join(' ')}`, status: first.status, stdout: first.stdout, stderr: first.stderr }];

    if (first.status === 0) {
        return { result: first, logs, retried: false };
    }

    await runSpawnCommand('pnpm', ['config', 'set', 'registry', 'https://registry.npmmirror.com'], options);
    const second = await runSpawnCommand(command, args, options);
    logs.push({ command: `${command} ${args.join(' ')} (retry)`, status: second.status, stdout: second.stdout, stderr: second.stderr });

    return { result: second, logs, retried: true };
}

async function initProject({ framework, projectDir }) {
    fs.mkdirSync(projectDir, { recursive: true });

    const env = checkEnvironment();
    if (!env.nodeInstalled || !env.pnpmInstalled) {
        return {
            status: 1,
            stdout: '',
            stderr: '环境未就绪：请先安装 Node.js 与 pnpm。',
            logs: []
        };
    }

    if (framework === 'hexo') {
        const execute = await runWithMirrorRetry('pnpm', ['dlx', 'hexo', 'init', projectDir], {
            cwd: process.cwd()
        });
        return {
            ...execute.result,
            logs: execute.logs,
            retried: execute.retried
        };
    }

    if (framework === 'hugo') {
        const result = await runSpawnCommand('hugo', ['new', 'site', projectDir], {
            cwd: process.cwd()
        });
        return {
            ...result,
            logs: [{ command: `hugo new site ${projectDir}`, status: result.status, stdout: result.stdout, stderr: result.stderr }],
            retried: false
        };
    }

    throw new Error('Unsupported framework');
}

module.exports = {
    detectFramework,
    initProject
};
