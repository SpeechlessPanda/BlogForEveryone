import test from "node:test";
import assert from "node:assert/strict";

import { createThemeConfigActions } from "./useThemeConfigActions.mjs";

test("theme config actions preserve theme, picker, asset, and preference payloads", async () => {
  const calls = [];
  const api = {
    getThemeConfig: async (payload) => {
      calls.push(["getThemeConfig", payload]);
      return { title: "Demo" };
    },
    validateThemeSettings: async (payload) => {
      calls.push(["validateThemeSettings", payload]);
      return { ok: true, warnings: [] };
    },
    saveThemeConfig: async (payload) => {
      calls.push(["saveThemeConfig", payload]);
      return { ok: true };
    },
    saveThemeLocalAsset: async (payload) => {
      calls.push(["saveThemeLocalAsset", payload]);
      return { webPath: "/img/demo.png" };
    },
    applyThemePreviewOverrides: async (payload) => {
      calls.push(["applyThemePreviewOverrides", payload]);
      return { ok: true };
    },
    getPreferences: async () => {
      calls.push(["getPreferences"]);
      return { autoSyncRssSubscriptions: true };
    },
    savePreferences: async (payload) => {
      calls.push(["savePreferences", payload]);
      return { preferences: payload };
    },
    pickFile: async (payload) => {
      calls.push(["pickFile", payload]);
      return { canceled: false, path: "D:/images/demo.png" };
    },
  };

  const actions = createThemeConfigActions(api);

  await actions.getThemeConfig({ projectDir: "D:/blogs/demo", framework: "hugo" });
  await actions.validateThemeSettings({
    framework: "hugo",
    themeId: "stack",
    basicFields: { siteTitle: "Demo" },
  });
  await actions.saveThemeConfig({
    projectDir: "D:/blogs/demo",
    framework: "hugo",
    nextConfig: { title: "Demo" },
  });
  await actions.saveThemeLocalAsset({
    projectDir: "D:/blogs/demo",
    framework: "hugo",
    localFilePath: "D:/images/demo.png",
    assetType: "background",
    preferredDir: "static/img",
    preferredFileName: "demo.png",
  });
  await actions.applyThemePreviewOverrides({
    projectDir: "D:/blogs/demo",
    framework: "hugo",
    themeId: "stack",
    backgroundImage: "/img/demo.png",
    favicon: "/img/favicon.png",
  });
  await actions.getPreferences();
  await actions.savePreferences({ autoSyncRssSubscriptions: false });
  await actions.pickFile({ title: "选择图片", defaultPath: "D:/images" });

  assert.deepEqual(calls, [
    ["getThemeConfig", { projectDir: "D:/blogs/demo", framework: "hugo" }],
    ["validateThemeSettings", {
      framework: "hugo",
      themeId: "stack",
      basicFields: { siteTitle: "Demo" },
    }],
    ["saveThemeConfig", {
      projectDir: "D:/blogs/demo",
      framework: "hugo",
      nextConfig: { title: "Demo" },
    }],
    ["saveThemeLocalAsset", {
      projectDir: "D:/blogs/demo",
      framework: "hugo",
      localFilePath: "D:/images/demo.png",
      assetType: "background",
      preferredDir: "static/img",
      preferredFileName: "demo.png",
    }],
    ["applyThemePreviewOverrides", {
      projectDir: "D:/blogs/demo",
      framework: "hugo",
      themeId: "stack",
      backgroundImage: "/img/demo.png",
      favicon: "/img/favicon.png",
    }],
    ["getPreferences"],
    ["savePreferences", { autoSyncRssSubscriptions: false }],
    ["pickFile", { title: "选择图片", defaultPath: "D:/images" }],
  ]);
});

test("theme config actions reject missing workspace context for file-backed theme operations", async () => {
  const actions = createThemeConfigActions({
    getThemeConfig: async () => ({}),
    validateThemeSettings: async () => ({}),
    saveThemeConfig: async () => ({}),
    saveThemeLocalAsset: async () => ({}),
    applyThemePreviewOverrides: async () => ({}),
    getPreferences: async () => ({}),
    savePreferences: async () => ({}),
    pickFile: async () => ({}),
  });

  await assert.rejects(
    () => actions.getThemeConfig({ framework: "hugo" }),
    /projectDir/,
  );
  await assert.rejects(
    () => actions.saveThemeConfig({ projectDir: "D:/blogs/demo" }),
    /framework/,
  );
  await assert.rejects(
    () => actions.saveThemeLocalAsset({ projectDir: "D:/blogs/demo" }),
    /framework/,
  );
});
