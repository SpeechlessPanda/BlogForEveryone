import test from "node:test";
import assert from "node:assert/strict";

import { createShellActions } from "./useShellActions.mjs";

test("shell actions preserve app/auth/update/env/preferences/rss contracts", async () => {
  const calls = [];
  const release = Symbol("release");
  const api = {
    getAppState: async () => {
      calls.push(["getAppState"]);
      return { appName: "BlogForEveryone", version: "1.1.0" };
    },
    getEnvironmentStatus: async () => {
      calls.push(["getEnvironmentStatus"]);
      return { ready: true };
    },
    getUpdateState: async () => {
      calls.push(["getUpdateState"]);
      return { status: "idle" };
    },
    getPreferences: async () => {
      calls.push(["getPreferences"]);
      return { launchAtStartup: true };
    },
    savePreferences: async (payload) => {
      calls.push(["savePreferences", payload]);
      return { preferences: payload };
    },
    getRssUnreadSummary: async () => {
      calls.push(["getRssUnreadSummary"]);
      return { totalUnread: 3 };
    },
    checkUpdatesNow: async () => {
      calls.push(["checkUpdatesNow"]);
      return { ok: true };
    },
    installUpdateNow: async () => {
      calls.push(["installUpdateNow"]);
      return { ok: true };
    },
    openInstaller: async (payload) => {
      calls.push(["openInstaller", payload]);
      return { url: "https://example.com/node" };
    },
    ensurePnpm: async () => {
      calls.push(["ensurePnpm"]);
      return { logs: [] };
    },
    autoInstallTool: async (payload) => {
      calls.push(["autoInstallTool", payload]);
      return { ok: true };
    },
    getGithubAuthState: async () => {
      calls.push(["getGithubAuthState"]);
      return { isLoggedIn: true };
    },
    beginGithubDeviceLogin: async (payload) => {
      calls.push(["beginGithubDeviceLogin", payload]);
      return { deviceCode: "device", userCode: "CODE" };
    },
    completeGithubDeviceLogin: async (payload) => {
      calls.push(["completeGithubDeviceLogin", payload]);
      return { user: { login: "demo" } };
    },
    githubLogout: async () => {
      calls.push(["githubLogout"]);
      return { ok: true };
    },
    onUpdateStatus: (handler) => {
      calls.push(["onUpdateStatus", handler]);
      return release;
    },
  };

  const actions = createShellActions(api);

  assert.deepEqual(await actions.getAppState(), await api.getAppState());
  assert.deepEqual(
    await actions.getEnvironmentStatus(),
    await api.getEnvironmentStatus(),
  );
  assert.deepEqual(await actions.getUpdateState(), await api.getUpdateState());
  assert.deepEqual(await actions.getPreferences(), await api.getPreferences());
  assert.deepEqual(
    await actions.savePreferences({ launchAtStartup: false }),
    { preferences: { launchAtStartup: false } },
  );
  assert.deepEqual(
    await actions.getRssUnreadSummary(),
    await api.getRssUnreadSummary(),
  );
  await actions.checkUpdatesNow();
  await actions.installUpdateNow();
  await actions.openInstaller({ tool: "node" });
  await actions.ensurePnpm();
  await actions.autoInstallTool({ tool: "git" });
  assert.deepEqual(
    await actions.getGithubAuthState(),
    await api.getGithubAuthState(),
  );
  await actions.beginGithubDeviceLogin({ clientId: "Iv1.demo", scope: "repo" });
  await actions.completeGithubDeviceLogin({
    clientId: "Iv1.demo",
    deviceCode: "device",
    interval: 5,
    expiresIn: 900,
  });
  await actions.githubLogout();
  assert.equal(actions.onUpdateStatus(() => {}), release);

  assert.deepEqual(calls.map(([name]) => name), [
    "getAppState",
    "getAppState",
    "getEnvironmentStatus",
    "getEnvironmentStatus",
    "getUpdateState",
    "getUpdateState",
    "getPreferences",
    "getPreferences",
    "savePreferences",
    "getRssUnreadSummary",
    "getRssUnreadSummary",
    "checkUpdatesNow",
    "installUpdateNow",
    "openInstaller",
    "ensurePnpm",
    "autoInstallTool",
    "getGithubAuthState",
    "getGithubAuthState",
    "beginGithubDeviceLogin",
    "completeGithubDeviceLogin",
    "githubLogout",
    "onUpdateStatus",
  ]);
});
