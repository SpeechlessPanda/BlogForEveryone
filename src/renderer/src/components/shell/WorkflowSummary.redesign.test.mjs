import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const summaryPath = new URL("./WorkflowSummary.vue", import.meta.url);

test("WorkflowSummary exposes editorial summary card landmarks", async () => {
  const source = await readFile(summaryPath, "utf8");

  const requiredHooks = [
    'data-shell-surface="summary"',
    'data-summary-card="lead"',
    'data-summary-card="readiness"',
    'data-summary-card="workspace"',
    'data-summary-card="next-step"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected WorkflowSummary.vue to include redesign hook: ${hook}`,
    );
  }
});

test("WorkflowSummary strengthens editorial hierarchy without changing summary content model", async () => {
  const source = await readFile(summaryPath, "utf8");

  assert.match(source, /activeTabMeta\.step/);
  assert.match(source, /activeSectionMeta\.label/);
  assert.match(source, /workspaceSummary\.title/);
  assert.match(source, /shell-summary-metric/);
});
