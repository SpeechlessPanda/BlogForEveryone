const { spawnSync } = require('child_process');
const { shell } = require('electron');
const fs = require('fs');
const path = require('path');

const MIRROR_REGISTRY = 'https://registry.npmmirror.com';

function runCommand(command, args = [], options = {}) {
    return spawnSync(command, args, {
        shell: true,
        encoding: 'utf-8',
        timeout: 120000,
        windowsHide: true,
        ...options
    });
}

function commandExists(command) {
    const result = runCommand(command, ['--version']);
    return result.status === 0;
}

function getHugoVersionInfo(executablePath) {
    if (!executablePath) {
        return { ok: false, isExtended: false, version: '', status: 1 };
    }

    const result = spawnSync(executablePath, ['version'], {
        shell: false,
        encoding: 'utf-8',
        timeout: 15000,
        windowsHide: true
    });

    const version = String(result.stdout || '').trim();
    return {
        ok: result.status === 0,
        isExtended: /\+extended\b/i.test(version),
        version,
        status: result.status ?? 1
    };
}

function resolveHugoExecutable(options = {}) {
    const requireExtended = Boolean(options.requireExtended);
    const candidates = [];
    const seen = new Set();

    const addCandidate = (candidate) => {
        if (!candidate || seen.has(candidate)) {
            return;
        }

        if (candidate === 'hugo' || candidate === 'hugo_extended') {
            if (commandExists(candidate)) {
                candidates.push(candidate);
                seen.add(candidate);
            }
            return;
        }

        if (fs.existsSync(candidate)) {
            candidates.push(candidate);
            seen.add(candidate);
        }
    };

    addCandidate('hugo_extended');
    addCandidate('hugo');

    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA;
        if (localAppData) {
            const linksDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Links');
            addCandidate(path.join(linksDir, 'hugo_extended.exe'));
            addCandidate(path.join(linksDir, 'hugo.exe'));

            const packagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
            if (fs.existsSync(packagesDir)) {
                try {
                    const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (!entry.isDirectory()) {
                            continue;
                        }
                        const dirNameLower = entry.name.toLowerCase();
                        if (!dirNameLower.startsWith('hugo.')) {
                            continue;
                        }
                        addCandidate(path.join(packagesDir, entry.name, 'hugo_extended.exe'));
                        addCandidate(path.join(packagesDir, entry.name, 'hugo.exe'));
                    }
                } catch {
                    // ignore candidate discovery failures
                }
            }
        }
    }

    const ordered = candidates.sort((a, b) => {
        const score = (value) => (/extended/i.test(value) ? 2 : 1);
        return score(b) - score(a);
    });

    if (!requireExtended) {
        return ordered[0] || '';
    }

    for (const candidate of ordered) {
        const versionInfo = getHugoVersionInfo(candidate);
        if (versionInfo.ok && versionInfo.isExtended) {
            return candidate;
        }
    }

    return '';
}

function resolveExecutable(command) {
    if (command === 'hugo') {
        return resolveHugoExecutable({ requireExtended: false });
    }

    if (commandExists(command)) {
        return command;
    }

    if (process.platform === 'win32') {
        if (command === 'pnpm') {
            const pnpmCandidates = [
                process.env.PNPM_HOME ? path.join(process.env.PNPM_HOME, 'pnpm.cmd') : '',
                process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.pnpm', 'pnpm.cmd') : '',
                process.env.APPDATA ? path.join(process.env.APPDATA, 'npm', 'pnpm.cmd') : ''
            ].filter(Boolean);

            for (const candidate of pnpmCandidates) {
                if (fs.existsSync(candidate)) {
                    return candidate;
                }
            }
        }

        const localAppData = process.env.LOCALAPPDATA;
        if (localAppData) {
            const candidate = path.join(localAppData, 'Microsoft', 'WinGet', 'Links', `${command}.exe`);
            if (fs.existsSync(candidate)) {
                return candidate;
            }

            const packagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
            if (fs.existsSync(packagesDir)) {
                try {
                    const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
                    const commandLower = command.toLowerCase();
                    for (const entry of entries) {
                        if (!entry.isDirectory()) {
                            continue;
                        }
                        const dirNameLower = entry.name.toLowerCase();
                        if (!dirNameLower.includes(`${commandLower}.`)) {
                            continue;
                        }
                        const exePath = path.join(packagesDir, entry.name, `${command}.exe`);
                        if (fs.existsSync(exePath)) {
                            return exePath;
                        }
                    }
                } catch {
                    return '';
                }
            }
        }
    }

    return '';
}

