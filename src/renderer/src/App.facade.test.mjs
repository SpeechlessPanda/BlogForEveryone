import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appPath = new URL("./App.vue", import.meta.url);

test("App uses shell composable and thin shell components instead of raw window.bfeApi shell calls", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /useAppShell/);
  assert.match(source, /WorkflowSidebar/);
  assert.match(source, /WorkflowSummary/);
  assert.match(source, /SystemStatusPanel/);
  assert.match(source, /ShellModalLayer/);

  const forbiddenInlineShellPresentation = [
    "GitHub 登录（OAuth 设备码）",
    "modal-backdrop",
    "device-code-card",
    "当前设备码",
  ];

  for (const snippet of forbiddenInlineShellPresentation) {
    assert.equal(
      source.includes(snippet),
      false,
      `expected App.vue to avoid inline shell presentation: ${snippet}`,
    );
  }

  const forbiddenCalls = [
    "getAppState",
    "getEnvironmentStatus",
    "getUpdateState",
    "getPreferences",
    "savePreferences",
    "getRssUnreadSummary",
    "checkUpdatesNow",
    "installUpdateNow",
    "openInstaller",
    "ensurePnpm",
    "autoInstallTool",
    "getGithubAuthState",
    "beginGithubDeviceLogin",
    "completeGithubDeviceLogin",
    "githubLogout",
    "onUpdateStatus",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected App.vue to stop calling window.bfeApi.${method}`,
    );
  }
});
