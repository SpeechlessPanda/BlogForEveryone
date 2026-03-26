const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const { startLocalPreview, stopLocalPreview } = require('../src/main/services/previewService');
const { resolveHugoExecutable, getHugoExecutionEnv } = require('../src/main/services/envService');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'e2e-real-workspaces', 'manifest.json');
const REPORT_PATH = path.join(ROOT, 'e2e-real-workspaces', 'verify-report.json');

function readText(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return '';
    }
}

function run(cwd, command, args, options = {}) {
    return new Promise((resolve) => {
        const useWindowsPnpmWrapper = process.platform === 'win32'
            && Boolean(options.shell)
            && String(command || '').toLowerCase() === 'pnpm';
        const actualCommand = useWindowsPnpmWrapper ? (process.env.ComSpec || 'cmd.exe') : command;
        const actualArgs = useWindowsPnpmWrapper ? ['/d', '/s', '/c', 'pnpm.cmd', ...args] : args;

        const child = spawn(actualCommand, actualArgs, {
            cwd,
            shell: useWindowsPnpmWrapper ? false : Boolean(options.shell),
            env: options.env || process.env,
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => {
            stdout += d.toString();
        });
        child.stderr.on('data', (d) => {
            stderr += d.toString();
        });
        child.on('close', (code) => {
            resolve({ ok: code === 0, code: code ?? 1, stdout, stderr });
        });
    });
}

function waitHttp(url, timeoutMs = 30000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const u = new URL(url);
        const tick = () => {
            const req = http.get({ host: u.hostname, port: u.port, path: '/' }, (res) => {
                res.resume();
                if (res.statusCode >= 200 && res.statusCode < 500) {
                    resolve(true);
                    return;
                }
                if (Date.now() - start > timeoutMs) {
                    resolve(false);
                    return;
                }
                setTimeout(tick, 500);
            });
            req.on('error', () => {
                if (Date.now() - start > timeoutMs) {
                    resolve(false);
                    return;
                }
                setTimeout(tick, 500);
            });
        };
        tick();
    });
}

function checkMarkers(item) {
    const { projectDir, framework, themeId } = item;
    const configFile = framework === 'hexo' ? path.join(projectDir, '_config.yml') : path.join(projectDir, 'hugo.toml');
    const configText = readText(configFile);
    const htmlText = readText(path.join(projectDir, 'public', 'index.html'));
    const partialText = readText(path.join(projectDir, 'layouts', 'partials', 'extend_head.html'));

    const backgroundOk = /background_image|banner_img|theme_config:\s*[\s\S]*\bbanner\b|backgroundImage|background-image|bfe-preview-overrides/i.test(`${configText}\n${htmlText}\n${partialText}`);
    const faviconOk = /favicon|shortcut icon|apple-touch-icon|params\.assets\.favicon/i.test(`${configText}\n${htmlText}\n${partialText}`);

    let avatarOk = true;
    let componentOk = true;

    if (themeId === 'stack') {
        avatarOk = /params\.sidebar[\s\S]*avatar\s*=\s*"\/img\//i.test(configText);
        componentOk = /\[\[params\.widgets\.homepage\]\][\s\S]*type\s*=\s*"archives"/i.test(configText)
            && /\[\[params\.widgets\.homepage\]\][\s\S]*type\s*=\s*"tag-cloud"/i.test(configText)
            && /\[\[menu\.main\]\][\s\S]*identifier\s*=\s*"home"/i.test(configText)
            && /\[\[menu\.main\]\][\s\S]*identifier\s*=\s*"about"/i.test(configText)
            && /\[\[menu\.main\]\][\s\S]*identifier\s*=\s*"archives"/i.test(configText);
    }

    if (themeId === 'anatole') {
        avatarOk = /profilePicture\s*=\s*"\/img\//i.test(configText);
    }

    if (themeId === 'next') {
        componentOk = /sidebar:[\s\S]*display:\s*always/i.test(configText)
            && /site-state-item-count/i.test(htmlText)
            && !/function%20\(\)%20%7B/i.test(htmlText);
    }

    if (themeId === 'loveit') {
        componentOk = /\[params\.home\.profile\][\s\S]*enable\s*=\s*false/i.test(configText)
            && /\[params\.home\.posts\][\s\S]*enable\s*=\s*true/i.test(configText)
            && /E2E Theme Check/i.test(htmlText);
    }

    if (themeId === 'mainroad') {
        componentOk = /\[Params\.sidebar\][\s\S]*widgets\s*=\s*\[/i.test(configText)
            && /secondary|widget-(search|recent|categories|taglist)/i.test(htmlText);
    }

    if (themeId === 'papermod') {
        componentOk = /\[\[params\.socialIcons\]\]/i.test(configText)
            && /social-icons|E2E Theme Check/i.test(htmlText);
    }

    if (themeId === 'anatole') {
        componentOk = /\[\[params\.socialIcons\]\]/i.test(configText)
            && /sidebar__introduction|sidebar/i.test(htmlText);
    }

    return { backgroundOk, faviconOk, avatarOk, componentOk };
}

async function verifyItem(item, index) {
    const port = 31000 + index;
    const preview = await startLocalPreview({
        projectDir: item.projectDir,
        framework: item.framework,
        port
    });

    let previewHttpOk = false;
    if (preview.ok && preview.url) {
        previewHttpOk = await waitHttp(preview.url, 45000);
    }

    const publish = item.framework === 'hexo'
        ? await run(item.projectDir, 'pnpm', ['build'], { shell: true })
        : await run(
            item.projectDir,
            resolveHugoExecutable({ requireExtended: true }),
            ['--environment', 'production'],
            { shell: false, env: getHugoExecutionEnv().env }
        );

    const markers = checkMarkers(item);

    await stopLocalPreview({ projectDir: item.projectDir, framework: item.framework });

    return {
        framework: item.framework,
        themeId: item.themeId,
        projectDir: item.projectDir,
        previewStartOk: Boolean(preview.ok),
        previewHttpOk,
        previewUrl: preview.url || '',
        previewLogs: preview.logs || [],
        publishOk: publish.ok,
        publishCode: publish.code,
        markers
    };
}

async function main() {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const rows = [];

    for (let i = 0; i < manifest.themes.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const result = await verifyItem(manifest.themes[i], i + 1);
        rows.push(result);
        console.log(`${result.framework}/${result.themeId}: preview=${result.previewStartOk && result.previewHttpOk} publish=${result.publishOk}`);
    }

    const passAll = rows.filter((r) =>
        r.previewStartOk && r.previewHttpOk && r.publishOk
        && r.markers.backgroundOk && r.markers.faviconOk && r.markers.avatarOk && r.markers.componentOk
    ).length;

    const report = {
        generatedAt: new Date().toISOString(),
        total: rows.length,
        passAll,
        rows
    };

    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
