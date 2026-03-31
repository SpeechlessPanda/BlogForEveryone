function assertProjectDir(projectDir) {
  if (!projectDir || !String(projectDir).trim()) {
    throw new Error("缺少 projectDir，无法恢复订阅。");
  }
}

function assertWorkspaceId(workspaceId) {
  if (!workspaceId || !String(workspaceId).trim()) {
    throw new Error("缺少 workspaceId，无法恢复订阅。");
  }
}

function assertLocalDestinationPath(localDestinationPath) {
  if (!localDestinationPath || !String(localDestinationPath).trim()) {
    throw new Error("缺少 localDestinationPath，无法从 GitHub 恢复工程。");
  }
}

function assertBackupRepo(backupRepo) {
  if (!backupRepo?.name || !backupRepo?.url) {
    throw new Error("缺少 backupRepo，无法从 GitHub 恢复工程。");
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
    async importWorkspaceFromGithub(payload) {
      assertLocalDestinationPath(payload?.localDestinationPath);
      assertBackupRepo(payload?.backupRepo);
      return api.importWorkspaceFromGithub({
        name: payload?.name,
        localDestinationPath: payload?.localDestinationPath,
        siteType: payload?.siteType,
        deployRepo: payload?.deployRepo,
        backupRepo: payload?.backupRepo,
      });
    },
    async listGithubRepos(payload) {
      return api.listGithubRepos({
        visibility: payload?.visibility,
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
      assertWorkspaceId(payload?.workspaceId);
      return api.importSubscriptions({
        workspaceId: payload.workspaceId,
        projectDir: payload.projectDir,
        strategy: payload?.strategy,
      });
    },
  };
}

export function useImportActions() {
  return createImportActions(window.bfeApi);
}
