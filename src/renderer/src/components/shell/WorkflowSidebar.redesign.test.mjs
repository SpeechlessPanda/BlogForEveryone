import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sidebarPath = new URL("./WorkflowSidebar.vue", import.meta.url);

test("WorkflowSidebar is reduced to minimal nav plus appearance and user entry points", async () => {
  const source = await readFile(sidebarPath, "utf8");

  const requiredHooks = [
    'data-shell-surface="sidebar"',
    'data-sidebar-region="brand"',
    'data-sidebar-region="nav"',
    'data-sidebar-entry="appearance"',
    'data-sidebar-entry="user"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected WorkflowSidebar.vue to include redesign hook: ${hook}`,
    );
  }

  const preservedBrandBindings = [
    'class="sidebar-brand-copy"',
    "appState.appName",
    'class="version"',
  ];

  for (const binding of preservedBrandBindings) {
    assert.equal(
      source.includes(binding),
      true,
      `expected WorkflowSidebar.vue to keep brand/info binding: ${binding}`,
    );
  }

  assert.equal(
    source.includes('<div class="sidebar-logo">B</div>'),
    false,
    "expected WorkflowSidebar.vue to remove the legacy top-left B mark while preserving the brand/info region",
  );

  const removedHeavyShellHooks = [
    'data-sidebar-block="current-stage"',
    'data-sidebar-block="utilities"',
    'data-shell-theme-toggle',
    'sidebar-group-frame',
    'sidebar-utility-meta',
  ];

  for (const hook of removedHeavyShellHooks) {
    assert.equal(
      source.includes(hook),
      false,
      `expected WorkflowSidebar.vue to remove heavy shell hook: ${hook}`,
    );
  }
});

test("WorkflowSidebar keeps grouped workflow navigation without persistent utility stacks", async () => {
  const source = await readFile(sidebarPath, "utf8");

  assert.match(source, /v-for="section in groupedWorkflowSections"/);
  assert.match(source, /@click="\$emit\('navigate', tab\.key\)"/);
  assert.match(source, /activeTab === tab\.key/);

  const removedUtilityBindings = [
    'check-updates',
    'install-update',
    'open-info',
    'toggle-launch-at-startup',
    'logout',
    'shellAppearanceToggleLabel',
    'sidebarLoginText',
    'environmentStatusText',
  ];

  for (const binding of removedUtilityBindings) {
    assert.equal(
      source.includes(binding),
      false,
      `expected WorkflowSidebar.vue to drop persistent utility binding: ${binding}`,
    );
  }
});
