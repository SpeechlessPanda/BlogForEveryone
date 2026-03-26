const { spawn } = require('child_process');
const { shell } = require('electron');
const net = require('net');
const { resolveHugoExecutable, ensureFrameworkEnvironment, getHugoExecutionEnv } = require('./envService');
const { evaluateExternalUrl, EXTERNAL_URL_RULES } = require('../policies/externalUrlPolicy');

const ANSI_COLOR_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

const previewProcesses = new Map();
let createServer = () => net.createServer();
let processTreeKiller = (pid) => new Promise((resolve) => {
    const killer = spawn('cmd', buildWindowsKillArgs(pid), {
        windowsHide: true,
        stdio: 'ignore'
    });
    killer.once('error', () => resolve());
    killer.once('close', () => resolve());
    killer.unref();
});

function getDefaultPort(framework) {
    return framework === 'hexo' ? 4000 : 1313;
}

function isPortBusy(port, host) {
    return new Promise((resolve) => {
        const tester = createServer();
        tester.once('error', (error) => {
            if (error && error.code === 'EADDRINUSE') {
                resolve(true);
                return;
            }
            resolve(false);
        });

        tester.once('listening', () => {
            tester.close(() => resolve(false));
        });

        if (host) {
            tester.listen(port, host);
            return;
        }

        tester.listen(port);
    });
}

async function findAvailablePort(preferredPort, host) {
    const base = Number(preferredPort) || 1313;
    const candidates = Array.from({ length: 30 }, (_, index) => base + index);
    for (const candidate of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const busy = await isPortBusy(candidate, host);
        if (!busy) {
            return candidate;
        }
    }

    return base + 31;
}

async function waitForPortRelease(port, host, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        // eslint-disable-next-line no-await-in-loop
        const busy = await isPortBusy(port, host);
        if (!busy) {
            return true;
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
}

function waitForCleanupStep(step, timeoutMs = 3000) {
    return Promise.race([
        Promise.resolve(step),
        new Promise((resolve) => setTimeout(resolve, timeoutMs))
    ]);
}

function waitForServerReady(proc, timeoutMs = 15000) {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let done = false;

        const finish = (payload) => {
            if (done) {
                return;
            }
            done = true;
            resolve(payload);
        };

        const timer = setTimeout(() => {
            finish({ ok: false, stdout, stderr, timedOut: true, code: 1 });
        }, timeoutMs);

        const onChunk = (chunk, target) => {
            const text = chunk.toString();
            const normalized = text.replace(ANSI_COLOR_PATTERN, '');
            if (target === 'stdout') {
                stdout += text;
            } else {
                stderr += text;
            }

            // 仅匹配框架启动成功日志，避免把帮助文本里的普通关键词误判为已启动。
            if (/(hexo\s+is\s+running\s+at\s+http:\/\/(localhost|127\.0\.0\.1):\d+)|(web\s+server\s+is\s+available\s+at\s+http:\/\/(localhost|127\.0\.0\.1):\d+)/i.test(normalized)) {
                clearTimeout(timer);
                finish({ ok: true, stdout, stderr, timedOut: false });
            }
        };

        proc.stdout?.on('data', (chunk) => onChunk(chunk, 'stdout'));
        proc.stderr?.on('data', (chunk) => onChunk(chunk, 'stderr'));

        proc.once('exit', (code) => {
            clearTimeout(timer);
            finish({ ok: false, stdout, stderr, code: code ?? 1 });
        });
    });
}

function isPortInUseError(payload) {
    const text = `${payload?.stdout || ''}\n${payload?.stderr || ''}`;
    return /EADDRINUSE|port\s+\d+\s+has\s+been\s+used/i.test(text);
}

function buildWindowsKillArgs(pid) {
    return ['/c', 'taskkill', '/PID', String(pid), '/T', '/F'];
}

