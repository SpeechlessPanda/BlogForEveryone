export function createShellActions(api) {
  return {
    async getAppState() {
      return api.getAppState();
    },
    async getEnvironmentStatus() {
      return api.getEnvironmentStatus();
    },
    async getUpdateState() {
      return api.getUpdateState();
    },
    async getPreferences() {
      return api.getPreferences();
    },
    async savePreferences(payload) {
      return api.savePreferences(payload);
    },
    async getRssUnreadSummary() {
      return api.getRssUnreadSummary();
    },
    async checkUpdatesNow() {
      return api.checkUpdatesNow();
    },
    async installUpdateNow() {
      return api.installUpdateNow();
    },
    async openInstaller(payload) {
      return api.openInstaller(payload);
    },
    async ensurePnpm() {
      return api.ensurePnpm();
    },
    async autoInstallTool(payload) {
      return api.autoInstallTool(payload);
    },
    async getGithubAuthState() {
      return api.getGithubAuthState();
    },
    async beginGithubDeviceLogin(payload) {
      return api.beginGithubDeviceLogin(payload);
    },
    async completeGithubDeviceLogin(payload) {
      return api.completeGithubDeviceLogin(payload);
    },
    async githubLogout() {
      return api.githubLogout();
    },
    onUpdateStatus(handler) {
      return api.onUpdateStatus(handler);
    },
  };
}

export function useShellActions() {
  return createShellActions(window.bfeApi);
}
