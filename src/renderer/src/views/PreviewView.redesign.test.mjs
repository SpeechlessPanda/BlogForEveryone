import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previewViewPath = new URL("./PreviewView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);

test("PreviewView keeps preview status and results in a single vertical workflow", async () => {
  const source = await readFile(previewViewPath, "utf8");

  const requiredHooks = [
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="hero-actions"',
    'data-workflow-zone="preview-workbench"',
    'data-workflow-zone="recent-result"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected PreviewView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(source, /data-workflow-action-level="primary"[\s\S]*前往预览控制台/);
  assert.match(source, /data-workflow-action-level="secondary"[\s\S]*查看最近结果/);
  assert.match(source, /data-workflow-action-level="tertiary"[\s\S]*打开教程中心/);
  assert.equal(source.includes("page-hero-aside"), false);
  assert.equal(source.includes("workflow-hero-note"), false);
  assert.equal(source.includes("workflow-inline-note"), false);
  assert.equal(source.includes("page-status-grid"), false);
  assert.match(source, /workflow-status-grid/);
  assert.doesNotMatch(source, /workflow-inline-panel/);
  assert.doesNotMatch(source, /priority-panel priority-panel--support workflow-result-panel/);
  assert.match(source, /workflow-compact-block workflow-result-block/);
  assert.match(source, /最近结果/);
  assert.match(source, /当前状态/);
  assert.match(source, /查看详细日志与链路事件/);
  assert.match(source, /useShellActions/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.match(source, /shellActions\.openTutorial\("preview-check"\)/);
});

test("PreviewView redesign uses shared compact workflow blocks and keeps hover affordances", async () => {
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    stylesSource,
    /\.page-hero-grid:has\(> :only-child\)[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
  assert.match(
    stylesSource,
    /\.workflow-section-heading--stacked[\s\S]*display:\s*grid/,
  );
  assert.match(
    stylesSource,
    /\.workflow-compact-block[\s\S]*border-radius:\s*12px/,
  );
  assert.match(
    stylesSource,
    /\.layout--editorial \.priority-panel,[\s\S]*\.layout--editorial \.context-card,[\s\S]*\.layout--editorial \.page-signal,[\s\S]*\.layout--editorial \.workflow-compact-block[\s\S]*background:\s*var\(--shell-panel-alt\)/,
  );
  assert.match(
    stylesSource,
    /button\.primary:hover,[\s\S]*button\.secondary:hover,[\s\S]*button\.danger:hover[\s\S]*translateY\(-2px\)/,
  );
  assert.match(
    stylesSource,
    /button\.primary:hover,[\s\S]*button\.secondary:hover,[\s\S]*button\.danger:hover[\s\S]*translateY\(-2px\)/,
  );
  assert.match(stylesSource, /button:focus-visible/);
  assert.match(stylesSource, /a:focus-visible/);
});
