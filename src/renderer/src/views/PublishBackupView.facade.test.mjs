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
    /publishToGitHub\(\s*\{[\s\S]*projectDir:\s*ws\.projectDir,[\s\S]*framework:\s*ws\.framework,[\s\S]*siteType:\s*publishForm\.siteType,[\s\S]*login:\s*normalizedPublishLogin\.value,[\s\S]*deployRepoName:\s*resolvedDeployRepoName\.value,[\s\S]*backupRepoName:\s*publishForm\.backupRepoName,[\s\S]*repoUrl:\s*deployRepoUrl\.value,[\s\S]*backupRepoUrl:\s*backupRepoUrl\.value,[\s\S]*createDeployRepo:\s*publishForm\.createDeployRepo,[\s\S]*createBackupRepo:\s*publishForm\.createBackupRepo,[\s\S]*backupDir:\s*publishForm\.backupDir,[\s\S]*publishMode:\s*publishForm\.publishMode,[\s\S]*gitUserName:\s*publishForm\.gitUserName,[\s\S]*gitUserEmail:\s*publishForm\.gitUserEmail,[\s\S]*\}\s*\)/,
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

test("PublishBackupView prefers auth login prefill, keeps workspace parsing as fallback, and protects manual login edits", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(source, /const\s+normalizedPublishLogin\s*=\s*computed\(\(\)\s*=>[\s\S]*String\(publishForm\.login\s*\|\|\s*""\)\.trim\(\)[\s\S]*\)/);
  assert.match(source, /const\s+publishLoginManuallyEdited\s*=\s*ref\(false\)/);
  assert.match(source, /function\s+markPublishLoginEdited\(\)\s*\{[\s\S]*publishLoginManuallyEdited\.value\s*=\s*true;[\s\S]*\}/);
  assert.match(source, /function\s+prefillPublishLogin\(login,[\s\S]*\{\s*force\s*=\s*false\s*\}\s*=\s*\{\}\)\s*\{[\s\S]*publishLoginManuallyEdited\.value[\s\S]*if\s*\(!force\s*&&\s*publishForm\.login\)[\s\S]*publishForm\.login\s*=\s*String\(login\s*\|\|\s*""\)\.trim\(\);[\s\S]*\}/);
  assert.match(source, /applyWorkspaceMetadata\(selectedWorkspace\.value,\s*\{\s*authLogin:\s*auth\?\.account\?\.login\s*\|\|\s*""\s*\}\)/);
  assert.match(source, /function\s+applyWorkspaceMetadata\(workspace,\s*\{\s*authLogin\s*=\s*""\s*\}\s*=\s*\{\}\)\s*\{/);
  assert.match(source, /if\s*\(!authLogin\)\s*\{[\s\S]*prefillPublishLogin\(deployRepoMeta\?\.owner\s*\|\|\s*backupRepoMeta\?\.owner\s*\|\|\s*""\)/);
  assert.match(source, /prefillPublishLogin\(auth\?\.account\?\.login,\s*\{\s*force:\s*true\s*\}\)/);
  assert.match(source, /@input="markPublishLoginEdited"/);
  assert.match(source, /resolvedDeployRepoName\s*=\s*computed\(\(\)\s*=>\s*\{[\s\S]*publishForm\.siteType\s*===\s*USER_PAGES[\s\S]*normalizedPublishLogin\.value[\s\S]*`\$\{normalizedPublishLogin\.value\}\.github\.io`[\s\S]*return\s+String\(publishForm\.deployRepoName\s*\|\|\s*""\)\.trim\(\)/);
  assert.doesNotMatch(source, /publishForm\.login\s*=\s*deployRepoMeta\?\.owner\s*\|\|\s*backupRepoMeta\?\.owner\s*\|\|\s*""/);
});

test("PublishBackupView lets auth login correct earlier workspace fallback when the user has not manually edited login", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(source, /prefillPublishLogin\(auth\?\.account\?\.login,\s*\{\s*force:\s*true\s*\}\)/);
  assert.match(source, /function\s+prefillPublishLogin\(login,[\s\S]*\{\s*force\s*=\s*false\s*\}\s*=\s*\{\}\)\s*\{[\s\S]*if\s*\(publishLoginManuallyEdited\.value\)\s*\{[\s\S]*return;[\s\S]*\}[\s\S]*if\s*\(!force\s*&&\s*publishForm\.login\)\s*\{[\s\S]*return;[\s\S]*\}/);
});

test("PublishBackupView re-applies workspace-derived metadata after selected workspace changes", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(source, /import\s*\{\s*computed,\s*reactive,\s*ref,\s*onMounted,\s*watch\s*\}\s*from\s*["']vue["']/);
  assert.match(source, /const\s+authLogin\s*=\s*ref\(""\)/);
  assert.match(source, /const\s+lastWorkspaceMetadataId\s*=\s*ref\(""\)/);
  assert.match(source, /watch\(\s*\(\)\s*=>\s*workspaceState\.selectedWorkspaceId,[\s\S]*applyWorkspaceMetadata\(selectedWorkspace\.value,\s*\{\s*authLogin:\s*authLogin\.value\s*\}\)[\s\S]*\)/);
  assert.match(source, /const\s+workspaceChanged\s*=\s*lastWorkspaceMetadataId\.value\s*&&\s*lastWorkspaceMetadataId\.value\s*!==\s*workspace\.id/);
  assert.match(source, /lastWorkspaceMetadataId\.value\s*=\s*workspace\.id\s*\|\|\s*""/);
  assert.match(source, /if\s*\(!authLogin\)\s*\{[\s\S]*if\s*\(workspaceChanged\s*&&\s*!publishLoginManuallyEdited\.value\)\s*\{[\s\S]*publishForm\.login\s*=\s*"";[\s\S]*\}[\s\S]*prefillPublishLogin\(deployRepoMeta\?\.owner\s*\|\|\s*backupRepoMeta\?\.owner\s*\|\|\s*""\)/);
  assert.match(source, /if\s*\(publishForm\.siteType\s*!==\s*USER_PAGES\s*&&\s*\(!publishForm\.deployRepoName\s*\|\|\s*workspaceChanged\)\)\s*\{[\s\S]*publishForm\.deployRepoName\s*=\s*workspace\.deployRepo\?\.name\s*\|\|\s*"";/);
});

test("PublishBackupView clears stale workspace-derived login and project repo name when selection is cleared before choosing another workspace", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(source, /if\s*\(!workspace\)\s*\{[\s\S]*lastWorkspaceMetadataId\.value\s*=\s*"";[\s\S]*publishForm\.backupRepoName\s*=\s*FIXED_BACKUP_REPO_NAME;/);
  assert.match(source, /if\s*\(!workspace\)\s*\{[\s\S]*if\s*\(!authLogin\s*&&\s*!publishLoginManuallyEdited\.value\)\s*\{[\s\S]*publishForm\.login\s*=\s*"";/);
  assert.match(source, /if\s*\(!workspace\)\s*\{[\s\S]*publishForm\.deployRepoName\s*=\s*"";/);
});

test("PublishBackupView keeps backup repo name fixed to BFE instead of workspace metadata", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(source, /const\s+FIXED_BACKUP_REPO_NAME\s*=\s*"BFE"/);
  assert.match(source, /publishForm\.backupRepoName\s*=\s*FIXED_BACKUP_REPO_NAME;/);
  assert.doesNotMatch(source, /publishForm\.backupRepoName\s*=\s*workspace\.backupRepo\?\.name/);
});

test("PublishBackupView keeps the publish payload unchanged while moving user-pages repo naming into derived UI", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(source, /publishToGitHub\(\s*\{[\s\S]*login:\s*normalizedPublishLogin\.value,[\s\S]*deployRepoName:\s*resolvedDeployRepoName\.value,[\s\S]*backupRepoName:\s*publishForm\.backupRepoName,/);
  assert.match(source, /publishForm\.siteType === USER_PAGES[\s\S]*resolvedDeployRepoName/);
  assert.doesNotMatch(source, /publishToGitHub\(\s*\{[\s\S]*derivedDeployRepoName/);
});
