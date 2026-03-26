import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const topBarPath = new URL("./ShellTopBar.vue", import.meta.url);

test("ShellTopBar exposes the approved top-bar shell regions without a duplicate top-right account trigger", async () => {
  const source = await readFile(topBarPath, "utf8");

  const requiredHooks = [
    'data-shell-surface="topbar"',
    'data-topbar-region="page-title"',
    'data-topbar-region="page-actions"',
    'data-topbar-region="popup-mount"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected ShellTopBar.vue to include top-bar hook: ${hook}`,
    );
  }

  assert.equal(
    source.includes('data-topbar-anchor="user-entry"'),
    false,
    "expected ShellTopBar.vue to stop rendering a duplicate top-right account trigger",
  );
  assert.equal(
    source.includes("shell-user-anchor"),
    false,
    "expected ShellTopBar.vue to stop rendering the top-right username button",
  );
});

test("ShellTopBar stays focused on page context and popup mounting", async () => {
  const source = await readFile(topBarPath, "utf8");

  assert.match(source, /activeTabMeta\.label/);
  assert.match(source, /activeSectionMeta\.label/);
  assert.match(source, /shellPopupAnchorStyle/);
  assert.match(source, /<slot name="page-actions" \/>/);
  assert.match(source, /<slot \/>/);
  assert.equal(
    source.includes("toggle-shell-popup"),
    false,
    "expected ShellTopBar.vue to stop implying topbar-owned popup navigation",
  );
});

test("ShellTopBar teleports the account popup into a sidebar-aligned fixed overlay layer instead of inline topbar flow", async () => {
  const source = await readFile(topBarPath, "utf8");

  assert.match(
    source,
    /<Teleport to="body">/,
    "expected ShellTopBar.vue to teleport the account popup so it is detached from the scrolling topbar flow",
  );
  assert.match(
    source,
    /class="shell-popup-overlay shell-popup-overlay--sidebar"/,
    "expected ShellTopBar.vue to expose a sidebar-aligned fixed overlay wrapper for the account popup",
  );
  assert.match(
    source,
    /class="shell-popup-panel-wrap"\s*:style="shellPopupAnchorStyle"/,
    "expected ShellTopBar.vue to position the popup mount from shell-owned sidebar anchor metadata",
  );
  assert.equal(
    source.includes('class="shell-popup-mount"'),
    false,
    "expected ShellTopBar.vue to stop rendering the popup as inline shell content that scrolls with the page",
  );
});
