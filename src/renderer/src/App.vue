<script setup>
import ShellTopBar from "./components/shell/ShellTopBar.vue";
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
  appState,
  authClientId,
  authLog,
  authState,
  closeErrorModal,
  closeInfoModal,
  copyUserCode,
  closeShellPopup,
  deviceFlow,
  envActionLog,
  envStatus,
  errorModal,
  fillDemoClientIdGuide,
  groupedWorkflowSections,
  handleAutoInstall,
  handleCheckUpdatesNow,
  handleGithubLogin,
  handleGithubLogout,
  handleInstallPnpm,
  handleInstallUpdateNow,
  handleOpenInstaller,
  infoModal,
  isShellPopupOpen,
  isLoggedIn,
  nextStep,
  pnpmInstalling,
  pnpmProgress,
  refreshAuthState,
  refreshEnvStatus,
  rssUnreadTotal,
  selectedWorkspace,
  setActiveTab,
  shellAppearance,
  shellAppearanceToggleLabel,
  shellUserEntryLabel,
  toggleShellPopup,
  toggleShellAppearance,
  updateState,
  workspaceSummary,
} = useAppShell();
</script>

<template>
  <div class="layout layout--editorial" :data-shell-appearance="shellAppearance">
    <WorkflowSidebar
      :active-tab="activeTab"
      :app-state="appState"
      :grouped-workflow-sections="groupedWorkflowSections"
      :rss-unread-total="rssUnreadTotal"
      :shell-appearance="shellAppearance"
      :shell-user-entry-label="shellUserEntryLabel"
      @navigate="setActiveTab"
      @toggle-shell-popup="toggleShellPopup"
    />

    <main class="content" data-shell-region="workspace">
      <ShellTopBar
        :active-section-meta="activeSectionMeta"
        :active-tab-meta="activeTabMeta"
        :is-shell-popup-open="isShellPopupOpen"
        :shell-user-entry-label="shellUserEntryLabel"
        @toggle-shell-popup="toggleShellPopup"
        @close-shell-popup="closeShellPopup"
      >
        <template #page-actions>
          <WorkflowSummary
            :active-section-meta="activeSectionMeta"
            :active-tab-meta="activeTabMeta"
            :next-step="nextStep"
            :workspace-summary="workspaceSummary"
          />
        </template>

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
          :shell-appearance="shellAppearance"
          :shell-appearance-toggle-label="shellAppearanceToggleLabel"
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
          @toggle-shell-appearance="toggleShellAppearance"
        />
      </ShellTopBar>

      <div class="content-view-scroll" data-shell-scroll-region="workflow-view">
        <TutorialCenterView v-if="activeTab === 'tutorial'" />
        <WorkspaceView v-if="activeTab === 'workspace'" />
        <ThemeConfigView v-if="activeTab === 'theme'" />
        <PreviewView v-if="activeTab === 'preview'" />
        <ContentEditorView v-if="activeTab === 'content'" />
        <PublishBackupView v-if="isLoggedIn && activeTab === 'publish'" />
        <ImportView v-if="activeTab === 'import'" />
        <RssReaderView v-if="activeTab === 'rss'" />
      </div>
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
