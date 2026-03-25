<script setup>
import WorkflowSidebar from "./components/shell/WorkflowSidebar.vue";
import WorkflowSummary from "./components/shell/WorkflowSummary.vue";
import SystemStatusPanel from "./components/shell/SystemStatusPanel.vue";
import ShellModalLayer from "./components/shell/ShellModalLayer.vue";
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
  shellAppearance,
  shellAppearanceToggleLabel,
  sidebarLoginText,
  toggleShellAppearance,
  updateState,
  workspaceSummary,
} = useAppShell();
</script>

<template>
  <div class="layout layout--editorial" :data-shell-appearance="shellAppearance">
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
      :shell-appearance="shellAppearance"
      :shell-appearance-toggle-label="shellAppearanceToggleLabel"
      :sidebar-login-text="sidebarLoginText"
      :update-state="updateState"
      @navigate="setActiveTab"
      @check-updates="handleCheckUpdatesNow"
      @install-update="handleInstallUpdateNow"
      @open-info="openInfoModal"
      @toggle-shell-appearance="toggleShellAppearance"
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
        :active-tab="activeTab"
        :auth-client-id="authClientId"
        :auth-log="authLog"
        :auth-state="authState"
        :device-flow="deviceFlow"
        :env-action-log="envActionLog"
        :env-status="envStatus"
        :is-logged-in="isLoggedIn"
        :pnpm-installing="pnpmInstalling"
        :pnpm-progress="pnpmProgress"
        :update-state="updateState"
        @update:auth-client-id="(value) => (authClientId = value)"
        @check-updates="handleCheckUpdatesNow"
        @install-update="handleInstallUpdateNow"
        @fill-demo-client-id-guide="fillDemoClientIdGuide"
        @login="handleGithubLogin"
        @logout="handleGithubLogout"
        @refresh-auth="refreshAuthState"
        @copy-user-code="copyUserCode"
        @open-installer="handleOpenInstaller"
        @auto-install="handleAutoInstall"
        @install-pnpm="handleInstallPnpm"
        @refresh-env="refreshEnvStatus"
      />

      <TutorialCenterView v-if="activeTab === 'tutorial'" />
      <WorkspaceView v-if="activeTab === 'workspace'" />
      <ThemeConfigView v-if="activeTab === 'theme'" />
      <PreviewView v-if="activeTab === 'preview'" />
      <ContentEditorView v-if="activeTab === 'content'" />
      <PublishBackupView v-if="isLoggedIn && activeTab === 'publish'" />
      <ImportView v-if="activeTab === 'import'" />
      <RssReaderView v-if="activeTab === 'rss'" />
    </main>

    <ShellModalLayer
      :active-info-modal="activeInfoModal"
      :error-modal="errorModal"
      :info-modal="infoModal"
      @close-info="closeInfoModal"
      @close-error="closeErrorModal"
    />
  </div>
</template>
