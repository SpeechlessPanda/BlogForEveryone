import test from "node:test";
import assert from "node:assert/strict";

import { createWorkspaceActions } from "./useWorkspaceActions.mjs";

test("workspace actions forward renderer workspace payloads", async () => {
  const calls = [];
  const api = {
    listWorkspaces: async () => {
      calls.push(["listWorkspaces"]);
      return [{ id: "ws-1" }];
    },
    getThemeCatalog: async () => {
      calls.push(["getThemeCatalog"]);
      return { hexo: [] };
    },
    createWorkspace: async (payload) => {
      calls.push(["createWorkspace", payload]);
      return { workspace: { id: "ws-1" } };
    },
    removeWorkspace: async (payload) => {
      calls.push(["removeWorkspace", payload]);
      return { ok: true };
    },
    installProjectDependencies: async (payload) => {
      calls.push(["installProjectDependencies", payload]);
      return { ok: true };
    },
    pickDirectory: async (payload) => {
      calls.push(["pickDirectory", payload]);
      return { canceled: false, path: "D:/blogs" };
    },
  };

  const actions = createWorkspaceActions(api);

  await actions.listWorkspaces();
  await actions.getThemeCatalog();
  await actions.createWorkspace({
    name: "Demo",
    framework: "hexo",
    theme: "landscape",
    projectDir: "D:/blogs/demo",
  });
  await actions.removeWorkspace({ id: "ws-1", deleteLocal: true });
  await actions.installProjectDependencies({ workspaceId: "ws-1", projectDir: "D:/blogs/demo" });
  await actions.pickDirectory({
    title: "选择博客工程目录",
    defaultPath: "D:/blogs",
  });

  assert.deepEqual(calls, [
    ["listWorkspaces"],
    ["getThemeCatalog"],
    ["createWorkspace", {
      name: "Demo",
      framework: "hexo",
      theme: "landscape",
      projectDir: "D:/blogs/demo",
    }],
    ["removeWorkspace", { id: "ws-1", deleteLocal: true }],
    ["installProjectDependencies", { workspaceId: "ws-1", projectDir: "D:/blogs/demo" }],
    ["pickDirectory", {
      title: "选择博客工程目录",
      defaultPath: "D:/blogs",
    }],
  ]);
});

test("workspace actions reject missing projectDir where required", async () => {
  const actions = createWorkspaceActions({
    listWorkspaces: async () => [],
    getThemeCatalog: async () => ({}),
    createWorkspace: async () => ({}),
    removeWorkspace: async () => ({}),
    installProjectDependencies: async () => ({}),
    pickDirectory: async () => ({}),
  });

  await assert.rejects(
    () => actions.installProjectDependencies({}),
    /projectDir/,
  );
  await assert.rejects(
    () => actions.installProjectDependencies({ projectDir: "D:/blogs/demo" }),
    /workspaceId/,
  );
  await assert.rejects(
    () => actions.createWorkspace({ name: "Demo", framework: "hexo", theme: "landscape" }),
    /projectDir/,
  );
  await assert.rejects(
    () => actions.removeWorkspace({ deleteLocal: true }),
    /id/,
  );
});
