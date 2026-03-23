function assertProjectDir(projectDir) {
  if (!projectDir || !String(projectDir).trim()) {
    throw new Error("缺少 projectDir，无法执行主题配置操作。");
  }
}

function assertFramework(framework) {
  if (!framework || !String(framework).trim()) {
    throw new Error("缺少 framework，无法执行主题配置操作。");
  }
}

function assertWorkspaceThemeContext(payload) {
  assertProjectDir(payload?.projectDir);
  assertFramework(payload?.framework);
}

function buildOptionalPickerPayload(payload) {
  const nextPayload = {
    title: payload?.title,
    defaultPath: payload?.defaultPath,
  };
  if (payload?.filters !== undefined) {
    nextPayload.filters = payload.filters;
  }
  return nextPayload;
}

export function createThemeConfigActions(api) {
  return {
    async getThemeConfig(payload) {
      assertWorkspaceThemeContext(payload);
      return api.getThemeConfig({
        projectDir: payload.projectDir,
        framework: payload.framework,
      });
    },
    async validateThemeSettings(payload) {
      return api.validateThemeSettings({
        framework: payload?.framework,
        themeId: payload?.themeId,
        basicFields: payload?.basicFields,
      });
    },
    async saveThemeConfig(payload) {
      assertWorkspaceThemeContext(payload);
      return api.saveThemeConfig({
        projectDir: payload.projectDir,
        framework: payload.framework,
        nextConfig: payload.nextConfig,
      });
    },
    async saveThemeLocalAsset(payload) {
      assertWorkspaceThemeContext(payload);
      return api.saveThemeLocalAsset({
        projectDir: payload.projectDir,
        framework: payload.framework,
        localFilePath: payload.localFilePath,
        assetType: payload.assetType,
        preferredDir: payload.preferredDir,
        preferredFileName: payload.preferredFileName,
      });
    },
    async applyThemePreviewOverrides(payload) {
      assertWorkspaceThemeContext(payload);
      return api.applyThemePreviewOverrides({
        projectDir: payload.projectDir,
        framework: payload.framework,
        themeId: payload.themeId,
        backgroundImage: payload.backgroundImage,
        favicon: payload.favicon,
      });
    },
    async getPreferences() {
      return api.getPreferences();
    },
    async savePreferences(payload) {
      return api.savePreferences(payload);
    },
    async pickFile(payload) {
      return api.pickFile(buildOptionalPickerPayload(payload));
    },
  };
}

export function useThemeConfigActions() {
  return createThemeConfigActions(window.bfeApi);
}
