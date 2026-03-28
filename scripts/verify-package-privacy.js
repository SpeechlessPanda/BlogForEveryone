const fs = require('node:fs');
const path = require('node:path');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function createCheck(key, ok, detail) {
    return { key, ok, detail };
}

async function verifyPackagePrivacy({ repoRoot = process.cwd() } = {}) {
    const packageJson = readJson(path.join(repoRoot, 'package.json'));
    const sanitizeReleaseSource = readText(path.join(repoRoot, 'scripts', 'sanitize-release.js'));
    const storeServiceSource = readText(path.join(repoRoot, 'src', 'main', 'services', 'storeService.js'));
    const githubAuthServiceSource = readText(path.join(repoRoot, 'src', 'main', 'services', 'githubAuthService.js'));
    const mainProcessSource = readText(path.join(repoRoot, 'src', 'main', 'main.js'));

    const buildFiles = Array.isArray(packageJson.build?.files) ? packageJson.build.files : [];
    const buildFilesText = buildFiles.join('\n');
    const checks = [];

    checks.push(
        createCheck(
            'build-files-whitelist',
            !/userData|\.tmp-user-data|\.bfe|test-results|e2e-real-workspaces|session-third\.md/i.test(buildFilesText),
            'package.json build.files does not whitelist runtime user data, fixture data, or obvious local residue.'
        )
    );

    checks.push(
        createCheck(
            'runtime-userdata-boundary',
            /app\.getPath\('userData'\)/.test(storeServiceSource) && /bfe-data/.test(storeServiceSource),
            'Runtime app data is stored under app.getPath(\'userData\')/bfe-data rather than packaged assets.'
        )
    );

    checks.push(
        createCheck(
            'sessiondata-boundary',
            /app\.setPath\('sessionData'\s*,\s*path\.join\(app\.getPath\('userData'\),\s*'session-data'\)\)/.test(mainProcessSource),
            'Electron sessionData is redirected under userData, outside packaged release inputs.'
        )
    );

    checks.push(
        createCheck(
            'encrypted-auth-storage',
            /(safeStorage|secureStorage)\.encryptString/.test(storeServiceSource)
                && /(safeStorage|secureStorage)\.decryptString/.test(storeServiceSource)
                && /readGithubAccessToken/.test(githubAuthServiceSource)
                && /saveGithubAuthSession/.test(storeServiceSource),
            'GitHub auth/session storage uses encrypted store ciphertext rather than bundling plaintext token files.'
        )
    );

    checks.push(
        createCheck(
            'sanitize-release-targets',
            /builder-debug\.yml/.test(sanitizeReleaseSource)
                && /builder-effective-config\.yaml/.test(sanitizeReleaseSource)
                && /subscriptions\.bundle\.json/.test(sanitizeReleaseSource)
                && /metadata\.json/.test(sanitizeReleaseSource)
                && /db\.json/.test(sanitizeReleaseSource)
                && /auth\.json/.test(sanitizeReleaseSource)
                && /token\.txt/.test(sanitizeReleaseSource),
            'sanitize-release removes known sensitive files and build residue before packaging.'
        )
    );

    checks.push(
        createCheck(
            'known-test-account-not-packaged-input',
            !/editorial-e2e|speechlesspanda/i.test(buildFilesText),
            'Packaging inputs do not explicitly whitelist known test-account fixture directories or release-only residue.'
        )
    );

    const findings = checks.filter((entry) => !entry.ok).map((entry) => ({
        key: entry.key,
        message: entry.detail
    }));

    return {
        ok: findings.length === 0,
        checks,
        findings
    };
}

async function main() {
    const result = await verifyPackagePrivacy();
    if (!result.ok) {
        console.error(JSON.stringify(result, null, 2));
        process.exitCode = 1;
        return;
    }
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error?.stack || String(error));
        process.exitCode = 1;
    });
}

module.exports = {
    verifyPackagePrivacy
};
