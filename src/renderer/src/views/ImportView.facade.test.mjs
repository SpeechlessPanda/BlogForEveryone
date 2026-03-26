import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const importViewPath = new URL("./ImportView.vue", import.meta.url);

test("ImportView uses import facade instead of raw window.bfeApi import calls", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.match(
    source,
    /import\s*\{\s*useImportActions\s*\}\s*from\s*["']\.\.\/composables\/useImportActions\.mjs["']/,
  );
  assert.match(
    source,
    /const\s*\{\s*importWorkspace\s*,\s*pickDirectory\s*,\s*importSubscriptions\s*\}\s*=\s*useImportActions\(\)/,
  );

  const requiredFacadeCalls = [
    "importWorkspace(",
    "pickDirectory(",
    "importSubscriptions(",
  ];

  for (const call of requiredFacadeCalls) {
    assert.equal(
      source.includes(call),
      true,
      `expected ImportView.vue to call facade method ${call}`,
    );
  }

  assert.match(
    source,
    /importWorkspace\(\s*\{\s*\.\.\.form\s*\}\s*\)/,
  );
  assert.match(
    source,
    /pickDirectory\(\s*\{[\s\S]*title:\s*["']选择已存在的博客工程目录["'],[\s\S]*defaultPath:\s*form\.projectDir\s*\|\|\s*undefined,[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /importSubscriptions\(\s*\{[\s\S]*projectDir:\s*form\.projectDir,[\s\S]*strategy:\s*["']merge["'],[\s\S]*\}\s*\)/,
  );

  const forbiddenCalls = [
    "importWorkspace",
    "pickDirectory",
    "importSubscriptions",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected ImportView.vue to stop calling window.bfeApi.${method}`,
    );
  }

  assert.match(source, /useShellActions/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.match(source, /shellActions\.openTutorial\("import-recovery"\)/);
  assert.match(source, /shellActions\.openTab\("theme"\)/);
  assert.match(source, /shellActions\.openTab\("workspace"\)/);
});

test("ImportView reads as the secondary entry path with guidance back into the main workflow", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.match(source, /data-page-role="import"/);
  assert.match(
    source,
    /data-page-layer="primary"[\s\S]*data-page-layer="explanation"[\s\S]*data-page-layer="detail"/,
  );
  assert.match(source, /次级入口/);
  assert.match(source, /接回主流程/);
  assert.match(source, /建议下一步/);
});
