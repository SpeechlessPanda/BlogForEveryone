import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publishBackupViewPath = new URL("./PublishBackupView.vue", import.meta.url);

test("PublishBackupView keeps release actions and backup support without duplicated hero summary cards", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  const requiredHooks = [
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="hero-actions"',
    'data-workflow-zone="publish-workbench"',
    'data-workflow-zone="backup-workbench"',
    'data-workflow-zone="recent-result"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected PublishBackupView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(source, /前往发布设置/);
  assert.match(source, /查看最近结果/);
  assert.match(source, /跳到备份设置/);
  assert.match(source, /data-workflow-action-level="primary"/);
  assert.match(source, /data-workflow-action-level="secondary"/);
  assert.match(source, /data-workflow-action-level="tertiary"/);
  assert.equal(source.includes("page-hero-aside"), false);
  assert.equal(source.includes("workflow-hero-note"), false);
  assert.equal(source.includes("workflow-inline-note"), false);
  assert.equal(source.includes("page-status-grid"), false);
  assert.match(source, /workflow-status-grid/);
  assert.match(source, /workflow-inline-panel/);
  assert.match(source, /发布结果摘要/);
  assert.match(source, /备份到底层仓库/);
  assert.match(source, /发布前检查清单/);
});
