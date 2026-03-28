import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceViewPath = new URL("./WorkspaceView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);
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
  assert.doesNotMatch(heroSectionSource, /page-hero-aside/);
  assert.match(heroSectionSource, /page-status-grid/);
  assert.match(heroSectionSource, /继续工作入口/);

  assert.match(continueSectionSource, /data-workspace-zone="continue-work"/);
  assert.match(continueSectionSource, /最近工作区/);
  assert.match(continueSectionSource, /继续现有工作/);
  assert.match(continueSectionSource, /继续完善/);
  assert.match(continueSectionSource, /继续去主题配置/);
});

test("WorkspaceView makes the preview media the primary lightbox target while keeping theme selection separate", async () => {
  const source = await readFile(workspaceViewPath, "utf8");
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    source,
    /<button[\s\S]*class="[^"]*workspace-theme-preview-trigger[^"]*"[\s\S]*@click="openThemePreview\(item\)"[\s\S]*<img[\s\S]*class="theme-thumb"/,
    "expected preview media area to be the main lightbox trigger",
  );
  assert.match(
    source,
    /<button class="primary" type="button" @click="selectThemeCard\(item\.id\)">/,
    "expected select button to remain the separate theme-selection action",
  );
  assert.doesNotMatch(
    source,
    /放大预览/,
    "expected previewing to move off the separate enlarge button",
  );
  assert.match(
    stylesSource,
    /\.workspace-theme-preview-trigger:hover[\s\S]*\.theme-thumb[\s\S]*transform:\s*scale\(1\.0[0-9]+\)/,
    "expected hover styling to slightly enlarge the preview media",
  );
});

test("WorkspaceView lightbox exposes explicit close controls for button, outside click, and Esc", async () => {
  const source = await readFile(workspaceViewPath, "utf8");
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    source,
    /<dialog[\s\S]*class="theme-preview-lightbox"[\s\S]*@click\.self="closeThemePreview"/,
    "expected outside-click close handling on the preview dialog",
  );
  assert.match(
    source,
    /<dialog[\s\S]*@cancel\.prevent="closeThemePreview"/,
    "expected Esc key handling on the preview dialog",
  );
  assert.match(
    source,
    /<div class="theme-preview-dialog-header">[\s\S]*<h3>{{ themePreviewLightbox\.title }}<\/h3>[\s\S]*<button[\s\S]*class="secondary theme-preview-close"[\s\S]*type="button"[\s\S]*@click="closeThemePreview"[\s\S]*关闭预览[\s\S]*<\/button>/,
    "expected explicit close button to live in the preview header",
  );
  assert.doesNotMatch(
    source,
    /<img :src="themePreviewLightbox\.src" :alt="themePreviewLightbox\.title" \/>[\s\S]*关闭预览/,
    "expected the close button to stay above the preview image instead of below it",
  );
  assert.match(
    stylesSource,
    /\.theme-preview-lightbox[\s\S]*\.theme-preview-dialog img[\s\S]*max-height:/,
    "expected dedicated app-scaled lightbox styling for preview media",
  );
});

test("WorkspaceView lightbox adds zoom controls and resets preview transform state on close", async () => {
  const source = await readFile(workspaceViewPath, "utf8");
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    source,
    /const themePreviewLightbox = reactive\([\s\S]*scale:\s*1[\s\S]*translateX:\s*0[\s\S]*translateY:\s*0[\s\S]*isDragging:\s*false[\s\S]*\)/,
    "expected lightbox state to track zoom scale and pan offsets",
  );
  assert.match(
    source,
    /function resetThemePreviewTransform\(\)[\s\S]*scale\s*=\s*1[\s\S]*translateX\s*=\s*0[\s\S]*translateY\s*=\s*0[\s\S]*isDragging\s*=\s*false/,
    "expected a dedicated reset helper for preview transform state",
  );
  assert.match(
    source,
    /function closeThemePreview\(\)[\s\S]*resetThemePreviewTransform\(\)/,
    "expected closing the lightbox to reset zoom and pan state",
  );
  assert.match(
    source,
    /class="secondary theme-preview-zoom-button"[\s\S]*@click="zoomThemePreview\(0\.2\)"[\s\S]*放大/,
    "expected an explicit zoom-in button inside the lightbox header",
  );
  assert.match(
    source,
    /class="secondary theme-preview-zoom-button"[\s\S]*@click="zoomThemePreview\(-0\.2\)"[\s\S]*缩小/,
    "expected an explicit zoom-out button inside the lightbox header",
  );
  assert.match(
    source,
    /class="secondary theme-preview-reset"[\s\S]*@click="resetThemePreviewTransform"[\s\S]*重置/,
    "expected an explicit reset button for preview transform state",
  );
  assert.match(
    source,
    /class="theme-preview-stage"[\s\S]*@wheel\.prevent="handleThemePreviewWheel"/,
    "expected the preview stage to support wheel-based zooming",
  );
  assert.match(
    source,
    /<img[\s\S]*class="theme-preview-image"[\s\S]*:style="themePreviewImageStyle"/,
    "expected the lightbox image to use reactive transform styling",
  );
  assert.match(
    stylesSource,
    /\.theme-preview-stage[\s\S]*cursor:\s*grab[\s\S]*\.theme-preview-image[\s\S]*transform:/,
    "expected dedicated stage and transformable image styling for zoom interaction",
  );
});
