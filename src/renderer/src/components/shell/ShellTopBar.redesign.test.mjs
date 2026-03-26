import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const topBarPath = new URL("./ShellTopBar.vue", import.meta.url);

test("ShellTopBar exposes the approved top-bar shell regions and popup anchor", async () => {
  const source = await readFile(topBarPath, "utf8");

  const requiredHooks = [
    'data-shell-surface="topbar"',
    'data-topbar-region="page-title"',
    'data-topbar-region="page-actions"',
    'data-topbar-anchor="user-entry"',
    'data-topbar-region="popup-mount"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected ShellTopBar.vue to include top-bar hook: ${hook}`,
    );
  }
});

test("ShellTopBar stays focused on page context and popup mounting", async () => {
  const source = await readFile(topBarPath, "utf8");

  assert.match(source, /activeTabMeta\.label/);
  assert.match(source, /activeSectionMeta\.label/);
  assert.match(source, /<slot name="page-actions" \/>/);
  assert.match(source, /<slot \/>/);
  assert.match(source, /toggle-shell-popup/);
});

test("ShellTopBar teleports the account popup into a fixed overlay layer instead of inline topbar flow", async () => {
  const source = await readFile(topBarPath, "utf8");

  assert.match(
    source,
    /<Teleport to="body">/,
    "expected ShellTopBar.vue to teleport the account popup so it is detached from the scrolling topbar flow",
  );
  assert.match(
    source,
    /class="shell-popup-overlay"/,
    "expected ShellTopBar.vue to expose a fixed overlay wrapper for the account popup",
  );
  assert.equal(
    source.includes('class="shell-popup-mount"'),
    false,
    "expected ShellTopBar.vue to stop rendering the popup as inline shell content that scrolls with the page",
  );
});
