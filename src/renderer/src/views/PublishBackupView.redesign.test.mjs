import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publishBackupViewPath = new URL("./PublishBackupView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);

test("PublishBackupView refits the page into one coordinated publish-plus-backup workbench", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  const requiredHooks = [
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="hero-actions"',
    'data-workflow-zone="publish-workbench"',
    'data-workflow-zone="recent-result"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected PublishBackupView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(source, /前往发布工作台/);
  assert.match(source, /查看最近结果/);
  assert.match(source, /查看仓库命名规则/);
  assert.match(source, /data-workflow-action-level="primary"/);
  assert.match(source, /data-workflow-action-level="secondary"/);
  assert.match(source, /data-workflow-action-level="tertiary"/);
  assert.equal(source.includes("page-hero-aside"), false);
  assert.equal(source.includes("workflow-hero-note"), false);
  assert.equal(source.includes("workflow-inline-note"), false);
  assert.equal(source.includes("page-status-grid"), false);
  assert.match(source, /workflow-status-grid/);
  assert.doesNotMatch(source, /workflow-inline-panel/);
  assert.doesNotMatch(source, /context-card/);
  assert.match(source, /workflow-compact-block workflow-result-block/);
  assert.match(source, /workflow-compact-block workflow-compact-block--support/);
  assert.equal(source.includes('data-workflow-zone="backup-workbench"'), false);
  assert.match(source, /统一发布与备份/);
  assert.match(source, /GitHub Pages 站点类型/);
  assert.match(source, /固定备份仓库：BFE/);
  assert.match(source, /用户名\.github\.io/);
  assert.match(source, /publish-outcome-list/);
  assert.match(source, /最近结果/);
});

test("PublishBackupView uses wrap-capable access-address and result surfaces for long URLs", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(source, /class="workflow-access-address"/);
  assert.doesNotMatch(source, /<input :value="accessAddress" disabled \/>/);
  assert.match(source, /class="workflow-compact-block workflow-compact-block--support"/);
  assert.match(stylesSource, /\.workflow-access-address,[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(stylesSource, /\.workflow-result-block,[\s\S]*min-width:\s*0/);
  assert.match(stylesSource, /\.publish-outcome-list[\s\S]*min-width:\s*0/);
});
