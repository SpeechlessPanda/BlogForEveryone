const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { commandExists } = require('./runCommand');

function createEnvironmentDetector(options = {}) {
    const fsImpl = options.fsImpl || fs;
    const pathImpl = options.pathImpl || path;
    const processImpl = options.processImpl || process;

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
            isExtended: /(?:\+|\b)extended\b/i.test(version),
            version,
            status: result.status ?? 1
        };
    }

    const resolveHugoExecutableImpl = options.resolveHugoExecutableImpl;
    const commandExistsImpl = options.commandExistsImpl || commandExists;

    function resolveHugoExecutable(resolveOptions = {}) {
        if (typeof resolveHugoExecutableImpl === 'function') {
            return resolveHugoExecutableImpl(resolveOptions);
        }

        const requireExtended = Boolean(resolveOptions.requireExtended);
        const candidates = [];
        const seen = new Set();

        const addCandidate = (candidate) => {
            if (!candidate || seen.has(candidate)) {
                return;
            }

            if (candidate === 'hugo' || candidate === 'hugo_extended') {
                if (commandExistsImpl(candidate)) {
                    candidates.push(candidate);
                    seen.add(candidate);
                }
                return;
            }

            if (fsImpl.existsSync(candidate)) {
                candidates.push(candidate);
                seen.add(candidate);
            }
        };

        addCandidate('hugo_extended');
        addCandidate('hugo');

        if (processImpl.platform === 'win32') {
            const localAppData = processImpl.env.LOCALAPPDATA;
            if (localAppData) {
                const linksDir = pathImpl.join(localAppData, 'Microsoft', 'WinGet', 'Links');
                addCandidate(pathImpl.join(linksDir, 'hugo_extended.exe'));
                addCandidate(pathImpl.join(linksDir, 'hugo.exe'));

                const packagesDir = pathImpl.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
                if (fsImpl.existsSync(packagesDir)) {
                    try {
                        const entries = fsImpl.readdirSync(packagesDir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (!entry.isDirectory()) {
                                continue;
                            }
                            const dirNameLower = entry.name.toLowerCase();
                            if (!dirNameLower.startsWith('hugo.')) {
                                continue;
                            }
                            addCandidate(pathImpl.join(packagesDir, entry.name, 'hugo_extended.exe'));
                            addCandidate(pathImpl.join(packagesDir, entry.name, 'hugo.exe'));
                        }
                    } catch (error) {
                        void error;
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

    const resolveExecutableImpl = options.resolveExecutableImpl;

    function resolveExecutable(command) {
        if (typeof resolveExecutableImpl === 'function') {
            return resolveExecutableImpl(command);
        }

        if (command === 'hugo') {
            return resolveHugoExecutable({ requireExtended: false });
        }

        if (commandExistsImpl(command)) {
            return command;
        }

        if (processImpl.platform === 'win32') {
            if (command === 'pnpm') {
                const pnpmCandidates = [
                    processImpl.env.PNPM_HOME ? pathImpl.join(processImpl.env.PNPM_HOME, 'pnpm.cmd') : '',
                    processImpl.env.USERPROFILE ? pathImpl.join(processImpl.env.USERPROFILE, '.pnpm', 'pnpm.cmd') : '',
                    processImpl.env.APPDATA ? pathImpl.join(processImpl.env.APPDATA, 'npm', 'pnpm.cmd') : ''
                ].filter(Boolean);

                for (const candidate of pnpmCandidates) {
                    if (fsImpl.existsSync(candidate)) {
                        return candidate;
                    }
                }
            }

            const localAppData = processImpl.env.LOCALAPPDATA;
            if (localAppData) {
                const candidate = pathImpl.join(localAppData, 'Microsoft', 'WinGet', 'Links', `${command}.exe`);
                if (fsImpl.existsSync(candidate)) {
                    return candidate;
                }

                const packagesDir = pathImpl.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
                if (fsImpl.existsSync(packagesDir)) {
                    try {
                        const entries = fsImpl.readdirSync(packagesDir, { withFileTypes: true });
                        const commandLower = command.toLowerCase();
                        for (const entry of entries) {
                            if (!entry.isDirectory()) {
                                continue;
                            }
                            const dirNameLower = entry.name.toLowerCase();
                            if (!dirNameLower.includes(`${commandLower}.`)) {
                                continue;
                            }
                            const exePath = pathImpl.join(packagesDir, entry.name, `${command}.exe`);
                            if (fsImpl.existsSync(exePath)) {
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
        const wingetInstalled = commandExistsImpl('winget');

        return {
            nodeInstalled,
            gitInstalled,
            pnpmInstalled,
            hugoInstalled,
            wingetInstalled,
            ready: nodeInstalled && gitInstalled && pnpmInstalled
        };
    }

    return {
        getHugoVersionInfo,
        resolveHugoExecutable,
        resolveExecutable,
        checkEnvironment
    };
}

const defaultDetector = createEnvironmentDetector();

module.exports = {
    createEnvironmentDetector,
    getHugoVersionInfo: defaultDetector.getHugoVersionInfo,
    resolveHugoExecutable: defaultDetector.resolveHugoExecutable,
    resolveExecutable: defaultDetector.resolveExecutable,
    checkEnvironment: defaultDetector.checkEnvironment
};
