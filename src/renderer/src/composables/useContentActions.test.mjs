import test from "node:test";
import assert from "node:assert/strict";

import { createContentActions } from "./useContentActions.mjs";

test("useContentActions.js is a pure stable re-export of the .mjs entrypoint", async () => {
  const jsModule = await import("./useContentActions.js");
  const mjsModule = await import("./useContentActions.mjs");

  assert.equal(
    jsModule.useContentActions,
    mjsModule.useContentActions,
    "expected .js entry to re-export the exact same useContentActions function",
  );
  assert.equal(
    jsModule.createContentActions,
    mjsModule.createContentActions,
    "expected .js entry to re-export createContentActions so callers have one stable source of truth",
  );
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
  });
  assert.deepEqual(calls[6][1], { jobId: "1" });
});

test("content actions reject missing workspaceId for workspace-scoped calls", async () => {
  const actions = createContentActions({
    createAndOpenContent: async () => ({}),
    listExistingContents: async () => [],
    readExistingContent: async () => ({}),
    saveExistingContent: async () => ({}),
    openExistingContent: async () => ({}),
    watchAndAutoPublish: async () => ({}),
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
});
