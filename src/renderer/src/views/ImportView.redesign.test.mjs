import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const importViewPath = new URL("./ImportView.vue", import.meta.url);

test("ImportView keeps import entry guidance without duplicated hero summary cards", async () => {
  const source = await readFile(importViewPath, "utf8");

  const requiredHooks = [
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="hero-actions"',
    'data-workflow-zone="import-workbench"',
    'data-workflow-zone="recent-result"',
    'data-workflow-zone="rss-restore"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected ImportView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(source, /前往导入设置/);
  assert.match(source, /查看最近结果/);
  assert.match(source, /前往主题配置/);
  assert.match(source, /data-workflow-action-level="primary"/);
  assert.match(source, /data-workflow-action-level="secondary"/);
  assert.match(source, /data-workflow-action-level="tertiary"/);
  assert.equal(source.includes("page-hero-aside"), false);
  assert.equal(source.includes("page-status-grid"), false);
  assert.match(source, /导入结果摘要/);
  assert.match(source, /useShellActions/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tab"/);
  assert.match(source, /shellActions\.openTutorial\(\)/);
  assert.match(source, /shellActions\.openTab\("theme"\)/);
  assert.match(source, /shellActions\.openTab\("workspace"\)/);
});

test("ImportView keeps in-page navigation in a view-owned enter-at-top helper", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.equal(
    source.includes("jumpToZone"),
    true,
    "expected ImportView.vue to define a view-owned jumpToZone helper",
  );
  assert.match(source, /scrollIntoView\(\{\s*behavior:\s*["']smooth["'],\s*block:\s*["']start["']\s*\}\)/);
  assert.doesNotMatch(source, /\$el\?\.querySelector\([^)]*\)\?\.scrollIntoView/);
});
