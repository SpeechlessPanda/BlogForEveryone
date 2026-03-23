import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const importViewPath = new URL("./ImportView.vue", import.meta.url);

test("ImportView uses import facade instead of raw window.bfeApi import calls", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.match(source, /useImportActions/);

  const forbiddenCalls = [
    "importWorkspace",
    "pickDirectory",
    "importSubscriptions",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected ImportView.vue to stop calling window.bfeApi.${method}`,
    );
  }
});
