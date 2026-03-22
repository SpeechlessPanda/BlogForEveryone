const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

const targetsToRemove = [
    'dist/builder-debug.yml',
    'dist/builder-effective-config.yaml',
    '.bfe/subscriptions.bundle.json',
    '.bfe/metadata.json'
];

function removeIfExists(relPath) {
    const fullPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(fullPath)) {
        return;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
        fs.rmSync(fullPath, { force: true });
    }
}

function ensureIconExists() {
    const iconPath = path.join(repoRoot, 'build', 'icon.ico');
    if (!fs.existsSync(iconPath)) {
        throw new Error('缺少 build/icon.ico，请先准备应用图标后再发布。');
    }
}

function scanForSensitiveFiles() {
    const forbiddenNames = ['db.json', 'auth.json', 'token.txt'];
    const roots = ['dist', '.bfe'];

    for (const root of roots) {
        const rootPath = path.join(repoRoot, root);
        if (!fs.existsSync(rootPath)) {
            continue;
        }

        const queue = [rootPath];
        while (queue.length > 0) {
            const current = queue.pop();
            for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    queue.push(fullPath);
                    continue;
                }

                if (forbiddenNames.includes(entry.name)) {
                    fs.rmSync(fullPath, { force: true });
                }
            }
        }
    }
}

function main() {
    ensureIconExists();

    for (const relPath of targetsToRemove) {
        removeIfExists(relPath);
    }

    scanForSensitiveFiles();
    console.log('sanitize-release: OK');
}

main();
