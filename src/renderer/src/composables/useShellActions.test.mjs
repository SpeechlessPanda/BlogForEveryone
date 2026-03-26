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

test("shell actions expose bfe custom-event listener bridges with release callbacks", () => {
  const api = {
    onUpdateStatus: () => {},
  };
  const listenerCalls = [];
  const fakeWindow = {
    addEventListener: (eventName, handler) => {
      listenerCalls.push(["add", eventName, handler]);
    },
    removeEventListener: (eventName, handler) => {
      listenerCalls.push(["remove", eventName, handler]);
    },
  };

  const actions = createShellActions(api, fakeWindow);
  const tutorialHandler = () => {};
  const tabHandler = () => {};
  const rssHandler = () => {};

  const releaseTutorial = actions.onOpenTutorial(tutorialHandler);
  const releaseTab = actions.onOpenTab(tabHandler);
  const releaseRss = actions.onRssUpdated(rssHandler);

  assert.equal(typeof releaseTutorial, "function");
  assert.equal(typeof releaseTab, "function");
  assert.equal(typeof releaseRss, "function");

  releaseTutorial();
  releaseTab();
  releaseRss();

  assert.deepEqual(listenerCalls, [
    ["add", "bfe:open-tutorial", tutorialHandler],
    ["add", "bfe:open-tab", tabHandler],
    ["add", "bfe:rss-updated", rssHandler],
    ["remove", "bfe:open-tutorial", tutorialHandler],
    ["remove", "bfe:open-tab", tabHandler],
    ["remove", "bfe:rss-updated", rssHandler],
  ]);
});

test("shell actions expose openTutorial and openTab as centralized navigation emitters", () => {
  const dispatchCalls = [];
  const customEvents = [];

  class FakeCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
      customEvents.push([type, options.detail]);
    }
  }

  const fakeWindow = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: (event) => {
      dispatchCalls.push(event);
      return true;
    },
    CustomEvent: FakeCustomEvent,
  };

  const actions = createShellActions({ onUpdateStatus: () => {} }, fakeWindow);

  actions.openTutorial();
  actions.openTab("theme");

  assert.deepEqual(customEvents, [
    ["bfe:open-tutorial", undefined],
    ["bfe:open-tab", { tabKey: "theme" }],
  ]);
  assert.equal(dispatchCalls.length, 2);
  assert.equal(dispatchCalls[0].type, "bfe:open-tutorial");
  assert.equal(dispatchCalls[1].type, "bfe:open-tab");
  assert.deepEqual(dispatchCalls[1].detail, { tabKey: "theme" });
});

test("shell actions expose shell utility wrappers for timers confirm and clipboard", async () => {
  const timerCalls = [];
  const intervalCalls = [];
  const clearCalls = [];
  const confirmCalls = [];
  const clipboardCalls = [];
  const timeoutToken = Symbol("timeout");
  const intervalToken = Symbol("interval");

  const fakeWindow = {
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: (handler, delay) => {
      timerCalls.push([handler, delay]);
      return timeoutToken;
    },
    setInterval: (handler, delay) => {
      intervalCalls.push([handler, delay]);
      return intervalToken;
    },
    clearInterval: (token) => {
      clearCalls.push(token);
    },
    confirm: (message) => {
      confirmCalls.push(message);
      return true;
    },
    navigator: {
      clipboard: {
        writeText: async (text) => {
          clipboardCalls.push(text);
        },
      },
    },
  };

  const actions = createShellActions({ onUpdateStatus: () => {} }, fakeWindow);
  const timeoutHandler = () => {};
  const intervalHandler = () => {};

  assert.equal(actions.setTimeout(timeoutHandler, 1400), timeoutToken);
  assert.equal(actions.setInterval(intervalHandler, 30000), intervalToken);
  actions.clearInterval(intervalToken);
  assert.equal(actions.confirm("confirm message"), true);
  await actions.copyToClipboard("USER-CODE");

  assert.deepEqual(timerCalls, [[timeoutHandler, 1400]]);
  assert.deepEqual(intervalCalls, [[intervalHandler, 30000]]);
  assert.deepEqual(clearCalls, [intervalToken]);
  assert.deepEqual(confirmCalls, ["confirm message"]);
  assert.deepEqual(clipboardCalls, ["USER-CODE"]);
});
