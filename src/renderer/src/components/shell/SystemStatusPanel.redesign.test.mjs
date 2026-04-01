import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const panelPath = new URL("./SystemStatusPanel.vue", import.meta.url);
const stylesPath = new URL("../../styles.css", import.meta.url);

test("SystemStatusPanel becomes a popup-based utility surface", async () => {
  const source = await readFile(panelPath, "utf8");

  const requiredHooks = [
    'data-shell-surface="user-popup"',
    'data-popup-block="account"',
    'data-popup-block="appearance"',
    'data-popup-block="startup"',
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
  assert.match(source, /等待 GitHub 登录/);
  assert.match(source, /!envStatus\.ready/);
  assert.match(source, /shellAppearanceToggleLabel/);
  assert.match(source, /toggle-shell-appearance/);
  assert.match(source, /launchAtStartupEnabled/);
  assert.match(source, /toggle-launch-at-startup/);
  assert.match(source, /开机自启动/);
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

test("SystemStatusPanel keeps popup auth logs wrap-safe for long tokens and JSON", async () => {
  const source = await readFile(panelPath, "utf8");
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(source, /class="shell-popup-log"/);
  assert.match(stylesSource, /\.shell-popup-log\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(stylesSource, /\.shell-popup-log\s*\{[\s\S]*word-break:\s*break-word/);
});

test("SystemStatusPanel keeps dark popup logout actions on readable shell tokens instead of literal red text", async () => {
  const source = await readFile(panelPath, "utf8");
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(source, /<button v-if="isLoggedIn" class="danger" @click="\$emit\('logout'\)">退出登录<\/button>/);
  assert.match(
    stylesSource,
    /\.shell-popup-theme\[data-shell-appearance="dark"\] button\.danger\s*\{[\s\S]*color:\s*var\(--shell-highlight\);[\s\S]*border-color:\s*var\(--shell-line-strong\);/,
    "expected dark popup logout actions to stop using literal red text and instead use readable shell tokens",
  );
  assert.doesNotMatch(
    stylesSource,
    /\.shell-popup-theme\[data-shell-appearance="dark"\] button\.danger\s*\{[\s\S]*color:\s*#ff8d8d;/,
    "expected dark popup logout actions to stop using literal pink-red text in dark mode",
  );
});
