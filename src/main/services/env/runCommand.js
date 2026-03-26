const { spawnSync } = require('child_process');
const { MIRROR_REGISTRY } = require('./registryPolicy');

function createRunCommandTools(options = {}) {
    const spawnSyncImpl = options.spawnSyncImpl || spawnSync;
    const mirrorRegistry = options.mirrorRegistry || MIRROR_REGISTRY;

    function runCommand(command, args = [], commandOptions = {}) {
        return spawnSyncImpl(command, args, {
            shell: false,
            encoding: 'utf-8',
            timeout: 120000,
            windowsHide: true,
            ...commandOptions
        });
    }

    function commandExists(command) {
        const result = runCommand(command, ['--version']);
        return result.status === 0;
    }

    function runPnpmDlxWithRetry(args, commandOptions = {}) {
        const logs = [];

        const firstTry = runCommand('pnpm', ['dlx', ...args], commandOptions);
        logs.push({ command: `pnpm dlx ${args.join(' ')}`, status: firstTry.status, stdout: firstTry.stdout, stderr: firstTry.stderr });

        if (firstTry.status === 0) {
            return { ok: true, retried: false, result: firstTry, logs };
        }

        logs.push({
            event: 'mirror-fallback',
            message: 'pnpm dlx 首次失败，已切换镜像源后重试。',
            registry: mirrorRegistry
        });

        const secondTry = runCommand('pnpm', ['--registry', mirrorRegistry, 'dlx', ...args], commandOptions);
        logs.push({
            command: `pnpm --registry ${mirrorRegistry} dlx ${args.join(' ')} (retry)`,
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

    return {
        runCommand,
        commandExists,
        runPnpmDlxWithRetry
    };
}

const defaultTools = createRunCommandTools();

module.exports = {
    createRunCommandTools,
    runCommand: defaultTools.runCommand,
    commandExists: defaultTools.commandExists,
    runPnpmDlxWithRetry: defaultTools.runPnpmDlxWithRetry
};
