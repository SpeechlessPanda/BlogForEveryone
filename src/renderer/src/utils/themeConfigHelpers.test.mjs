import test from "node:test";
import assert from "node:assert/strict";

import {
  getAvatarUploadDir,
  getHexoBackgroundConfigPath,
  getHexoFaviconConfigPath,
  getHugoDescriptionConfigPath,
  hydrateThemeOptionValues,
  normalizeAvatarConfigValue,
  readHexoBackgroundValue,
  readHexoFaviconValue,
  resolveWorkspaceThemeId,
  syncHugoOutputs,
} from "./themeConfigHelpers.mjs";

function getByPath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function setByPath(target, path, value) {
  const keys = path.split(".");
  let pointer = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (pointer[key] == null || typeof pointer[key] !== "object") {
      pointer[key] = {};
    }
    pointer = pointer[key];
  }
  pointer[keys[keys.length - 1]] = value;
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

test("Fluid uses theme-specific banner_img background key", () => {
  assert.equal(getHexoBackgroundConfigPath("fluid"), "theme_config.banner_img");

  const config = {
    theme_config: {
      banner_img: "/img/fluid-home.jpg",
      background_image: "/img/generic-bg.jpg",
    },
  };

  assert.equal(
    readHexoBackgroundValue(config, "fluid", getByPath),
    "/img/fluid-home.jpg",
  );
});

test("Mainroad uses Params namespace for description path", () => {
  assert.equal(getHugoDescriptionConfigPath("mainroad"), "Params.description");
  assert.equal(getHugoDescriptionConfigPath("stack"), "params.description");
});

test("Unknown imported theme does not silently fall back to first catalog theme", () => {
  const catalog = [{ id: "stack" }, { id: "mainroad" }];

  assert.equal(resolveWorkspaceThemeId("mainroad", catalog), "mainroad");
  assert.equal(resolveWorkspaceThemeId("unknown", catalog), "");
  assert.equal(resolveWorkspaceThemeId("", catalog), "");
});

test("Advanced theme options hydrate from existing config values", () => {
  const config = {
    Params: {
      description: "Mainroad verification",
      post_meta: ["date", "categories"],
    },
    params: {
      ShowReadingTime: false,
    },
  };
  const options = [
    { key: "Params.description", type: "string", default: "" },
    { key: "Params.post_meta", type: "array", default: ["date"] },
    { key: "params.ShowReadingTime", type: "boolean", default: true },
  ];

  assert.deepEqual(hydrateThemeOptionValues(config, options, getByPath), {
    "Params.description": "Mainroad verification",
    "Params.post_meta": "date, categories",
    "params.ShowReadingTime": "false",
  });
});

test("Disabling Hugo RSS updates outputs without removing HTML", () => {
  const config = {
    outputs: {
      home: ["HTML", "RSS"],
    },
  };

  syncHugoOutputs(config, false, getByPath, setByPath);

  assert.deepEqual(config.outputs.home, ["HTML"]);
});

test("Enabling Hugo RSS adds RSS to outputs when missing", () => {
  const config = {
    outputs: {
      home: ["HTML"],
    },
  };

  syncHugoOutputs(config, true, getByPath, setByPath);

  assert.deepEqual(config.outputs.home, ["HTML", "RSS"]);
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
