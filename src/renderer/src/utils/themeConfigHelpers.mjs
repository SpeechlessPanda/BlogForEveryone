export function getHexoBackgroundConfigPath(themeId) {
  return themeId === "landscape"
    ? "theme_config.banner"
    : "theme_config.background_image";
}

export function getHexoFaviconConfigPath(themeId) {
  return themeId === "landscape" ? "theme_config.favicon" : "favicon";
}

export function readHexoBackgroundValue(config, themeId, getByPath) {
  const preferred = getByPath(config, getHexoBackgroundConfigPath(themeId));
  if (preferred) {
    return preferred;
  }

  if (themeId === "landscape") {
    return getByPath(config, "theme_config.background_image") || "";
  }

  return "";
}

export function readHexoFaviconValue(config, themeId, getByPath) {
  const preferred = getByPath(config, getHexoFaviconConfigPath(themeId));
  if (preferred) {
    return preferred;
  }

  if (themeId === "landscape") {
    return config.favicon || "";
  }

  return "";
}

export function getAvatarUploadDir(framework, themeId) {
  if (framework !== "hugo") {
    return "source/img";
  }

  if (themeId === "stack") {
    return "assets/img";
  }

  return "static/img";
}

export function normalizeAvatarConfigValue(framework, themeId, assetPath) {
  if (!assetPath) {
    return "";
  }

  const normalized = String(assetPath).trim().replace(/\\/g, "/");
  if (!normalized) {
    return "";
  }

  if (framework === "hugo" && themeId === "stack") {
    return normalized
      .replace(/^\/+assets\//, "")
      .replace(/^\/+/, "");
  }

  return normalized;
}
