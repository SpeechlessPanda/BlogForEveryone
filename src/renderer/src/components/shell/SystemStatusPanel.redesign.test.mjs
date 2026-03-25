import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const panelPath = new URL("./SystemStatusPanel.vue", import.meta.url);

test("SystemStatusPanel exposes grouped editorial status surfaces", async () => {
  const source = await readFile(panelPath, "utf8");

  const requiredHooks = [
    'data-shell-surface="system-status"',
    'data-status-block="overview"',
    'data-status-block="auth"',
    'data-status-block="environment"',
    'system-status-card',
    'system-status-grid',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected SystemStatusPanel.vue to include redesign hook: ${hook}`,
    );
  }
});

test("SystemStatusPanel preserves auth and environment conditional flows under new grouping", async () => {
  const source = await readFile(panelPath, "utf8");

  assert.match(source, /!isLoggedIn && isAuthRequiredForTab\(activeTab\)/);
  assert.match(source, /!envStatus\.ready/);
  assert.match(source, /system-status-log/);
  assert.match(source, /system-status-actions/);
});
