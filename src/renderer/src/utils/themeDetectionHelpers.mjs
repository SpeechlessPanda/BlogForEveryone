function normalizeThemeValue(themeValue) {
  if (themeValue == null) {
    return "";
  }
  return String(themeValue).trim();
}

function getCatalogThemeIdSet(themeCatalog) {
  return new Set((themeCatalog || []).map((item) => String(item.id || "").trim()));
}

function getUnsupportedThemeLabel(workspaceTheme, confirmation) {
  const confirmedTheme = normalizeThemeValue(confirmation?.originalTheme);
  if (confirmedTheme) {
    return confirmedTheme;
  }
  return normalizeThemeValue(workspaceTheme) || "custom";
}

export function resolveThemeSelection(workspace, themeCatalog, confirmation) {
  const workspaceTheme = normalizeThemeValue(workspace?.theme);
  const supportedThemeIds = getCatalogThemeIdSet(themeCatalog);

  if (confirmation?.kind === "supported") {
    const confirmedThemeId = normalizeThemeValue(confirmation.themeId);
    if (confirmedThemeId && supportedThemeIds.has(confirmedThemeId)) {
      return {
        selectedThemeId: confirmedThemeId,
        needsUserConfirmation: false,
        isSupportedTheme: true,
        isUnsupportedOrCustom: false,
      };
    }
  }

  if (confirmation?.kind === "unsupported") {
    return {
      selectedThemeId: getUnsupportedThemeLabel(workspaceTheme, confirmation),
      needsUserConfirmation: false,
      isSupportedTheme: false,
      isUnsupportedOrCustom: true,
    };
  }

  if (workspaceTheme && supportedThemeIds.has(workspaceTheme)) {
    return {
      selectedThemeId: workspaceTheme,
      needsUserConfirmation: false,
      isSupportedTheme: true,
      isUnsupportedOrCustom: false,
    };
  }

  const requiresConfirmation = workspaceTheme === "unknown" || Boolean(workspaceTheme);
  return {
    selectedThemeId: workspaceTheme || "unknown",
    needsUserConfirmation: requiresConfirmation,
    isSupportedTheme: false,
    isUnsupportedOrCustom: false,
  };
}

export function isThemeSpecificMappingAllowed(themeSelectionState) {
  return Boolean(themeSelectionState?.isSupportedTheme);
}
