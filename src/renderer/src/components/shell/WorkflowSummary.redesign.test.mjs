import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const summaryPath = new URL("./WorkflowSummary.vue", import.meta.url);

test("WorkflowSummary becomes a compact top-bar summary strip", async () => {
  const source = await readFile(summaryPath, "utf8");

  const requiredHooks = [
    'data-shell-surface="summary"',
    'data-summary-layout="compact"',
    'data-summary-item="step"',
    'data-summary-item="workspace"',
    'data-summary-item="next-step"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected WorkflowSummary.vue to include redesign hook: ${hook}`,
    );
  }
  const removedHeavySummaryHooks = [
    'data-summary-card="lead"',
    'data-summary-card="readiness"',
    'data-summary-card="workspace"',
    'data-summary-card="next-step"',
    'shell-summary-metric',
  ];

  for (const hook of removedHeavySummaryHooks) {
    assert.equal(
      source.includes(hook),
      false,
      `expected WorkflowSummary.vue to remove heavy summary hook: ${hook}`,
    );
  }
});

test("WorkflowSummary keeps the workflow/workspace model while dropping persistent readiness cards", async () => {
  const source = await readFile(summaryPath, "utf8");

  assert.match(source, /activeTabMeta\.step/);
  assert.match(source, /activeSectionMeta\.label/);
  assert.match(source, /workspaceSummary\.title/);

  const removedReadinessContent = ["environmentStatusText", "loginStatusText"];

  for (const binding of removedReadinessContent) {
    assert.equal(
      source.includes(binding),
      false,
      `expected WorkflowSummary.vue to move readiness content out of the permanent shell: ${binding}`,
    );
  }
});
