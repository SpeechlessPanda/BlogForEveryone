const fs = require('fs');
const path = require('path');
const { exportSubscriptions } = require('./rssService');
const { runCommand } = require('./env/runCommand');
const { getAccessTokenForPrivilegedUse } = require('./githubAuthService');
const { RESULT_CODES, RESULT_CATEGORIES } = require('../../shared/operationResultContract');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    for (const item of fs.readdirSync(src)) {
        if (item === '.git') {
            continue;
        }

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

function isInsidePath(candidatePath, basePath) {
    const relative = path.relative(basePath, candidatePath);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isGithubHttpsUrl(repoUrl) {
    return /^https:\/\/github\.com\//i.test(String(repoUrl || '').trim());
}

function buildGithubGitAuthEnv(repoUrl) {
    if (!isGithubHttpsUrl(repoUrl)) {
        return null;
    }

    const token = getAccessTokenForPrivilegedUse();
    if (!token) {
        return null;
    }

    return {
        ...process.env,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
        GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`, 'utf-8').toString('base64')}`
    };
}

function backupWorkspace({ projectDir, backupDir, metadata }) {
    const resolvedProjectDir = path.resolve(projectDir);
    const resolvedBackupDir = path.resolve(backupDir);

    if (isInsidePath(resolvedBackupDir, resolvedProjectDir)) {
        throw new Error('备份目录不能位于项目目录内部。');
    }

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
        const authEnv = args[0] === 'push' ? buildGithubGitAuthEnv(repoUrl) : null;
        const res = runCommand(bin, args, {
            cwd: snapshotDir,
            ...(authEnv ? { env: authEnv } : {})
        });
        resultLog.push({ bin, args, code: res.status, stdout: res.stdout, stderr: res.stderr });
        if (res.status !== 0) {
            break;
        }
    }

    return resultLog;
}

function pushBackupToRepoOutcome(snapshotDir, repoUrl) {
    const logs = pushBackupToRepo(snapshotDir, repoUrl);
    const failedStep = logs.find((entry) => typeof entry.code === 'number' && entry.code !== 0);

    if (!failedStep) {
        return {
            ok: true,
            code: RESULT_CODES.ok,
            category: RESULT_CATEGORIES.runtime,
            userMessage: '备份推送完成。',
            detail: '',
            retryable: false,
            logs
        };
    }

    const detail = String(failedStep.stderr || failedStep.stdout || '').trim();
    const causeMessage = detail || '备份推送失败。';
    return {
        ok: false,
        code: RESULT_CODES.runtimeError,
        category: RESULT_CATEGORIES.runtime,
        userMessage: '备份推送失败。',
        detail,
        retryable: true,
        causes: [{
            message: causeMessage,
            step: `${failedStep.bin} ${Array.isArray(failedStep.args) ? failedStep.args.join(' ') : ''}`.trim(),
            stderr: failedStep.stderr || '',
            stdout: failedStep.stdout || ''
        }],
        rootCause: {
            step: failedStep.bin,
            args: Array.isArray(failedStep.args) ? failedStep.args : [],
            retryable: true
        },
        logs
    };
}

module.exports = {
    backupWorkspace,
    pushBackupToRepo,
    pushBackupToRepoOutcome
};