function waitForProcessExit(proc, timeoutMs = 3000) {
    if (!proc || typeof proc.once !== 'function') {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) {
                return;
            }
            done = true;
            resolve();
        };

        const timer = setTimeout(finish, timeoutMs);
        proc.once('exit', () => {
            clearTimeout(timer);
            finish();
        });
    });
}

async function terminateProcessTree(proc) {
    if (!proc) {
        return;
    }

    const pid = Number(proc.pid);
    if (process.platform === 'win32' && Number.isFinite(pid) && pid > 0) {
        try {
            await waitForCleanupStep(processTreeKiller(pid));
        } catch {
            // Fallback to default kill below.
        }
    }

    try {
        if (!proc.killed) {
            proc.kill();
        }
    } catch {
        // Ignore cleanup failures.
    }

    await waitForProcessExit(proc);
}

async function startLocalPreview(payload) {
    const { projectDir, framework } = payload || {};
    const key = `${framework}:${projectDir}`;

    const existing = previewProcesses.get(key);
    if (existing?.proc && !existing.proc.killed) {
        return {
            ok: true,
            alreadyRunning: true,
            url: `http://localhost:${existing.port}/`
        };
    }

    const preferredPort = Number(payload?.port) || getDefaultPort(framework);

    const envReady = ensureFrameworkEnvironment(framework);
    if (!envReady.ok) {
        return {
            ok: false,
            reason: envReady.reason,
            message: envReady.message,
            logs: envReady.logs || []
        };
    }

    let command = '';
    let args = [];

    if (framework === 'hexo') {
        if (process.platform === 'win32') {
            command = process.env.ComSpec || 'cmd.exe';
            args = ['/d', '/s', '/c', `pnpm exec hexo server --port ${preferredPort} --host 127.0.0.1`];
        } else {
            command = 'pnpm';
            args = ['exec', 'hexo', 'server', '--port', String(preferredPort), '--host', '127.0.0.1'];
        }
    } else if (framework === 'hugo') {
        command = resolveHugoExecutable({ requireExtended: true });
        if (!command) {
            return {
                ok: false,
                reason: 'HUGO_EXTENDED_MISSING',
                message: 'Hugo Extended 未找到，无法启动本地预览。'
            };
        }
        args = ['server', '--port', String(preferredPort), '--bind', '127.0.0.1', '--buildDrafts', '--buildFuture'];
    } else {
        return {
            ok: false,
            reason: 'UNSUPPORTED_FRAMEWORK',
            message: '该框架暂不支持本地预览。'
        };
    }

    let selectedPort = preferredPort;
    let lastReady = null;
    const maxAttempts = framework === 'hexo' ? 6 : 4;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        selectedPort = await findAvailablePort(preferredPort + attempt, '127.0.0.1');

        const launchArgs = framework === 'hexo'
            ? (process.platform === 'win32'
                ? ['/d', '/s', '/c', `pnpm exec hexo server --port ${selectedPort} --host 127.0.0.1`]
                : ['exec', 'hexo', 'server', '--port', String(selectedPort), '--host', '127.0.0.1'])
            : ['server', '--port', String(selectedPort), '--bind', '127.0.0.1', '--buildDrafts', '--buildFuture'];

        const proc = spawn(command, launchArgs, {
            cwd: projectDir,
            shell: false,
            windowsHide: true,
            env: framework === 'hugo' ? getHugoExecutionEnv().env : process.env
        });

        previewProcesses.set(key, { proc, framework, projectDir, port: selectedPort });
        // eslint-disable-next-line no-await-in-loop
        const ready = await waitForServerReady(proc, framework === 'hexo' ? 18000 : 20000);
        lastReady = { ready, launchArgs, selectedPort };

        if (ready.ok) {
            proc.once('exit', () => {
                previewProcesses.delete(key);
            });

            return {
                ok: true,
                url: `http://localhost:${selectedPort}/`,
                logs: [
                    ...(envReady.logs || []),
                    {
                        command: `${command} ${launchArgs.join(' ')}`,
                        status: 0,
                        stdout: ready.stdout,
                        stderr: ready.stderr
                    },
                    {
                        command: 'port-selection',
                        status: 0,
                        stdout: `preferred=${preferredPort}, actual=${selectedPort}`,
                        stderr: ''
                    }
                ]
            };
        }

        // eslint-disable-next-line no-await-in-loop
        await terminateProcessTree(proc);
        previewProcesses.delete(key);

        if (!isPortInUseError(ready)) {
            break;
        }
    }

    return {
        ok: false,
        reason: 'PREVIEW_START_FAILED',
        message: '本地预览启动失败，请确认工程依赖已安装。',
        logs: [
            ...(envReady.logs || []),
            {
                command: `${command} ${(lastReady?.launchArgs || args).join(' ')}`,
                status: lastReady?.ready?.code || 1,
                stdout: lastReady?.ready?.stdout || '',
                stderr: lastReady?.ready?.stderr || ''
            },
            {
                command: 'port-selection',
                status: 0,
                stdout: `preferred=${preferredPort}, actual=${lastReady?.selectedPort ?? preferredPort}`,
                stderr: ''
            }
        ]
    };
}

