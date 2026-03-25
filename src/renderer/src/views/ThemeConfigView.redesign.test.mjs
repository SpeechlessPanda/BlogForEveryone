import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const themeConfigViewPath = new URL("./ThemeConfigView.vue", import.meta.url);

test("ThemeConfigView establishes a clearer editorial studio rhythm for brand-first work", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");

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

  assert.match(source, /品牌识别先行/);
  assert.match(source, /视觉素材台/);
  assert.match(source, /阅读节奏微调/);
  assert.match(
    source,
    /data-theme-zone="identity-rhythm"[\s\S]*data-theme-zone="asset-studio"[\s\S]*data-theme-zone="reading-rhythm"/,
  );
});

test("ThemeConfigView separates primary controls from calmer theme options and advanced raw config", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");

  assert.match(source, /品牌主叙事/);
  assert.match(source, /素材状态一览/);
  assert.match(source, /主题细节（可选，后置）/);
  assert.match(source, /原始配置抽屉/);
  assert.match(
    source,
    /data-page-layer="explanation"[\s\S]*data-theme-zone="theme-quiet-controls"[\s\S]*保存与确认/,
  );
  assert.match(
    source,
    /data-page-layer="detail"[\s\S]*data-theme-zone="advanced-config"[\s\S]*高级与原始配置属于次级区域/,
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
