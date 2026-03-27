import test from "node:test";
import assert from "node:assert/strict";

import { createImportActions } from "./useImportActions.mjs";

test("import actions preserve local import, GitHub import, and repo listing payloads", async () => {
  const calls = [];
  const api = {
    importWorkspace: async (payload) => {
      calls.push(["importWorkspace", payload]);
      return { ok: true, workspace: { id: "ws-1" } };
    },
    importWorkspaceFromGithub: async (payload) => {
      calls.push(["importWorkspaceFromGithub", payload]);
      return { ok: true, workspace: { id: "ws-2" } };
    },
    listGithubRepos: async (payload) => {
      calls.push(["listGithubRepos", payload]);
      return [{ owner: "demo", name: "BFE", url: "https://github.com/demo/BFE.git" }];
    },
    pickDirectory: async (payload) => {
      calls.push(["pickDirectory", payload]);
      return { canceled: false, path: "D:/old-blog" };
    },
    importSubscriptions: async (payload) => {
      calls.push(["importSubscriptions", payload]);
      return { ok: true };
    },
  };

  const actions = createImportActions(api);

  await actions.importWorkspace({ name: "Old Blog", projectDir: "D:/old-blog" });
  await actions.listGithubRepos({ visibility: "all" });
  await actions.importWorkspaceFromGithub({
    name: "Remote Blog",
    localDestinationPath: "D:/restored-blog",
    siteType: "project-pages",
    deployRepo: {
      owner: "demo",
      name: "demo-site",
      url: "https://github.com/demo/demo-site.git",
    },
    backupRepo: {
      owner: "demo",
      name: "BFE",
      url: "https://github.com/demo/BFE.git",
    },
  });
  await actions.pickDirectory({
    title: "选择已存在的博客工程目录",
    defaultPath: "D:/old-blog",
  });
  await actions.importSubscriptions({
    projectDir: "D:/old-blog",
    strategy: "merge",
  });

  assert.deepEqual(calls, [
    ["importWorkspace", { name: "Old Blog", projectDir: "D:/old-blog" }],
    ["listGithubRepos", { visibility: "all" }],
    ["importWorkspaceFromGithub", {
      name: "Remote Blog",
      localDestinationPath: "D:/restored-blog",
      siteType: "project-pages",
      deployRepo: {
        owner: "demo",
        name: "demo-site",
        url: "https://github.com/demo/demo-site.git",
      },
      backupRepo: {
        owner: "demo",
        name: "BFE",
        url: "https://github.com/demo/BFE.git",
      },
    }],
    ["pickDirectory", {
      title: "选择已存在的博客工程目录",
      defaultPath: "D:/old-blog",
    }],
    ["importSubscriptions", { projectDir: "D:/old-blog", strategy: "merge" }],
  ]);
});

test("import actions reject missing required workspace paths", async () => {
  const actions = createImportActions({
    importWorkspace: async () => ({}),
    importWorkspaceFromGithub: async () => ({}),
    listGithubRepos: async () => [],
    pickDirectory: async () => ({}),
    importSubscriptions: async () => ({}),
  });

  await assert.rejects(
    () => actions.importSubscriptions({ strategy: "merge" }),
    /projectDir/,
  );
  await assert.rejects(
    () => actions.importWorkspace({ name: "Old Blog" }),
    /projectDir/,
  );
  await assert.rejects(
    () => actions.importWorkspaceFromGithub({ backupRepo: { name: "BFE", url: "https://github.com/demo/BFE.git" } }),
    /localDestinationPath/,
  );
});
