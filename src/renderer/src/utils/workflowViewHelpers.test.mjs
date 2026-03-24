import test from "node:test";
import assert from "node:assert/strict";

import {
  isAuthRequiredForTab,
  resolveThemePreviewPath,
} from "./workflowViewHelpers.mjs";

test("Only publish flow requires GitHub auth", () => {
  assert.equal(isAuthRequiredForTab("publish"), true);
  assert.equal(isAuthRequiredForTab("workspace"), false);
  assert.equal(isAuthRequiredForTab("theme"), false);
  assert.equal(isAuthRequiredForTab("preview"), false);
  assert.equal(isAuthRequiredForTab("content"), false);
  assert.equal(isAuthRequiredForTab("import"), false);
  assert.equal(isAuthRequiredForTab("rss"), false);
  assert.equal(isAuthRequiredForTab("tutorial"), false);
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
