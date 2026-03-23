const {
    checkEnvironment,
    resolveExecutable,
    resolveHugoExecutable
} = require('./env/detectEnvironment');
const {
    openInstaller,
    autoInstallToolWithWinget,
    ensureFrameworkEnvironment,
    getHugoExecutionEnv,
    ensureDartSass,
    ensurePnpm,
    installDependenciesWithRetry
} = require('./env/installTooling');
const {
    runPnpmDlxWithRetry,
    runCommand,
    commandExists
} = require('./env/runCommand');
const { MIRROR_REGISTRY } = require('./env/registryPolicy');

module.exports = {
    checkEnvironment,
    resolveExecutable,
    resolveHugoExecutable,
    openInstaller,
    autoInstallToolWithWinget,
    ensureFrameworkEnvironment,
    getHugoExecutionEnv,
    ensureDartSass,
    ensurePnpm,
    installDependenciesWithRetry,
    runPnpmDlxWithRetry,
    runCommand,
    commandExists,
    MIRROR_REGISTRY
};
