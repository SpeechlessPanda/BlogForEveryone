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

test("ContentEditorView uses content facade instead of raw window.bfeApi content calls", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  assert.match(source, /useContentActions/);
  assert.match(source, /const contentActions = useContentActions\(\)/);
  assert.match(source, /useShellActions/);
  assert.match(source, /const shellActions = useShellActions\(\)/);

  const forbiddenCalls = [
    "createAndOpenContent",
    "watchAndAutoPublish",
    "listExistingContents",
    "readExistingContent",
    "saveExistingContent",
    "openExistingContent",
    "getPublishJobStatus",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected ContentEditorView.vue to stop calling window.bfeApi.${method}`,
    );
  }

  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.match(source, /shellActions\.openTutorial\("content-editing"\)/);
});

test("ContentEditorView delegates hero and existing-content sections behind content section components", async () => {
  const source = await readFile(contentEditorPath, "utf8");
  const heroSectionSource = await readFile(contentWorkflowHeroPath, "utf8");
  const existingSectionSource = await readFile(existingContentSectionPath, "utf8");

  assert.match(
    source,
    /import ContentWorkflowHero from "\.\.\/components\/content\/ContentWorkflowHero\.vue"/,
  );
  assert.match(
    source,
    /import ExistingContentSection from "\.\.\/components\/content\/ExistingContentSection\.vue"/,
  );
  assert.match(source, /<ContentWorkflowHero[\s\S]*data-workflow-zone="hero"/);
  assert.match(
    source,
    /<ExistingContentSection[\s\S]*data-workflow-zone="existing-content"/,
  );
  assert.doesNotMatch(source, /<section class="panel page-hero" data-workflow-zone="hero">/);
  assert.doesNotMatch(source, /<section[^>]*data-workflow-zone="existing-content"/);

  assert.match(heroSectionSource, /写作中枢/);
  assert.match(heroSectionSource, /前往新建内容/);
  assert.match(heroSectionSource, /继续编辑已有内容/);
  assert.match(heroSectionSource, /当前工作区/);
  assert.match(heroSectionSource, /当前内容状态/);
  assert.match(heroSectionSource, /建议下一步/);

  assert.match(existingSectionSource, /已有内容二次编辑/);
  assert.match(existingSectionSource, /选择已有内容/);
  assert.match(existingSectionSource, /保存标题与正文/);
  assert.match(existingSectionSource, /用外部编辑器打开/);
});
