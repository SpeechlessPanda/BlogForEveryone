<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import appContents from "../../shared/data/appContents.json";
import WorkspaceView from "./views/WorkspaceView.vue";
import ThemeConfigView from "./views/ThemeConfigView.vue";
import PreviewView from "./views/PreviewView.vue";
import PublishBackupView from "./views/PublishBackupView.vue";
import ImportView from "./views/ImportView.vue";
import RssReaderView from "./views/RssReaderView.vue";
import TutorialCenterView from "./views/TutorialCenterView.vue";
import ContentEditorView from "./views/ContentEditorView.vue";

const ACTION_IDLE_RESET_MS = 1400;

const tabs = [
  { key: "tutorial", label: "教程中心" },
  { key: "workspace", label: "博客创建" },
  { key: "theme", label: "主题配置" },
  { key: "preview", label: "本地预览" },
  { key: "content", label: "内容编辑" },
  { key: "publish", label: "发布与备份" },
  { key: "import", label: "导入恢复" },
  { key: "rss", label: "RSS 阅读" },
];

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
const preferences = ref({
  launchAtStartup: false,
});
const isLoggedIn = computed(() =>
  Boolean(authState.value?.accessToken || authState.value?.user),
);
const launchAtStartupEnabled = computed(
  () => preferences.value.launchAtStartup === true,
);
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
let openTutorialListener = null;
let openTabListener = null;
let rssUpdatedListener = null;
let rssSummaryTimer = null;

const sidebarLoginText = computed(() => {
  if (!isLoggedIn.value) {
    return "登录状态：未登录";
  }
  const user = authState.value?.user;
  return `登录状态：${user?.login || "已登录"}`;
});

const activeInfoModal = computed(() => {
  const key = infoModal.value.key;
  return appContents[key] || appContents.about;
});

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
  errorModal.value = {
    ...errorModal.value,
    visible: false,
  };
}

