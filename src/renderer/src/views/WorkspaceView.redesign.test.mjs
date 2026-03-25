import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspaceViewPath = new URL("./WorkspaceView.vue", import.meta.url);

test("WorkspaceView distinguishes new-start and continue-work flows inside the editorial workbench", async () => {
  const source = await readFile(workspaceViewPath, "utf8");

  const requiredHooks = [
    'data-workspace-surface="editorial-workbench"',
    'data-workspace-zone="hero"',
    'data-workspace-zone="new-start"',
    'data-workspace-zone="continue-work"',
    'data-workspace-zone="theme-curation"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected WorkspaceView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(source, /快速创建新博客/);
  assert.match(source, /继续现有工作/);
  assert.match(source, /导入已有项目/);
});

test("WorkspaceView presents theme selection as a curated editorial collection with featured framing", async () => {
  const source = await readFile(workspaceViewPath, "utf8");

  assert.match(source, /精选首发主题/);
  assert.match(source, /推荐继续看/);
  assert.match(source, /theme-display-tag/);
  assert.match(source, /positioningCopy/);
  assert.match(source, /featuredTheme/);
  assert.match(source, /getThemeDisplayMetadata/);
});

test("WorkspaceView foregrounds continue-work actions on recent workspace cards", async () => {
  const source = await readFile(workspaceViewPath, "utf8");

  assert.match(source, /最近工作区/);
  assert.match(source, /继续完善/);
  assert.match(source, /继续去主题配置/);
  assert.match(source, /去内容编辑/);
  assert.match(source, /去本地预览/);
  assert.match(source, /workspace-card/);
});
