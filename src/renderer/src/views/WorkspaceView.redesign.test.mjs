import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceViewPath = new URL("./WorkspaceView.vue", import.meta.url);
const workspaceHeroSectionPath = new URL(
  "../components/workspace/WorkspaceHeroSection.vue",
  import.meta.url,
);
const workspaceContinueSectionPath = new URL(
  "../components/workspace/WorkspaceContinueSection.vue",
  import.meta.url,
);

test("WorkspaceView keeps new-start and continue-work flows while moving themes into one shared selection zone", async () => {
  const source = await readFile(workspaceViewPath, "utf8");
  const heroSectionSource = await readFile(workspaceHeroSectionPath, "utf8");

  const requiredHooks = [
    'data-workspace-surface="editorial-workbench"',
    'data-workspace-zone="hero"',
    'data-workspace-zone="new-start"',
    'data-workspace-zone="continue-work"',
    'data-workspace-zone="theme-selection"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected WorkspaceView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(heroSectionSource, /快速创建新博客/);
  assert.match(heroSectionSource, /继续现有工作/);
  assert.match(heroSectionSource, /导入已有项目/);
});

test("WorkspaceView keeps theme selection unified and lightbox-capable instead of splitting featured recommendations", async () => {
  const source = await readFile(workspaceViewPath, "utf8");

  assert.equal(
    source.includes('data-workspace-zone="theme-selection"'),
    true,
    "expected WorkspaceView.vue to expose a single theme-selection zone",
  );
  assert.doesNotMatch(source, /精选首发主题|推荐继续看|编辑部精选/);
  assert.doesNotMatch(
    source,
    /featuredTheme|recommendedThemes|getThemeDisplayMetadata|featuredThemeIdByFramework|recommendedThemeIdsByFramework/,
  );
  assert.doesNotMatch(source, /<label>\s*主题\s*<\/label>[\s\S]*<select\s+v-model="form\.theme"/);
  assert.match(
    source,
    /<(dialog|Teleport)[\s\S]*(theme-preview|preview-dialog|lightbox)/i,
  );
});

test("WorkspaceView foregrounds continue-work actions on recent workspace cards", async () => {
  const continueSectionSource = await readFile(workspaceContinueSectionPath, "utf8");

  assert.match(continueSectionSource, /最近工作区/);
  assert.match(continueSectionSource, /继续完善/);
  assert.match(continueSectionSource, /继续去主题配置/);
  assert.match(continueSectionSource, /去内容编辑/);
  assert.match(continueSectionSource, /去本地预览/);
  assert.match(continueSectionSource, /workspace-card/);
});

test("WorkspaceView redesign extracts hero and continue-work structures into stable workspace section components", async () => {
  const source = await readFile(workspaceViewPath, "utf8");
  const heroSectionSource = await readFile(workspaceHeroSectionPath, "utf8");
  const continueSectionSource = await readFile(
    workspaceContinueSectionPath,
    "utf8",
  );

  assert.match(source, /<WorkspaceHeroSection[\s\S]*data-workspace-zone="hero"/);
  assert.match(
    source,
    /<WorkspaceContinueSection[\s\S]*data-workspace-zone="continue-work"/,
  );
  assert.doesNotMatch(source, /<section class="panel page-hero workspace-hero"/);
  assert.doesNotMatch(source, /<section[^>]*data-workspace-zone="continue-work"/);

  assert.match(heroSectionSource, /data-workspace-zone="hero"/);
  assert.match(heroSectionSource, /博客创建工作台/);
  assert.match(heroSectionSource, /Workflow entry/);
  assert.match(heroSectionSource, /快速创建新博客/);
  assert.match(heroSectionSource, /继续现有工作/);
  assert.match(heroSectionSource, /导入已有项目/);

  assert.match(continueSectionSource, /data-workspace-zone="continue-work"/);
  assert.match(continueSectionSource, /最近工作区/);
  assert.match(continueSectionSource, /继续现有工作/);
  assert.match(continueSectionSource, /继续完善/);
  assert.match(continueSectionSource, /继续去主题配置/);
});
