import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previewViewPath = new URL("./PreviewView.vue", import.meta.url);

test("PreviewView uses preview facade instead of raw window.bfeApi preview calls", async () => {
  const source = await readFile(previewViewPath, "utf8");

  assert.match(source, /usePreviewActions/);

  const forbiddenCalls = [
    "startLocalPreview",
    "openLocalPreview",
    "stopLocalPreview",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected PreviewView.vue to stop calling window.bfeApi.${method}`,
    );
  }
});
