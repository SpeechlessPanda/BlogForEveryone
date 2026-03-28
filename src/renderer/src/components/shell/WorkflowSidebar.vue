<script setup>
defineProps({
  activeTab: { type: String, required: true },
  appState: { type: Object, required: true },
  groupedWorkflowSections: { type: Array, required: true },
  rssUnreadTotal: { type: Number, required: true },
  shellAppearance: { type: String, required: true },
  shellUserEntryLabel: { type: String, required: true },
});

defineEmits(["navigate", "open-shell-popup"]);
</script>

<template>
  <aside class="sidebar" data-shell-surface="sidebar">
    <div class="sidebar-inner">
      <div class="sidebar-brand" data-sidebar-region="brand">
        <div class="sidebar-brand-copy">
          <strong>{{ appState.appName }}</strong>
          <p class="version">v{{ appState.version }}</p>
        </div>
      </div>

      <nav class="sidebar-nav" data-sidebar-region="nav">
        <div
          v-for="section in groupedWorkflowSections"
          :key="section.key"
          class="sidebar-group"
        >
          <p class="sidebar-group-label">{{ section.label }}</p>
          <div class="workflow-nav">
            <button
              v-for="tab in section.tabs"
              :key="tab.key"
              :class="['tab', 'sidebar-tab', { active: activeTab === tab.key }]"
              @click="$emit('navigate', tab.key)"
            >
              <span class="tab-label-row">
                <span>{{ tab.label }}</span>
                <span v-if="tab.key === 'rss' && rssUnreadTotal > 0" class="tab-badge">
                  {{ rssUnreadTotal }}
                </span>
              </span>
            </button>
          </div>
        </div>
      </nav>

      <div class="sidebar-footer">
        <button
          class="sidebar-entry"
          data-sidebar-entry="appearance"
          @click="$emit('open-shell-popup', { key: 'appearance', element: $event.currentTarget })"
        >
          <span class="sidebar-entry-label">模式</span>
          <strong>{{ shellAppearance === "dark" ? "暗色" : "亮色" }}</strong>
        </button>

        <button
          class="sidebar-entry"
          data-sidebar-entry="account"
          @click="$emit('open-shell-popup', { key: 'account', element: $event.currentTarget })"
        >
          <span class="sidebar-entry-label">登录状态</span>
          <strong>{{ shellUserEntryLabel }}</strong>
        </button>
      </div>
    </div>
  </aside>
</template>
