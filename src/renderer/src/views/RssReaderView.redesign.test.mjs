import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rssReaderViewPath = new URL("./RssReaderView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);

test("RssReaderView keeps quiet intake actions without a duplicated hero summary card", async () => {
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
  assert.equal(source.includes("page-hero-aside"), false);
  assert.match(source, /订阅结果摘要/);
  assert.match(source, /useShellActions/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.doesNotMatch(source, /shellActions\.openTutorial\(\)/);
  assert.match(source, /shellActions\.openTutorial\("rss-reading"\)/);
  assert.match(source, /rss-subscription-toolbar/);
  assert.match(source, /rss-subscription-row/);
  assert.doesNotMatch(
    source,
    /data-workflow-zone="subscription-list"[\s\S]*class="page-hero-grid"/,
    "expected the subscription list area to stop reusing the generic page hero grid for toolbar and rows",
  );
});

test("RssReaderView right-aligns refresh and unsubscribe actions inside dedicated rss action rows", async () => {
  const source = await readFile(rssReaderViewPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.equal(
    source.includes("rss-subscription-list-header"),
    true,
    "expected RssReaderView.vue to expose a dedicated list-header layout instead of generic hero-grid alignment",
  );
  assert.equal(
    source.includes("rss-subscription-item-header"),
    true,
    "expected RssReaderView.vue to expose a dedicated item-header layout for right-aligned unsubscribe actions",
  );
  assert.equal(source.includes("rss-subscription-actions"), true);
  assert.match(styles, /\.rss-subscription-actions\s*\{[\s\S]*justify-content:\s*flex-end;/);
  assert.match(styles, /\.rss-subscription-actions\s*\{[\s\S]*margin-left:\s*auto;/);
  assert.doesNotMatch(source, /data-workflow-zone="subscription-list"[\s\S]*<div class="page-hero-grid">/);
});

test("RssReaderView uses the shared balanced secondary grid for result and list regions", async () => {
  const source = await readFile(rssReaderViewPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.equal(source.includes("workflow-balanced-grid"), true);
  assert.match(styles, /\.workflow-balanced-grid\s*\{[\s\S]*display:\s*grid;/);
});

test("RssReaderView keeps in-page navigation in a view-owned enter-at-top helper", async () => {
  const source = await readFile(rssReaderViewPath, "utf8");

  assert.equal(
    source.includes("jumpToZone"),
    true,
    "expected RssReaderView.vue to define a view-owned jumpToZone helper",
  );
  assert.match(source, /scrollIntoView\(\{\s*behavior:\s*["']smooth["'],\s*block:\s*["']start["']\s*\}\)/);
  assert.doesNotMatch(source, /\$el\?\.querySelector\([^)]*\)\?\.scrollIntoView/);
});
