<script setup>
defineProps({
  activeSectionMeta: { type: Object, required: true },
  activeTab: { type: String, required: true },
  actionState: { type: Object, required: true },
  appState: { type: Object, required: true },
  getActionLabel: { type: Function, required: true },
  groupedWorkflowSections: { type: Array, required: true },
  isLoggedIn: { type: Boolean, required: true },
  launchAtStartupEnabled: { type: Boolean, required: true },
  nextStep: { type: Object, required: true },
  rssUnreadTotal: { type: Number, required: true },
  selectedWorkspace: { type: Object, default: null },
  sidebarLoginText: { type: String, required: true },
  updateState: { type: Object, required: true },
  environmentStatusText: { type: String, required: true },
});

defineEmits([
  "navigate",
  "check-updates",
  "install-update",
  "open-info",
  "toggle-launch-at-startup",
  "logout",
]);
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-inner">
      <div class="sidebar-primary">
        <div>
          <h1>{{ appState.appName }}</h1>
          <p class="version">v{{ appState.version }}</p>
        </div>

        <div class="sidebar-focus-card">
          <p class="sidebar-kicker">当前阶段</p>
          <strong>{{ activeSectionMeta.label }}</strong>
          <p class="muted sidebar-focus-copy">
            {{ activeSectionMeta.summary }}
          </p>
          <div class="sidebar-next-step">
            <span class="status-label">建议下一步</span>
            <strong>{{ nextStep.title }}</strong>
            <p class="muted">{{ nextStep.detail }}</p>
          </div>
        </div>

        <div
          v-for="section in groupedWorkflowSections"
          :key="section.key"
          class="sidebar-group"
        >
          <p class="sidebar-group-kicker">Workflow</p>
          <h2 class="sidebar-group-title">{{ section.label }}</h2>
          <p class="muted sidebar-group-copy">{{ section.summary }}</p>
          <div class="workflow-nav">
            <button
              v-for="tab in section.tabs"
              :key="tab.key"
              :class="['tab', { active: activeTab === tab.key }]"
              @click="$emit('navigate', tab.key)"
            >
              <span class="tab-copy">
                <span class="tab-kicker">{{ tab.step }}</span>
                <span class="tab-label-row">
                  <span>{{ tab.label }}</span>
                  <span
                    v-if="tab.key === 'rss' && rssUnreadTotal > 0"
                    class="tab-badge"
                  >
                    {{ rssUnreadTotal }}
                  </span>
                </span>
                <span class="tab-note">{{ tab.note }}</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="sidebar-utility-card">
          <p class="sidebar-kicker">辅助状态</p>
          <div class="sidebar-status-list">
            <div class="sidebar-status-item">
              <span class="muted">环境</span>
              <strong>{{ environmentStatusText }}</strong>
            </div>
            <div class="sidebar-status-item">
              <span class="muted">登录</span>
              <strong>{{ sidebarLoginText.replace('登录状态：', '') }}</strong>
            </div>
            <div class="sidebar-status-item">
              <span class="muted">工作区</span>
              <strong>{{ selectedWorkspace?.name || "未选择" }}</strong>
            </div>
            <div class="sidebar-status-item">
              <span class="muted">更新</span>
              <strong>{{ updateState.message }}</strong>
            </div>
            <div class="sidebar-status-item">
              <span class="muted">开机自启动</span>
              <strong>{{ launchAtStartupEnabled ? "已开启" : "已关闭" }}</strong>
            </div>
            <div class="sidebar-status-item">
              <span class="muted">RSS 未读</span>
              <strong>{{ rssUnreadTotal }}</strong>
            </div>
          </div>
        </div>

        <div class="actions actions-tight sidebar-utility-actions">
          <button
            class="secondary"
            :class="{
              'is-loading': actionState.checkUpdate === 'loading',
              'is-success': actionState.checkUpdate === 'success',
              'is-fail': actionState.checkUpdate === 'fail',
            }"
            :disabled="actionState.checkUpdate === 'loading'"
            @click="$emit('check-updates')"
          >
            <span
              v-if="actionState.checkUpdate === 'loading'"
              class="btn-spinner"
              aria-hidden="true"
            ></span>
            {{ getActionLabel("checkUpdate", "检查更新") }}
          </button>
          <button
            v-if="updateState.downloaded"
            class="primary"
            :class="{
              'is-loading': actionState.installUpdate === 'loading',
              'is-success': actionState.installUpdate === 'success',
              'is-fail': actionState.installUpdate === 'fail',
            }"
            :disabled="actionState.installUpdate === 'loading'"
            @click="$emit('install-update')"
          >
            <span
              v-if="actionState.installUpdate === 'loading'"
              class="btn-spinner"
              aria-hidden="true"
            ></span>
            {{ getActionLabel("installUpdate", "立即安装更新") }}
          </button>
          <button class="secondary" @click="$emit('open-info', 'about')">
            关于
          </button>
          <button class="secondary" @click="$emit('open-info', 'announcement')">
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
            @click="$emit('toggle-launch-at-startup')"
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
          <button v-if="isLoggedIn" class="danger" @click="$emit('logout')">
            退出登录
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
