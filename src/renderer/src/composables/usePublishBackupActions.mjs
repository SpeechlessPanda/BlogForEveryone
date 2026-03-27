function assertProjectDir(projectDir) {
  if (!projectDir || !String(projectDir).trim()) {
    throw new Error("缺少 projectDir，无法执行发布或备份操作。");
  }
}

export function createPublishBackupActions(api) {
  return {
    async publishToGitHub(payload) {
      assertProjectDir(payload?.projectDir);
      return api.publishToGitHub({
        projectDir: payload.projectDir,
        framework: payload.framework,
        siteType: payload.siteType,
        login: payload.login,
        deployRepoName: payload.deployRepoName,
        backupRepoName: payload.backupRepoName,
        repoUrl: payload.repoUrl,
        backupRepoUrl: payload.backupRepoUrl,
        createDeployRepo: payload.createDeployRepo,
        createBackupRepo: payload.createBackupRepo,
        backupDir: payload.backupDir,
        publishMode: payload.publishMode,
        gitUserName: payload.gitUserName,
        gitUserEmail: payload.gitUserEmail,
      });
    },
    async pickDirectory(payload) {
      return api.pickDirectory({
        title: payload?.title,
        defaultPath: payload?.defaultPath,
      });
    },
    async getGithubAuthState() {
      return api.getGithubAuthState();
    },
  };
}

export function usePublishBackupActions() {
  return createPublishBackupActions(window.bfeApi);
}
