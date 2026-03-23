import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceStorePath = new URL("./workspaceStore.js", import.meta.url);

test("workspaceStore uses workspace facade instead of raw window.bfeApi store calls", async () => {
  const source = await readFile(workspaceStorePath, "utf8");

  assert.match(source, /createWorkspaceActions|useWorkspaceActions/);

  const forbiddenCalls = ["listWorkspaces", "getThemeCatalog"];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected workspaceStore.js to stop calling window.bfeApi.${method}`,
    );
  }
});
