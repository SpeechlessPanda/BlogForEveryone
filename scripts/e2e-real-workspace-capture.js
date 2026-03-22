const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { startLocalPreview, stopLocalPreview } = require('../src/main/services/previewService');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'e2e-real-workspaces', 'manifest.json');
const SCREENSHOT_DIR = path.join(ROOT, 'e2e-real-workspaces', 'screenshots');

function run(command, args, options = {}) {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd: options.cwd || ROOT,
            shell: Boolean(options.shell),
            windowsHide: true,
            env: options.env || process.env
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('close', (code) => {
            resolve({ ok: code === 0, code: code ?? 1, stdout, stderr });
        });
    });
}

function resolveEdgeBinary() {
    const candidates = [
        path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return '';
}

async function captureWithEdge(edgePath, url, outputPath) {
    const args = [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--window-size=1920,1400',
        '--virtual-time-budget=12000',
        '--run-all-compositor-stages-before-draw',
        `--screenshot=${outputPath}`,
        url
    ];
    return run(edgePath, args, { shell: false });
}

function isScreenshotUsable(filePath) {
    try {
        const stat = fs.statSync(filePath);
        // Tiny files are usually blank/failed captures; minimalist themes can still be much smaller than 80KB.
        return stat.size > 8 * 1024;
    } catch {
        return false;
    }
}

async function main() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error(`manifest not found: ${MANIFEST_PATH}`);
    }

    const edgePath = resolveEdgeBinary();
    if (!edgePath) {
        throw new Error('Microsoft Edge executable not found.');
    }

    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const results = [];

    for (let i = 0; i < manifest.themes.length; i += 1) {
        const item = manifest.themes[i];
        const preferredPort = 32000 + i + 1;

        // eslint-disable-next-line no-await-in-loop
        const preview = await startLocalPreview({
            projectDir: item.projectDir,
            framework: item.framework,
            port: preferredPort
        });

        if (!preview.ok || !preview.url) {
            results.push({ theme: `${item.framework}/${item.themeId}`, ok: false, reason: 'preview-start-failed' });
            // eslint-disable-next-line no-await-in-loop
            await stopLocalPreview({ projectDir: item.projectDir, framework: item.framework });
            continue;
        }

        const outputPath = path.join(SCREENSHOT_DIR, `${item.framework}-${item.themeId}.png`);
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        let shot = null;
        let attempt = 0;
        const maxAttempts = 3;

        while (attempt < maxAttempts) {
            attempt += 1;
            // eslint-disable-next-line no-await-in-loop
            shot = await captureWithEdge(edgePath, preview.url, outputPath);
            if (shot.ok && isScreenshotUsable(outputPath)) {
                break;
            }
        }

        // eslint-disable-next-line no-await-in-loop
        await stopLocalPreview({ projectDir: item.projectDir, framework: item.framework });

        results.push({
            theme: `${item.framework}/${item.themeId}`,
            ok: shot.ok && fs.existsSync(outputPath),
            outputPath,
            url: preview.url,
            attempt,
            stderr: shot.stderr
        });

        console.log(`${item.framework}/${item.themeId}: ${shot.ok ? 'captured' : 'failed'} -> ${outputPath}`);
    }

    const failed = results.filter((row) => !row.ok);
    if (failed.length) {
        console.error(JSON.stringify({ failed }, null, 2));
        process.exitCode = 1;
        return;
    }

    console.log(JSON.stringify({ total: results.length, ok: true }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
