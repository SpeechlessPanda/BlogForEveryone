import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveThemeSelection,
  isThemeSpecificMappingAllowed,
} from "./themeDetectionHelpers.mjs";

const hugoCatalog = [{ id: "papermod" }, { id: "stack" }];

test("imported unknown theme stays in confirmation-needed state", () => {
  const state = resolveThemeSelection({ theme: "unknown" }, hugoCatalog, null);

  assert.equal(state.selectedThemeId, "unknown");
  assert.equal(state.needsUserConfirmation, true);
  assert.equal(state.isSupportedTheme, false);
  assert.equal(state.isUnsupportedOrCustom, false);
  assert.equal(isThemeSpecificMappingAllowed(state), false);
});

test("user-confirmed supported theme enables safe theme-specific logic", () => {
  const state = resolveThemeSelection(
    { theme: "unknown" },
    hugoCatalog,
    {
      kind: "supported",
      themeId: "stack",
    },
  );

  assert.equal(state.selectedThemeId, "stack");
  assert.equal(state.needsUserConfirmation, false);
  assert.equal(state.isSupportedTheme, true);
  assert.equal(state.isUnsupportedOrCustom, false);
  assert.equal(isThemeSpecificMappingAllowed(state), true);
});

test("user-confirmed unsupported/custom theme keeps generic-only behavior", () => {
  const state = resolveThemeSelection(
    { theme: "unknown" },
    hugoCatalog,
    {
      kind: "unsupported",
      originalTheme: "my-private-theme",
    },
  );

  assert.equal(state.selectedThemeId, "my-private-theme");
  assert.equal(state.needsUserConfirmation, false);
  assert.equal(state.isSupportedTheme, false);
  assert.equal(state.isUnsupportedOrCustom, true);
  assert.equal(isThemeSpecificMappingAllowed(state), false);
});

test("recognized supported theme remains supported without confirmation", () => {
  const state = resolveThemeSelection({ theme: "papermod" }, hugoCatalog, null);

  assert.equal(state.selectedThemeId, "papermod");
  assert.equal(state.needsUserConfirmation, false);
  assert.equal(state.isSupportedTheme, true);
  assert.equal(state.isUnsupportedOrCustom, false);
  assert.equal(isThemeSpecificMappingAllowed(state), true);
});
