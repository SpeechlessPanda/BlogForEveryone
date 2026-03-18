const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ensureFrameworkEnvironment, runPnpmDlxWithRetry, resolveExecutable } = require('./envService');

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

async function initProject({ framework, projectDir }) {
    fs.mkdirSync(projectDir, { recursive: true });

    const envReady = ensureFrameworkEnvironment(framework);
    if (!envReady.ok) {
        return {
            status: 1,
            stdout: '',
            stderr: envReady.message,
            logs: envReady.logs || []
        };
    }

    if (framework === 'hexo') {
        const execute = runPnpmDlxWithRetry(['hexo', 'init', projectDir], {
            cwd: process.cwd()
        });
        return {
            status: execute.result.status,
            stdout: execute.result.stdout,
            stderr: execute.result.stderr,
            logs: [...(envReady.logs || []), ...(execute.logs || [])],
            retried: execute.retried
        };
    }

    if (framework === 'hugo') {
        const hugoBin = resolveExecutable('hugo');
        if (!hugoBin) {
            return {
                status: 1,
                stdout: '',
                stderr: 'Hugo 未找到，请先安装 Hugo 后重试。',
                logs: envReady.logs || []
            };
        }

        const result = await runSpawnCommand(hugoBin, ['new', 'site', projectDir], {
            cwd: process.cwd()
        });
        return {
            ...result,
            logs: [
                ...(envReady.logs || []),
                { command: `${hugoBin} new site ${projectDir}`, status: result.status, stdout: result.stdout, stderr: result.stderr }
            ],
            retried: false
        };
    }

    throw new Error('Unsupported framework');
}

module.exports = {
    detectFramework,
    initProject
};
