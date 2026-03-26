import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previewViewPath = new URL("./PreviewView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);

test("PreviewView joins the shared editorial workflow family without duplicating hero summary cards", async () => {
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
  assert.match(source, /workflow-inline-panel/);
  assert.match(source, /预览结果摘要/);
  assert.match(source, /最近结果/);
  assert.match(source, /useShellActions/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.match(source, /shellActions\.openTutorial\("preview-check"\)/);
});

test("PreviewView shares stronger button hover affordances while keeping focus-visible explicit", async () => {
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    stylesSource,
    /\.page-hero-grid:has\(> :only-child\)[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
  assert.match(
    stylesSource,
    /button\.primary:hover,[\s\S]*button\.secondary:hover,[\s\S]*button\.danger:hover[\s\S]*translateY\(-2px\)/,
  );
  assert.match(
    stylesSource,
    /\.layout--editorial \.shell-user-anchor:hover,[\s\S]*\.layout--editorial \.shell-popup-dismiss:hover,[\s\S]*\.layout--editorial button\.primary:hover,[\s\S]*\.layout--editorial button\.secondary:hover,[\s\S]*\.layout--editorial button\.danger:hover[\s\S]*(translateY\(-1px\)|translate3d\([^)]*-1px[^)]*\))/,
  );
  assert.doesNotMatch(
    stylesSource,
    /\.layout--editorial \.shell-user-anchor:hover,[\s\S]*\.layout--editorial \.shell-popup-dismiss:hover,[\s\S]*\.layout--editorial button\.primary:hover,[\s\S]*\.layout--editorial button\.secondary:hover,[\s\S]*\.layout--editorial button\.danger:hover[\s\S]*transform:\s*none/,
  );
  assert.match(stylesSource, /button:focus-visible/);
  assert.match(stylesSource, /a:focus-visible/);
});
