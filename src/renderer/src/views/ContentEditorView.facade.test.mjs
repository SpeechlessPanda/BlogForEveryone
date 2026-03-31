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

test("ContentEditorView sends canonical special-page payloads without stale manual title or slug fields", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  assert.match(source, /const SPECIAL_CONTENT_TYPES = \["about", "links", "announcement"\];/);
  assert.match(source, /const SPECIAL_CONTENT_DEFAULT_TITLES = \{/);
  assert.match(source, /about:\s*"关于",/);
  assert.match(source, /links:\s*"友链",/);
  assert.match(source, /announcement:\s*"公告",/);
  assert.match(source, /const requiresManualContentIdentity = computed\([\s\S]*!SPECIAL_CONTENT_TYPES\.includes\(form\.type\)[\s\S]*\);/);
  assert.match(source, /const contentTitle = requiresManualContentIdentity\.value[\s\S]*SPECIAL_CONTENT_DEFAULT_TITLES\[form\.type\] \|\| form\.title;/);
  assert.match(source, /const contentSlug = requiresManualContentIdentity\.value \? form\.slug : "";/);
  assert.match(source, /title:\s*contentTitle,/);
  assert.match(source, /slug:\s*contentSlug,/);
});

test("ContentEditorView reuses workspace publish repo for auto-publish and skips the flow safely when no repo is configured", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  assert.match(source, /const autoPublishRepoUrl = ws\.deployRepo\?\.url \|\| "";/);
  assert.match(source, /const autoPublishSiteType = ws\.siteType \|\| "project-pages";/);
  assert.match(source, /const autoPublishLogin = ws\.deployRepo\?\.owner \|\| ws\.backupRepo\?\.owner \|\| "";/);
  assert.match(source, /const autoPublishDeployRepoName = ws\.deployRepo\?\.name \|\| "";/);
  assert.match(source, /const autoPublishBackupRepoName = ws\.backupRepo\?\.name \|\| "";/);
  assert.match(source, /const autoPublishBackupRepoUrl = ws\.backupRepo\?\.url \|\| "";/);
  assert.match(source, /const autoPublishGitUserName = autoPublishIdentity\.value\.name;/);
  assert.match(source, /const autoPublishGitUserEmail = autoPublishIdentity\.value\.email;/);
  assert.match(source, /if \(form\.autoPublish\) \{[\s\S]*?if \(autoPublishRepoUrl\) \{[\s\S]*?repoUrl:\s*autoPublishRepoUrl,[\s\S]*?siteType:\s*autoPublishSiteType,[\s\S]*?login:\s*autoPublishLogin,[\s\S]*?deployRepoName:\s*autoPublishDeployRepoName,[\s\S]*?backupRepoName:\s*autoPublishBackupRepoName,[\s\S]*?backupRepoUrl:\s*autoPublishBackupRepoUrl,[\s\S]*?\}[\s\S]*?else \{[\s\S]*?state\.jobId = "";[\s\S]*?state\.jobStatus = "未配置发布仓库，已跳过自动发布。";[\s\S]*?\}[\s\S]*?\}/);
  assert.match(source, /gitUserName:\s*autoPublishGitUserName,/);
  assert.match(source, /gitUserEmail:\s*autoPublishGitUserEmail,/);
  assert.match(source, /siteType:\s*autoPublishSiteType,/);
  assert.doesNotMatch(source, /watchAndAutoPublish\(\{[\s\S]*?repoUrl:\s*ws\.repoUrl/);
  assert.match(source, /保存后自动发布（沿用当前工程已保存的发布与备份仓库信息）/);
  assert.match(source, /会沿用当前工程已保存的站点类型、发布仓库和备份仓库；不会自动代入备份目录或发布页里的临时建仓选项。/);
  assert.match(source, /如果当前工程是用户主页，但保存的发布仓库不是 用户名\.github\.io，自动发布会先提示你回到发布与备份页修正仓库绑定。/);
  assert.match(source, /保存后自动发布仍会更新备份仓库，确保 GitHub 恢复拿到的是最新内容。/);
  assert.match(source, /未配置发布仓库，已跳过自动发布。/);
});

test("ContentEditorView reuses workspace publish repo for saving existing content too", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  const saveExistingBlock = source.match(
    /async function saveExistingContentChanges\(\) \{([\s\S]*?)^\}/m,
  );
  assert.ok(saveExistingBlock, "expected saveExistingContentChanges block");
  const block = saveExistingBlock[1];

  assert.match(block, /const autoPublishRepoUrl = ws\.deployRepo\?\.url \|\| "";/);
  assert.match(block, /const autoPublishSiteType = ws\.siteType \|\| "project-pages";/);
  assert.match(block, /const autoPublishLogin = ws\.deployRepo\?\.owner \|\| ws\.backupRepo\?\.owner \|\| "";/);
  assert.match(block, /const autoPublishDeployRepoName = ws\.deployRepo\?\.name \|\| "";/);
  assert.match(block, /const autoPublishBackupRepoName = ws\.backupRepo\?\.name \|\| "";/);
  assert.match(block, /const autoPublishBackupRepoUrl = ws\.backupRepo\?\.url \|\| "";/);
  assert.match(block, /const autoPublishGitUserName = autoPublishIdentity\.value\.name;/);
  assert.match(block, /const autoPublishGitUserEmail = autoPublishIdentity\.value\.email;/);
  assert.match(block, /await contentActions\.saveExistingContent\(/);
  assert.match(block, /if \(form\.autoPublish\) \{/);
  assert.match(block, /if \(autoPublishRepoUrl\) \{/);
  assert.match(block, /filePath:\s*selectedExistingPath\.value,/);
  assert.match(block, /contentActions\.publishSavedContent\(/);
  assert.match(block, /repoUrl:\s*autoPublishRepoUrl,/);
  assert.match(block, /siteType:\s*autoPublishSiteType,/);
  assert.match(block, /login:\s*autoPublishLogin,/);
  assert.match(block, /deployRepoName:\s*autoPublishDeployRepoName,/);
  assert.match(block, /backupRepoName:\s*autoPublishBackupRepoName,/);
  assert.match(block, /backupRepoUrl:\s*autoPublishBackupRepoUrl,/);
  assert.match(block, /gitUserName:\s*autoPublishGitUserName,/);
  assert.match(block, /gitUserEmail:\s*autoPublishGitUserEmail,/);
  assert.match(block, /state\.jobStatus = "未配置发布仓库，已跳过自动发布。";/);
});

test("ContentEditorView prefers backend job messages over raw status codes for auto-publish feedback", async () => {
  const source = await readFile(contentEditorPath, "utf8");

  assert.match(source, /state\.jobStatus = job\.message \|\| job\.status;/);
  assert.match(source, /const job = await contentActions\.publishSavedContent\(/);
  assert.match(source, /const job = await contentActions\.watchAndAutoPublish\(/);
  assert.match(source, /const job = await contentActions\.getPublishJobStatus\(/);
});
