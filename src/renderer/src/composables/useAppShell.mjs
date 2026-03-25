import { computed, onMounted, onUnmounted, ref } from "vue";

import appContents from "../../../shared/data/appContents.json";
import {
  getSelectedWorkspace,
  refreshWorkspaces,
} from "../stores/workspaceStore.js";
import { useShellActions } from "./useShellActions.mjs";

const ACTION_IDLE_RESET_MS = 1400;
const RSS_SUMMARY_REFRESH_INTERVAL_MS = 30000;

const tabs = [
  {
    key: "tutorial",
    label: "教程中心",
    section: "start",
    step: "STEP 01",
    note: "先走一遍 10 分钟总流程，知道每一步会看到什么。",
    summary: "从环境、登录到创建与发布，先把新手主线看明白。",
  },
  {
    key: "workspace",
    label: "博客创建",
    section: "build",
    step: "STEP 02",
    note: "创建第一个工作区，选框架、主题和本地目录。",
    summary: "把第一个博客工程搭起来，后面的配置都会围绕这个工作区展开。",
  },
  {
    key: "theme",
    label: "主题配置",
    section: "build",
    step: "STEP 03",
    note: "先改基础外观，复杂项放到高级设置里慢慢补。",
    summary: "按先基础、后高级的顺序整理博客外观与主题能力。",
  },
  {
    key: "preview",
    label: "本地预览",
    section: "check-release",
    step: "STEP 04",
    note: "确认 localhost 能打开，再决定要不要继续调整。",
    summary: "把当前配置真实跑起来，快速确认页面有没有达到预期。",
  },
  {
    key: "content",
    label: "内容编辑",
    section: "build",
    step: "STEP 05",
    note: "先写第一篇内容，再考虑自动发布与二次编辑。",
    summary: "创建文章和页面内容，让博客从空壳变成真正可读。",
  },
  {
    key: "publish",
    label: "发布与备份",
    section: "check-release",
    step: "STEP 06",
    note: "发布上线后，顺手做一份备份，迁移会更安心。",
    summary: "把本地成果推到 GitHub Pages，并准备好恢复用的快照。",
  },
  {
    key: "import",
    label: "导入恢复",
    section: "start",
    step: "STEP 07",
    note: "把旧工程接进来，重新回到可视化流程里。",
    summary: "已有博客也能继续用这套工作流维护，而不是从头再来。",
  },
  {
    key: "rss",
    label: "RSS 阅读",
    section: "extension",
    step: "STEP 08",
    note: "把常看的站点放进来，持续获取灵感与更新。",
    summary: "在同一个应用里关注内容更新，形成持续创作的节奏。",
  },
];

const workflowSections = [
  {
    key: "start",
    label: "开始",
    summary: "先用教程了解主线，再把已有工程导入到统一流程里。",
  },
  {
    key: "build",
    label: "搭建博客",
    summary: "从工作区、主题、预览到内容，逐步把博客做完整。",
  },
  {
    key: "check-release",
    label: "检查与发布",
    summary: "先做本地检查，再完成发布与备份，确保上线链路稳定。",
  },
  {
    key: "extension",
    label: "扩展",
    summary: "通过 RSS 阅读扩展信息输入，保持持续创作节奏。",
  },
];

function normalizePreferences(next, current) {
  return {
    ...current,
    ...(next || {}),
    launchAtStartup: next?.launchAtStartup === true,
  };
}

function mapPnpmProgress(result) {
  const mapped = [];
  const logs = Array.isArray(result?.logs) ? result.logs : [];

  for (const item of logs) {
    if (item.event === "mirror-fallback") {
      mapped.push({ label: item.message, status: "success" });
      continue;
    }
    if (item.command) {
      mapped.push({
        label: item.command,
        status: Number(item.status) === 0 ? "success" : "failed",
      });
    }
  }

  if (!mapped.length) {
    mapped.push({ label: "pnpm 已就绪", status: "success" });
  }

  return mapped;
}

