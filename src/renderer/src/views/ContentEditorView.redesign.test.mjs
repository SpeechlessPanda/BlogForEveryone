import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contentEditorPath = new URL("./ContentEditorView.vue", import.meta.url);

test("ContentEditorView reads as the writing hub with a shared workflow rail and postposed automation", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  const requiredHooks = [
    'data-page-role="content-editor"',
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="hero-actions"',
    'data-workflow-zone="create-content"',
    'data-workflow-zone="existing-content"',
    'data-workflow-zone="recent-result"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected ContentEditorView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(source, /写作中枢/);
  assert.match(source, /前往新建内容/);
  assert.match(source, /继续编辑已有内容/);
  assert.match(source, /data-workflow-action-level="primary"/);
  assert.match(source, /data-workflow-action-level="secondary"/);
  assert.match(source, /data-workflow-action-level="tertiary"/);
  assert.match(source, /写作结果摘要/);
  assert.match(source, /自动流程（后置）/);
  assert.match(source, /data-page-layer="detail"[\s\S]*自动流程（后置）/);
});
