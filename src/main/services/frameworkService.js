const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runPnpmDlxWithRetry, checkEnvironment } = require('./envService');

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

function initProject({ framework, projectDir }) {
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
        const execute = runPnpmDlxWithRetry(['hexo', 'init', projectDir], {
            shell: true,
            encoding: 'utf-8'
        });
        return {
            ...execute.result,
            logs: execute.logs,
            retried: execute.retried
        };
    }

    if (framework === 'hugo') {
        return spawnSync('hugo', ['new', 'site', projectDir], {
            shell: true,
            encoding: 'utf-8'
        });
    }

    throw new Error('Unsupported framework');
}

module.exports = {
    detectFramework,
    initProject
};
