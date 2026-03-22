const fs = require('fs');
const path = require('path');

const { startLocalPreview, stopLocalPreview } = require('../src/main/services/previewService');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'e2e-real-workspaces', 'manifest.json');

async function main() {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const rows = [];

    for (let i = 0; i < manifest.themes.length; i += 1) {
        const item = manifest.themes[i];
        const preferredPort = 32000 + i + 1;
        // eslint-disable-next-line no-await-in-loop
        const result = await startLocalPreview({
            projectDir: item.projectDir,
            framework: item.framework,
            port: preferredPort
        });

        if (!result.ok) {
            console.error(`[FAIL] ${item.framework}/${item.themeId}`);
            console.error(JSON.stringify(result, null, 2));
            continue;
        }

        rows.push({
            framework: item.framework,
            themeId: item.themeId,
            projectDir: item.projectDir,
            preferredPort,
            url: result.url
        });

        console.log(`[OK] ${item.framework}/${item.themeId} => ${result.url}`);
    }

    const dump = {
        generatedAt: new Date().toISOString(),
        total: rows.length,
        rows
    };

    console.log('SERVE_MAP_START');
    console.log(JSON.stringify(dump, null, 2));
    console.log('SERVE_MAP_END');
    console.log('Servers are running. Press Ctrl+C to stop.');

    const stopAll = async () => {
        for (const row of rows) {
            // eslint-disable-next-line no-await-in-loop
            await stopLocalPreview({ projectDir: row.projectDir, framework: row.framework });
        }
        process.exit(0);
    };

    process.on('SIGINT', stopAll);
    process.on('SIGTERM', stopAll);

    setInterval(() => { }, 1000);
}

main().catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
});
