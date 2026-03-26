const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'e2e-real-workspaces', 'manifest.json');

function runScript(scriptName) {
    return spawnSync(process.execPath, [path.join(__dirname, scriptName)], {
        cwd: ROOT,
        stdio: 'inherit',
        windowsHide: true
    });
}

async function runVerifyWorkspaceForTests() {
    if (fs.existsSync(MANIFEST_PATH)) {
        fs.unlinkSync(MANIFEST_PATH);
    }

    const prepare = runScript('e2e-real-workspace-prepare.js');
    const prepareCode = typeof prepare.status === 'number' ? prepare.status : 1;
    if (prepareCode !== 0) {
        return prepareCode;
    }

    if (!fs.existsSync(MANIFEST_PATH)) {
        process.stderr.write(`VERIFY_REAL_WORKSPACE_MANIFEST_MISSING path=${MANIFEST_PATH}\n`);
        return 1;
    }

    const verify = runScript('e2e-real-workspace-verify.js');
    return typeof verify.status === 'number' ? verify.status : 1;
}

module.exports = {
    runVerifyWorkspaceForTests,
    runScript,
    MANIFEST_PATH,
    ROOT
};

if (require.main === module) {
    runVerifyWorkspaceForTests()
        .then((code) => {
            process.exitCode = code;
        })
        .catch((error) => {
            process.stderr.write(`${error && error.stack ? error.stack : String(error)}\n`);
            process.exitCode = 1;
        });
}
