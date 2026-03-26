import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contentEditorPath = new URL("./ContentEditorView.vue", import.meta.url);
const contentWorkflowHeroPath = new URL(
  "../components/content/ContentWorkflowHero.vue",
  import.meta.url,
);
const existingContentSectionPath = new URL(
  "../components/content/ExistingContentSection.vue",
  import.meta.url,
);

test("ContentEditorView keeps the writing hub flow while removing duplicated hero summary cards", async () => {
  const source = await readFile(contentEditorPath, "utf8");
  const heroSectionSource = await readFile(contentWorkflowHeroPath, "utf8");

  const requiredHooks = [
    'data-page-role="content-editor"',
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="create-content"',
    'data-workflow-zone="existing-content"',
    'data-workflow-zone="recent-result"',
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
  assert.equal(source.includes("page-hero-aside"), false);
  assert.equal(source.includes("page-status-grid"), false);
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
});
