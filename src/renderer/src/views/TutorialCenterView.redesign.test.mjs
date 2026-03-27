import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tutorialViewPath = new URL("./TutorialCenterView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);

test("TutorialCenterView exposes the required sectioned tutorial surface and single-purpose tutorial set", async () => {
  const source = await readFile(tutorialViewPath, "utf8");
  const publishParentSection = source.match(/id: "tutorial-publish-release"[\s\S]*?notes:\s*\[[\s\S]*?\],/);
  const importParentSection = source.match(/id: "tutorial-import-recovery"[\s\S]*?notes:\s*\[[\s\S]*?\],/);

  assert.ok(publishParentSection, "expected to capture the publish parent tutorial section");
  assert.ok(importParentSection, "expected to capture the import parent tutorial section");

  const publishParent = publishParentSection[0];
  const importParent = importParentSection[0];

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

  const requiredTutorialTitles = [
    /user site vs project site/i,
    /deploy repository naming rules/i,
    /backup repository purpose and naming/i,
    /first publish prerequisites/i,
    /sign in to GitHub/i,
    /publish with GitHub Actions/i,
    /understand the final blog address/i,
    /import from GitHub into a local path/i,
    /recover from backup\/import differences/i,
    /base URL \/ subpath mismatch repair/i,
  ];

  for (const title of requiredTutorialTitles) {
    assert.match(source, title);
  }

  assert.match(source, /固定备份仓库名必须使用 <code>BFE<\/code>/);
  assert.match(source, /GitHub 直连导入时，以备份仓库 <code>BFE<\/code> 作为权威导入源/);
  assert.match(source, /tutorial-callout tutorial-callout--warning/);
  assert.match(source, /tutorial-cluster-grid/);
  assert.match(source, /tutorial-lesson-card/);
  assert.match(source, /https:\/\/用户名\.github\.io\//);
  assert.match(source, /users\.noreply\.github\.com/);
  assert.match(source, /GitHub Actions/);
  assert.doesNotMatch(source, /title: "发布、账号与访问地址"/);
  assert.doesNotMatch(source, /仓库地址、Git 身份、OAuth 登录和 Pages 地址都在这里串起来/);

  assert.match(publishParent, /本节是首次发布的索引页|本节先做首次发布路线图/);
  assert.match(publishParent, /先挑出和你当前问题完全对应的单用途卡片/);
  assert.match(publishParent, /看完单卡后回到发布与备份页完成当前动作/);
  assert.match(publishParent, /不要在这里继续把站点类型、仓库命名、登录、发布与地址混成一节/);
  assert.doesNotMatch(publishParent, /GitHub 用户名、站点类型、发布仓库名和本地备份目录/);
  assert.doesNotMatch(publishParent, /Git 提交用户名与邮箱一次填全/);
  assert.doesNotMatch(publishParent, /GitHub Settings → Pages/);
  assert.doesNotMatch(publishParent, /OAuth Device Flow 常见报错/);

  assert.match(importParent, /本节是导入与恢复的分流入口|本节先帮你判断该看哪张恢复卡片/);
  assert.match(importParent, /先判断你现在是本地导入、GitHub 恢复，还是路径修复/);
  assert.match(importParent, /看完对应单卡后回到导入页或原来的工作流页面继续操作/);
  assert.match(importParent, /不要在这里把导入、恢复、发布修复混成同一节/);
  assert.doesNotMatch(importParent, /导入成功后，先去主题配置确认识别结果，再做本地预览和发布检查/);
  assert.doesNotMatch(importParent, /如果只是恢复旧工程，不要重复创建新工作区/);
  assert.doesNotMatch(importParent, /导入后优先去主题配置，再去本地预览，最后确认发布和访问地址/);
  assert.doesNotMatch(importParent, /如果导入后页面资源路径不对/);
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
  assert.match(stylesSource, /\.tutorial-directory-card,[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(stylesSource, /\.tutorial-lesson-card,[\s\S]*min-width:\s*0/);
  assert.match(stylesSource, /\.tutorial-callout--warning/);
});
