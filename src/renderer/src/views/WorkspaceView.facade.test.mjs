import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceViewPath = new URL("./WorkspaceView.vue", import.meta.url);

test("WorkspaceView uses workspace facade instead of raw window.bfeApi workspace calls", async () => {
  const source = await readFile(workspaceViewPath, "utf8");

  assert.match(source, /useWorkspaceActions/);

  const forbiddenCalls = [
    "createWorkspace",
    "pickDirectory",
    "removeWorkspace",
    "installProjectDependencies",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected WorkspaceView.vue to stop calling window.bfeApi.${method}`,
    );
  }
});
