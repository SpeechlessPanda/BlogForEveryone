import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const panelPath = new URL("./SystemStatusPanel.vue", import.meta.url);

test("SystemStatusPanel becomes a popup-based utility surface", async () => {
  const source = await readFile(panelPath, "utf8");

  const requiredHooks = [
    'data-shell-surface="user-popup"',
    'data-popup-block="account"',
    'data-popup-block="appearance"',
    'data-popup-block="updates"',
    'data-popup-block="environment"',
    'shell-popup-actions',
    'shell-popup-log',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected SystemStatusPanel.vue to include redesign hook: ${hook}`,
    );
  }
  const removedPersistentDashboardHooks = [
    'data-status-block="overview"',
    'data-status-block="auth"',
    'data-status-block="environment"',
    'system-status-grid',
    'system-status-card',
  ];

  for (const hook of removedPersistentDashboardHooks) {
    assert.equal(
      source.includes(hook),
      false,
      `expected SystemStatusPanel.vue to remove persistent dashboard hook: ${hook}`,
    );
  }
});

test("SystemStatusPanel preserves auth-required and environment-required flows inside the popup", async () => {
  const source = await readFile(panelPath, "utf8");

  assert.match(source, /!isLoggedIn && isAuthRequiredForTab\(activeTab\)/);
  assert.match(source, /!envStatus\.ready/);
  assert.match(source, /shellAppearanceToggleLabel/);
  assert.match(source, /toggle-shell-appearance/);
});

test("SystemStatusPanel targets the requested popup block with active marker, scroll alignment, and first-control focus", async () => {
  const source = await readFile(panelPath, "utf8");

  assert.match(source, /activePopupSection/);
  assert.match(source, /isShellPopupOpen/);
  assert.match(source, /data-popup-active/);
  assert.match(source, /scrollIntoView\(/);
  assert.match(source, /querySelector\(/);
  assert.match(source, /focus\(/);
});