function scheduleActionReset(key) {
  window.setTimeout(() => {
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

function getTabLabel(tab) {
  if (tab.key === "rss" && rssUnreadTotal.value > 0) {
    return `${tab.label} (${rssUnreadTotal.value})`;
  }
  return tab.label;
}

async function refreshEnvStatus() {
  try {
    envStatus.value = await window.bfeApi.getEnvironmentStatus();
  } catch (error) {
    openErrorModal("环境状态刷新失败", error);
  }
}

async function refreshUpdateState() {
  updateState.value = await window.bfeApi.getUpdateState();
}

async function refreshPreferences() {
  try {
    const next = await window.bfeApi.getPreferences();
    preferences.value = {
      ...preferences.value,
      ...next,
      launchAtStartup: next.launchAtStartup === true,
    };
  } catch (error) {
    openErrorModal("读取偏好设置失败", error);
  }
}

async function refreshRssUnreadSummary() {
  try {
    const summary = await window.bfeApi.getRssUnreadSummary();
    rssUnreadTotal.value = Number(summary?.totalUnread || 0);
  } catch {
    rssUnreadTotal.value = 0;
  }
}

async function handleCheckUpdatesNow() {
  await runActionWithFeedback(
    "checkUpdate",
    async () => {
      await window.bfeApi.checkUpdatesNow();
      await refreshUpdateState();
    },
    "检查更新失败",
  );
}

async function handleInstallUpdateNow() {
  await runActionWithFeedback(
    "installUpdate",
    async () => {
      await window.bfeApi.installUpdateNow();
    },
    "安装更新失败",
  );
}

async function handleToggleLaunchAtStartup() {
  const nextValue = !launchAtStartupEnabled.value;
  await runActionWithFeedback(
    "launchAtStartup",
    async () => {
      const result = await window.bfeApi.savePreferences({
        launchAtStartup: nextValue,
      });

      preferences.value = {
        ...preferences.value,
        ...(result.preferences || {}),
        launchAtStartup: (result.preferences || {}).launchAtStartup === true,
      };
    },
    nextValue ? "开启开机自启动失败" : "关闭开机自启动失败",
  );
}

async function handleOpenInstaller(tool) {
  try {
    const result = await window.bfeApi.openInstaller({ tool });
    envActionLog.value = `已打开 ${tool} 下载页：${result.url}`;
  } catch (error) {
    openErrorModal(`打开 ${tool} 下载页失败`, error);
  }
}

async function handleInstallPnpm() {
  pnpmInstalling.value = true;
  pnpmProgress.value = [{ label: "检查现有 pnpm", status: "running" }];
  try {
    const result = await window.bfeApi.ensurePnpm();
    const mapped = [];
    const logs = Array.isArray(result?.logs) ? result.logs : [];
    for (const item of logs) {
      if (item.event === "mirror-fallback") {
        mapped.push({
          label: item.message,
          status: "success",
        });
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
    pnpmProgress.value = mapped;
    envActionLog.value = JSON.stringify(result, null, 2);
    await refreshEnvStatus();
  } catch (error) {
    pnpmProgress.value.push({ label: "安装过程异常中断", status: "failed" });
    openErrorModal("pnpm 安装失败", error);
  } finally {
    pnpmInstalling.value = false;
  }
}

async function handleAutoInstall(tool) {
  const confirmed = window.confirm(
    `将使用 winget 静默安装 ${tool}，是否继续？`,
  );
  if (!confirmed) {
    return;
  }

  try {
    const result = await window.bfeApi.autoInstallTool({ tool });
    envActionLog.value = JSON.stringify(result, null, 2);
    await refreshEnvStatus();
  } catch (error) {
    openErrorModal(`${tool} 自动安装失败`, error);
  }
}

async function refreshAuthState() {
  try {
    authState.value = await window.bfeApi.getGithubAuthState();
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
    const begin = await window.bfeApi.beginGithubDeviceLogin({
      clientId: authClientId.value,
      scope: "repo read:user user:email",
    });

    deviceFlow.value = begin;
    authLog.value = `请在 GitHub 页面输入设备码：${begin.userCode}。应用正在等待你授权完成...`;

    const result = await window.bfeApi.completeGithubDeviceLogin({
      clientId: authClientId.value,
      deviceCode: begin.deviceCode,
      interval: begin.interval,
      expiresIn: begin.expiresIn,
    });

    authLog.value = `登录成功：${result.user?.login}`;
    await refreshAuthState();
  } catch (error) {
    const raw = String(error?.message || error || "unknown error");
    authLog.value = raw.replace(
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

  await navigator.clipboard.writeText(deviceFlow.value.userCode);
  authLog.value = `设备码已复制：${deviceFlow.value.userCode}`;
}

function fillDemoClientIdGuide() {
  authLog.value =
    "这里要填的是你在 GitHub OAuth App 里拿到的 Client ID（形如 Iv1.xxxxx）。如果页面要求设备码，请输入应用日志中的 user code。";
}

async function handleGithubLogout() {
  try {
    await window.bfeApi.githubLogout();
    await refreshAuthState();
    authLog.value = "已退出 GitHub 登录状态。";
    deviceFlow.value = null;
  } catch (error) {
    openErrorModal("退出登录失败", error);
  }
}

onMounted(async () => {
  if (window.bfeApi) {
    appState.value = await window.bfeApi.getAppState();
    envStatus.value = appState.value.env || envStatus.value;
    await refreshUpdateState();
    await refreshAuthState();
    await refreshPreferences();
    await refreshRssUnreadSummary();

    releaseUpdateListener = window.bfeApi.onUpdateStatus((payload) => {
      updateState.value = payload;
    });
  }

  openTutorialListener = () => {
    activeTab.value = "tutorial";
  };

  openTabListener = (event) => {
    const tabKey = event?.detail?.tabKey;
    if (tabs.some((item) => item.key === tabKey)) {
      activeTab.value = tabKey;
    }
  };

  rssUpdatedListener = () => {
    refreshRssUnreadSummary();
  };

  window.addEventListener("bfe:open-tutorial", openTutorialListener);
  window.addEventListener("bfe:open-tab", openTabListener);
  window.addEventListener("bfe:rss-updated", rssUpdatedListener);

  rssSummaryTimer = window.setInterval(() => {
    refreshRssUnreadSummary();
  }, 30000);
});

onUnmounted(() => {
  if (typeof releaseUpdateListener === "function") {
    releaseUpdateListener();
  }
  if (openTutorialListener) {
    window.removeEventListener("bfe:open-tutorial", openTutorialListener);
  }
  if (openTabListener) {
    window.removeEventListener("bfe:open-tab", openTabListener);
  }
  if (rssUpdatedListener) {
    window.removeEventListener("bfe:rss-updated", rssUpdatedListener);
  }
  if (rssSummaryTimer) {
    window.clearInterval(rssSummaryTimer);
  }
});
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-inner">
        <div>
          <h1>{{ appState.appName }}</h1>
          <p class="version">v{{ appState.version }}</p>
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="['tab', { active: activeTab === tab.key }]"
            @click="activeTab = tab.key"
          >
            {{ getTabLabel(tab) }}
          </button>
        </div>

        <div class="sidebar-footer">
          <p class="muted status-line">{{ sidebarLoginText }}</p>
          <p class="muted status-line">
            {{ updateState.message }}
          </p>
          <p class="muted status-line">
            开机自启动：{{ launchAtStartupEnabled ? "已开启" : "已关闭" }}
          </p>
          <p class="muted status-line">RSS 新文章：{{ rssUnreadTotal }}</p>
          <div class="actions actions-tight">
            <button
              class="secondary"
              :class="{
                'is-loading': actionState.checkUpdate === 'loading',
                'is-success': actionState.checkUpdate === 'success',
                'is-fail': actionState.checkUpdate === 'fail',
              }"
              :disabled="actionState.checkUpdate === 'loading'"
              @click="handleCheckUpdatesNow"
            >
              <span
                v-if="actionState.checkUpdate === 'loading'"
                class="btn-spinner"
                aria-hidden="true"
              ></span>
              {{ getActionLabel("checkUpdate", "检查更新") }}
            </button>
            <button
              class="primary"
              v-if="updateState.downloaded"
              :class="{
                'is-loading': actionState.installUpdate === 'loading',
                'is-success': actionState.installUpdate === 'success',
                'is-fail': actionState.installUpdate === 'fail',
              }"
              :disabled="actionState.installUpdate === 'loading'"
              @click="handleInstallUpdateNow"
            >
              <span
                v-if="actionState.installUpdate === 'loading'"
                class="btn-spinner"
                aria-hidden="true"
              ></span>
              {{ getActionLabel("installUpdate", "立即安装更新") }}
            </button>
            <button class="secondary" @click="openInfoModal('about')">
              关于
            </button>
            <button class="secondary" @click="openInfoModal('announcement')">
              公告
            </button>
            <button
              class="secondary"
              :class="{
                'is-loading': actionState.launchAtStartup === 'loading',
                'is-success': actionState.launchAtStartup === 'success',
                'is-fail': actionState.launchAtStartup === 'fail',
              }"
              :disabled="actionState.launchAtStartup === 'loading'"
              @click="handleToggleLaunchAtStartup"
            >
              <span
                v-if="actionState.launchAtStartup === 'loading'"
                class="btn-spinner"
                aria-hidden="true"
              ></span>
              {{
                getActionLabel(
                  "launchAtStartup",
                  launchAtStartupEnabled ? "关闭开机自启动" : "开启开机自启动",
                )
              }}
            </button>
            <button
              v-if="isLoggedIn"
              class="danger"
              @click="handleGithubLogout"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </aside>

    <main class="content">
      <section v-if="!envStatus.ready" class="panel env-alert">
        <h2>环境检查</h2>
        <p class="muted">
          检测到当前环境不完整。你只需要确认按钮，应用会引导下载安装。
        </p>
        <ul>
          <li>Node.js: {{ envStatus.nodeInstalled ? "已安装" : "未安装" }}</li>
          <li>Git: {{ envStatus.gitInstalled ? "已安装" : "未安装" }}</li>
          <li>pnpm: {{ envStatus.pnpmInstalled ? "已安装" : "未安装" }}</li>
        </ul>
        <div class="actions">
          <button
            v-if="!envStatus.nodeInstalled"
            class="primary"
            @click="handleOpenInstaller('node')"
          >
            下载 Node.js
          </button>
          <button
            v-if="!envStatus.nodeInstalled && envStatus.wingetInstalled"
            class="secondary"
            @click="handleAutoInstall('node')"
          >
            自动安装 Node.js（winget）
          </button>
          <button
            v-if="!envStatus.gitInstalled"
            class="primary"
            @click="handleOpenInstaller('git')"
          >
            下载 Git
          </button>
          <button
            v-if="!envStatus.gitInstalled && envStatus.wingetInstalled"
            class="secondary"
            @click="handleAutoInstall('git')"
          >
            自动安装 Git（winget）
          </button>
          <button
            v-if="envStatus.nodeInstalled && !envStatus.pnpmInstalled"
            class="secondary"
            :disabled="pnpmInstalling"
            @click="handleInstallPnpm"
          >
            {{
              pnpmInstalling
                ? "正在配置 pnpm..."
                : "安装 pnpm（失败自动换源重试）"
            }}
          </button>
          <button class="secondary" @click="refreshEnvStatus">重新检测</button>
        </div>
        <div v-if="pnpmProgress.length" class="panel stack-top">
          <h2>pnpm 配置进度</h2>
          <div
            v-for="(step, idx) in pnpmProgress"
            :key="`${step.label}-${idx}`"
            class="muted"
            style="margin-bottom: 6px"
          >
            {{
              step.status === "success"
                ? "✓"
                : step.status === "failed"
                  ? "✗"
                  : "⏳"
            }}
            {{ step.label }}
          </div>
        </div>
        <pre v-if="envActionLog">{{ envActionLog }}</pre>
      </section>

      <section class="panel" v-if="!isLoggedIn && activeTab !== 'tutorial'">
        <h2>GitHub 登录（OAuth 设备码）</h2>
        <p class="muted">
          填写你的 GitHub OAuth App Client ID
          后，点击登录会自动打开浏览器并进入设备码授权流程。
        </p>
        <label>GitHub OAuth Client ID</label>
        <input v-model="authClientId" placeholder="例如 Iv1.xxxxxxxxxxxxxxxx" />
        <div class="actions">
          <button class="secondary" @click="fillDemoClientIdGuide">
            这里填什么？
          </button>
          <button class="primary" @click="handleGithubLogin">设备码登录</button>
          <button class="secondary" @click="refreshAuthState">
            刷新登录状态
          </button>
          <button v-if="authState" class="danger" @click="handleGithubLogout">
            退出登录
          </button>
        </div>
        <div
          v-if="deviceFlow?.userCode"
          class="panel tutorial-note device-code-card"
        >
          <h2>当前设备码</h2>
          <p class="device-code">
            {{ deviceFlow.userCode }}
          </p>
          <p class="muted">如果 GitHub 页面提示输入 code，请填这个码。</p>
          <div class="actions">
            <button class="secondary" @click="copyUserCode">复制设备码</button>
          </div>
        </div>
        <pre v-if="authLog">{{ authLog }}</pre>
      </section>

      <TutorialCenterView v-if="activeTab === 'tutorial'" />
      <WorkspaceView v-if="isLoggedIn && activeTab === 'workspace'" />
      <ThemeConfigView v-if="isLoggedIn && activeTab === 'theme'" />
      <PreviewView v-if="isLoggedIn && activeTab === 'preview'" />
      <ContentEditorView v-if="isLoggedIn && activeTab === 'content'" />
      <PublishBackupView v-if="isLoggedIn && activeTab === 'publish'" />
      <ImportView v-if="isLoggedIn && activeTab === 'import'" />
      <RssReaderView v-if="isLoggedIn && activeTab === 'rss'" />
    </main>

    <div
      v-if="infoModal.visible"
      class="modal-backdrop"
      @click.self="closeInfoModal"
    >
      <div class="modal-panel">
        <h2>{{ activeInfoModal.title }}</h2>
        <p>{{ activeInfoModal.content }}</p>
        <div class="actions">
          <button class="primary" @click="closeInfoModal">我知道了</button>
        </div>
      </div>
    </div>

    <div
      v-if="errorModal.visible"
      class="modal-backdrop"
      @click.self="closeErrorModal"
    >
      <div class="modal-panel">
        <h2>{{ errorModal.title }}</h2>
        <p class="muted error-text">{{ errorModal.message }}</p>
        <div class="actions">
          <button class="danger" @click="closeErrorModal">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>
