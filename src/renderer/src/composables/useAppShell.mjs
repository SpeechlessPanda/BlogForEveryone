import { computed, onMounted, onUnmounted, ref } from "vue";

import appContents from "../../../shared/data/appContents.json";
import {
  getSelectedWorkspace,
  refreshWorkspaces,
} from "../stores/workspaceStore.js";
import { useShellNavigation } from "./useShellNavigation.mjs";
import { useShellActions } from "./useShellActions.mjs";
import { useShellWorkspaceSummary } from "./useShellWorkspaceSummary.mjs";

const ACTION_IDLE_RESET_MS = 1400;
const RSS_SUMMARY_REFRESH_INTERVAL_MS = 30000;
const SHELL_POPUP_VIEWPORT_PADDING_PX = 24;
const SHELL_POPUP_DESKTOP_MAX_HEIGHT_PX = 420;

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
  const isShellPopupOpen = ref(false);
  const shellPopupTriggerElement = ref(null);
  const shellPopupSectionKey = ref("account");
  const shellPopupAnchor = ref({
    key: "account",
    top: 24,
    left: 24,
    width: 0,
  });
  const shellScrollRegion = ref(null);
  const tutorialTarget = ref("tutorial-home");
  const shellNavigation = useShellNavigation({ initialTab: "tutorial" });
  const {
    activeTab,
    activeTabMeta,
    activeSectionMeta,
    groupedWorkflowSections,
  } = shellNavigation;
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
  const selectedWorkspace = computed(() => getSelectedWorkspace());
  const shellWorkspaceSummary = useShellWorkspaceSummary({
    activeTab,
    envStatus,
    isLoggedIn,
    selectedWorkspace,
  });
  const { workspaceSummary, nextStep } = shellWorkspaceSummary;
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
  const sidebarLoginText = computed(() => {
    if (!isLoggedIn.value) {
      return "登录状态：未登录";
    }
    const account = authState.value?.account;
    return `登录状态：${account?.login || "已登录"}`;
  });
  const shellUserEntryLabel = computed(() => {
    if (!isLoggedIn.value) {
      return "未登录";
    }
    return authState.value?.account?.login || "GitHub 已登录";
  });
  const activeInfoModal = computed(() => {
    return appContents[infoModal.value.key] || appContents.about;
  });
  const shellAppearanceToggleLabel = computed(() =>
    shellAppearance.value === "light"
      ? "切换到暗色编辑台"
      : "切换到亮色编辑台",
  );
  const shellPopupAnchorStyle = computed(() => ({
    "--shell-popup-top": `${shellPopupAnchor.value.top}px`,
    "--shell-popup-left": `${shellPopupAnchor.value.left}px`,
    "--shell-popup-width": `${shellPopupAnchor.value.width}px`,
  }));

  function setShellScrollRegion(element) {
    shellScrollRegion.value = element;
  }

  function resetShellScrollRegion() {
    if (typeof shellScrollRegion.value?.scrollTo === "function") {
      shellScrollRegion.value.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    }
  }

  function syncShellPopupAnchor(anchor) {
    const anchorElement = anchor && anchor.element;
    const anchorRect = anchorElement?.getBoundingClientRect?.();
    if (!anchorRect) {
      shellPopupTriggerElement.value = null;
      shellPopupAnchor.value = {
        key: anchor?.key || "account",
        top: 24,
        left: 24,
        width: 0,
      };
      return false;
    }

    shellPopupTriggerElement.value = anchorElement;

    const viewportHeight =
      globalThis.innerHeight ||
      globalThis.document?.documentElement?.clientHeight ||
      0;
    const popupTop = Math.max(
      SHELL_POPUP_VIEWPORT_PADDING_PX,
      Math.min(
        anchorRect.top,
        viewportHeight -
          SHELL_POPUP_DESKTOP_MAX_HEIGHT_PX -
          SHELL_POPUP_VIEWPORT_PADDING_PX,
      ),
    );

    shellPopupAnchor.value = {
      key: anchor?.key || "account",
      top: popupTop,
      left: anchorRect.left,
      width: anchorRect.width,
    };

    return true;
  }

  function setActiveTab(tabKey) {
    const previousTab = activeTab.value;
    shellNavigation.setActiveTab(tabKey);
    if (activeTab.value !== previousTab) {
      closeShellPopup();
      resetShellScrollRegion();
    }
  }

  function toggleShellAppearance() {
    shellAppearance.value = shellAppearance.value === "light" ? "dark" : "light";
  }

  function openShellPopup(anchor) {
    shellPopupSectionKey.value = anchor?.key === "appearance" ? "appearance" : "account";
    if (!syncShellPopupAnchor(anchor)) {
      isShellPopupOpen.value = false;
      return;
    }
    isShellPopupOpen.value = true;
  }

  function closeShellPopup() {
    isShellPopupOpen.value = false;
    shellPopupTriggerElement.value?.focus({ preventScroll: true });
    shellPopupTriggerElement.value = null;
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

    releaseOpenTutorialListener = shellActions.onOpenTutorial((event) => {
      tutorialTarget.value = event?.detail?.target || "tutorial-home";
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
    isShellPopupOpen,
    isLoggedIn,
    launchAtStartupEnabled,
    loginStatusText,
    nextStep,
    openShellPopup,
    openInfoModal,
    pnpmInstalling,
    pnpmProgress,
    refreshAuthState,
    refreshEnvStatus,
    rssUnreadTotal,
    selectedWorkspace,
    setShellScrollRegion,
    setActiveTab,
    shellAppearance,
    shellPopupAnchorStyle,
    shellPopupSectionKey,
    shellAppearanceToggleLabel,
    shellUserEntryLabel,
    sidebarLoginText,
    closeShellPopup,
    toggleShellAppearance,
    tutorialTarget,
    updateState,
    workspaceSummary,
  };
}
