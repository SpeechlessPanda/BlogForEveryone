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
        repoUrl: payload.repoUrl,
        publishMode: payload.publishMode,
        gitUserName: payload.gitUserName,
        gitUserEmail: payload.gitUserEmail,
      });
    },
    async backupWorkspace(payload) {
      assertProjectDir(payload?.projectDir);
      return api.backupWorkspace({
        projectDir: payload.projectDir,
        backupDir: payload.backupDir,
        repoUrl: payload.repoUrl,
        visibility: payload.visibility,
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
