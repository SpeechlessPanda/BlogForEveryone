const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHECK_SCRIPT_PATH = path.join(__dirname, 'check-node-coverage.js');

function runCoverageOnceForTests() {
    const testRun = spawnSync(process.execPath, ['--test', '--experimental-test-coverage'], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true
    });

    const testStdout = typeof testRun.stdout === 'string' ? testRun.stdout : (testRun.stdout || Buffer.alloc(0)).toString('utf8');
    const testStderr = typeof testRun.stderr === 'string' ? testRun.stderr : (testRun.stderr || Buffer.alloc(0)).toString('utf8');
    process.stdout.write(testStdout);
    process.stderr.write(testStderr);

    const checkerRun = spawnSync(process.execPath, [CHECK_SCRIPT_PATH], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        input: `${testStdout}${testStderr}`
    });

    const checkerStdout = typeof checkerRun.stdout === 'string' ? checkerRun.stdout : (checkerRun.stdout || Buffer.alloc(0)).toString('utf8');
    const checkerStderr = typeof checkerRun.stderr === 'string' ? checkerRun.stderr : (checkerRun.stderr || Buffer.alloc(0)).toString('utf8');
    process.stdout.write(checkerStdout);
    process.stderr.write(checkerStderr);

    const testCode = typeof testRun.status === 'number' ? testRun.status : 1;
    const checkCode = typeof checkerRun.status === 'number' ? checkerRun.status : 1;
    if (testCode !== 0) {
        return testCode;
    }
    if (checkCode !== 0) {
        return checkCode;
    }
    return 0;
}

async function main() {
    return runCoverageOnceForTests();
}

module.exports = {
    runCoverageOnceForTests,
    CHECK_SCRIPT_PATH,
    ROOT
};

if (require.main === module) {
    main()
        .then((code) => {
            process.exitCode = code;
        })
        .catch((error) => {
            process.stderr.write(`${error && error.stack ? error.stack : String(error)}\n`);
            process.exitCode = 1;
        });
}
