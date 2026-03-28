import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const themeConfigViewPath = new URL("./ThemeConfigView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);
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

test("ThemeConfigView removes hero-side note cards and moves studio summary below the hero body", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");

  assert.equal(source.includes("theme-studio-hero-note"), false);
  assert.equal(source.includes("theme-studio-status-grid"), false);
  assert.equal(source.includes("theme-studio-status-card"), false);

  assert.equal(
    source.includes('data-theme-zone="studio-summary"'),
    true,
    "expected ThemeConfigView.vue to expose a lower studio-summary zone after removing the top-right note/status cards",
  );

  assert.match(source, /当前工作区/);
  assert.match(source, /当前主题/);
  assert.match(source, /兼容提示/);
  assert.match(
    source,
    /data-page-layer="explanation"[\s\S]*data-theme-zone="studio-summary"/,
  );
});

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

  assert.doesNotMatch(source, /品牌主叙事/);
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

test("ThemeConfigView keeps dark editorial studio support copy and page links on explicit shell contrast tokens", async () => {
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    stylesSource,
    /\.layout--editorial \.theme-studio \.section-eyebrow,[\s\S]*\.layout--editorial \.theme-studio \.section-helper,[\s\S]*\.layout--editorial \.theme-studio \.muted,[\s\S]*\.layout--editorial \.theme-studio \.page-lead,[\s\S]*\.layout--editorial \.theme-studio \.status-detail,[\s\S]*\.layout--editorial \.theme-studio \.page-result-note[\s\S]*color:\s*var\(--shell-muted\);/,
    "expected theme studio helper and result copy to keep following the shell muted token",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.theme-studio \.page-link-row a\s*\{[\s\S]*color:\s*var\(--shell-highlight\);/,
    "expected theme studio links to use the shell highlight token on dark shell surfaces",
  );
});

test("ThemeConfigView keeps dark editorial studio titles and primary asset text on explicit shell ink and muted tokens", async () => {
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.theme-studio-heading h2,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.theme-studio-note strong,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.theme-studio-status-card strong,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.theme-studio-card h3[\s\S]*color:\s*var\(--shell-ink\);/,
    "expected theme studio titles and status-card primary text to use the shell ink token in dark mode",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.theme-studio-note \.section-helper,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.theme-studio-status-card \.status-detail,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.theme-asset-preview-card span[\s\S]*color:\s*var\(--shell-muted\);/,
    "expected theme studio supporting copy to use the shell muted token in dark mode",
  );
});
