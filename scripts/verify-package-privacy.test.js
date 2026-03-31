const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const readText = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const escapedVersion = packageJson.version.replace(/\./g, '\\.')

test('README top section shows current version and top release link', () => {
    const readme = readText('README.md');

    assert.match(readme, new RegExp(`当前版本：v${escapedVersion}。`));
    assert.match(readme, /最新发布页：<https:\/\/github\.com\/SpeechlessPanda\/BlogForEveryone\/releases>/);
    assert.match(readme, /发布与自动更新指南：\[docs\/guides\/release-signing-auto-update\.md\]/);
    assert.match(readme, /新手发布指南：\[docs\/guides\/blog-publish-pages-beginner\.md\]/);
    assert.match(readme, /GitHub 登录配置：\[docs\/guides\/github-oauth-app-setup\.md\]/);
});

test('publish beginner guide reflects derived user-pages flow and BFE backup guidance', () => {
    const guide = readText('docs/guides/blog-publish-pages-beginner.md');

    assert.match(guide, /用户站点会直接使用 `用户名\.github\.io` 作为发布仓库名/);
    assert.match(guide, /备份仓库固定使用 `BFE`/);
    assert.match(guide, /统一发布与备份/);
});

test('release guide links release page and keeps app release distinct from blog publish', () => {
    const guide = readText('docs/guides/release-signing-auto-update.md');

    assert.match(guide, /最新发布页：<https:\/\/github\.com\/SpeechlessPanda\/BlogForEveryone\/releases>/);
    assert.match(guide, /本指南是“桌面应用本身”的发布流程，不是博客内容发布流程/);
    assert.match(guide, /博客发布请看：docs\/guides\/blog-publish-pages-beginner\.md/);
});

test('release artifact naming stays explicit and consistent across package metadata and docs', () => {
    const readme = readText('README.md');
    const guide = readText('docs/guides/release-signing-auto-update.md');

    assert.equal(packageJson.build?.artifactName, 'BlogForEveryone-Setup-${version}.${ext}');
    assert.match(readme, /BlogForEveryone-Setup x\.y\.z\.exe/);
    assert.match(readme, /BlogForEveryone-Setup x\.y\.z\.exe\.blockmap/);
    assert.match(guide, /BlogForEveryone-Setup x\.y\.z\.exe/);
    assert.match(guide, /BlogForEveryone-Setup x\.y\.z\.exe\.blockmap/);
    assert.match(guide, /latest\.yml/);
});

test('windows release flow enforces signed packaging path', () => {
    assert.equal(packageJson.build?.win?.signAndEditExecutable, true);
    assert.match(packageJson.scripts['package:signed'], /verify:windows-signing-env/);
    assert.equal(packageJson.scripts['verify:git-clean'], 'node scripts/verify-git-clean.js');
    assert.match(packageJson.scripts['verify:release'], /verify:git-clean/);
    assert.match(packageJson.scripts.release, /verify:release/);
    assert.match(packageJson.scripts.release, /--publish always/);
});

test('package privacy verification script exists and reports structured checks', async () => {
    const modulePath = path.join(repoRoot, 'scripts', 'verify-package-privacy.js');
    const privacyModule = require(modulePath);

    assert.equal(typeof privacyModule.verifyPackagePrivacy, 'function');

    const result = await privacyModule.verifyPackagePrivacy({ repoRoot });

    assert.equal(result.ok, true);
    assert.equal(typeof result.ok, 'boolean');
    assert.ok(Array.isArray(result.checks));
    assert.ok(Array.isArray(result.findings));
    assert.equal(result.findings.length, 0);
    assert.ok(result.checks.some((entry) => entry.key === 'build-files-whitelist'));
    assert.ok(result.checks.some((entry) => entry.key === 'runtime-userdata-boundary'));
    assert.ok(result.checks.some((entry) => entry.key === 'sessiondata-boundary'));
    assert.ok(result.checks.some((entry) => entry.key === 'encrypted-auth-storage'));
    assert.ok(result.checks.some((entry) => entry.key === 'sanitize-release-targets'));
    assert.ok(result.checks.some((entry) => entry.key === 'known-test-account-not-packaged-input'));
});
