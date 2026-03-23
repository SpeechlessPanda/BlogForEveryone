import test from "node:test";
import assert from "node:assert/strict";

import { createPreviewActions } from "./usePreviewActions.mjs";

test("preview actions call preview IPC contract", async () => {
  const calls = [];
  const api = {
    startLocalPreview: async (payload) => {
      calls.push(["startLocalPreview", payload]);
      return { ok: true, url: "http://localhost:1313" };
    },
    openLocalPreview: async (payload) => {
      calls.push(["openLocalPreview", payload]);
      return { ok: true, url: payload.url || "http://localhost:1313" };
    },
    stopLocalPreview: async (payload) => {
      calls.push(["stopLocalPreview", payload]);
      return { ok: true };
    },
  };

  const actions = createPreviewActions(api);

  await actions.startLocalPreview({
    projectDir: "D:/blogs/demo",
    framework: "hugo",
    port: 1313,
  });
  await actions.openLocalPreview({
    projectDir: "D:/blogs/demo",
    framework: "hugo",
    url: "http://localhost:1313",
  });
  await actions.stopLocalPreview({
    projectDir: "D:/blogs/demo",
    framework: "hugo",
  });

  assert.deepEqual(calls, [
    ["startLocalPreview", {
      projectDir: "D:/blogs/demo",
      framework: "hugo",
      port: 1313,
    }],
    ["openLocalPreview", {
      projectDir: "D:/blogs/demo",
      framework: "hugo",
      url: "http://localhost:1313",
    }],
    ["stopLocalPreview", {
      projectDir: "D:/blogs/demo",
      framework: "hugo",
    }],
  ]);
});

test("preview actions reject missing workspace preview context", async () => {
  const actions = createPreviewActions({
    startLocalPreview: async () => ({}),
    openLocalPreview: async () => ({}),
    stopLocalPreview: async () => ({}),
  });

  await assert.rejects(
    () => actions.startLocalPreview({ framework: "hugo", port: 1313 }),
    /projectDir/,
  );
  await assert.rejects(
    () => actions.stopLocalPreview({ projectDir: "D:/blogs/demo" }),
    /framework/,
  );
});