function checkEnvironment() {
    const nodeInstalled = Boolean(resolveExecutable('node'));
    const gitInstalled = Boolean(resolveExecutable('git'));
    const pnpmInstalled = Boolean(resolveExecutable('pnpm'));
    const hugoInstalled = Boolean(resolveExecutable('hugo'));
    const wingetInstalled = commandExists('winget');

    return {
        nodeInstalled,
        gitInstalled,
        pnpmInstalled,
        hugoInstalled,
        wingetInstalled,
        ready: nodeInstalled && gitInstalled && pnpmInstalled
    };
}

function autoInstallToolWithWinget(tool) {
    const env = checkEnvironment();
    if (!env.wingetInstalled) {
        return { ok: false, reason: 'WINGET_MISSING', logs: [] };
    }

    const packageIds =
        tool === 'git'
            ? ['Git.Git']
            : tool === 'node'
                ? ['OpenJS.NodeJS.LTS']
                : tool === 'hugo'
                    ? ['Hugo.Hugo.Extended', 'Hugo.Hugo']
                    : tool === 'hugo-extended'
                        ? ['Hugo.Hugo.Extended']
                        : null;
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

        const firstTry = runCommand('winget', installArgs);
        logs.push({ command: `winget ${installArgs.join(' ')}`, status: firstTry.status, stdout: firstTry.stdout, stderr: firstTry.stderr });

        if (firstTry.status === 0) {
            return { ok: true, retried: false, packageId, logs };
        }

        const updateSource = runCommand('winget', ['source', 'update', 'winget']);
        logs.push({ command: 'winget source update winget', status: updateSource.status, stdout: updateSource.stdout, stderr: updateSource.stderr });

        const secondTry = runCommand('winget', installArgs);
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

    const step1 = runCommand('corepack', ['enable'], { timeout: 45000 });
    logs.push({ command: 'corepack enable', status: step1.status, stdout: step1.stdout, stderr: step1.stderr });

    const step2 = runCommand('corepack', ['prepare', 'pnpm@latest', '--activate'], { timeout: 90000 });
    logs.push({
        command: 'corepack prepare pnpm@latest --activate',
        status: step2.status,
        stdout: step2.stdout,
        stderr: step2.stderr
    });

    if (step2.status === 0 && resolveExecutable('pnpm')) {
        return { ok: true, alreadyInstalled: false, logs };
    }

    logs.push({
        event: 'mirror-fallback',
        message: 'corepack 安装 pnpm 失败，已切换 npm 镜像源后重试。',
        registry: MIRROR_REGISTRY
    });

    const setMirror = runCommand('npm', ['config', 'set', 'registry', MIRROR_REGISTRY]);
    logs.push({
        command: `npm config set registry ${MIRROR_REGISTRY}`,
        status: setMirror.status,
        stdout: setMirror.stdout,
        stderr: setMirror.stderr
    });

    const fallbackInstall = runCommand('npm', ['install', '-g', 'pnpm'], { timeout: 180000 });
    logs.push({ command: 'npm install -g pnpm', status: fallbackInstall.status, stdout: fallbackInstall.stdout, stderr: fallbackInstall.stderr });

    if (fallbackInstall.status === 0 && resolveExecutable('pnpm')) {
        return { ok: true, alreadyInstalled: false, logs, fallback: true };
    }

    return { ok: false, reason: 'PNPM_INSTALL_FAILED', logs };
}

