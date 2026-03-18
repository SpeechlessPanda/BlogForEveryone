const { spawn } = require('child_process');
const { shell } = require('electron');
const { resolveExecutable, resolveHugoExecutable, ensureFrameworkEnvironment } = require('./envService');

const previewProcesses = new Map();

function getDefaultPort(framework) {
    return framework === 'hexo' ? 4000 : 1313;
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
            if (target === 'stdout') {
                stdout += text;
            } else {
                stderr += text;
            }

            // 仅匹配框架启动成功日志，避免把帮助文本里的普通关键词误判为已启动。
            if (/(hexo\s+is\s+running\s+at\s+http:\/\/(localhost|127\.0\.0\.1):\d+)|(web\s+server\s+is\s+available\s+at\s+http:\/\/(localhost|127\.0\.0\.1):\d+)/i.test(text)) {
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

async function startLocalPreview(payload) {
    const { projectDir, framework } = payload || {};
    const port = Number(payload?.port) || getDefaultPort(framework);
    const key = `${framework}:${projectDir}`;

    const existing = previewProcesses.get(key);
    if (existing && !existing.killed) {
        return {
            ok: true,
            alreadyRunning: true,
            url: `http://localhost:${port}/`
        };
    }

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
        command = 'pnpm';
        args = ['exec', 'hexo', 'server', '--port', String(port), '--host', '127.0.0.1'];
    } else if (framework === 'hugo') {
        command = resolveHugoExecutable({ requireExtended: true });
        if (!command) {
            return {
                ok: false,
                reason: 'HUGO_EXTENDED_MISSING',
                message: 'Hugo Extended 未找到，无法启动本地预览。'
            };
        }
        args = ['server', '--port', String(port), '--bind', '127.0.0.1', '--buildDrafts', '--buildFuture'];
    } else {
        return {
            ok: false,
            reason: 'UNSUPPORTED_FRAMEWORK',
            message: '该框架暂不支持本地预览。'
        };
    }

    const proc = spawn(command, args, {
        cwd: projectDir,
        shell: framework === 'hexo',
        windowsHide: true
    });

    previewProcesses.set(key, proc);

    const ready = await waitForServerReady(proc);
    if (!ready.ok) {
        previewProcesses.delete(key);
        return {
            ok: false,
            reason: 'PREVIEW_START_FAILED',
            message: '本地预览启动失败，请确认工程依赖已安装。',
            logs: [
                ...(envReady.logs || []),
                {
                    command: `${command} ${args.join(' ')}`,
                    status: ready.code || 1,
                    stdout: ready.stdout,
                    stderr: ready.stderr
                }
            ]
        };
    }

    proc.once('exit', () => {
        previewProcesses.delete(key);
    });

    return {
        ok: true,
        url: `http://localhost:${port}/`,
        logs: [
            ...(envReady.logs || []),
            {
                command: `${command} ${args.join(' ')}`,
                status: 0,
                stdout: ready.stdout,
                stderr: ready.stderr
            }
        ]
    };
}

function openLocalPreview(payload) {
    const framework = payload?.framework;
    const port = Number(payload?.port) || getDefaultPort(framework);
    const url = `http://localhost:${port}/`;
    shell.openExternal(url);
    return { ok: true, url };
}

function stopLocalPreview(payload) {
    const { projectDir, framework } = payload || {};
    const key = `${framework}:${projectDir}`;
    const proc = previewProcesses.get(key);
    if (!proc) {
        return { ok: true, stopped: false };
    }

    proc.kill();
    previewProcesses.delete(key);
    return { ok: true, stopped: true };
}

module.exports = {
    startLocalPreview,
    openLocalPreview,
    stopLocalPreview
};
