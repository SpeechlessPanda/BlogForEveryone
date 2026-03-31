function assertId(id, label) {
  if (!id || !String(id).trim()) {
    throw new Error(`缺少 ${label}，无法执行 RSS 操作。`);
  }
}

function assertProjectDir(projectDir) {
  if (!projectDir || !String(projectDir).trim()) {
    throw new Error("缺少 projectDir，无法导出订阅。");
  }
}

function assertWorkspaceId(workspaceId) {
  if (!workspaceId || !String(workspaceId).trim()) {
    throw new Error("缺少 workspaceId，无法执行 RSS 操作。");
  }
}

function assertUrl(url) {
  if (!url || !String(url).trim()) {
    throw new Error("缺少 url，无法执行 RSS 操作。");
  }
}

export function createRssActions(api) {
  return {
    async listSubscriptions() {
      return api.listSubscriptions();
    },
    async addSubscription(payload) {
      assertUrl(payload?.url);
      return api.addSubscription({
        url: payload?.url,
        title: payload?.title,
      });
    },
    async removeSubscription(payload) {
      assertId(payload?.id, "id");
      return api.removeSubscription({ id: payload.id });
    },
    async syncSubscriptions() {
      return api.syncSubscriptions();
    },
    async openRssArticle(payload) {
      assertUrl(payload?.url);
      return api.openRssArticle({
        url: payload.url,
      });
    },
    async markSubscriptionItemRead(payload) {
      assertId(payload?.subscriptionId, "subscriptionId");
      assertId(payload?.itemKey, "itemKey");
      return api.markSubscriptionItemRead({
        subscriptionId: payload.subscriptionId,
        itemKey: payload.itemKey,
      });
    },
    async pickDirectory(payload) {
      return api.pickDirectory({
        title: payload?.title,
        defaultPath: payload?.defaultPath,
      });
    },
    async exportSubscriptions(payload) {
      assertProjectDir(payload?.projectDir);
      assertWorkspaceId(payload?.workspaceId);
      return api.exportSubscriptions({ workspaceId: payload.workspaceId, projectDir: payload.projectDir });
    },
    async getRssUnreadSummary() {
      return api.getRssUnreadSummary();
    },
  };
}

export function useRssActions() {
  return createRssActions(window.bfeApi);
}
