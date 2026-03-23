import test from "node:test";
import assert from "node:assert/strict";

import { createImportActions } from "./useImportActions.mjs";

test("import actions preserve import and picker payloads", async () => {
  const calls = [];
  const api = {
    importWorkspace: async (payload) => {
      calls.push(["importWorkspace", payload]);
      return { ok: true, workspace: { id: "ws-1" } };
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
    ["pickDirectory", {
      title: "选择已存在的博客工程目录",
      defaultPath: "D:/old-blog",
    }],
    ["importSubscriptions", { projectDir: "D:/old-blog", strategy: "merge" }],
  ]);
});

test("import actions reject missing projectDir for rss restore", async () => {
  const actions = createImportActions({
    importWorkspace: async () => ({}),
    pickDirectory: async () => ({}),
    importSubscriptions: async () => ({}),
  });

  await assert.rejects(
    () => actions.importSubscriptions({ strategy: "merge" }),
    /projectDir/,
  );
});
