const AUTH_REQUIRED_TABS = new Set(["publish"]);

export function isAuthRequiredForTab(tabKey) {
  return AUTH_REQUIRED_TABS.has(String(tabKey || "").trim());
}

export function resolveThemePreviewPath(baseUrl, assetPath) {
  const normalizedBase = String(baseUrl || "./");
  const normalizedAsset = String(assetPath || "")
    .trim()
    .replace(/^\/+/, "");

  if (!normalizedAsset) {
    return "";
  }

  if (!normalizedBase || normalizedBase === "/") {
    return `/${normalizedAsset}`;
  }

  const baseWithSlash = normalizedBase.endsWith("/")
    ? normalizedBase
    : `${normalizedBase}/`;

  return `${baseWithSlash}${normalizedAsset}`;
}
