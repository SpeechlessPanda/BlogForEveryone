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

test("WorkspaceView uses workspace facade instead of raw window.bfeApi workspace calls", async () => {
  const source = await readFile(workspaceViewPath, "utf8");

  assert.match(source, /useWorkspaceActions/);
  assert.match(source, /const workspaceActions = useWorkspaceActions\(\)/);
  assert.match(source, /useShellActions/);
  assert.match(source, /const shellActions = useShellActions\(\)/);
  assert.match(source, /workspaceActions\.createWorkspace\(/);
  assert.match(source, /workspaceActions\.pickDirectory\(/);
  assert.match(source, /workspaceActions\.removeWorkspace\(/);

  const forbiddenCalls = [
    "createWorkspace",
    "pickDirectory",
    "removeWorkspace",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected WorkspaceView.vue to stop calling window.bfeApi.${method}`,
    );
  }

  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tab"/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.match(source, /shellActions\.openTab\("import"\)/);
  assert.match(source, /shellActions\.openTab\("theme"\)/);
  assert.match(source, /shellActions\.openTab\("content"\)/);
  assert.match(source, /shellActions\.openTab\("preview"\)/);
});

test("WorkspaceView exposes the workflow-entry hierarchy cues for blog, stage, next action, and blocker state", async () => {
  const source = await readFile(workspaceViewPath, "utf8");
  const heroSectionSource = await readFile(workspaceHeroSectionPath, "utf8");

  assert.match(source, /data-page-role="workspace"/);
  assert.match(
    source,
    /data-page-layer="primary"[\s\S]*data-page-layer="explanation"[\s\S]*data-page-layer="detail"/,
  );
  assert.match(heroSectionSource, /当前博客/);
  assert.match(heroSectionSource, /当前阶段/);
  assert.match(heroSectionSource, /建议下一步/);
  assert.match(heroSectionSource, /当前阻塞/);
});

test("WorkspaceView delegates stable hero and continue sections behind workspace section components", async () => {
  const source = await readFile(workspaceViewPath, "utf8");
  const heroSectionSource = await readFile(workspaceHeroSectionPath, "utf8");
  const continueSectionSource = await readFile(
    workspaceContinueSectionPath,
    "utf8",
  );

  assert.match(
    source,
    /import WorkspaceHeroSection from "\.\.\/components\/workspace\/WorkspaceHeroSection\.vue"/,
  );
  assert.match(
    source,
    /import WorkspaceContinueSection from "\.\.\/components\/workspace\/WorkspaceContinueSection\.vue"/,
  );
  assert.match(source, /<WorkspaceHeroSection[\s\S]*data-workspace-zone="hero"/);
  assert.match(
    source,
    /<WorkspaceContinueSection[\s\S]*data-workspace-zone="continue-work"/,
  );
  assert.doesNotMatch(source, /<section class="panel page-hero workspace-hero"/);
  assert.doesNotMatch(source, /<section[^>]*data-workspace-zone="continue-work"/);

  assert.match(heroSectionSource, /博客创建工作台/);
  assert.match(heroSectionSource, /快速创建新博客/);
  assert.match(heroSectionSource, /继续现有工作/);
  assert.match(heroSectionSource, /导入已有项目/);
  assert.match(heroSectionSource, /当前博客/);
  assert.match(heroSectionSource, /当前阶段/);
  assert.match(heroSectionSource, /建议下一步/);
  assert.match(heroSectionSource, /当前阻塞/);

  assert.match(continueSectionSource, /最近工作区/);
  assert.match(continueSectionSource, /继续完善/);
  assert.match(continueSectionSource, /继续去主题配置/);
  assert.match(continueSectionSource, /去内容编辑/);
  assert.match(continueSectionSource, /去本地预览/);
});
