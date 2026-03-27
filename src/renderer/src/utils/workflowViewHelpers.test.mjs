import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChildOutcomeCards,
  collectOperationMessages,
  isAuthRequiredForTab,
  resolveThemePreviewPath,
} from "./workflowViewHelpers.mjs";

test("Publish and GitHub import flows require GitHub auth", () => {
  assert.equal(isAuthRequiredForTab("publish"), true);
  assert.equal(isAuthRequiredForTab("import"), true);
  assert.equal(isAuthRequiredForTab("workspace"), false);
  assert.equal(isAuthRequiredForTab("theme"), false);
  assert.equal(isAuthRequiredForTab("preview"), false);
  assert.equal(isAuthRequiredForTab("content"), false);
  assert.equal(isAuthRequiredForTab("rss"), false);
  assert.equal(isAuthRequiredForTab("tutorial"), false);
});

test("Structured operation helpers keep child outcomes and root causes visible", () => {
  assert.deepEqual(
    collectOperationMessages({
      message: "统一发布部分完成。",
      operationResult: {
        causes: [
          { key: "backup_push_failed", message: "备份推送失败" },
          { key: "network_error", userMessage: "请稍后重试网络操作" },
        ],
      },
    }),
    ["备份推送失败", "请稍后重试网络操作"],
  );

  assert.deepEqual(
    buildChildOutcomeCards(
      {
        childOutcomes: {
          deployRepoEnsure: { ok: true, message: "发布仓库已就绪。" },
          backupPush: {
            ok: false,
            message: "备份推送失败。",
            operationResult: {
              causes: [{ key: "push_denied", userMessage: "GitHub 拒绝了这次备份推送。" }],
            },
          },
        },
      },
      {
        deployRepoEnsure: "发布仓库准备",
        backupPush: "备份推送",
      },
    ),
    [
      {
        key: "deployRepoEnsure",
        label: "发布仓库准备",
        ok: true,
        message: "发布仓库已就绪。",
        causes: [],
      },
      {
        key: "backupPush",
        label: "备份推送",
        ok: false,
        message: "备份推送失败。",
        causes: ["GitHub 拒绝了这次备份推送。"],
      },
    ],
  );
});

test("Theme preview paths honor relative Vite base path", () => {
  assert.equal(
    resolveThemePreviewPath("./", "/theme-previews/hexo-fluid.png"),
    "./theme-previews/hexo-fluid.png",
  );
  assert.equal(
    resolveThemePreviewPath("./", "theme-previews/hexo-fluid.png"),
    "./theme-previews/hexo-fluid.png",
  );
});

test("Theme preview paths honor nested absolute base path", () => {
  assert.equal(
    resolveThemePreviewPath("/app/", "/theme-previews/hugo-stack.png"),
    "/app/theme-previews/hugo-stack.png",
  );
});
