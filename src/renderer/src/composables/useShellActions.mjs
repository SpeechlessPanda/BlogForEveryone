function createWindowEventBridge(shellWindow, eventName) {
  if (
    !shellWindow ||
    typeof shellWindow.addEventListener !== "function" ||
    typeof shellWindow.removeEventListener !== "function"
  ) {
    return () => () => {};
  }

  return (handler) => {
    shellWindow.addEventListener(eventName, handler);
    return () => {
      shellWindow.removeEventListener(eventName, handler);
    };
  };
}

function resolveShellWindow(shellWindow) {
  if (shellWindow) {
    return shellWindow;
  }

  if (typeof globalThis !== "undefined" && globalThis.window) {
    return globalThis.window;
  }

  return null;
}

export function createShellActions(api, shellWindow) {
  const resolvedWindow = resolveShellWindow(shellWindow);
  const onOpenTutorial = createWindowEventBridge(
    resolvedWindow,
    "bfe:open-tutorial",
  );
  const onOpenTab = createWindowEventBridge(resolvedWindow, "bfe:open-tab");
  const onRssUpdated = createWindowEventBridge(
    resolvedWindow,
    "bfe:rss-updated",
  );

  return {
    hasApi() {
      return Boolean(api);
    },
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
    setTimeout(handler, delayMs) {
      if (typeof resolvedWindow?.setTimeout !== "function") {
        return null;
      }
      return resolvedWindow.setTimeout(handler, delayMs);
    },
    setInterval(handler, delayMs) {
      if (typeof resolvedWindow?.setInterval !== "function") {
        return null;
      }
      return resolvedWindow.setInterval(handler, delayMs);
    },
    clearInterval(timerId) {
      if (typeof resolvedWindow?.clearInterval === "function") {
        resolvedWindow.clearInterval(timerId);
      }
    },
    confirm(message) {
      if (typeof resolvedWindow?.confirm !== "function") {
        return false;
      }
      return resolvedWindow.confirm(message);
    },
    async copyToClipboard(text) {
      const clipboard = resolvedWindow?.navigator?.clipboard;
      if (!clipboard || typeof clipboard.writeText !== "function") {
        throw new Error("clipboard is unavailable");
      }
      await clipboard.writeText(text);
    },
    onOpenTutorial,
    onOpenTab,
    onRssUpdated,
  };
}

export function useShellActions() {
  return createShellActions(window.bfeApi);
}
