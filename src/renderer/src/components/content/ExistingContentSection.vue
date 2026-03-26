<script setup>
import AsyncActionButton from "../AsyncActionButton.vue";

defineProps({
  existingList: {
    type: Array,
    required: true,
  },
  selectedExistingPath: {
    type: String,
    required: true,
  },
  existingEditor: {
    type: Object,
    required: true,
  },
  isBusy: {
    type: Function,
    required: true,
  },
  refreshExistingContents: {
    type: Function,
    required: true,
  },
  saveExistingContentChanges: {
    type: Function,
    required: true,
  },
  openSelectedExistingInEditor: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["update:selectedExistingPath"]);
</script>

<template>
  <section
    id="content-existing-zone"
    class="panel workflow-section-panel"
    data-workflow-zone="existing-content"
  >
    <div class="workflow-section-heading">
      <div class="workflow-section-heading-copy">
        <p class="section-eyebrow">Step 02 · 继续写作</p>
        <h2>已有内容二次编辑</h2>
        <p class="section-helper">
          读取当前工程已有文章或页面，继续改标题、正文，再决定是否改用外部编辑器深化写作。
        </p>
      </div>
      <aside class="workflow-inline-note priority-panel priority-panel--subtle">
        <p class="section-eyebrow">当前写作状态</p>
        <strong>{{ existingList.length ? `已有 ${existingList.length} 项内容` : "还没有已载入内容" }}</strong>
        <p class="page-result-note">已存在内容也能在这里直接继续编辑。</p>
      </aside>
    </div>
    <div class="grid-2">
      <div>
        <label>选择已有内容</label>
        <select
          :value="selectedExistingPath"
          @change="emit('update:selectedExistingPath', $event.target.value)"
        >
          <option value="">请选择</option>
          <option v-for="item in existingList" :key="item.filePath" :value="item.filePath">
            {{ item.type }} | {{ item.title }} | {{ item.relativePath }}
          </option>
        </select>
      </div>
      <div>
        <label>标题</label>
        <input v-model="existingEditor.title" placeholder="文章标题" />
      </div>
    </div>
    <div class="stack-top">
      <label>正文（Markdown）</label>
      <textarea
        v-model="existingEditor.body"
        rows="14"
        placeholder="在这里编辑正文内容"
      ></textarea>
    </div>
    <div class="actions">
      <AsyncActionButton
        kind="secondary"
        label="刷新内容列表"
        busy-label="刷新中..."
        :busy="isBusy('load-existing')"
        data-workflow-action-level="secondary"
        @click="refreshExistingContents"
      />
      <AsyncActionButton
        kind="primary"
        label="保存标题与正文"
        busy-label="保存中..."
        :busy="isBusy('save-existing')"
        data-workflow-action-level="primary"
        @click="saveExistingContentChanges"
      />
      <AsyncActionButton
        kind="secondary"
        label="用外部编辑器打开"
        busy-label="打开中..."
        :busy="isBusy('open-existing')"
        data-workflow-action-level="secondary"
        @click="openSelectedExistingInEditor"
      />
    </div>
  </section>
</template>
