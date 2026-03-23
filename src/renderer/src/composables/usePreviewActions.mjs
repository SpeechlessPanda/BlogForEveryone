function assertProjectDir(projectDir) {
  if (!projectDir || !String(projectDir).trim()) {
    throw new Error("缺少 projectDir，无法执行预览操作。");
  }
}

function assertFramework(framework) {
  if (!framework || !String(framework).trim()) {
    throw new Error("缺少 framework，无法执行预览操作。");
  }
}

function assertPreviewContext(payload) {
  assertProjectDir(payload?.projectDir);
  assertFramework(payload?.framework);
}

function buildOptionalPreviewPayload(payload) {
  const nextPayload = {};
  if (payload?.port !== undefined) {
    nextPayload.port = payload.port;
  }
  if (payload?.url !== undefined) {
    nextPayload.url = payload.url;
  }
  return nextPayload;
}

export function createPreviewActions(api) {
  return {
    async startLocalPreview(payload) {
      assertPreviewContext(payload);
      return api.startLocalPreview({
        projectDir: payload.projectDir,
        framework: payload.framework,
        ...buildOptionalPreviewPayload(payload),
      });
    },
    async openLocalPreview(payload) {
      assertPreviewContext(payload);
      return api.openLocalPreview({
        projectDir: payload.projectDir,
        framework: payload.framework,
        ...buildOptionalPreviewPayload(payload),
      });
    },
    async stopLocalPreview(payload) {
      assertPreviewContext(payload);
      return api.stopLocalPreview({
        projectDir: payload.projectDir,
        framework: payload.framework,
      });
    },
  };
}

export function usePreviewActions() {
  return createPreviewActions(window.bfeApi);
}
