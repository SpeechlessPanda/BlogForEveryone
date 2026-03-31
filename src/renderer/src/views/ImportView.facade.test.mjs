import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const importViewPath = new URL("./ImportView.vue", import.meta.url);

test("ImportView uses import facade instead of raw window.bfeApi import calls", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.match(
    source,
    /import\s*\{\s*useImportActions\s*\}\s*from\s*["']\.\.\/composables\/useImportActions\.mjs["']/,
  );
  assert.match(
    source,
    /const\s*\{[\s\S]*importWorkspace\s*,[\s\S]*importWorkspaceFromGithub\s*,[\s\S]*listGithubRepos\s*,[\s\S]*pickDirectory\s*,[\s\S]*importSubscriptions\s*[\s\S]*\}\s*=\s*useImportActions\(\)/,
  );

  const requiredFacadeCalls = [
    "importWorkspace(",
    "importWorkspaceFromGithub(",
    "listGithubRepos(",
    "pickDirectory(",
    "importSubscriptions(",
  ];

  for (const call of requiredFacadeCalls) {
    assert.equal(
      source.includes(call),
      true,
      `expected ImportView.vue to call facade method ${call}`,
    );
  }

  assert.match(
    source,
    /importWorkspace\(\s*\{\s*\.\.\.localImportForm\s*\}\s*\)/,
  );
  assert.match(
    source,
    /importWorkspaceFromGithub\(\s*\{[\s\S]*name:\s*githubImportForm\.name,[\s\S]*localDestinationPath:\s*githubImportForm\.localDestinationPath,[\s\S]*siteType:\s*githubImportForm\.siteType,[\s\S]*deployRepo:\s*selectedGithubDeployRepo\.value\s*\|\|\s*undefined,[\s\S]*backupRepo:\s*selectedGithubBackupRepo\.value,[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /listGithubRepos\(/,
  );
  assert.match(
    source,
    /pickDirectory\(\s*\{[\s\S]*title:\s*["']选择已存在的博客工程目录["'],[\s\S]*defaultPath:\s*localImportForm\.projectDir\s*\|\|\s*undefined,[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /pickDirectory\(\s*\{[\s\S]*title:\s*["']选择 GitHub 恢复目标目录["'],[\s\S]*defaultPath:\s*githubImportForm\.localDestinationPath\s*\|\|\s*undefined,[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /importSubscriptions\(\s*\{[\s\S]*projectDir:\s*localImportForm\.projectDir,[\s\S]*strategy:\s*["']merge["'],[\s\S]*\}\s*\)/,
  );
  assert.doesNotMatch(source, /zip/i);
  assert.match(source, /collectOperationMessages/);

  const forbiddenCalls = [
    "importWorkspace",
    "importWorkspaceFromGithub",
    "listGithubRepos",
    "pickDirectory",
    "importSubscriptions",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected ImportView.vue to stop calling window.bfeApi.${method}`,
    );
  }

  assert.match(source, /useShellActions/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.match(source, /shellActions\.openTutorial\("import-recovery"\)/);
  assert.match(source, /shellActions\.openTab\("workspace"\)/);
});

test("ImportView reads as the secondary entry path with guidance back into the main workflow", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.match(source, /data-page-role="import"/);
  assert.match(
    source,
    /data-page-layer="primary"[\s\S]*data-page-layer="explanation"[\s\S]*data-page-layer="detail"/,
  );
  assert.match(source, /次级入口/);
  assert.match(source, /接回主流程/);
  assert.match(source, /建议下一步/);
  assert.match(source, /GitHub 仓库列表/);
});

test("ImportView derives exact GitHub repo autodetect from auth login without overriding manual recovery choices", async () => {
  const source = await readFile(importViewPath, "utf8");
  const syncFunction = source.match(
    /function syncExactGithubRepoAutodetect\(\) \{[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(syncFunction, "expected ImportView.vue to define syncExactGithubRepoAutodetect()");

  assert.match(source, /shellActions\.getGithubAuthState\(\)/);
  assert.match(source, /authState\?\.account\?\.login/);
  assert.match(source, /repo\.name === deployRepoName/);
  assert.match(source, /repo\.name === "BFE"/);
  assert.match(source, /deployRepoMatches\.length === 1/);
  assert.match(source, /backupRepoMatches\.length === 1/);
  assert.match(source, /githubImportManualState = reactive\(\{[\s\S]*siteType:\s*false,[\s\S]*deployRepo:\s*false,[\s\S]*backupRepo:\s*false,[\s\S]*localDestinationPath:\s*false,[\s\S]*\}\)/);
  assert.match(source, /githubImportAutoSelection\.deployRepoUrl = uniqueDeployRepo\?\.url \|\| ""/);
  assert.match(source, /githubImportAutoSelection\.backupRepoUrl = uniqueBackupRepo\?\.url \|\| ""/);
  assert.match(source, /!githubImportManualState\.deployRepo[\s\S]*!githubImportForm\.deployRepoUrl \|\| githubImportForm\.deployRepoUrl === previousDeployRepoUrl[\s\S]*githubImportForm\.deployRepoUrl = githubImportAutoSelection\.deployRepoUrl/);
  assert.match(source, /!githubImportManualState\.backupRepo[\s\S]*!githubImportForm\.backupRepoUrl \|\| githubImportForm\.backupRepoUrl === previousBackupRepoUrl[\s\S]*githubImportForm\.backupRepoUrl = githubImportAutoSelection\.backupRepoUrl/);
  assert.match(source, /uniqueDeployRepo[\s\S]*!githubImportManualState\.siteType[\s\S]*!githubImportManualState\.deployRepo[\s\S]*githubImportForm\.siteType = "user-pages"/);
  assert.match(source, /!uniqueDeployRepo[\s\S]*!githubImportManualState\.siteType[\s\S]*!githubImportManualState\.deployRepo[\s\S]*githubImportForm\.siteType === "user-pages"[\s\S]*githubImportForm\.siteType = "project-pages"/);
  assert.match(source, /@change="markGithubSiteTypeManual"/);
  assert.match(source, /@change="markGithubDeployRepoManual"/);
  assert.match(source, /@change="markGithubBackupRepoManual"/);
  assert.match(source, /@input="markGithubLocalDestinationManual"/);
  assert.doesNotMatch(source, /githubRepos\.value\.find\(\(repo\) => repo\.name === "BFE"\)/);
  assert.match(source, /deployRepo:\s*selectedGithubDeployRepo\.value \|\| undefined/);
  assert.match(source, /backupRepo:\s*selectedGithubBackupRepo\.value/);
  assert.doesNotMatch(syncFunction, /localDestinationPath/);
});

test("ImportView keeps manual repo URL fallback usable when repo list cannot be loaded", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.match(source, /function\s+parseGithubRepo\(repoUrl\)/);
  assert.match(source, /selectedGithubDeployRepo\s*=\s*computed\([\s\S]*parseGithubRepo\(githubImportForm\.deployRepoUrl\)/);
  assert.match(source, /selectedGithubBackupRepo\s*=\s*computed\([\s\S]*parseGithubRepo\(githubImportForm\.backupRepoUrl\)/);
  assert.match(source, /const githubRepoLoadFailed = ref\(false\)/);
  assert.match(source, /const githubBackupRepoChoices = computed\(\(\) => githubRepos\.value\)/);
  assert.match(source, /githubRepoLoadFailed\.value = false[\s\S]*githubRepos\.value = Array\.isArray\(repos\)/);
  assert.match(source, /catch\s*\(error\)\s*\{[\s\S]*githubRepoLoadFailed\.value = true;[\s\S]*githubRepos\.value = \[\];[\s\S]*syncExactGithubRepoAutodetect\(\);[\s\S]*githubRepoSummary\.value/);
  assert.match(source, /if \(githubRepoLoadFailed\.value\) \{[\s\S]*可手动填写恢复仓库地址继续操作/);
  assert.match(source, /hasExactBackupRepoAutodetect\.value[\s\S]*发布仓库没有唯一精确匹配[\s\S]*可继续手动选择/);
  assert.match(source, /!githubBackupRepoChoices\.value\.length[\s\S]*未读取到仓库列表时，可直接手动填写恢复源仓库地址继续恢复/);
  assert.match(source, /@input="markGithubDeployRepoManual"/);
  assert.match(source, /@input="markGithubBackupRepoManual"/);
  assert.doesNotMatch(source, /备份仓库必须为 BFE/);
});

test("ImportView does not hard-block manually entered non-BFE backup repo before submit", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.doesNotMatch(source, /String\(selectedGithubBackupRepo\.value\.name \|\| ""\)\.trim\(\)\.toLowerCase\(\)\s*!==\s*"bfe"/);
  assert.match(source, /backupRepo:\s*selectedGithubBackupRepo\.value/);
});
