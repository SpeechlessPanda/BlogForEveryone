import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const themeConfigViewPath = new URL("./ThemeConfigView.vue", import.meta.url);

test("ThemeConfigView uses theme facade instead of raw window.bfeApi theme/picker calls", async () => {
  const source = await readFile(themeConfigViewPath, "utf8");

  assert.match(source, /useThemeConfigActions/);

  const forbiddenCalls = [
    "getThemeConfig",
    "validateThemeSettings",
    "saveThemeConfig",
    "saveThemeLocalAsset",
    "applyThemePreviewOverrides",
    "getPreferences",
    "savePreferences",
    "pickFile",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected ThemeConfigView.vue to stop calling window.bfeApi.${method}`,
    );
  }
});
