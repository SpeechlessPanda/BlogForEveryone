import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceViewPath = new URL("./WorkspaceView.vue", import.meta.url);

test("WorkspaceView uses workspace facade instead of raw window.bfeApi workspace calls", async () => {
  const source = await readFile(workspaceViewPath, "utf8");

  assert.match(source, /useWorkspaceActions/);
  assert.match(source, /const workspaceActions = useWorkspaceActions\(\)/);
  assert.match(source, /getThemeDisplayMetadata/);
  assert.match(source, /workspaceActions\.createWorkspace\(/);
  assert.match(source, /workspaceActions\.pickDirectory\(/);
  assert.match(source, /workspaceActions\.removeWorkspace\(/);
  assert.match(source, /workspaceActions\.installProjectDependencies\(/);

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

  assert.match(source, /new CustomEvent\("bfe:open-tab"/);
  assert.match(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.match(source, /tabKey: "import"/);
});

test("WorkspaceView exposes the workflow-entry hierarchy cues for blog, stage, next action, and blocker state", async () => {
  const source = await readFile(workspaceViewPath, "utf8");

  assert.match(source, /data-page-role="workspace"/);
  assert.match(
    source,
    /data-page-layer="primary"[\s\S]*data-page-layer="explanation"[\s\S]*data-page-layer="detail"/,
  );
  assert.match(source, /当前博客/);
  assert.match(source, /当前阶段/);
  assert.match(source, /建议下一步/);
  assert.match(source, /当前阻塞/);
});
