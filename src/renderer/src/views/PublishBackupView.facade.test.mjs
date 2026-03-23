import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publishBackupViewPath = new URL("./PublishBackupView.vue", import.meta.url);

test("PublishBackupView uses publish/backup facade instead of raw window.bfeApi publish calls", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(
    source,
    /import\s*\{\s*usePublishBackupActions\s*\}\s*from\s*["']\.\.\/composables\/usePublishBackupActions\.mjs["']/,
  );
  assert.match(
    source,
    /const\s*\{[\s\S]*publishToGitHub\s*,[\s\S]*backupWorkspace\s*,[\s\S]*pickDirectory\s*,[\s\S]*getGithubAuthState\s*,?[\s\S]*\}\s*=\s*usePublishBackupActions\(\)/,
  );

  const requiredFacadeCalls = [
    "publishToGitHub(",
    "backupWorkspace(",
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
    /publishToGitHub\(\s*\{[\s\S]*projectDir:\s*ws\.projectDir,[\s\S]*framework:\s*ws\.framework,[\s\S]*repoUrl:\s*publishForm\.repoUrl,[\s\S]*publishMode:\s*publishForm\.publishMode,[\s\S]*gitUserName:\s*publishForm\.gitUserName,[\s\S]*gitUserEmail:\s*publishForm\.gitUserEmail,[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /backupWorkspace\(\s*\{[\s\S]*projectDir:\s*ws\.projectDir,[\s\S]*backupDir:\s*backupForm\.backupDir,[\s\S]*repoUrl:\s*backupForm\.backupRepoUrl,[\s\S]*visibility:\s*backupForm\.visibility,[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /pickDirectory\(\s*\{[\s\S]*title:\s*["']选择备份目录["'],[\s\S]*defaultPath:\s*backupForm\.backupDir\s*\|\|\s*undefined,[\s\S]*\}\s*\)/,
  );
  assert.match(source, /const\s+auth\s*=\s*await\s+getGithubAuthState\(\)/);

  const forbiddenCalls = [
    "publishToGitHub",
    "backupWorkspace",
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

  assert.match(source, /auth\?\.account\?\.login/);
  assert.doesNotMatch(source, /auth\?\.user\?\.login/);
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
  assert.match(source, /data-page-layer="detail"[\s\S]*查看发布日志与链路事件/);
});
