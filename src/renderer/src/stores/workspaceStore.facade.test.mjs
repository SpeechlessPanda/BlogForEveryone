import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceStorePath = new URL("./workspaceStore.js", import.meta.url);

test("workspaceStore uses workspace facade instead of raw window.bfeApi store calls", async () => {
  const source = await readFile(workspaceStorePath, "utf8");

  assert.match(source, /useWorkspaceActions/);
  assert.equal(
    source.includes("createWorkspaceActions("),
    false,
    "expected workspaceStore.js to avoid direct createWorkspaceActions(...) calls",
  );
  assert.equal(
    source.includes("window.bfeApi"),
    false,
    "expected workspaceStore.js to avoid direct window.bfeApi access",
  );

  assert.match(source, /workspaceActions\.listWorkspaces\(/);
  assert.match(source, /workspaceActions\.getThemeCatalog\(/);

  const forbiddenCalls = ["listWorkspaces", "getThemeCatalog"];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected workspaceStore.js to stop calling window.bfeApi.${method}`,
    );
  }

  assert.match(
    source,
    /workspaceThemeConfirmations\[workspaceId\]\s*=\s*{\s*kind:\s*'supported'/s,
  );
  assert.match(
    source,
    /workspaceThemeConfirmations\[workspaceId\]\s*=\s*{\s*kind:\s*'unsupported'/s,
  );
  assert.match(
    source,
    /for \(const workspaceId of Object\.keys\(workspaceState\.workspaceThemeConfirmations\)\)/,
  );
});
