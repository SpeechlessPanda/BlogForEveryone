import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publishBackupViewPath = new URL("./PublishBackupView.vue", import.meta.url);

test("PublishBackupView uses the unified publish facade instead of split publish and backup calls", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(
    source,
    /import\s*\{\s*usePublishBackupActions\s*\}\s*from\s*["']\.\.\/composables\/usePublishBackupActions\.mjs["']/,
  );
  assert.match(
    source,
    /const\s*\{[\s\S]*publishToGitHub\s*,[\s\S]*pickDirectory\s*,[\s\S]*getGithubAuthState\s*,?[\s\S]*\}\s*=\s*usePublishBackupActions\(\)/,
  );

  const requiredFacadeCalls = [
    "publishToGitHub(",
    "pickDirectory(",
    "getGithubAuthState(",
  ];

  for (const call of requiredFacadeCalls) {
    assert.equal(
      source.includes(call),
      true,
      `expected PublishBackupView.vue to call facade method ${call}`,
    );
  }

  assert.match(
    source,
    /publishToGitHub\(\s*\{[\s\S]*projectDir:\s*ws\.projectDir,[\s\S]*framework:\s*ws\.framework,[\s\S]*siteType:\s*publishForm\.siteType,[\s\S]*login:\s*publishForm\.login,[\s\S]*deployRepoName:\s*resolvedDeployRepoName\.value,[\s\S]*backupRepoName:\s*publishForm\.backupRepoName,[\s\S]*repoUrl:\s*deployRepoUrl\.value,[\s\S]*backupRepoUrl:\s*backupRepoUrl\.value,[\s\S]*createDeployRepo:\s*publishForm\.createDeployRepo,[\s\S]*createBackupRepo:\s*publishForm\.createBackupRepo,[\s\S]*backupDir:\s*publishForm\.backupDir,[\s\S]*publishMode:\s*publishForm\.publishMode,[\s\S]*gitUserName:\s*publishForm\.gitUserName,[\s\S]*gitUserEmail:\s*publishForm\.gitUserEmail,[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /pickDirectory\(\s*\{[\s\S]*title:\s*["']选择本地备份目录["'],[\s\S]*defaultPath:\s*publishForm\.backupDir\s*\|\|\s*undefined,[\s\S]*\}\s*\)/,
  );
  assert.match(source, /const\s+auth\s*=\s*await\s+getGithubAuthState\(\)/);
  assert.match(source, /buildChildOutcomeCards/);
  assert.match(source, /collectOperationMessages/);
  assert.doesNotMatch(source, /JSON\.stringify\(result\.logs \|\| result, null, 2\)/);

  const forbiddenCalls = [
    "publishToGitHub",
    "pickDirectory",
    "getGithubAuthState",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected PublishBackupView.vue to stop calling window.bfeApi.${method}`,
    );
  }

  assert.match(source, /useShellActions/);
  assert.match(source, /auth\?\.account\?\.login/);
  assert.doesNotMatch(source, /auth\?\.user\?\.login/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.match(source, /shellActions\.openTutorial\("publish-release"\)/);
});

test("PublishBackupView reads as a release control center with readiness and result above logs", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(source, /data-page-role="publish"/);
  assert.match(source, /发布控制中心/);
  assert.match(
    source,
    /data-page-layer="primary"[\s\S]*data-page-layer="explanation"[\s\S]*data-page-layer="detail"/,
  );
  assert.match(source, /发布准备度/);
  assert.match(source, /最近结果/);
  assert.match(source, /结构化链路结果/);
  assert.match(source, /data-page-layer="detail"[\s\S]*查看发布日志与链路事件/);
});
