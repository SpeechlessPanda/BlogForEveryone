function assertWorkspaceId(workspaceId) {
  if (!workspaceId || !String(workspaceId).trim()) {
    throw new Error("缺少 workspaceId，无法执行内容操作。");
  }
}

function buildTargetPayload(payload) {
  const nextPayload = {};
  if (typeof payload?.contentId === "string" && payload.contentId.trim()) {
    nextPayload.contentId = payload.contentId;
  }
  if (typeof payload?.filePath === "string" && payload.filePath.trim()) {
    nextPayload.filePath = payload.filePath;
  }
  return nextPayload;
}

export function createContentActions(api) {
  return {
    async createAndOpenContent(payload) {
      assertWorkspaceId(payload?.workspaceId);
      return api.createAndOpenContent({
        workspaceId: payload.workspaceId,
        type: payload.type,
        title: payload.title,
        slug: payload.slug,
      });
    },
    async listExistingContents(payload) {
      assertWorkspaceId(payload?.workspaceId);
      return api.listExistingContents({ workspaceId: payload.workspaceId });
    },
    async readExistingContent(payload) {
      assertWorkspaceId(payload?.workspaceId);
      return api.readExistingContent({
        workspaceId: payload.workspaceId,
        ...buildTargetPayload(payload),
      });
    },
    async saveExistingContent(payload) {
      assertWorkspaceId(payload?.workspaceId);
      return api.saveExistingContent({
        workspaceId: payload.workspaceId,
        ...buildTargetPayload(payload),
        title: payload.title,
        body: payload.body,
      });
    },
    async openExistingContent(payload) {
      assertWorkspaceId(payload?.workspaceId);
      return api.openExistingContent({
        workspaceId: payload.workspaceId,
        ...buildTargetPayload(payload),
      });
    },
    async watchAndAutoPublish(payload) {
      assertWorkspaceId(payload?.workspaceId);
      return api.watchAndAutoPublish({
        workspaceId: payload.workspaceId,
        ...buildTargetPayload(payload),
        repoUrl: payload.repoUrl,
      });
    },
    async getPublishJobStatus(payload) {
      return api.getPublishJobStatus({ jobId: payload?.jobId });
    },
  };
}

export function useContentActions() {
  return createContentActions(window.bfeApi);
}
