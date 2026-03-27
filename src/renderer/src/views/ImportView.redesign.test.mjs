import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const importViewPath = new URL("./ImportView.vue", import.meta.url);

test("ImportView adds a dedicated GitHub-direct recovery path alongside local import", async () => {
  const source = await readFile(importViewPath, "utf8");

  const requiredHooks = [
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="hero-actions"',
    'data-workflow-zone="local-import-workbench"',
    'data-workflow-zone="github-import-workbench"',
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

  assert.match(source, /前往本地导入/);
  assert.match(source, /前往 GitHub 恢复/);
  assert.match(source, /查看最近结果/);
  assert.match(source, /data-workflow-action-level="primary"/);
  assert.match(source, /data-workflow-action-level="secondary"/);
  assert.match(source, /data-workflow-action-level="tertiary"/);
  assert.equal(source.includes("page-hero-aside"), false);
  assert.equal(source.includes("workflow-hero-note"), false);
  assert.equal(source.includes("page-status-grid"), false);
  assert.match(source, /workflow-status-grid/);
  assert.match(source, /接回主流程/);
  assert.match(source, /GitHub 直接恢复/);
  assert.match(source, /目标恢复目录/);
  assert.match(source, /导入结果摘要/);
  assert.match(source, /useShellActions/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tab"/);
  assert.match(source, /shellActions\.openTutorial\("import-recovery"\)/);
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
