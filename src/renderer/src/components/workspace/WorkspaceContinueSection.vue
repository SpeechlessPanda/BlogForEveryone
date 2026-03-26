<script setup>
defineProps({
  workspaceState: {
    type: Object,
    required: true,
  },
  jumpToThemeConfig: {
    type: Function,
    required: true,
  },
  jumpToContentEditor: {
    type: Function,
    required: true,
  },
  jumpToPreview: {
    type: Function,
    required: true,
  },
  removeWorkspaceRecord: {
    type: Function,
    required: true,
  },
  jumpToZone: {
    type: Function,
    required: true,
  },
  jumpToImportView: {
    type: Function,
    required: true,
  },
});
</script>

<template>
  <section
    id="workspace-continue"
    class="panel workspace-continue-panel"
    data-workspace-zone="continue-work"
  >
    <div class="workspace-section-heading">
      <div>
        <p class="section-eyebrow">Continue flow</p>
        <h2>最近工作区</h2>
      </div>
      <p class="section-helper workspace-heading-note">
        已有工作区优先回到继续完善动作，再决定是否删除记录或移除本地目录。
      </p>
    </div>

    <div class="workspace-card-grid" v-if="workspaceState.workspaces.length">
      <article
        v-for="ws in workspaceState.workspaces"
        :key="ws.id"
        class="workspace-card tutorial-recent-card"
      >
        <div class="workspace-card-top">
          <p class="section-eyebrow">继续现有工作</p>
          <span class="tutorial-tag tutorial-tag--quiet workspace-state-chip">
            {{ ws.localExists ? "本地可继续" : "缺少本地目录" }}
          </span>
        </div>
        <h4>{{ ws.name }}</h4>
        <p class="workspace-card-meta muted">{{ ws.framework }} · {{ ws.projectDir }}</p>
        <p class="workspace-card-note">
          {{
            workspaceState.selectedWorkspaceId === ws.id
              ? "当前默认工作区，继续完善会直接接回主流程。"
              : "可从这里直接回到主题配置、内容编辑或本地预览。"
          }}
        </p>
        <div class="actions workspace-card-actions">
          <button class="primary" type="button" @click="jumpToThemeConfig(ws)">
            继续完善
          </button>
          <button class="secondary" type="button" @click="jumpToContentEditor(ws)">
            去内容编辑
          </button>
          <button class="secondary" type="button" @click="jumpToPreview(ws)">
            去本地预览
          </button>
        </div>
        <div class="actions workspace-card-actions-secondary">
          <button class="secondary" type="button" @click="jumpToThemeConfig(ws)">
            继续去主题配置
          </button>
        </div>
        <div class="actions workspace-danger-actions">
          <button class="danger" type="button" @click="removeWorkspaceRecord(ws.id, false)">
            仅删记录
          </button>
          <button class="danger" type="button" @click="removeWorkspaceRecord(ws.id, true)">
            删除本地并移除
          </button>
        </div>
      </article>
    </div>

    <div v-else class="priority-panel priority-panel--subtle workspace-empty-state">
      <p class="section-eyebrow">Continue flow</p>
      <strong>还没有可继续的工作区。</strong>
      <p class="page-result-note">
        你可以先快速创建新博客，或直接导入已有项目接回后续主题、内容与预览流程。
      </p>
      <div class="actions">
        <button class="primary" type="button" @click="jumpToZone('workspace-new-start')">
          去快速创建
        </button>
        <button class="secondary" type="button" @click="jumpToImportView">
          导入已有项目
        </button>
      </div>
    </div>
  </section>
</template>