function openLocalPreview(payload) {
    const explicitUrl = String(payload?.url || '').trim();
    const framework = payload?.framework;
    const projectDir = payload?.projectDir;
    const key = `${framework}:${projectDir}`;
    const existing = previewProcesses.get(key);
    const port = Number(payload?.port) || existing?.port || getDefaultPort(framework);
    const nextUrl = explicitUrl || `http://localhost:${port}/`;
    const decision = evaluateExternalUrl(nextUrl, EXTERNAL_URL_RULES.preview);
    if (!decision.allowed) {
        return {
            ok: false,
            reason: 'PREVIEW_URL_BLOCKED',
            message: '预览地址不受信任，已阻止打开。'
        };
    }

    shell.openExternal(decision.normalizedUrl);
    return { ok: true, url: decision.normalizedUrl };
}

async function stopLocalPreview(payload) {
    const { projectDir, framework } = payload || {};
    const key = `${framework}:${projectDir}`;
    const item = previewProcesses.get(key);
    if (!item?.proc) {
        return {
            ok: false,
            stopped: false,
            reason: 'PREVIEW_NOT_RUNNING',
            message: '当前没有正在运行的预览进程。'
        };
    }

    await terminateProcessTree(item.proc);
    await waitForPortRelease(item.port, '127.0.0.1');
    previewProcesses.delete(key);
    return { ok: true, stopped: true, message: '已停止本地预览。' };
}

module.exports = {
    startLocalPreview,
    openLocalPreview,
    stopLocalPreview,
    __test__: {
        isPortBusy,
        findAvailablePort,
        waitForPortRelease,
        waitForServerReady,
        waitForProcessExit,
        terminateProcessTree,
        isPortInUseError,
        buildWindowsKillArgs,
        setPreviewProcess(payload) {
            const framework = payload?.framework;
            const projectDir = payload?.projectDir;
            if (!framework || !projectDir) {
                return;
            }
            previewProcesses.set(`${framework}:${projectDir}`, payload);
        },
        clearPreviewProcesses() {
            previewProcesses.clear();
        },
        setProcessTreeKillerForTests(killer) {
            if (typeof killer === 'function') {
                processTreeKiller = killer;
                return;
            }

            processTreeKiller = (pid) => new Promise((resolve) => {
                const proc = spawn('cmd', buildWindowsKillArgs(pid), {
                    windowsHide: true,
                    stdio: 'ignore'
                });
                proc.once('error', () => resolve());
                proc.once('close', () => resolve());
                proc.unref();
            });
        },
        setCreateServerForTests(factory) {
            if (typeof factory === 'function') {
                createServer = factory;
                return;
            }

            createServer = () => net.createServer();
        }
    }
};
