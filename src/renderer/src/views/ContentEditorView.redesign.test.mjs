import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contentEditorPath = new URL("./ContentEditorView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);
const contentWorkflowHeroPath = new URL(
  "../components/content/ContentWorkflowHero.vue",
  import.meta.url,
);
const existingContentSectionPath = new URL(
  "../components/content/ExistingContentSection.vue",
  import.meta.url,
);

test("ContentEditorView keeps one primary writing flow and demotes helper blocks", async () => {
  const source = await readFile(contentEditorPath, "utf8");
  const heroSectionSource = await readFile(contentWorkflowHeroPath, "utf8");

  const requiredHooks = [
    'data-page-role="content-editor"',
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="create-content"',
    'data-workflow-zone="existing-content"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected ContentEditorView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(heroSectionSource, /data-workflow-zone="hero-actions"/);
  assert.match(heroSectionSource, /写作中枢/);
  assert.match(heroSectionSource, /前往新建内容/);
  assert.match(heroSectionSource, /继续编辑已有内容/);
  assert.match(heroSectionSource, /data-workflow-action-level="primary"/);
  assert.match(heroSectionSource, /data-workflow-action-level="secondary"/);
  assert.match(heroSectionSource, /data-workflow-action-level="tertiary"/);
  assert.equal(
    heroSectionSource.includes('class="workflow-hero-note"'),
    false,
    "expected ContentWorkflowHero to stop rendering a right-side hero note card",
  );
  assert.equal(source.includes("page-hero-aside"), false);
  assert.equal(source.includes("page-status-grid"), false);
  assert.equal(
    source.includes('data-page-layer="explanation"'),
    false,
    "expected ContentEditorView to fold result summaries back into the writing flow instead of keeping a separate explanation rail",
  );
  assert.equal(
    source.includes('data-workflow-zone="recent-result"'),
    false,
    "expected ContentEditorView to stop rendering a separate recent-result panel",
  );
  assert.equal(
    source.includes('class="workflow-inline-note'),
    false,
    "expected ContentEditorView to move the write-result note below the heading instead of keeping it on the right",
  );
  assert.doesNotMatch(source, /workflow-inline-panel priority-panel priority-panel--support/);
  assert.match(source, /workflow-compact-block workflow-result-block/);
  assert.match(source, /写作结果摘要/);
  assert.match(source, /自动流程（后置）/);
  assert.match(source, /data-page-layer="detail"[\s\S]*自动流程（后置）/);
});

test("ContentEditorView redesign extracts hero and existing-content structures into stable content section components", async () => {
  const source = await readFile(contentEditorPath, "utf8");
  const heroSectionSource = await readFile(contentWorkflowHeroPath, "utf8");
  const existingSectionSource = await readFile(existingContentSectionPath, "utf8");

  assert.match(source, /<ContentWorkflowHero[\s\S]*data-workflow-zone="hero"/);
  assert.match(
    source,
    /<ExistingContentSection[\s\S]*data-workflow-zone="existing-content"/,
  );
  assert.doesNotMatch(source, /<section class="panel page-hero" data-workflow-zone="hero">/);
  assert.doesNotMatch(source, /<section[^>]*data-workflow-zone="existing-content"/);

  assert.match(heroSectionSource, /data-workflow-zone="hero"/);
  assert.match(heroSectionSource, /写作中枢/);
  assert.match(heroSectionSource, /前往新建内容/);
  assert.match(heroSectionSource, /继续编辑已有内容/);
  assert.match(heroSectionSource, /查看写作教程/);

  assert.match(existingSectionSource, /data-workflow-zone="existing-content"/);
  assert.match(existingSectionSource, /已有内容二次编辑/);
  assert.match(existingSectionSource, /选择已有内容/);
  assert.match(existingSectionSource, /正文（Markdown）/);
  assert.match(existingSectionSource, /保存标题与正文/);
  assert.match(existingSectionSource, /workflow-section-heading--stacked/);
  assert.match(existingSectionSource, /workflow-compact-block workflow-compact-block--subtle/);
  assert.doesNotMatch(existingSectionSource, /workflow-inline-note/);
  assert.doesNotMatch(existingSectionSource, /<aside/);
});

test("ContentEditorView uses a balanced secondary grid so lower cards stop stretching oversized across pages", async () => {
  const source = await readFile(contentEditorPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.equal(
    source.includes("workflow-balanced-grid"),
    true,
    "expected ContentEditorView.vue to adopt the shared balanced secondary-card grid",
  );
  assert.match(styles, /\.workflow-balanced-grid\s*\{[\s\S]*display:\s*grid;/);
  assert.match(styles, /\.workflow-balanced-grid\s*\{[\s\S]*align-items:\s*stretch;/);
  assert.match(styles, /\.workflow-balanced-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/);
});
