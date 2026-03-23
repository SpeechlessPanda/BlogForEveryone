function assertProjectDir(projectDir) {
  if (!projectDir || !String(projectDir).trim()) {
    throw new Error("缺少 projectDir，无法恢复订阅。");
  }
}

export function createImportActions(api) {
  return {
    async importWorkspace(payload) {
      assertProjectDir(payload?.projectDir);
      return api.importWorkspace({
        name: payload?.name,
        projectDir: payload?.projectDir,
      });
    },
    async pickDirectory(payload) {
      return api.pickDirectory({
        title: payload?.title,
        defaultPath: payload?.defaultPath,
      });
    },
    async importSubscriptions(payload) {
      assertProjectDir(payload?.projectDir);
      return api.importSubscriptions({
        projectDir: payload.projectDir,
        strategy: payload?.strategy,
      });
    },
  };
}

export function useImportActions() {
  return createImportActions(window.bfeApi);
}
