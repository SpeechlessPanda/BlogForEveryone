const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { exportSubscriptions } = require('./rssService');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    for (const item of fs.readdirSync(src)) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function backupWorkspace({ projectDir, backupDir, metadata }) {
    fs.mkdirSync(backupDir, { recursive: true });
    const projectName = path.basename(projectDir);
    const snapshotDir = path.join(backupDir, `${projectName}-snapshot`);

    exportSubscriptions({ projectDir });

    if (fs.existsSync(snapshotDir)) {
        fs.rmSync(snapshotDir, { recursive: true, force: true });
    }

    copyDir(projectDir, snapshotDir);

    const metaDir = path.join(snapshotDir, '.bfe');
    fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(path.join(metaDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    return snapshotDir;
}

function pushBackupToRepo(snapshotDir, repoUrl) {
    const cmds = [
        ['git', ['init']],
        ['git', ['add', '.']],
        ['git', ['commit', '-m', 'chore: backup blog workspace']],
        ['git', ['branch', '-M', 'main']],
        ['git', ['remote', 'add', 'origin', repoUrl]],
        ['git', ['push', '-u', 'origin', 'main']]
    ];

    const resultLog = [];
    for (const [bin, args] of cmds) {
        const res = spawnSync(bin, args, {
            cwd: snapshotDir,
            shell: true,
            encoding: 'utf-8'
        });
        resultLog.push({ bin, args, code: res.status, stdout: res.stdout, stderr: res.stderr });
        if (res.status !== 0) {
            break;
        }
    }

    return resultLog;
}

module.exports = {
    backupWorkspace,
    pushBackupToRepo
};
