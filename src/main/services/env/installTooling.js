const { shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { evaluateExternalUrl, EXTERNAL_URL_RULES } = require('../../policies/externalUrlPolicy');
const { MIRROR_REGISTRY, getWingetPackageIds } = require('./registryPolicy');
const { runCommand } = require('./runCommand');
const { checkEnvironment, resolveExecutable, resolveHugoExecutable } = require('./detectEnvironment');

function createInstallToolingService(options = {}) {
    const checkEnvironmentImpl = options.checkEnvironmentImpl || checkEnvironment;
    const resolveExecutableImpl = options.resolveExecutableImpl || resolveExecutable;
    const resolveHugoExecutableImpl = options.resolveHugoExecutableImpl || resolveHugoExecutable;
    const runCommandImpl = options.runCommandImpl || runCommand;
    const evaluateExternalUrlImpl = options.evaluateExternalUrlImpl || evaluateExternalUrl;
    const externalUrlRules = options.externalUrlRules || EXTERNAL_URL_RULES;
    const shellImpl = options.shellImpl || shell;
    const fsImpl = options.fsImpl || fs;
    const pathImpl = options.pathImpl || path;
    const processImpl = options.processImpl || process;
    const mirrorRegistry = options.mirrorRegistry || MIRROR_REGISTRY;

    function autoInstallToolWithWinget(tool) {
        const env = checkEnvironmentImpl();
        if (!env.wingetInstalled) {
            return { ok: false, reason: 'WINGET_MISSING', logs: [] };
        }

        const packageIds = getWingetPackageIds(tool);
        if (!packageIds) {
            return { ok: false, reason: 'UNSUPPORTED_TOOL', logs: [] };
        }

        const logs = [];

        for (const packageId of packageIds) {
            const installArgs = [
                'install',
                '--id',
                packageId,
                '--source',
                'winget',
                '--silent',
                '--accept-package-agreements',
                '--accept-source-agreements'
            ];

            const firstTry = runCommandImpl('winget', installArgs);
            logs.push({ command: `winget ${installArgs.join(' ')}`, status: firstTry.status, stdout: firstTry.stdout, stderr: firstTry.stderr });

            if (firstTry.status === 0) {
                return { ok: true, retried: false, packageId, logs };
            }

            const updateSource = runCommandImpl('winget', ['source', 'update', 'winget']);
            logs.push({ command: 'winget source update winget', status: updateSource.status, stdout: updateSource.stdout, stderr: updateSource.stderr });

            const secondTry = runCommandImpl('winget', installArgs);
            logs.push({ command: `winget ${installArgs.join(' ')} (retry)`, status: secondTry.status, stdout: secondTry.stdout, stderr: secondTry.stderr });

            if (secondTry.status === 0) {
                return { ok: true, retried: true, packageId, logs };
            }
        }

        return {
            ok: false,
            retried: true,
            logs
        };
    }

    function openInstaller(tool) {
        const installerUrl =
            tool === 'git'
                ? 'https://git-scm.com/download/win'
                : tool === 'node'
                    ? 'https://nodejs.org/en/download'
                    : '';

        if (!installerUrl) {
            throw new Error('Unsupported installer target');
        }

        const decision = evaluateExternalUrlImpl(installerUrl, externalUrlRules.installer);
        if (!decision.allowed) {
            throw new Error('Installer URL blocked by trust policy');
        }

        shellImpl.openExternal(decision.normalizedUrl);
        return { ok: true, tool, url: decision.normalizedUrl };
    }

    function ensurePnpm() {
        const env = checkEnvironmentImpl();
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

        const step1 = runCommandImpl('corepack', ['enable'], { timeout: 45000 });
        logs.push({ command: 'corepack enable', status: step1.status, stdout: step1.stdout, stderr: step1.stderr });

        const step2 = runCommandImpl('corepack', ['prepare', 'pnpm@latest', '--activate'], { timeout: 90000 });
        logs.push({
            command: 'corepack prepare pnpm@latest --activate',
            status: step2.status,
            stdout: step2.stdout,
            stderr: step2.stderr
        });

        if (step2.status === 0 && resolveExecutableImpl('pnpm')) {
            return { ok: true, alreadyInstalled: false, logs };
        }

        logs.push({
            event: 'mirror-fallback',
            message: 'corepack 安装 pnpm 失败，已切换 npm 镜像源后重试。',
            registry: mirrorRegistry
        });

        const setMirror = runCommandImpl('npm', ['config', 'set', 'registry', mirrorRegistry]);
        logs.push({
            command: `npm config set registry ${mirrorRegistry}`,
            status: setMirror.status,
            stdout: setMirror.stdout,
            stderr: setMirror.stderr
        });

        const fallbackInstall = runCommandImpl('npm', ['install', '-g', 'pnpm'], { timeout: 180000 });
        logs.push({ command: 'npm install -g pnpm', status: fallbackInstall.status, stdout: fallbackInstall.stdout, stderr: fallbackInstall.stderr });

        if (fallbackInstall.status === 0 && resolveExecutableImpl('pnpm')) {
            return { ok: true, alreadyInstalled: false, logs, fallback: true };
        }

        return { ok: false, reason: 'PNPM_INSTALL_FAILED', logs };
    }

    const ensurePnpmImpl = options.ensurePnpmImpl || ensurePnpm;

    function ensureDartSass() {
        const logs = [];
        const pnpmExecutable = resolveExecutableImpl('pnpm') || 'pnpm';

        if (resolveExecutableImpl('sass')) {
            return {
                ok: true,
                alreadyInstalled: true,
                logs
            };
        }

        const pnpmResult = ensurePnpmImpl();
        logs.push({ step: 'ensure-pnpm', ...pnpmResult });
        if (!pnpmResult.ok) {
            return {
                ok: false,
                reason: pnpmResult.reason || 'PNPM_INSTALL_FAILED',
                logs
            };
        }

        const installResult = runCommandImpl(pnpmExecutable, ['add', '-g', 'sass'], { timeout: 180000 });
        logs.push({
            command: 'pnpm add -g sass',
            status: installResult.status,
            stdout: installResult.stdout,
            stderr: installResult.stderr
        });

        if (installResult.status === 0 && (resolveExecutableImpl('sass') || (processImpl.platform === 'win32' && findSassRunner()))) {
            return {
                ok: true,
                alreadyInstalled: false,
                logs
            };
        }

        return {
            ok: false,
            reason: 'SASS_INSTALL_FAILED',
            logs
        };
    }

    const ensureDartSassImpl = options.ensureDartSassImpl || ensureDartSass;

    function findSassRunner() {
        const candidates = [
            processImpl.env.APPDATA ? pathImpl.join(processImpl.env.APPDATA, 'npm', 'node_modules', 'sass-embedded-win32-x64', 'dart-sass', 'sass.bat') : '',
            processImpl.env.USERPROFILE ? pathImpl.join(processImpl.env.USERPROFILE, 'AppData', 'Roaming', 'npm', 'node_modules', 'sass-embedded-win32-x64', 'dart-sass', 'sass.bat') : '',
            processImpl.env.APPDATA ? pathImpl.join(processImpl.env.APPDATA, 'npm', 'sass.cmd') : ''
        ].filter(Boolean);

        return candidates.find((item) => fsImpl.existsSync(item)) || '';
    }

    function ensureHugoSassShim() {
        const logs = [];

        if (processImpl.platform !== 'win32') {
            const sassExecutable = resolveExecutableImpl('sass');
            if (!sassExecutable) {
                return {
                    ok: false,
                    reason: 'SASS_SHIM_PREPARE_FAILED',
                    logs
                };
            }

            logs.push({ stage: 'sass-shim', mode: 'direct', executable: sassExecutable });
            return {
                ok: true,
                binDir: '',
                logs
            };
        }

        const sassRunner = findSassRunner();

        if (!sassRunner) {
            return {
                ok: false,
                reason: 'SASS_SHIM_PREPARE_FAILED',
                logs
            };
        }

        const shimDir = pathImpl.join(processImpl.env.LOCALAPPDATA || processImpl.cwd(), 'BlogForEveryone', 'bin');
        fsImpl.mkdirSync(shimDir, { recursive: true });

        const cmdShimPath = pathImpl.join(shimDir, 'sass.cmd');
        const batShimPath = pathImpl.join(shimDir, 'sass.bat');
        const shimContent = `@echo off\r\ncall "${sassRunner}" %*\r\n`;
        fsImpl.writeFileSync(cmdShimPath, shimContent, 'utf-8');
        fsImpl.writeFileSync(batShimPath, shimContent, 'utf-8');
        logs.push({ stage: 'sass-shim', path: cmdShimPath, runner: sassRunner });

        return {
            ok: true,
            binDir: shimDir,
            logs
        };
    }

    function getHugoExecutionEnv() {
        const shim = ensureHugoSassShim();
        if (!shim.ok) {
            return {
                ok: false,
                reason: shim.reason,
                env: { ...processImpl.env },
                logs: shim.logs || []
            };
        }

        if (!shim.binDir) {
            return {
                ok: true,
                env: { ...processImpl.env },
                logs: shim.logs || []
            };
        }

        const currentPath = processImpl.env.PATH || '';
        return {
            ok: true,
            env: {
                ...processImpl.env,
                PATH: `${shim.binDir}${pathImpl.delimiter}${currentPath}`
            },
            logs: shim.logs || []
        };
    }

    function ensureFrameworkEnvironment(framework) {
        const logs = [];
        const env = checkEnvironmentImpl();

        if (framework === 'hexo') {
            if (!env.nodeInstalled) {
                const nodeInstall = autoInstallToolWithWinget('node');
                logs.push({ step: 'install-node', ...nodeInstall });
                if (!nodeInstall.ok) {
                    return {
                        ok: false,
                        framework,
                        reason: 'NODE_MISSING',
                        message: 'Hexo 需要 Node.js，自动安装失败，请在环境检查中手动安装。',
                        logs
                    };
                }
            }

            const pnpmResult = ensurePnpmImpl();
            logs.push({ step: 'ensure-pnpm', ...pnpmResult });
            if (!pnpmResult.ok) {
                return {
                    ok: false,
                    framework,
                    reason: pnpmResult.reason || 'PNPM_INSTALL_FAILED',
                    message: 'Hexo 需要 pnpm，自动安装失败，请在环境检查中重试。',
                    logs
                };
            }

            return { ok: true, framework, logs };
        }

        if (framework === 'hugo') {
            if (!resolveHugoExecutableImpl({ requireExtended: true })) {
                const hugoInstall = autoInstallToolWithWinget('hugo-extended');
                logs.push({ step: 'install-hugo', ...hugoInstall });
                if (!hugoInstall.ok || !resolveHugoExecutableImpl({ requireExtended: true })) {
                    return {
                        ok: false,
                        framework,
                        reason: 'HUGO_EXTENDED_MISSING',
                        message: 'Hugo Extended 环境未就绪，自动安装失败，请在环境检查中安装 Hugo Extended。',
                        logs
                    };
                }
            }

            const sassReady = ensureDartSassImpl();
            logs.push({ step: 'ensure-dart-sass', ...sassReady });
            if (!sassReady.ok) {
                return {
                    ok: false,
                    framework,
                    reason: 'DART_SASS_MISSING',
                    message: 'Hugo 主题预览需要 Dart Sass，自动安装失败，请手动安装后重试。',
                    logs
                };
            }

            const shimReady = ensureHugoSassShim();
            logs.push({ step: 'ensure-sass-shim', ...shimReady });
            if (!shimReady.ok) {
                return {
                    ok: false,
                    framework,
                    reason: 'SASS_SHIM_PREPARE_FAILED',
                    message: 'Hugo Sass 启动脚本准备失败，请检查本地 Node 与 Sass 安装。',
                    logs
                };
            }

            return { ok: true, framework, logs };
        }

        return {
            ok: false,
            framework,
            reason: 'UNSUPPORTED_FRAMEWORK',
            message: '暂不支持该框架环境自动配置。',
            logs
        };
    }

    function installDependenciesWithRetry(projectDir) {
        const logs = [];

        const firstTry = runCommandImpl('pnpm', ['install'], { cwd: projectDir });
        logs.push({ command: 'pnpm install', status: firstTry.status, stdout: firstTry.stdout, stderr: firstTry.stderr });

        if (firstTry.status === 0) {
            return { ok: true, retried: false, logs };
        }

        logs.push({
            event: 'mirror-fallback',
            message: 'pnpm install 首次失败，已切换镜像源后重试。',
            registry: mirrorRegistry
        });

        const setMirror = runCommandImpl('pnpm', ['config', 'set', 'registry', mirrorRegistry], { cwd: projectDir });
        logs.push({
            command: `pnpm config set registry ${mirrorRegistry}`,
            status: setMirror.status,
            stdout: setMirror.stdout,
            stderr: setMirror.stderr
        });

        const secondTry = runCommandImpl('pnpm', ['install'], { cwd: projectDir });
        logs.push({ command: 'pnpm install (retry)', status: secondTry.status, stdout: secondTry.stdout, stderr: secondTry.stderr });

        return {
            ok: secondTry.status === 0,
            retried: true,
            logs
        };
    }

    return {
        autoInstallToolWithWinget,
        openInstaller,
        ensurePnpm,
        ensureDartSass,
        getHugoExecutionEnv,
        ensureFrameworkEnvironment,
        installDependenciesWithRetry
    };
}

const defaultService = createInstallToolingService();

module.exports = {
    createInstallToolingService,
    autoInstallToolWithWinget: defaultService.autoInstallToolWithWinget,
    openInstaller: defaultService.openInstaller,
    ensurePnpm: defaultService.ensurePnpm,
    ensureDartSass: defaultService.ensureDartSass,
    getHugoExecutionEnv: defaultService.getHugoExecutionEnv,
    ensureFrameworkEnvironment: defaultService.ensureFrameworkEnvironment,
    installDependenciesWithRetry: defaultService.installDependenciesWithRetry
};
