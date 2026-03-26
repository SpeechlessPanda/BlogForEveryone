import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const themeConfigViewPath = new URL("./ThemeConfigView.vue", import.meta.url);
const themeIdentitySectionPath = new URL(
  "../components/theme-config/ThemeIdentitySection.vue",
  import.meta.url,
);
const themeAssetStudioSectionPath = new URL(
  "../components/theme-config/ThemeAssetStudioSection.vue",
  import.meta.url,
);
const themeAdvancedConfigSectionPath = new URL(
  "../components/theme-config/ThemeAdvancedConfigSection.vue",
  import.meta.url,
);

test("ThemeConfigView establishes a clearer editorial studio rhythm for brand-first work", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");
  const identitySectionSource = await readFile(themeIdentitySectionPath, "utf8");
  const assetSectionSource = await readFile(themeAssetStudioSectionPath, "utf8");

  const requiredHooks = [
    'data-theme-surface="editorial-studio"',
    'data-theme-zone="identity-rhythm"',
    'data-theme-zone="asset-studio"',
    'data-theme-zone="reading-rhythm"',
    'data-theme-zone="theme-quiet-controls"',
    'data-theme-zone="advanced-config"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected ThemeConfigView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(identitySectionSource, /品牌识别先行/);
  assert.match(assetSectionSource, /视觉素材台/);
  assert.match(source, /阅读节奏微调/);
  assert.match(
    source,
    /data-theme-zone="identity-rhythm"[\s\S]*data-theme-zone="asset-studio"[\s\S]*data-theme-zone="reading-rhythm"/,
  );
});

test("ThemeConfigView removes duplicated hero summary cards and adds enlargeable asset previews", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");
  const identitySectionSource = await readFile(themeIdentitySectionPath, "utf8");
  const assetSectionSource = await readFile(themeAssetStudioSectionPath, "utf8");
  const advancedSectionSource = await readFile(themeAdvancedConfigSectionPath, "utf8");

  assert.match(source, /品牌主叙事/);
  assert.match(assetSectionSource, /素材状态一览/);
  assert.equal(
    source.includes('class="theme-studio-hero-note"'),
    false,
    "expected ThemeConfigView hero to stop rendering stacked right-side note cards",
  );
  assert.doesNotMatch(
    identitySectionSource,
    /theme-studio-heading[\s\S]*<aside class="theme-studio-note/,
    "expected ThemeIdentitySection heading note to move below the heading row",
  );
  assert.doesNotMatch(
    assetSectionSource,
    /theme-studio-heading[\s\S]*<aside class="theme-studio-note/,
    "expected ThemeAssetStudioSection heading note to move below the heading row",
  );

  for (const currentSource of [
    source,
    identitySectionSource,
    assetSectionSource,
    advancedSectionSource,
  ]) {
    assert.equal(currentSource.includes("page-hero-aside"), false);
    assert.equal(currentSource.includes("page-status-grid"), false);
  }

  assert.match(assetSectionSource, /data-theme-zone="asset-studio"[\s\S]*<img/);
  assert.match(assetSectionSource, /<(dialog|Teleport)[\s\S]*(asset|preview).*(lightbox|dialog)/i);
  assert.match(source, /主题细节（可选，后置）/);
  assert.match(advancedSectionSource, /原始配置抽屉/);
  assert.match(
    source,
    /data-page-layer="explanation"[\s\S]*data-theme-zone="theme-quiet-controls"[\s\S]*保存与确认/,
  );
  assert.match(
    advancedSectionSource,
    /data-theme-zone="advanced-config"[\s\S]*高级与原始配置属于次级区域/,
  );
});

test("ThemeConfigView redesign keeps the theme facade boundary intact", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");

  assert.match(source, /useThemeConfigActions/);
  assert.match(
    source,
    /const\s+themeConfigActions\s*=\s*useThemeConfigActions\(\)/,
  );
  assert.equal(source.includes("window.bfeApi"), false);
});

test("ThemeConfigView extracts identity, asset, and advanced sections behind dedicated section components", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");

  assert.match(source, /<ThemeIdentitySection[\s\S]*data-theme-zone="identity-rhythm"/);
  assert.match(source, /<ThemeAssetStudioSection[\s\S]*data-theme-zone="asset-studio"/);
  assert.match(source, /<ThemeAdvancedConfigSection[\s\S]*data-theme-zone="advanced-config"/);

  assert.equal(source.includes("<article class=\"priority-panel theme-studio-card theme-studio-card--emphasis\">"), false);
  assert.equal(source.includes("转存并应用博客图标"), false);
  assert.equal(source.includes("原始配置抽屉"), false);
});
