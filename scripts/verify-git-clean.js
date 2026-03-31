const { spawnSync } = require('node:child_process');

function checkGitClean({ statusOutput = '' } = {}) {
    const normalized = String(statusOutput || '').trim();
    if (!normalized) {
        return {
            ok: true,
            hasChanges: false,
            message: 'Working tree is clean.'
        };
    }

    const lines = normalized.split(/\r?\n/).filter(Boolean);
    const preview = lines.slice(0, 10).join('\n');

    return {
        ok: false,
        hasChanges: true,
        message: `Working tree is not clean.\n${preview}`
    };
}

function readGitStatusOutput() {
    const result = spawnSync('git', ['status', '--porcelain'], {
        encoding: 'utf8'
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        const stderr = String(result.stderr || '').trim();
        throw new Error(stderr || `git status --porcelain failed with exit code ${result.status}`);
    }

    return String(result.stdout || '');
}

function run() {
    const output = readGitStatusOutput();
    const result = checkGitClean({ statusOutput: output });

    if (!result.ok) {
        throw new Error(result.message);
    }

    return result;
}

if (require.main === module) {
    try {
        run();
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = {
    checkGitClean,
    readGitStatusOutput,
    run
};
