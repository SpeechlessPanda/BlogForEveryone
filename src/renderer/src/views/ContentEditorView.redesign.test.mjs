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

test("ContentEditorView hides manual title and slug inputs for canonical special pages", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  assert.match(source, /const SPECIAL_CONTENT_TYPES = \["about", "links", "announcement"\];/);
  assert.match(
    source,
    /const requiresManualContentIdentity = computed\([\s\S]*?!SPECIAL_CONTENT_TYPES\.includes\(form\.type\)[\s\S]*?\);/,
  );
  assert.match(source, /<div v-if="requiresManualContentIdentity"[\s\S]*?<label>标题<\/label>/);
  assert.match(source, /<div v-if="requiresManualContentIdentity"[\s\S]*?<label>slug（可选）<\/label>/);
  assert.match(source, /<div v-else class="workflow-compact-block workflow-compact-block--subtle">/);
  assert.match(source, /关于、友链、公告会自动写入固定路径与默认标题，创建后直接进入编辑器。/);
});

test("ContentEditorView explains that auto-publish reuses publish settings and skips safely when the workspace repo is missing", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  assert.match(source, /保存后自动发布（沿用当前工程已保存的发布与备份仓库信息）/);
  assert.match(source, /会沿用当前工程已保存的站点类型、发布仓库和备份仓库；不会自动代入备份目录或发布页里的临时建仓选项。/);
  assert.match(source, /如果当前工程还没有已保存的发布仓库地址，自动发布会自动跳过，先完成写作与保存。/);
  assert.match(source, /如果当前工程还没有已保存的备份仓库地址，自动发布会自动跳过，先回到发布与备份页补齐备份仓库。/);
  assert.match(source, /如果当前工程是用户主页，但保存的发布仓库不是 用户名\.github\.io，自动发布会先提示你回到发布与备份页修正仓库绑定。/);
  assert.match(source, /已有内容点击“保存标题与正文”后，会直接触发自动发布，不需要再等下一次文件改动。/);
  assert.match(source, /保存后自动发布仍会更新备份仓库，确保 GitHub 恢复拿到的是最新内容。/);
  assert.match(source, /未配置发布仓库，已跳过自动发布。/);
});

test("ContentEditorView surfaces actionable auto-publish messages instead of raw job status codes", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  assert.match(source, /state\.jobStatus = job\.message \|\| job\.status;/);
  assert.match(source, /<p class="muted">任务状态：{{ state\.jobStatus \|\| "-" }}<\/p>/);
});

test("ContentEditorView keeps existing-content saves on the same auto-publish contract as new content", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  const saveExistingBlock = source.match(
    /async function saveExistingContentChanges\(\) \{([\s\S]*?)^\}/m,
  );
  assert.ok(saveExistingBlock, "expected saveExistingContentChanges block");
  const block = saveExistingBlock[1];

  assert.match(block, /await contentActions\.saveExistingContent\(/);
  assert.match(block, /if \(form\.autoPublish\) \{/);
  assert.match(block, /selectedExistingPath\.value/);
  assert.match(block, /publishSavedContent/);
  assert.match(block, /自动发布前需要先在发布与备份页保存备份仓库地址。/);
  assert.match(block, /未配置发布仓库，已跳过自动发布。/);
});
