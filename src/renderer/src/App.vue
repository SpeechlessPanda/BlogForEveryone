<script setup>
import WorkflowSidebar from "./components/shell/WorkflowSidebar.vue";
import WorkflowSummary from "./components/shell/WorkflowSummary.vue";
import SystemStatusPanel from "./components/shell/SystemStatusPanel.vue";
import { useAppShell } from "./composables/useAppShell.mjs";
import WorkspaceView from "./views/WorkspaceView.vue";
import ThemeConfigView from "./views/ThemeConfigView.vue";
import PreviewView from "./views/PreviewView.vue";
import PublishBackupView from "./views/PublishBackupView.vue";
import ImportView from "./views/ImportView.vue";
import RssReaderView from "./views/RssReaderView.vue";
import TutorialCenterView from "./views/TutorialCenterView.vue";
import ContentEditorView from "./views/ContentEditorView.vue";

const {
  activeInfoModal,
  activeSectionMeta,
  activeTab,
  activeTabMeta,
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
  sidebarLoginText,
  updateState,
  workspaceSummary,
} = useAppShell();
</script>

<template>
  <div class="layout">
    <WorkflowSidebar
      :active-section-meta="activeSectionMeta"
      :active-tab="activeTab"
      :action-state="actionState"
      :app-state="appState"
      :environment-status-text="environmentStatusText"
      :get-action-label="getActionLabel"
      :grouped-workflow-sections="groupedWorkflowSections"
      :is-logged-in="isLoggedIn"
      :launch-at-startup-enabled="launchAtStartupEnabled"
      :next-step="nextStep"
      :rss-unread-total="rssUnreadTotal"
      :selected-workspace="selectedWorkspace"
      :sidebar-login-text="sidebarLoginText"
      :update-state="updateState"
      @navigate="setActiveTab"
      @check-updates="handleCheckUpdatesNow"
      @install-update="handleInstallUpdateNow"
      @open-info="openInfoModal"
      @toggle-launch-at-startup="handleToggleLaunchAtStartup"
      @logout="handleGithubLogout"
    />

    <main class="content">
      <WorkflowSummary
        :active-section-meta="activeSectionMeta"
        :active-tab-meta="activeTabMeta"
        :environment-status-text="environmentStatusText"
        :login-status-text="loginStatusText"
        :next-step="nextStep"
        :workspace-summary="workspaceSummary"
      />

      <SystemStatusPanel
        :env-action-log="envActionLog"
        :env-status="envStatus"
        :pnpm-installing="pnpmInstalling"
        :pnpm-progress="pnpmProgress"
        @open-installer="handleOpenInstaller"
        @auto-install="handleAutoInstall"
        @install-pnpm="handleInstallPnpm"
        @refresh-env="refreshEnvStatus"
      />

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
