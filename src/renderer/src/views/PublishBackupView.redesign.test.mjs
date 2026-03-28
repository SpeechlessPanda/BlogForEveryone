import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publishBackupViewPath = new URL("./PublishBackupView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);

test("PublishBackupView refits the page into one coordinated publish-plus-backup workbench", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  const requiredHooks = [
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="hero-actions"',
    'data-workflow-zone="publish-workbench"',
    'data-workflow-zone="recent-result"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected PublishBackupView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(source, /前往发布工作台/);
  assert.match(source, /查看最近结果/);
  assert.match(source, /查看仓库命名规则/);
  assert.match(source, /data-workflow-action-level="primary"/);
  assert.match(source, /data-workflow-action-level="secondary"/);
  assert.match(source, /data-workflow-action-level="tertiary"/);
  assert.equal(source.includes("page-hero-aside"), false);
  assert.equal(source.includes("workflow-hero-note"), false);
  assert.equal(source.includes("workflow-inline-note"), false);
  assert.equal(source.includes("page-status-grid"), false);
  assert.match(source, /workflow-status-grid/);
  assert.doesNotMatch(source, /workflow-inline-panel/);
  assert.doesNotMatch(source, /context-card/);
  assert.match(source, /workflow-compact-block workflow-result-block/);
  assert.match(source, /workflow-compact-block workflow-compact-block--support/);
  assert.equal(source.includes('data-workflow-zone="backup-workbench"'), false);
  assert.match(source, /统一发布与备份/);
  assert.match(source, /GitHub Pages 站点类型/);
  assert.match(source, /固定备份仓库：BFE/);
  assert.match(source, /用户名\.github\.io/);
  assert.match(source, /publish-outcome-list/);
  assert.match(source, /最近结果/);
});

test("PublishBackupView uses wrap-capable access-address and result surfaces for long URLs", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(source, /class="workflow-access-address"/);
  assert.doesNotMatch(source, /<input :value="accessAddress" disabled \/>/);
  assert.match(source, /class="workflow-compact-block workflow-compact-block--support"/);
  assert.match(stylesSource, /\.workflow-access-address,[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(stylesSource, /\.workflow-result-block,[\s\S]*min-width:\s*0/);
  assert.match(stylesSource, /\.publish-outcome-list[\s\S]*min-width:\s*0/);
});

test("PublishBackupView removes manual-friction GitHub username copy while keeping repo naming guidance", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.doesNotMatch(source, /待补充：填写 GitHub 用户名。/);
  assert.match(source, /待补充：先登录 GitHub 以自动带入用户名。/);
  assert.match(source, /GitHub 用户名（登录后自动带入，可手动调整）/);
  assert.match(source, /登录后会自动带入 GitHub 用户名；如需发布到其他账号，可手动调整。/);
  assert.match(source, /用户站点固定命名为 <code>用户名\.github\.io<\/code>/);
  assert.match(source, /项目站点访问地址示例：<code>https:\/\/用户名\.github\.io\/仓库名\/<\/code>/);
  assert.match(source, /当前仓库：\{\{ resolvedDeployRepoName \|\| "等待填写" \}\}/);
  assert.match(source, /<label>固定备份仓库<\/label>[\s\S]*<input v-model="publishForm\.backupRepoName" disabled \/>/);
  assert.match(source, /<label>固定备份仓库<\/label>[\s\S]*<p class="muted stack-top">\{\{ backupRepoUrl \|\| "等待填写 GitHub 用户名" \}\}<\/p>/);
});

test("PublishBackupView trims manual login input before readiness, URL preview, and publish payload use", async () => {
  const source = await readFile(publishBackupViewPath, "utf8");

  assert.match(source, /const\s+normalizedPublishLogin\s*=\s*computed\(\(\)\s*=>[\s\S]*String\(publishForm\.login\s*\|\|\s*""\)\.trim\(\)[\s\S]*\)/);
  assert.match(source, /publishReadiness\s*=\s*computed\(\(\)\s*=>\s*\{[\s\S]*if\s*\(!normalizedPublishLogin\.value\)\s*\{/);
  assert.match(source, /normalizedPublishLogin\.value/);
  assert.match(source, /\.github\.io/);
  assert.match(source, /buildGithubRepoUrl\(normalizedPublishLogin\.value,\s*resolvedDeployRepoName\.value\)/);
  assert.match(source, /buildGithubRepoUrl\(normalizedPublishLogin\.value,\s*publishForm\.backupRepoName\)/);
  assert.match(source, /https:\/\/\$\{normalizedPublishLogin\.value\}\.github\.io\//);
  assert.match(source, /login:\s*normalizedPublishLogin\.value,/);
});
