import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publishBackupViewPath = new URL("./PublishBackupView.vue", import.meta.url);

test("PublishBackupView uses publish/backup facade instead of raw window.bfeApi publish calls", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(source, /usePublishBackupActions/);

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
