import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const themeConfigViewPath = new URL("./ThemeConfigView.vue", import.meta.url);

test("ThemeConfigView uses theme facade instead of raw window.bfeApi theme/picker calls", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");

  assert.match(source, /useThemeConfigActions/);
  assert.match(
    source,
    /const\s+themeConfigActions\s*=\s*useThemeConfigActions\(\)/,
  );

  const requiredFacadeCalls = [
    "getThemeConfig",
    "validateThemeSettings",
    "saveThemeConfig",
    "saveThemeLocalAsset",
    "applyThemePreviewOverrides",
    "getPreferences",
    "savePreferences",
    "pickFile",
  ];

  for (const method of requiredFacadeCalls) {
    assert.match(
      source,
      new RegExp(`themeConfigActions\\.${method}\\s*\\(`),
      `expected ThemeConfigView.vue to call facade method themeConfigActions.${method}(...)`,
    );
  }

  const forbiddenCalls = [
    "getThemeConfig",
    "validateThemeSettings",
    "saveThemeConfig",
    "saveThemeLocalAsset",
    "applyThemePreviewOverrides",
    "getPreferences",
    "savePreferences",
    "pickFile",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected ThemeConfigView.vue to stop calling window.bfeApi.${method}`,
    );
  }

  assert.equal(
    source.includes("window.bfeApi"),
    false,
    "expected ThemeConfigView.vue to keep all bridge I/O behind useThemeConfigActions",
  );
});

test("ThemeConfigView presents the brand-workspace hierarchy while keeping advanced config secondary", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");

  assert.match(source, /data-page-role="theme-config"/);
  assert.match(source, /data-theme-surface="editorial-studio"/);
  assert.match(
    source,
    /data-theme-zone="identity-rhythm"[\s\S]*data-theme-zone="asset-studio"[\s\S]*data-theme-zone="advanced-config"/,
  );
  assert.match(source, /品牌与外观工作台/);
  assert.match(
    source,
    /data-page-layer="primary"[\s\S]*data-page-layer="explanation"[\s\S]*data-page-layer="detail"/,
  );
  assert.match(source, /高级与原始配置属于次级区域/);
  assert.match(
    source,
    /data-page-layer="detail"[\s\S]*主题专属高级配置[\s\S]*全部配置项/,
  );
});
