import test from "node:test";
import assert from "node:assert/strict";

import { createPublishBackupActions } from "./usePublishBackupActions.mjs";

test("publish actions preserve the unified publish-plus-backup payload", async () => {
  const calls = [];
  const api = {
    publishToGitHub: async (payload) => {
      calls.push(["publishToGitHub", payload]);
      return { ok: true, pagesUrl: "https://demo.github.io" };
    },
    pickDirectory: async (payload) => {
      calls.push(["pickDirectory", payload]);
      return { canceled: false, path: "D:/backup" };
    },
    getGithubAuthState: async () => {
      calls.push(["getGithubAuthState"]);
      return { isLoggedIn: true, account: { login: "demo" } };
    },
  };

  const actions = createPublishBackupActions(api);

  await actions.publishToGitHub({
    projectDir: "D:/blogs/demo",
    framework: "hexo",
    siteType: "project-pages",
    login: "demo",
    deployRepoName: "demo-site",
    backupRepoName: "BFE",
    repoUrl: "https://github.com/demo/demo-site.git",
    backupRepoUrl: "https://github.com/demo/BFE.git",
    createDeployRepo: true,
    createBackupRepo: false,
    backupDir: "D:/backup",
    publishMode: "actions",
    gitUserName: "demo",
    gitUserEmail: "demo@example.com",
  });
  await actions.pickDirectory({ title: "选择本地备份目录", defaultPath: "D:/backup" });
  await actions.getGithubAuthState();

  assert.deepEqual(calls, [
    ["publishToGitHub", {
      projectDir: "D:/blogs/demo",
      framework: "hexo",
      siteType: "project-pages",
      login: "demo",
      deployRepoName: "demo-site",
      backupRepoName: "BFE",
      repoUrl: "https://github.com/demo/demo-site.git",
      backupRepoUrl: "https://github.com/demo/BFE.git",
      createDeployRepo: true,
      createBackupRepo: false,
      backupDir: "D:/backup",
      publishMode: "actions",
      gitUserName: "demo",
      gitUserEmail: "demo@example.com",
    }],
    ["pickDirectory", { title: "选择本地备份目录", defaultPath: "D:/backup" }],
    ["getGithubAuthState"],
  ]);
});

test("publish actions reject missing projectDir for workspace work", async () => {
  const actions = createPublishBackupActions({
    publishToGitHub: async () => ({}),
    pickDirectory: async () => ({}),
    getGithubAuthState: async () => ({}),
  });

  await assert.rejects(
    () => actions.publishToGitHub({ framework: "hexo", repoUrl: "https://github.com/demo/demo-site.git" }),
    /projectDir/,
  );
});
