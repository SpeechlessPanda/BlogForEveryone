import test from "node:test";
import assert from "node:assert/strict";

import { createPublishBackupActions } from "./usePublishBackupActions.mjs";

test("publish/backup actions preserve publish and backup payloads", async () => {
  const calls = [];
  const api = {
    publishToGitHub: async (payload) => {
      calls.push(["publishToGitHub", payload]);
      return { ok: true, pagesUrl: "https://demo.github.io" };
    },
    backupWorkspace: async (payload) => {
      calls.push(["backupWorkspace", payload]);
      return { ok: true };
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
    repoUrl: "https://github.com/demo/demo.github.io.git",
    publishMode: "actions",
    gitUserName: "demo",
    gitUserEmail: "demo@example.com",
  });
  await actions.backupWorkspace({
    projectDir: "D:/blogs/demo",
    backupDir: "D:/backup",
    repoUrl: "https://github.com/demo/blog-backup.git",
    visibility: "private",
  });
  await actions.pickDirectory({ title: "选择备份目录", defaultPath: "D:/backup" });
  await actions.getGithubAuthState();

  assert.deepEqual(calls, [
    ["publishToGitHub", {
      projectDir: "D:/blogs/demo",
      framework: "hexo",
      repoUrl: "https://github.com/demo/demo.github.io.git",
      publishMode: "actions",
      gitUserName: "demo",
      gitUserEmail: "demo@example.com",
    }],
    ["backupWorkspace", {
      projectDir: "D:/blogs/demo",
      backupDir: "D:/backup",
      repoUrl: "https://github.com/demo/blog-backup.git",
      visibility: "private",
    }],
    ["pickDirectory", { title: "选择备份目录", defaultPath: "D:/backup" }],
    ["getGithubAuthState"],
  ]);
});

test("publish/backup actions reject missing projectDir for workspace work", async () => {
  const actions = createPublishBackupActions({
    publishToGitHub: async () => ({}),
    backupWorkspace: async () => ({}),
    pickDirectory: async () => ({}),
    getGithubAuthState: async () => ({}),
  });

  await assert.rejects(
    () => actions.publishToGitHub({ framework: "hexo", repoUrl: "https://github.com/demo/demo.github.io.git" }),
    /projectDir/,
  );
  await assert.rejects(
    () => actions.backupWorkspace({ backupDir: "D:/backup" }),
    /projectDir/,
  );
});
