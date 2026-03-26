import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sectionPath = new URL("./ThemeIdentitySection.vue", import.meta.url);

test("ThemeIdentitySection exposes the brand-first context and identity controls for H4 extraction", async () => {
  const source = await readFile(sectionPath, "utf8");

  assert.match(source, /data-theme-zone="identity-rhythm"/);
  assert.match(source, /Step 01 · 品牌识别先行/);
  assert.match(source, /确认当前博客与主题/);
  assert.match(source, /博客基础信息/);
  assert.match(source, /博客标题/);
  assert.match(source, /博客副标题/);
  assert.match(source, /邮箱/);
  assert.match(source, /GitHub 主页链接/);
});
