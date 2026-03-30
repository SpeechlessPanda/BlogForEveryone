const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ensureFrameworkEnvironment, runPnpmDlxWithRetry, resolveExecutable, installDependenciesWithRetry } = require('./envService');

function detectFramework(projectDir) {
    const hasHexoConfig = fs.existsSync(path.join(projectDir, '_config.yml'));
    const hasHugoConfig = ['hugo.toml', 'config.toml', 'config.yaml', 'config.yml', 'config.json']
        .some((fileName) => fs.existsSync(path.join(projectDir, fileName)));

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
            shell: false,
            windowsHide: true,
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

function hasHexoProjectScaffold(projectDir) {
    return fs.existsSync(path.join(projectDir, '_config.yml'))
        && fs.existsSync(path.join(projectDir, 'package.json'))
        && fs.existsSync(path.join(projectDir, 'scaffolds'))
        && fs.existsSync(path.join(projectDir, 'source'));
}

function shouldRecoverHexoInit(execute, projectDir) {
    const stderr = execute?.result?.stderr || '';
    return Boolean(
        execute?.retried
        && execute?.result?.status !== 0
        && /not empty|target not empty/i.test(stderr)
        && hasHexoProjectScaffold(projectDir)
    );
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
        const execute = await runPnpmDlxWithRetry(['hexo', 'init', projectDir], {
            cwd: process.cwd()
        });

        if (shouldRecoverHexoInit(execute, projectDir)) {
            const installResult = installDependenciesWithRetry(projectDir);
            const recovered = Boolean(installResult?.ok);
            return {
                status: recovered ? 0 : 1,
                stdout: execute.result.stdout,
                stderr: execute.result.stderr,
                logs: [
                    ...(envReady.logs || []),
                    ...(execute.logs || []),
                    {
                        event: 'hexo-init-recovery',
                        ok: recovered,
                        message: recovered
                            ? 'Hexo 初始化首次已写入项目结构，重试命中非空目录，已改为依赖安装恢复。'
                            : 'Hexo 初始化进入恢复路径，但依赖安装失败。'
                    },
                    ...(installResult?.logs || [])
                ],
                retried: execute.retried,
                recoveredFromPartialInit: recovered
            };
        }

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
