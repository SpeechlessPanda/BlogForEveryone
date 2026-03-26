import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const themeConfigViewPath = new URL("./ThemeConfigView.vue", import.meta.url);
const themeAdvancedConfigSectionPath = new URL(
  "../components/theme-config/ThemeAdvancedConfigSection.vue",
  import.meta.url,
);

test("ThemeConfigView uses theme facade instead of raw window.bfeApi theme/picker calls", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");

  assert.match(source, /useThemeConfigActions/);
  assert.match(source, /useShellActions/);
  assert.match(source, /const shellActions = useShellActions\(\)/);
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

  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tab"/);
  assert.match(source, /shellActions\.openTutorial\("theme-config"\)/);
  assert.match(source, /shellActions\.openTab\("preview"\)/);
});

test("ThemeConfigView presents the brand-workspace hierarchy while keeping advanced config secondary", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");
  const advancedSectionSource = await readFile(themeAdvancedConfigSectionPath, "utf8");

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
  assert.match(source, /<ThemeAdvancedConfigSection[\s\S]*data-theme-zone="advanced-config"/);
  assert.match(advancedSectionSource, /高级与原始配置属于次级区域/);
  assert.match(
    advancedSectionSource,
    /主题专属高级配置[\s\S]*全部配置项/,
  );
});

test("ThemeConfigView delegates the first extracted theme-config sections instead of keeping them inline", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");

  assert.match(source, /import\s+ThemeIdentitySection\s+from\s+"\.\.\/components\/theme-config\/ThemeIdentitySection\.vue"/);
  assert.match(source, /import\s+ThemeAssetStudioSection\s+from\s+"\.\.\/components\/theme-config\/ThemeAssetStudioSection\.vue"/);
  assert.match(source, /import\s+ThemeAdvancedConfigSection\s+from\s+"\.\.\/components\/theme-config\/ThemeAdvancedConfigSection\.vue"/);

  assert.match(source, /<ThemeIdentitySection[\s\S]*\/>/);
  assert.match(source, /<ThemeAssetStudioSection[\s\S]*\/>/);
  assert.match(source, /<ThemeAdvancedConfigSection[\s\S]*\/>/);

  assert.equal(source.includes("博客基础信息"), false);
  assert.equal(source.includes("转存并应用博客图标"), false);
  assert.equal(source.includes("全部配置项"), false);
  assert.equal(source.includes("const assetPreview = reactive"), false);
  assert.equal(source.includes("const faviconUploadPath = ref"), false);
  assert.equal(source.includes("const faviconPreferredFileName = ref"), false);
  assert.equal(source.includes("function openAssetPreview"), false);
  assert.equal(source.includes("function closeAssetPreview"), false);
  assert.equal(source.includes("function setFaviconUploadPath"), false);
  assert.equal(source.includes("function setFaviconPreferredFileName"), false);

  assert.match(source, /:set-pending-supported-theme-id="setPendingSupportedThemeId"/);
  assert.match(source, /:pick-favicon-image-file="pickFaviconImageFile"/);
  assert.match(source, /:upload-local-favicon="uploadLocalFavicon"/);
});
