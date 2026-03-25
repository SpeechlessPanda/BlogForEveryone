import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rssReaderViewPath = new URL("./RssReaderView.vue", import.meta.url);

test("RssReaderView joins the editorial workflow family with quiet intake actions and export support", async () => {
  const source = await readFile(rssReaderViewPath, "utf8");

  const requiredHooks = [
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="hero-actions"',
    'data-workflow-zone="add-subscription"',
    'data-workflow-zone="recent-result"',
    'data-workflow-zone="subscription-list"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected RssReaderView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(source, /前往新增订阅/);
  assert.match(source, /立即同步订阅/);
  assert.match(source, /导出订阅快照/);
  assert.match(source, /data-workflow-action-level="primary"/);
  assert.match(source, /data-workflow-action-level="secondary"/);
  assert.match(source, /data-workflow-action-level="tertiary"/);
  assert.match(source, /订阅结果摘要/);
});