function ensureDartSass() {
    const logs = [];

    if (resolveExecutable('sass')) {
        return {
            ok: true,
            alreadyInstalled: true,
            logs
        };
    }

    const pnpmResult = ensurePnpm();
    logs.push({ step: 'ensure-pnpm', ...pnpmResult });
    if (!pnpmResult.ok) {
        return {
            ok: false,
            reason: pnpmResult.reason || 'PNPM_INSTALL_FAILED',
            logs
        };
    }

    const installResult = runCommand('pnpm', ['add', '-g', 'sass'], { timeout: 180000 });
    logs.push({
        command: 'pnpm add -g sass',
        status: installResult.status,
        stdout: installResult.stdout,
        stderr: installResult.stderr
    });

    if (installResult.status === 0 && resolveExecutable('sass')) {
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

function findSassRunner() {
    const candidates = [
        process.env.APPDATA ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'sass-embedded-win32-x64', 'dart-sass', 'sass.bat') : '',
        process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'npm', 'node_modules', 'sass-embedded-win32-x64', 'dart-sass', 'sass.bat') : '',
        process.env.APPDATA ? path.join(process.env.APPDATA, 'npm', 'sass.cmd') : ''
    ].filter(Boolean);

    return candidates.find((item) => fs.existsSync(item)) || '';
}

function ensureHugoSassShim() {
    const logs = [];
    const sassRunner = findSassRunner();

    if (!sassRunner) {
        return {
            ok: false,
            reason: 'SASS_SHIM_PREPARE_FAILED',
            logs
        };
    }

    const shimDir = path.join(process.env.LOCALAPPDATA || process.cwd(), 'BlogForEveryone', 'bin');
    fs.mkdirSync(shimDir, { recursive: true });

    const cmdShimPath = path.join(shimDir, 'sass.cmd');
    const batShimPath = path.join(shimDir, 'sass.bat');
    const shimContent = `@echo off\r\ncall "${sassRunner}" %*\r\n`;
    fs.writeFileSync(cmdShimPath, shimContent, 'utf-8');
    fs.writeFileSync(batShimPath, shimContent, 'utf-8');
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
            env: { ...process.env },
            logs: shim.logs || []
        };
    }

    const currentPath = process.env.PATH || '';
    return {
        ok: true,
        env: {
            ...process.env,
            PATH: `${shim.binDir}${path.delimiter}${currentPath}`
        },
        logs: shim.logs || []
    };
}

function ensureFrameworkEnvironment(framework) {
    const logs = [];
    const env = checkEnvironment();

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

        const pnpmResult = ensurePnpm();
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
        if (!resolveHugoExecutable({ requireExtended: true })) {
            const hugoInstall = autoInstallToolWithWinget('hugo-extended');
            logs.push({ step: 'install-hugo', ...hugoInstall });
            if (!hugoInstall.ok || !resolveHugoExecutable({ requireExtended: true })) {
                return {
                    ok: false,
                    framework,
                    reason: 'HUGO_EXTENDED_MISSING',
                    message: 'Hugo Extended 环境未就绪，自动安装失败，请在环境检查中安装 Hugo Extended。',
                    logs
                };
            }
        }

        const sassReady = ensureDartSass();
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

    const firstTry = runCommand('pnpm', ['install'], { cwd: projectDir });
    logs.push({ command: 'pnpm install', status: firstTry.status, stdout: firstTry.stdout, stderr: firstTry.stderr });

    if (firstTry.status === 0) {
        return { ok: true, retried: false, logs };
    }

    logs.push({
        event: 'mirror-fallback',
        message: 'pnpm install 首次失败，已切换镜像源后重试。',
        registry: MIRROR_REGISTRY
    });

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

    logs.push({
        event: 'mirror-fallback',
        message: 'pnpm dlx 首次失败，已切换镜像源后重试。',
        registry: MIRROR_REGISTRY
    });

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
    MIRROR_REGISTRY
};
