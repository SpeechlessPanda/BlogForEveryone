import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sidebarPath = new URL("./WorkflowSidebar.vue", import.meta.url);

test("WorkflowSidebar exposes editorial shell landmarks and appearance toggle hooks", async () => {
  const source = await readFile(sidebarPath, "utf8");

  const requiredHooks = [
    'data-shell-surface="sidebar"',
    'data-sidebar-block="brand"',
    'data-sidebar-block="current-stage"',
    'data-sidebar-block="workflow"',
    'data-sidebar-block="utilities"',
    'data-shell-theme-toggle',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected WorkflowSidebar.vue to include redesign hook: ${hook}`,
    );
  }
});

test("WorkflowSidebar keeps workflow grouping and action boundaries while adding hierarchy", async () => {
  const source = await readFile(sidebarPath, "utf8");

  assert.match(source, /v-for="section in groupedWorkflowSections"/);
  assert.match(source, /@click="\$emit\('navigate', tab\.key\)"/);
  assert.match(source, /sidebar-group-frame/);
  assert.match(source, /sidebar-utility-meta/);
});
