import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contentEditorPath = new URL("./ContentEditorView.vue", import.meta.url);

test("ContentEditorView uses content facade instead of raw window.bfeApi content calls", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  assert.match(source, /useContentActions/);

  const forbiddenCalls = [
    "createAndOpenContent",
    "listExistingContents",
    "readExistingContent",
    "saveExistingContent",
    "openExistingContent",
    "watchAndAutoPublish",
    "getPublishJobStatus",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected ContentEditorView.vue to stop calling window.bfeApi.${method}`,
    );
  }
});
