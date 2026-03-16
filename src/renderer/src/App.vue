<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import appContents from "../../shared/data/appContents.json";
import WorkspaceView from "./views/WorkspaceView.vue";
import ThemeConfigView from "./views/ThemeConfigView.vue";
import PublishBackupView from "./views/PublishBackupView.vue";
import ImportView from "./views/ImportView.vue";
import RssReaderView from "./views/RssReaderView.vue";
import TutorialCenterView from "./views/TutorialCenterView.vue";
import ContentEditorView from "./views/ContentEditorView.vue";

const tabs = [
  { key: "tutorial", label: "教程中心" },
  { key: "workspace", label: "博客创建" },
  { key: "theme", label: "主题配置" },
  { key: "content", label: "内容编辑" },
  { key: "publish", label: "发布与备份" },
  { key: "import", label: "导入恢复" },
  { key: "rss", label: "RSS 阅读" },
];

const activeTab = ref("workspace");
const appState = ref({ appName: "BlogForEveryone", version: "0.1.0" });
const envStatus = ref({
  nodeInstalled: true,
  gitInstalled: true,
  pnpmInstalled: true,
  ready: true,
});
const envActionLog = ref("");
const uiFeedback = ref({ type: "info", message: "" });
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
const isLoggedIn = computed(() =>
  Boolean(authState.value?.accessToken || authState.value?.user),
);
const infoModal = ref({ visible: false, key: "about" });
let releaseUpdateListener = null;

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

function setUiFeedback(type, message) {
  uiFeedback.value = { type, message };
}

async function refreshEnvStatus() {
  try {
    envStatus.value = await window.bfeApi.getEnvironmentStatus();
    setUiFeedback("success", "环境状态已刷新。");
  } catch (error) {
    setUiFeedback(
      "error",
      `环境状态刷新失败：${String(error?.message || error)}`,
    );
  }
}

async function refreshUpdateState() {
  updateState.value = await window.bfeApi.getUpdateState();
}

async function handleCheckUpdatesNow() {
  try {
    await window.bfeApi.checkUpdatesNow();
    await refreshUpdateState();
    setUiFeedback("success", "已触发更新检查。");
  } catch (error) {
    updateState.value = {
      ...updateState.value,
      status: "error",
      message: "手动检查更新失败",
      error: String(error?.message || error || "unknown error"),
    };
    setUiFeedback("error", "检查更新失败，请稍后重试。");
  }
}

async function handleInstallUpdateNow() {
  try {
    await window.bfeApi.installUpdateNow();
    setUiFeedback("success", "更新安装已启动，应用将重启。");
  } catch (error) {
    setUiFeedback("error", `安装更新失败：${String(error?.message || error)}`);
  }
}

async function handleOpenInstaller(tool) {
  try {
    const result = await window.bfeApi.openInstaller({ tool });
    envActionLog.value = `已打开 ${tool} 下载页：${result.url}`;
    setUiFeedback("success", `${tool} 下载页已打开。`);
  } catch (error) {
    setUiFeedback(
      "error",
      `打开 ${tool} 下载页失败：${String(error?.message || error)}`,
    );
  }
}

async function handleInstallPnpm() {
  try {
    const result = await window.bfeApi.ensurePnpm();
    envActionLog.value = JSON.stringify(result, null, 2);
    setUiFeedback("success", "pnpm 安装流程已执行。");
    await refreshEnvStatus();
  } catch (error) {
    setUiFeedback("error", `pnpm 安装失败：${String(error?.message || error)}`);
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
    setUiFeedback("success", `${tool} 自动安装已执行。`);
    await refreshEnvStatus();
  } catch (error) {
    setUiFeedback(
      "error",
      `${tool} 自动安装失败：${String(error?.message || error)}`,
    );
  }
}

