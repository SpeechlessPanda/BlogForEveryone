function assertProjectDir(projectDir) {
  if (!projectDir || !String(projectDir).trim()) {
    throw new Error("缺少 projectDir，无法执行工作区操作。");
  }
}

function assertId(id) {
  if (!id || !String(id).trim()) {
    throw new Error("缺少 id，无法执行工作区操作。");
  }
}

export function createWorkspaceActions(api) {
  return {
    async listWorkspaces() {
      return api.listWorkspaces();
    },
    async getThemeCatalog() {
      return api.getThemeCatalog();
    },
    async createWorkspace(payload) {
      assertProjectDir(payload?.projectDir);
      return api.createWorkspace({
        name: payload?.name,
        framework: payload?.framework,
        theme: payload?.theme,
        projectDir: payload?.projectDir,
      });
    },
    async removeWorkspace(payload) {
      assertId(payload?.id);
      return api.removeWorkspace({
        id: payload?.id,
        deleteLocal: payload?.deleteLocal,
      });
    },
    async installProjectDependencies(payload) {
      assertProjectDir(payload?.projectDir);
      return api.installProjectDependencies({
        projectDir: payload.projectDir,
      });
    },
    async pickDirectory(payload) {
      return api.pickDirectory({
        title: payload?.title,
        defaultPath: payload?.defaultPath,
      });
    },
  };
}

export function useWorkspaceActions() {
  return createWorkspaceActions(window.bfeApi);
}
