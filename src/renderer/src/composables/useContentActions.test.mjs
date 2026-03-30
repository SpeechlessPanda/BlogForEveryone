import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createContentActions } from "./useContentActions.mjs";

test("useContentActions.js is a pure stable re-export of the .mjs entrypoint", async () => {
  const mjsModule = await import("./useContentActions.mjs");
  const jsSource = await readFile(new URL("./useContentActions.js", import.meta.url), "utf-8");

  assert.match(
    jsSource.trim(),
    /^export\s*\{\s*createContentActions,\s*useContentActions\s*\}\s*from\s*["']\.\/useContentActions\.mjs["'];?$/,
    "expected .js entry to stay a pure re-export of the .mjs source of truth",
  );
  assert.equal(typeof mjsModule.useContentActions, "function");
  assert.equal(typeof mjsModule.createContentActions, "function");
});

test("content actions call workspaceId-based IPC contract", async () => {
  const calls = [];
  const api = {
    createAndOpenContent: async (payload) => {
      calls.push(["createAndOpenContent", payload]);
      return { ok: true };
    },
    listExistingContents: async (payload) => {
      calls.push(["listExistingContents", payload]);
      return [];
    },
    readExistingContent: async (payload) => {
      calls.push(["readExistingContent", payload]);
      return { title: "t", body: "b" };
    },
    saveExistingContent: async (payload) => {
      calls.push(["saveExistingContent", payload]);
      return { ok: true };
    },
    openExistingContent: async (payload) => {
      calls.push(["openExistingContent", payload]);
      return { ok: true };
    },
    watchAndAutoPublish: async (payload) => {
      calls.push(["watchAndAutoPublish", payload]);
      return { jobId: "1", status: "watching" };
    },
    publishSavedContent: async (payload) => {
      calls.push(["publishSavedContent", payload]);
      return { jobId: "2", status: "publishing" };
    },
    getPublishJobStatus: async (payload) => {
      calls.push(["getPublishJobStatus", payload]);
      return { status: "done" };
    },
  };

  const actions = createContentActions(api);
  await actions.createAndOpenContent({
    workspaceId: "ws-1",
    type: "post",
    title: "A",
    slug: "a",
  });
  await actions.listExistingContents({ workspaceId: "ws-1" });
  await actions.readExistingContent({
    workspaceId: "ws-1",
    filePath: "/tmp/a.md",
  });
  await actions.saveExistingContent({
    workspaceId: "ws-1",
    filePath: "/tmp/a.md",
    title: "B",
    body: "Body",
  });
  await actions.openExistingContent({
    workspaceId: "ws-1",
    filePath: "/tmp/a.md",
  });
  await actions.watchAndAutoPublish({
    workspaceId: "ws-1",
    filePath: "/tmp/a.md",
    repoUrl: "https://github.com/x/y.git",
    siteType: "project-pages",
    login: "demo",
    gitUserName: "Demo Bot",
    gitUserEmail: "demo@example.com",
    deployRepoName: "demo-site",
    backupRepoName: "BFE",
    backupRepoUrl: "https://github.com/demo/BFE.git",
  });
  await actions.publishSavedContent({
    workspaceId: "ws-1",
    filePath: "/tmp/a.md",
    repoUrl: "https://github.com/x/y.git",
    siteType: "project-pages",
    login: "demo",
    gitUserName: "Demo Bot",
    gitUserEmail: "demo@example.com",
    deployRepoName: "demo-site",
    backupRepoName: "BFE",
    backupRepoUrl: "https://github.com/demo/BFE.git",
  });
  await actions.getPublishJobStatus({ jobId: "1" });

  assert.deepEqual(calls[0][1], {
    workspaceId: "ws-1",
    type: "post",
    title: "A",
    slug: "a",
  });
  assert.deepEqual(calls[1][1], { workspaceId: "ws-1" });
  assert.deepEqual(calls[2][1], { workspaceId: "ws-1", filePath: "/tmp/a.md" });
  assert.deepEqual(calls[3][1], {
    workspaceId: "ws-1",
    filePath: "/tmp/a.md",
    title: "B",
    body: "Body",
  });
  assert.deepEqual(calls[4][1], { workspaceId: "ws-1", filePath: "/tmp/a.md" });
  assert.deepEqual(calls[5][1], {
    workspaceId: "ws-1",
    filePath: "/tmp/a.md",
    repoUrl: "https://github.com/x/y.git",
    siteType: "project-pages",
    login: "demo",
    gitUserName: "Demo Bot",
    gitUserEmail: "demo@example.com",
    deployRepoName: "demo-site",
    backupRepoName: "BFE",
    backupRepoUrl: "https://github.com/demo/BFE.git",
  });
  assert.deepEqual(calls[6][1], {
    workspaceId: "ws-1",
    filePath: "/tmp/a.md",
    repoUrl: "https://github.com/x/y.git",
    siteType: "project-pages",
    login: "demo",
    gitUserName: "Demo Bot",
    gitUserEmail: "demo@example.com",
    deployRepoName: "demo-site",
    backupRepoName: "BFE",
    backupRepoUrl: "https://github.com/demo/BFE.git",
  });
  assert.deepEqual(calls[7][1], { jobId: "1" });
});

test("content actions reject missing workspaceId for workspace-scoped calls", async () => {
  const actions = createContentActions({
    createAndOpenContent: async () => ({}),
    listExistingContents: async () => [],
    readExistingContent: async () => ({}),
    saveExistingContent: async () => ({}),
    openExistingContent: async () => ({}),
    watchAndAutoPublish: async () => ({}),
    publishSavedContent: async () => ({}),
    getPublishJobStatus: async () => ({}),
  });

  await assert.rejects(
    () => actions.createAndOpenContent({ type: "post", title: "A" }),
    /workspaceId/,
  );
  await assert.rejects(() => actions.listExistingContents({}), /workspaceId/);
  await assert.rejects(
    () => actions.readExistingContent({ filePath: "/tmp/a.md" }),
    /workspaceId/,
  );
  await assert.rejects(
    () => actions.publishSavedContent({ filePath: "/tmp/a.md", repoUrl: "https://github.com/x/y.git" }),
    /workspaceId/,
  );
});
