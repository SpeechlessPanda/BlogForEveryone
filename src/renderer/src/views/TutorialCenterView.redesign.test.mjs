import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tutorialViewPath = new URL("./TutorialCenterView.vue", import.meta.url);

test("TutorialCenterView exposes the editorial workbench first-screen zones", async () => {
  const source = await readFile(tutorialViewPath, "utf8");

  const requiredHooks = [
    'data-tutorial-surface="editorial-workbench"',
    'data-tutorial-zone="brand-header"',
    'data-tutorial-zone="hero"',
    'data-tutorial-zone="recent-work"',
    'data-tutorial-zone="theme-rail"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected TutorialCenterView.vue to include redesign hook: ${hook}`,
    );
  }
});

test("TutorialCenterView keeps visible workbench actions and workspace-aware entry hooks", async () => {
  const source = await readFile(tutorialViewPath, "utf8");

  const requiredActions = ["继续上次工作", "新建博客", "导入已有项目"];

  for (const action of requiredActions) {
    assert.equal(
      source.includes(action),
      true,
      `expected TutorialCenterView.vue to show primary action: ${action}`,
    );
  }

  assert.match(source, /workspaceState\.workspaces/);
  assert.match(source, /bfe:open-tab/);
  assert.match(source, /tutorial-workbench-hero/);
  assert.match(source, /theme-exploration-rail/);
});
