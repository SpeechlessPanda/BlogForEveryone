import { computed } from "vue";

import { isAuthRequiredForTab } from "../utils/workflowViewHelpers.mjs";

export function useShellWorkspaceSummary(deps) {
  const { activeTab, envStatus, isLoggedIn, selectedWorkspace } = deps;

  const workspaceSummary = computed(() => {
    const ws = selectedWorkspace.value;
    if (!ws) {
      return {
        title: "还未选择工作区",
        detail: "去“博客创建”新建第一个博客工程，或在页面下拉框里切换已有工程。",
      };
    }

    return {
      title: ws.name,
      detail: `${String(ws.framework || "").toUpperCase()} · ${ws.theme || "主题待识别"} · ${ws.projectDir}`,
    };
  });

  const nextStep = computed(() => {
    if (!envStatus.value.ready) {
      return {
        title: "先补齐运行环境",
        detail: "把 Node.js、Git、pnpm 补齐后，再继续后面的创建与发布。",
      };
    }

    if (!isLoggedIn.value && isAuthRequiredForTab(activeTab.value)) {
      return {
        title: "完成 GitHub 登录",
        detail: "登录成功后，发布、备份和仓库相关能力才会变得顺畅。",
      };
    }

    if (
      !selectedWorkspace.value &&
      !["tutorial", "workspace", "import", "rss"].includes(activeTab.value)
    ) {
      return {
        title: "先选一个博客工程",
        detail: "主题配置、预览、内容编辑和发布都需要先绑定到具体工作区。",
      };
    }

    if (activeTab.value === "tutorial") {
      return {
        title: isLoggedIn.value ? "开始创建第一个博客工程" : "先创建、预览并写第一篇内容",
        detail: isLoggedIn.value
          ? "进入“博客创建”，选框架、主题和目录，拿到第一个可运行工作区。"
          : "你可以先跑通创建、主题、预览和内容流程，需要发布、备份和仓库操作时再登录 GitHub。",
      };
    }

    if (activeTab.value === "workspace") {
      return selectedWorkspace.value
        ? {
            title: "去主题配置整理外观",
            detail: `当前工作区“${selectedWorkspace.value.name}”已经就位，下一步可以先改标题、背景和图标。`,
          }
        : {
            title: "创建第一个工作区",
            detail: "建议先用默认主题跑通，再逐步替换成更喜欢的外观。",
          };
    }

    if (activeTab.value === "theme") {
      return {
        title: "保存后去本地预览",
        detail: "先处理标题、背景、图标这些高感知项，再去 localhost 看实际效果。",
      };
    }

    if (activeTab.value === "preview") {
      return {
        title: "确认能打开后开始写内容",
        detail: "预览页能正常打开时，说明工程链路基本通了，可以继续写第一篇文章。",
      };
    }

    if (activeTab.value === "content") {
      return {
        title: "写完第一篇后去发布",
        detail: "有了真实内容再发布，首次上线时更容易确认主题和链接都正常。",
      };
    }

    if (activeTab.value === "publish") {
      return {
        title: "发布成功后顺手做备份",
        detail: "上线和备份在同一页完成，后续换设备或恢复会轻松很多。",
      };
    }

    if (activeTab.value === "import") {
      return {
        title: "导入完成后回到主题或预览",
        detail: "先确认旧工程被识别正确，再继续调外观、预览和发布。",
      };
    }

    return {
      title: "添加订阅并定期同步",
      detail: "把常看的站点放进来，应用会继续帮你跟踪更新和未读数量。",
    };
  });

  return {
    workspaceSummary,
    nextStep,
  };
}
