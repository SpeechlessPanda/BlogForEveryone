import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const importViewPath = new URL("./ImportView.vue", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);

test("ImportView adds a dedicated GitHub-direct recovery path alongside local import", async () => {
  const source = await readFile(importViewPath, "utf8");

  const requiredHooks = [
    'data-workflow-surface="editorial-workflow"',
    'data-workflow-zone="hero"',
    'data-workflow-zone="hero-actions"',
    'data-workflow-zone="local-import-workbench"',
    'data-workflow-zone="github-import-workbench"',
    'data-workflow-zone="recent-result"',
    'data-workflow-zone="rss-restore"',
  ];

  for (const hook of requiredHooks) {
    assert.equal(
      source.includes(hook),
      true,
      `expected ImportView.vue to include redesign hook: ${hook}`,
    );
  }

  assert.match(source, /前往本地导入/);
  assert.match(source, /前往 GitHub 恢复/);
  assert.match(source, /查看最近结果/);
  assert.match(source, /data-workflow-action-level="primary"/);
  assert.match(source, /data-workflow-action-level="secondary"/);
  assert.match(source, /data-workflow-action-level="tertiary"/);
  assert.equal(source.includes("page-hero-aside"), false);
  assert.equal(source.includes("workflow-hero-note"), false);
  assert.equal(source.includes("page-status-grid"), false);
  assert.match(source, /workflow-status-grid/);
  assert.match(source, /接回主流程/);
  assert.match(source, /GitHub 直接恢复/);
  assert.match(source, /目标恢复目录/);
  assert.match(source, /导入结果摘要/);
  assert.match(source, /useShellActions/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tab"/);
  assert.match(source, /shellActions\.openTutorial\("import-recovery"\)/);
  assert.match(source, /shellActions\.openTab\("workspace"\)/);
});

test("ImportView uses the shared balanced secondary grid for lower result and restore cards", async () => {
  const source = await readFile(importViewPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.equal(source.includes("workflow-balanced-grid"), true);
  assert.match(styles, /\.workflow-balanced-grid\s*\{[\s\S]*display:\s*grid;/);
});

test("ImportView keeps in-page navigation in a view-owned enter-at-top helper", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.equal(
    source.includes("jumpToZone"),
    true,
    "expected ImportView.vue to define a view-owned jumpToZone helper",
  );
  assert.match(source, /scrollIntoView\(\{\s*behavior:\s*["']smooth["'],\s*block:\s*["']start["']\s*\}\)/);
  assert.doesNotMatch(source, /\$el\?\.querySelector\([^)]*\)\?\.scrollIntoView/);
});

test("ImportView guides the user toward choosing only the destination path after exact repo autodetect", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.match(source, /基于当前 GitHub 登录名精确匹配/);
  assert.match(source, /`\$\{login\}\.github\.io`/);
  assert.match(source, /下一步只需选择目标恢复目录/);
  assert.match(source, /已自动识别发布仓库和 BFE 备份仓库/);
  assert.match(source, /已自动识别 BFE 备份仓库；如果发布仓库没有唯一精确匹配，可继续手动选择/);
  assert.match(source, /会基于当前 GitHub 登录名精确匹配 `\$\{login\}\.github\.io` 和 `BFE`；未命中或不唯一时可继续手动选择/);
});

test("ImportView keeps a manual recovery path when repo autodetect cannot safely resolve", async () => {
  const source = await readFile(importViewPath, "utf8");

  assert.match(source, /const githubRepoLoadFailed = ref\(false\)/);
  assert.match(source, /if \(githubRepoLoadFailed\.value\) \{[\s\S]*可手动填写恢复仓库地址继续操作/);
  assert.match(source, /如果 GitHub 仓库列表暂时加载失败，可手动填写恢复仓库地址继续操作/);
  assert.match(source, /v-if="githubRepos.length"/);
  assert.match(source, /v-else[\s\S]*placeholder="https:\/\/github.com\/用户名\/用户名\.github\.io\.git"/);
  assert.match(source, /v-else[\s\S]*placeholder="https:\/\/github.com\/用户名\/BFE\.git"/);
  assert.match(source, /已自动识别 BFE 备份仓库；如果发布仓库没有唯一精确匹配，可继续手动选择/);
  assert.match(source, /githubBackupRepoChoices/);
  assert.match(source, /v-if="githubBackupRepoChoices.length"/);
  assert.match(source, /v-for="repo in githubBackupRepoChoices"/);
  assert.match(source, /未在列表中发现 BFE 时，可直接手动填写仓库地址继续恢复/);
  assert.match(source, /备份仓库必须为 BFE/);
});