async function refreshAuthState() {
  try {
    authState.value = await window.bfeApi.getGithubAuthState();
  } catch (error) {
    setUiFeedback(
      "error",
      `刷新登录状态失败：${String(error?.message || error)}`,
    );
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
    setUiFeedback("success", `登录成功：${result.user?.login}`);
    await refreshAuthState();
  } catch (error) {
    const raw = String(error?.message || error || "unknown error");
    authLog.value = raw.replace(
      /Error invoking remote method '[^']+':\s*/i,
      "",
    );
    setUiFeedback("error", "登录失败，请检查网络或 Client ID。");
  }
}

async function copyUserCode() {
  if (!deviceFlow.value?.userCode) {
    return;
  }

  await navigator.clipboard.writeText(deviceFlow.value.userCode);
  authLog.value = `设备码已复制：${deviceFlow.value.userCode}`;
  setUiFeedback("success", "设备码已复制到剪贴板。");
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
    setUiFeedback("success", "已退出登录。");
  } catch (error) {
    setUiFeedback("error", `退出登录失败：${String(error?.message || error)}`);
  }
}

onMounted(async () => {
  if (window.bfeApi) {
    appState.value = await window.bfeApi.getAppState();
    envStatus.value = appState.value.env || envStatus.value;
    await refreshUpdateState();
    await refreshAuthState();

    releaseUpdateListener = window.bfeApi.onUpdateStatus((payload) => {
      updateState.value = payload;
    });
  }

  window.addEventListener("bfe:open-tutorial", () => {
    activeTab.value = "tutorial";
  });
});

onUnmounted(() => {
  if (typeof releaseUpdateListener === "function") {
    releaseUpdateListener();
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
            {{ tab.label }}
          </button>
        </div>

        <div class="sidebar-footer">
          <p class="muted" style="margin: 0 0 8px 0">{{ sidebarLoginText }}</p>
          <div class="actions" style="margin-top: 0">
            <button class="secondary" @click="openInfoModal('about')">
              关于
            </button>
            <button class="secondary" @click="openInfoModal('announcement')">
              公告
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
      <section
        v-if="uiFeedback.message"
        class="panel"
        :class="
          uiFeedback.type === 'error' ? 'feedback-error' : 'feedback-success'
        "
      >
        <p class="muted" style="margin: 0">{{ uiFeedback.message }}</p>
      </section>

      <section class="panel">
        <h2>自动更新</h2>
        <p class="muted">{{ updateState.message }}</p>
        <p class="muted" v-if="updateState.error">
          错误：{{ updateState.error }}
        </p>
        <div class="actions">
          <button class="secondary" @click="handleCheckUpdatesNow">
            立即检查更新
          </button>
          <button
            class="primary"
            v-if="updateState.downloaded"
            @click="handleInstallUpdateNow"
          >
            立即重启并安装
          </button>
        </div>
      </section>

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
            @click="handleInstallPnpm"
          >
            安装 pnpm（失败自动换源重试）
          </button>
          <button class="secondary" @click="refreshEnvStatus">重新检测</button>
        </div>
        <pre v-if="envActionLog">{{ envActionLog }}</pre>
      </section>

      <section class="panel" v-if="!isLoggedIn">
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
          class="panel tutorial-note"
          style="margin-top: 10px"
        >
          <h2>当前设备码</h2>
          <p
            style="
              font-size: 24px;
              letter-spacing: 3px;
              margin: 8px 0;
              font-weight: 700;
            "
          >
            {{ deviceFlow.userCode }}
          </p>
          <p class="muted">如果 GitHub 页面提示输入 code，请填这个码。</p>
          <div class="actions">
            <button class="secondary" @click="copyUserCode">复制设备码</button>
          </div>
        </div>
        <pre v-if="authLog">{{ authLog }}</pre>
      </section>

      <TutorialCenterView v-if="isLoggedIn && activeTab === 'tutorial'" />
      <WorkspaceView v-if="isLoggedIn && activeTab === 'workspace'" />
      <ThemeConfigView v-if="isLoggedIn && activeTab === 'theme'" />
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
  </div>
</template>
