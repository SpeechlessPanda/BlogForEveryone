export function getHexoBackgroundConfigPath(themeId) {
  if (themeId === "landscape") {
    return "theme_config.banner";
  }

  if (themeId === "fluid") {
    return "theme_config.banner_img";
  }

  return "theme_config.background_image";
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

  if (themeId === "fluid") {
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

export function getHugoDescriptionConfigPath(themeId) {
  return themeId === "mainroad"
    ? "Params.description"
    : "params.description";
}

export function resolveWorkspaceThemeId(themeId, catalog = []) {
  const normalized = String(themeId || "").trim();
  if (!normalized) {
    return "";
  }

  return catalog.some((item) => item?.id === normalized) ? normalized : "";
}

function formatThemeOptionValue(value, type) {
  if (type === "boolean") {
    return value ? "true" : "false";
  }

  if (type === "array") {
    return Array.isArray(value) ? value.join(", ") : String(value || "");
  }

  return value == null ? "" : String(value);
}

export function hydrateThemeOptionValues(config, options, getByPath) {
  const values = {};

  for (const option of options || []) {
    const rawValue = getByPath(config, option.key);
    const nextValue = rawValue ?? option.default;
    values[option.key] = formatThemeOptionValue(nextValue, option.type);
  }

  return values;
}

export function syncHugoOutputs(config, rssEnabled, getByPath, setByPath) {
  const outputs = getByPath(config, "outputs.home");
  const outputList = Array.isArray(outputs) ? [...outputs] : ["HTML"];
  const hasRss = outputList.includes("RSS");

  if (rssEnabled && !hasRss) {
    outputList.push("RSS");
  }

  if (!rssEnabled && hasRss) {
    const filtered = outputList.filter((item) => item !== "RSS");
    setByPath(config, "outputs.home", filtered.length ? filtered : ["HTML"]);
    return;
  }

  setByPath(config, "outputs.home", outputList);
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
