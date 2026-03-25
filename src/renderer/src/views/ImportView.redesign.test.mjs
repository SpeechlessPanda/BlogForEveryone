import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const importViewPath = new URL("./ImportView.vue", import.meta.url);

test("ImportView joins the editorial workflow family with clear import entry and follow-up guidance", async () => {
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
  assert.match(source, /导入结果摘要/);
});
