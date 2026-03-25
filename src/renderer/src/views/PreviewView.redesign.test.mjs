import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previewViewPath = new URL("./PreviewView.vue", import.meta.url);

test("PreviewView joins the shared editorial workflow family with top actions and consistent result framing", async () => {
  const source = await readFile(previewViewPath, "utf8");

  const requiredHooks = [
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="hero-actions"',
    'data-workflow-zone="preview-workbench"',
    'data-workflow-zone="recent-result"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected PreviewView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(source, /data-workflow-action-level="primary"[\s\S]*前往预览控制台/);
  assert.match(source, /data-workflow-action-level="secondary"[\s\S]*查看最近结果/);
  assert.match(source, /data-workflow-action-level="tertiary"[\s\S]*停止预览/);
  assert.match(source, /预览结果摘要/);
  assert.match(source, /最近结果/);
});
