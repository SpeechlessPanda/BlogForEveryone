import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sectionPath = new URL("./ThemeAdvancedConfigSection.vue", import.meta.url);

test("ThemeAdvancedConfigSection owns advanced and raw-config rendering for H4 extraction", async () => {
  const source = await readFile(sectionPath, "utf8");

  assert.match(source, /data-theme-zone="advanced-config"/);
  assert.match(source, /高级与原始配置属于次级区域/);
  assert.match(source, /主题专属高级配置/);
  assert.match(source, /原始配置抽屉/);
  assert.match(source, /selectedThemeSchema/);
  assert.match(source, /optionValues/);
  assert.match(source, /allConfigEntries/);
});
