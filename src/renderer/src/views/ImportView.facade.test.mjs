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
