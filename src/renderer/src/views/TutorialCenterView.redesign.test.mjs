import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tutorialViewPath = new URL("./TutorialCenterView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);

test("TutorialCenterView exposes the required sectioned tutorial surface and guide-driven content", async () => {
  const source = await readFile(tutorialViewPath, "utf8");

  const requiredSectionIds = [
    'id: "tutorial-workspace-create"',
    'id: "tutorial-theme-config"',
    'id: "tutorial-content-editing"',
    'id: "tutorial-preview-check"',
    'id: "tutorial-publish-release"',
    'id: "tutorial-import-recovery"',
    'id: "tutorial-rss-reading"',
  ];

  assert.equal(source.includes('id="tutorial-home"'), true);

  for (const hook of requiredSectionIds) {
    assert.equal(
      source.includes(hook),
      true,
      `expected TutorialCenterView.vue to include tutorial section: ${hook}`,
    );
  }

  assert.match(source, /data-tutorial-surface="sectioned-tutorial-center"/);
  assert.doesNotMatch(source, /data-tutorial-surface="editorial-workbench"/);
  assert.doesNotMatch(source, /workspaceState\.workspaces/);
  assert.doesNotMatch(source, /themeExplorationTracks/);
  assert.match(source, /在软件里怎么做/);
  assert.match(source, /完成检查点 \/ 下一步/);
  assert.match(source, /打开对应页面/);
  assert.match(source, /https:\/\/用户名\.github\.io\//);
  assert.match(source, /users\.noreply\.github\.com/);
  assert.match(source, /GitHub Actions/);
  assert.match(source, /incorrect_client_credentials/);
  assert.match(source, /pnpm run build:renderer/);
  assert.match(source, /pnpm exec node --test/);
});

test("TutorialCenterView maps tutorial targets to sections and scrolls after the tutorial tab activates", async () => {
  const source = await readFile(tutorialViewPath, "utf8");

  assert.match(source, /tutorialTarget/);
  assert.match(source, /useShellActions/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tab"/);
  assert.match(source, /shellActions\.openTab\(/);
  assert.match(source, /nextTick/);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /document\.getElementById\(resolveTutorialSectionId\(target\)\)/);
  assert.match(source, /return `tutorial-\$\{target\}`/);
});

test("TutorialCenterView keeps the hero intro full width and moves guidance cards below the title flow", async () => {
  const source = await readFile(tutorialViewPath, "utf8");
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.equal(source.includes("tutorial-home-aside"), false);
  assert.equal(source.includes("page-hero-grid tutorial-home-grid"), false);
  assert.match(source, /<div class="tutorial-home-guidance-grid">[\s\S]*怎么使用[\s\S]*主流程顺序[\s\S]*<\/div>/);
  assert.match(source, /<div class="tutorial-home-guidance-grid">[\s\S]*<\/div>[\s\S]*<div class="tutorial-directory-grid">/);
  assert.match(stylesSource, /\.tutorial-home-guidance-grid,[\s\S]*\.tutorial-flow-grid\s*\{/);
});
