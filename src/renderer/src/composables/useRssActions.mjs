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

export function createRssActions(api) {
  return {
    async listSubscriptions() {
      return api.listSubscriptions();
    },
    async addSubscription(payload) {
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
      return api.exportSubscriptions({ projectDir: payload.projectDir });
    },
    async getRssUnreadSummary() {
      return api.getRssUnreadSummary();
    },
  };
}

export function useRssActions() {
  return createRssActions(window.bfeApi);
}