export function useAppShell() {
  const shellActions = useShellActions();

  const activeTab = ref("tutorial");
  const appState = ref({ appName: "BlogForEveryone", version: "0.1.0" });
  const envStatus = ref({
    nodeInstalled: true,
    gitInstalled: true,
    pnpmInstalled: true,
    ready: true,
  });
  const envActionLog = ref("");
  const pnpmProgress = ref([]);
  const pnpmInstalling = ref(false);
  const shellAppearance = ref("light");
  const updateState = ref({
    status: "idle",
    message: "未检测更新",
    downloaded: false,
    error: null,
  });
  const authClientId = ref("");
  const authState = ref(null);
  const authLog = ref("");
  const deviceFlow = ref(null);
  const rssUnreadTotal = ref(0);
  const preferences = ref({ launchAtStartup: false });
  const infoModal = ref({ visible: false, key: "about" });
  const actionState = ref({
    checkUpdate: "idle",
    installUpdate: "idle",
    launchAtStartup: "idle",
  });
  const errorModal = ref({
    visible: false,
    title: "操作失败",
    message: "",
  });

  let releaseUpdateListener = null;
  let releaseOpenTutorialListener = null;
  let releaseOpenTabListener = null;
  let releaseRssUpdatedListener = null;
  let rssSummaryTimer = null;

  const isLoggedIn = computed(() => authState.value?.isLoggedIn === true);
  const launchAtStartupEnabled = computed(
    () => preferences.value.launchAtStartup === true,
  );
  const groupedWorkflowSections = computed(() => {
    return workflowSections.map((section) => ({
      ...section,
      tabs: tabs.filter((tab) => tab.section === section.key),
    }));
  });
  const activeTabMeta = computed(() => {
    return tabs.find((item) => item.key === activeTab.value) || tabs[0];
  });
  const activeSectionMeta = computed(() => {
    return (
      workflowSections.find((item) => item.key === activeTabMeta.value.section) ||
      workflowSections[0]
    );
  });
  const selectedWorkspace = computed(() => getSelectedWorkspace());
  const environmentStatusText = computed(() => {
    return envStatus.value.ready ? "环境已就绪" : "环境待补齐";
  });
  const loginStatusText = computed(() => {
    if (!isLoggedIn.value) {
      return "等待 GitHub 登录";
    }
    const account = authState.value?.account;
    return account?.login ? `已连接 ${account.login}` : "GitHub 已登录";
  });
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
  const sidebarLoginText = computed(() => {
    if (!isLoggedIn.value) {
      return "登录状态：未登录";
    }
    const account = authState.value?.account;
    return `登录状态：${account?.login || "已登录"}`;
  });
  const activeInfoModal = computed(() => {
    return appContents[infoModal.value.key] || appContents.about;
  });
  const shellAppearanceToggleLabel = computed(() =>
    shellAppearance.value === "light"
      ? "切换到暗色编辑台"
      : "切换到亮色编辑台",
  );

  function setActiveTab(tabKey) {
    if (tabs.some((item) => item.key === tabKey)) {
      activeTab.value = tabKey;
    }
  }

  function toggleShellAppearance() {
    shellAppearance.value = shellAppearance.value === "light" ? "dark" : "light";
  }

  function openInfoModal(key) {
    infoModal.value = { visible: true, key };
  }

  function closeInfoModal() {
    infoModal.value = { ...infoModal.value, visible: false };
  }

  function openErrorModal(title, error) {
    errorModal.value = {
      visible: true,
      title,
      message: String(error?.message || error || "未知错误"),
    };
  }

  function closeErrorModal() {
    errorModal.value = { ...errorModal.value, visible: false };
  }

  function scheduleActionReset(key) {
    shellActions.setTimeout(() => {
      if (actionState.value[key] !== "loading") {
        actionState.value[key] = "idle";
      }
    }, ACTION_IDLE_RESET_MS);
  }

  async function runActionWithFeedback(key, task, failTitle) {
    actionState.value[key] = "loading";
    try {
      await task();
      actionState.value[key] = "success";
    } catch (error) {
      actionState.value[key] = "fail";
      openErrorModal(failTitle, error);
    } finally {
      scheduleActionReset(key);
    }
  }

  function getActionLabel(key, idleLabel) {
    const state = actionState.value[key];
    if (state === "success") {
      return "success";
    }
    if (state === "fail") {
      return "fail";
    }
    return idleLabel;
  }

  async function refreshEnvStatus() {
    try {
      envStatus.value = await shellActions.getEnvironmentStatus();
    } catch (error) {
      openErrorModal("环境状态刷新失败", error);
    }
  }

  async function refreshUpdateState() {
    try {
      updateState.value = await shellActions.getUpdateState();
    } catch (error) {
      openErrorModal("更新状态刷新失败", error);
    }
  }

  async function refreshPreferences() {
    try {
      preferences.value = normalizePreferences(
        await shellActions.getPreferences(),
        preferences.value,
      );
    } catch (error) {
      openErrorModal("读取偏好设置失败", error);
    }
  }

  async function refreshRssUnreadSummary() {
    try {
      const summary = await shellActions.getRssUnreadSummary();
      rssUnreadTotal.value = Number(summary?.totalUnread || 0);
    } catch {
      rssUnreadTotal.value = 0;
    }
  }

  async function handleCheckUpdatesNow() {
    await runActionWithFeedback(
      "checkUpdate",
      async () => {
        await shellActions.checkUpdatesNow();
        await refreshUpdateState();
      },
      "检查更新失败",
    );
  }

  async function handleInstallUpdateNow() {
    await runActionWithFeedback(
      "installUpdate",
      async () => {
        const result = await shellActions.installUpdateNow();
        if (!result?.ok) {
          throw new Error(result?.message || "当前更新不可安装");
        }
      },
      "安装更新失败",
    );
  }

  async function handleToggleLaunchAtStartup() {
    const nextValue = !launchAtStartupEnabled.value;
    await runActionWithFeedback(
      "launchAtStartup",
      async () => {
        const result = await shellActions.savePreferences({
          launchAtStartup: nextValue,
        });
        preferences.value = normalizePreferences(
          result?.preferences,
          preferences.value,
        );
      },
      nextValue ? "开启开机自启动失败" : "关闭开机自启动失败",
    );
  }

  async function handleOpenInstaller(tool) {
    try {
      const result = await shellActions.openInstaller({ tool });
      envActionLog.value = `已打开 ${tool} 下载页：${result.url}`;
    } catch (error) {
      openErrorModal(`打开 ${tool} 下载页失败`, error);
    }
  }

  async function handleInstallPnpm() {
    pnpmInstalling.value = true;
    pnpmProgress.value = [{ label: "检查现有 pnpm", status: "running" }];

    try {
      const result = await shellActions.ensurePnpm();
      pnpmProgress.value = mapPnpmProgress(result);
      envActionLog.value = JSON.stringify(result, null, 2);
      await refreshEnvStatus();
    } catch (error) {
      pnpmProgress.value = [
        ...pnpmProgress.value,
        { label: "安装过程异常中断", status: "failed" },
      ];
      openErrorModal("pnpm 安装失败", error);
    } finally {
      pnpmInstalling.value = false;
    }
  }

  async function handleAutoInstall(tool) {
    const confirmed = shellActions.confirm(
      `将使用 winget 静默安装 ${tool}，是否继续？`,
    );
    if (!confirmed) {
      return;
    }

    try {
      const result = await shellActions.autoInstallTool({ tool });
      envActionLog.value = JSON.stringify(result, null, 2);
      await refreshEnvStatus();
    } catch (error) {
      openErrorModal(`${tool} 自动安装失败`, error);
    }
  }

  async function refreshAuthState() {
    try {
      authState.value = await shellActions.getGithubAuthState();
    } catch (error) {
      openErrorModal("刷新登录状态失败", error);
    }
  }

  async function handleGithubLogin() {
    if (!authClientId.value) {
      authLog.value = "请先填写 GitHub OAuth App 的 Client ID。";
      return;
    }

    authLog.value = "正在申请设备码...";
    try {
      const begin = await shellActions.beginGithubDeviceLogin({
        clientId: authClientId.value,
        scope: "repo read:user user:email",
      });

      deviceFlow.value = begin;
      authLog.value = `请在 GitHub 页面输入设备码：${begin.userCode}。应用正在等待你授权完成...`;

      const result = await shellActions.completeGithubDeviceLogin({
        clientId: authClientId.value,
        deviceCode: begin.deviceCode,
        interval: begin.interval,
        expiresIn: begin.expiresIn,
      });

      authLog.value = `登录成功：${result.user?.login}`;
      await refreshAuthState();
    } catch (error) {
      authLog.value = String(error?.message || error || "unknown error").replace(
        /Error invoking remote method '[^']+':\s*/i,
        "",
      );
      openErrorModal("登录失败，请检查网络或 Client ID", error);
    }
  }

  async function copyUserCode() {
    if (!deviceFlow.value?.userCode) {
      return;
    }

    await shellActions.copyToClipboard(deviceFlow.value.userCode);
    authLog.value = `设备码已复制：${deviceFlow.value.userCode}`;
  }

  function fillDemoClientIdGuide() {
    authLog.value =
      "这里要填的是你在 GitHub OAuth App 里拿到的 Client ID（形如 Iv1.xxxxx）。如果页面要求设备码，请输入应用日志中的 user code。";
  }

  async function handleGithubLogout() {
    try {
      await shellActions.githubLogout();
      await refreshAuthState();
      authLog.value = "已退出 GitHub 登录状态。";
      deviceFlow.value = null;
    } catch (error) {
      openErrorModal("退出登录失败", error);
    }
  }

  onMounted(async () => {
    if (shellActions.hasApi()) {
      appState.value = await shellActions.getAppState();
      envStatus.value = appState.value.env || envStatus.value;
      await refreshUpdateState();
      await refreshAuthState();
      await refreshPreferences();
      await refreshRssUnreadSummary();

      try {
        await refreshWorkspaces();
      } catch {
        // Workspaces are contextual metadata for the shell; views keep their own refresh flow.
      }

      releaseUpdateListener = shellActions.onUpdateStatus((payload) => {
        updateState.value = payload;
      });
    }

    releaseOpenTutorialListener = shellActions.onOpenTutorial(() => {
      setActiveTab("tutorial");
    });
    releaseOpenTabListener = shellActions.onOpenTab((event) => {
      setActiveTab(event?.detail?.tabKey);
    });
    releaseRssUpdatedListener = shellActions.onRssUpdated(() => {
      refreshRssUnreadSummary();
    });

    rssSummaryTimer = shellActions.setInterval(() => {
      refreshRssUnreadSummary();
    }, RSS_SUMMARY_REFRESH_INTERVAL_MS);
  });

  onUnmounted(() => {
    if (typeof releaseUpdateListener === "function") {
      releaseUpdateListener();
    }
    if (typeof releaseOpenTutorialListener === "function") {
      releaseOpenTutorialListener();
    }
    if (typeof releaseOpenTabListener === "function") {
      releaseOpenTabListener();
    }
    if (typeof releaseRssUpdatedListener === "function") {
      releaseRssUpdatedListener();
    }
    if (rssSummaryTimer) {
      shellActions.clearInterval(rssSummaryTimer);
    }
  });

  return {
    activeTab,
    activeTabMeta,
    activeSectionMeta,
    activeInfoModal,
    actionState,
    appState,
    authClientId,
    authLog,
    authState,
    closeErrorModal,
    closeInfoModal,
    copyUserCode,
    deviceFlow,
    envActionLog,
    envStatus,
    environmentStatusText,
    errorModal,
    fillDemoClientIdGuide,
    getActionLabel,
    groupedWorkflowSections,
    handleAutoInstall,
    handleCheckUpdatesNow,
    handleGithubLogin,
    handleGithubLogout,
    handleInstallPnpm,
    handleInstallUpdateNow,
    handleOpenInstaller,
    handleToggleLaunchAtStartup,
    infoModal,
    isLoggedIn,
    launchAtStartupEnabled,
    loginStatusText,
    nextStep,
    openInfoModal,
    pnpmInstalling,
    pnpmProgress,
    refreshAuthState,
    refreshEnvStatus,
    rssUnreadTotal,
    selectedWorkspace,
    setActiveTab,
    shellAppearance,
    shellAppearanceToggleLabel,
    sidebarLoginText,
    toggleShellAppearance,
    updateState,
    workspaceSummary,
  };
}
import { isAuthRequiredForTab } from "../utils/workflowViewHelpers.mjs";
