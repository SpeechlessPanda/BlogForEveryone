import test from "node:test";
import assert from "node:assert/strict";

import {
  getAvatarUploadDir,
  getHexoBackgroundConfigPath,
  getHexoFaviconConfigPath,
  normalizeAvatarConfigValue,
  readHexoBackgroundValue,
  readHexoFaviconValue,
} from "./themeConfigHelpers.mjs";

function getByPath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

test("Landscape uses theme-specific background and favicon keys", () => {
  assert.equal(getHexoBackgroundConfigPath("landscape"), "theme_config.banner");
  assert.equal(getHexoFaviconConfigPath("landscape"), "theme_config.favicon");

  const config = {
    theme_config: {
      banner: "/img/home-bg.jpg",
      favicon: "/img/favicon.png",
    },
    favicon: "/legacy/favicon.ico",
  };

  assert.equal(readHexoBackgroundValue(config, "landscape", getByPath), "/img/home-bg.jpg");
  assert.equal(readHexoFaviconValue(config, "landscape", getByPath), "/img/favicon.png");
});

test("Generic Hexo themes keep existing fallback keys", () => {
  assert.equal(
    getHexoBackgroundConfigPath("next"),
    "theme_config.background_image",
  );
  assert.equal(getHexoFaviconConfigPath("next"), "favicon");
});

test("Stack avatar uses Hugo assets path and relative config value", () => {
  assert.equal(getAvatarUploadDir("hugo", "stack"), "assets/img");
  assert.equal(
    normalizeAvatarConfigValue("hugo", "stack", "/assets/img/avatar.png"),
    "img/avatar.png",
  );
  assert.equal(
    normalizeAvatarConfigValue("hugo", "stack", "img/avatar.png"),
    "img/avatar.png",
  );
});

test("Non-Stack avatar uploads keep web-style paths", () => {
  assert.equal(getAvatarUploadDir("hugo", "anatole"), "static/img");
  assert.equal(
    normalizeAvatarConfigValue("hugo", "anatole", "/img/avatar.png"),
    "/img/avatar.png",
  );
});
