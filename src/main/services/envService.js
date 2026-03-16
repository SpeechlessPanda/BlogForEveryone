const { spawnSync } = require('child_process');
const { shell } = require('electron');

const MIRROR_REGISTRY = 'https://registry.npmmirror.com';

function runCommand(command, args = [], options = {}) {
    return spawnSync(command, args, {
        shell: true,
        encoding: 'utf-8',
        timeout: 120000,
        ...options
    });
}

function commandExists(command) {
    const result = runCommand(command, ['--version']);
    return result.status === 0;
}

function checkEnvironment() {
    const nodeInstalled = commandExists('node');
    const gitInstalled = commandExists('git');
    const pnpmInstalled = commandExists('pnpm');
    const wingetInstalled = commandExists('winget');

    return {
        nodeInstalled,
        gitInstalled,
        pnpmInstalled,
        wingetInstalled,
        ready: nodeInstalled && gitInstalled && pnpmInstalled
    };
}

function autoInstallToolWithWinget(tool) {
    const env = checkEnvironment();
    if (!env.wingetInstalled) {
        return { ok: false, reason: 'WINGET_MISSING', logs: [] };
    }

    const packageId = tool === 'git' ? 'Git.Git' : tool === 'node' ? 'OpenJS.NodeJS.LTS' : null;
    if (!packageId) {
        return { ok: false, reason: 'UNSUPPORTED_TOOL', logs: [] };
    }

    const logs = [];

    const installArgs = [
        'install',
        '--id',
        packageId,
        '--silent',
        '--accept-package-agreements',
        '--accept-source-agreements'
    ];

    const firstTry = runCommand('winget', installArgs);
    logs.push({ command: `winget ${installArgs.join(' ')}`, status: firstTry.status, stdout: firstTry.stdout, stderr: firstTry.stderr });

    if (firstTry.status === 0) {
        return { ok: true, retried: false, logs };
    }

    const resetSource = runCommand('winget', ['source', 'reset', '--force']);
    logs.push({ command: 'winget source reset --force', status: resetSource.status, stdout: resetSource.stdout, stderr: resetSource.stderr });

    const secondTry = runCommand('winget', installArgs);
    logs.push({ command: `winget ${installArgs.join(' ')} (retry)`, status: secondTry.status, stdout: secondTry.stdout, stderr: secondTry.stderr });

    return {
        ok: secondTry.status === 0,
        retried: true,
        logs
    };
}

function openInstaller(tool) {
    if (tool === 'git') {
        shell.openExternal('https://git-scm.com/download/win');
        return { ok: true, tool, url: 'https://git-scm.com/download/win' };
    }

    if (tool === 'node') {
        shell.openExternal('https://nodejs.org/en/download');
        return { ok: true, tool, url: 'https://nodejs.org/en/download' };
    }

    throw new Error('Unsupported installer target');
}

function ensurePnpm() {
    const env = checkEnvironment();
    if (!env.nodeInstalled) {
        return {
            ok: false,
            reason: 'NODE_MISSING',
            logs: []
        };
    }

    if (env.pnpmInstalled) {
        return {
            ok: true,
            alreadyInstalled: true,
            logs: []
        };
    }

    const logs = [];

    const step1 = runCommand('corepack', ['enable']);
    logs.push({ command: 'corepack enable', status: step1.status, stdout: step1.stdout, stderr: step1.stderr });

    const step2 = runCommand('corepack', ['prepare', 'pnpm@latest', '--activate']);
    logs.push({
        command: 'corepack prepare pnpm@latest --activate',
        status: step2.status,
        stdout: step2.stdout,
        stderr: step2.stderr
    });

    if (step2.status === 0 && commandExists('pnpm')) {
        return { ok: true, alreadyInstalled: false, logs };
    }

    const setMirror = runCommand('npm', ['config', 'set', 'registry', MIRROR_REGISTRY]);
    logs.push({
        command: `npm config set registry ${MIRROR_REGISTRY}`,
        status: setMirror.status,
        stdout: setMirror.stdout,
        stderr: setMirror.stderr
    });

    const fallbackInstall = runCommand('npm', ['install', '-g', 'pnpm']);
    logs.push({ command: 'npm install -g pnpm', status: fallbackInstall.status, stdout: fallbackInstall.stdout, stderr: fallbackInstall.stderr });

    if (fallbackInstall.status === 0 && commandExists('pnpm')) {
        return { ok: true, alreadyInstalled: false, logs, fallback: true };
    }

    return { ok: false, reason: 'PNPM_INSTALL_FAILED', logs };
}

function installDependenciesWithRetry(projectDir) {
    const logs = [];

    const firstTry = runCommand('pnpm', ['install'], { cwd: projectDir });
    logs.push({ command: 'pnpm install', status: firstTry.status, stdout: firstTry.stdout, stderr: firstTry.stderr });

    if (firstTry.status === 0) {
        return { ok: true, retried: false, logs };
    }

    const setMirror = runCommand('pnpm', ['config', 'set', 'registry', MIRROR_REGISTRY], { cwd: projectDir });
    logs.push({
        command: `pnpm config set registry ${MIRROR_REGISTRY}`,
        status: setMirror.status,
        stdout: setMirror.stdout,
        stderr: setMirror.stderr
    });

    const secondTry = runCommand('pnpm', ['install'], { cwd: projectDir });
    logs.push({ command: 'pnpm install (retry)', status: secondTry.status, stdout: secondTry.stdout, stderr: secondTry.stderr });

    return {
        ok: secondTry.status === 0,
        retried: true,
        logs
    };
}

function runPnpmDlxWithRetry(args, options = {}) {
    const logs = [];

    const firstTry = runCommand('pnpm', ['dlx', ...args], options);
    logs.push({ command: `pnpm dlx ${args.join(' ')}`, status: firstTry.status, stdout: firstTry.stdout, stderr: firstTry.stderr });

    if (firstTry.status === 0) {
        return { ok: true, retried: false, result: firstTry, logs };
    }

    const setMirror = runCommand('pnpm', ['config', 'set', 'registry', MIRROR_REGISTRY], options);
    logs.push({
        command: `pnpm config set registry ${MIRROR_REGISTRY}`,
        status: setMirror.status,
        stdout: setMirror.stdout,
        stderr: setMirror.stderr
    });

    const secondTry = runCommand('pnpm', ['dlx', ...args], options);
    logs.push({
        command: `pnpm dlx ${args.join(' ')} (retry)`,
        status: secondTry.status,
        stdout: secondTry.stdout,
        stderr: secondTry.stderr
    });

    return {
        ok: secondTry.status === 0,
        retried: true,
        result: secondTry,
        logs
    };
}

module.exports = {
    checkEnvironment,
    openInstaller,
    autoInstallToolWithWinget,
    ensurePnpm,
    installDependenciesWithRetry,
    runPnpmDlxWithRetry,
    MIRROR_REGISTRY
};
