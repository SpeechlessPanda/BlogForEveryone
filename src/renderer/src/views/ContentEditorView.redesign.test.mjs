import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contentEditorPath = new URL("./ContentEditorView.vue", import.meta.url);

test("ContentEditorView reads as the writing hub with automation secondary and results framed before details", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  assert.match(source, /data-page-role="content-editor"/);
  assert.match(source, /写作中枢/);
  assert.match(
    source,
    /data-page-layer="primary"[\s\S]*data-page-layer="explanation"[\s\S]*data-page-layer="detail"/,
  );
  assert.match(source, /建议下一步/);
  assert.match(source, /最近结果/);
  assert.match(source, /自动发布（次级流程）/);
  assert.match(source, /data-page-layer="detail"[\s\S]*自动发布（次级流程）/);
});
