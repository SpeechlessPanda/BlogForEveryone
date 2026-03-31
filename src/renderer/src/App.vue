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
import LoginView from "./views/LoginView.vue";

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
  openShellPopup,
  pnpmInstalling,
  pnpmProgress,
  refreshAuthState,
  refreshEnvStatus,
  rssUnreadTotal,
  setShellScrollRegion,
  setActiveTab,
  shellAppearance,
  shellPopupAnchorStyle,
  shellPopupSectionKey,
  shellAppearanceToggleLabel,
  shellUserEntryLabel,
  toggleShellAppearance,
  tutorialTarget,
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
      @open-shell-popup="openShellPopup"
    />

    <main class="content" data-shell-region="workspace">
      <ShellTopBar
        :active-section-meta="activeSectionMeta"
        :active-tab-meta="activeTabMeta"
        :is-shell-popup-open="isShellPopupOpen"
        :shell-appearance="shellAppearance"
        :shell-popup-anchor-style="shellPopupAnchorStyle"
        @close-shell-popup="closeShellPopup"
      >
        <template #page-actions>
          <div class="shell-page-actions-summary">
            <WorkflowSummary
              :active-section-meta="activeSectionMeta"
              :active-tab-meta="activeTabMeta"
              :next-step="nextStep"
              :workspace-summary="workspaceSummary"
            />
            <p
              class="shell-summary-copy shell-summary-copy--workspace-detail"
              data-summary-detail="workspace"
            >
              {{ workspaceSummary.detail }}
            </p>
          </div>
        </template>

        <SystemStatusPanel
          :active-tab="activeTab"
          :auth-client-id="authClientId"
          :auth-log="authLog"
          :auth-state="authState"
          :device-flow="deviceFlow"
          :env-action-log="envActionLog"
          :env-status="envStatus"
          :active-popup-section="shellPopupSectionKey"
          :is-logged-in="isLoggedIn"
          :is-shell-popup-open="isShellPopupOpen"
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

      <div :ref="setShellScrollRegion" class="content-view-scroll" data-shell-scroll-region="workflow-view">
        <LoginView
          v-if="!isLoggedIn && activeTab === 'login'"
          :auth-client-id="authClientId"
          :auth-log="authLog"
          :device-flow="deviceFlow"
          @update:auth-client-id="(value) => (authClientId = value)"
          @fill-demo-client-id-guide="fillDemoClientIdGuide"
          @login="handleGithubLogin"
          @copy-user-code="copyUserCode"
        />
        <TutorialCenterView v-if="activeTab === 'tutorial'" :tutorial-target="tutorialTarget" />
        <WorkspaceView v-if="activeTab === 'workspace'" />
        <ThemeConfigView v-if="activeTab === 'theme'" />
        <PreviewView v-if="activeTab === 'preview'" />
        <ContentEditorView v-if="activeTab === 'content'" />
        <PublishBackupView v-if="isLoggedIn && activeTab === 'publish'" />
        <ImportView v-if="isLoggedIn && activeTab === 'import'" />
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
