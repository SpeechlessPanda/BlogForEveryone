<script setup>
import { reactive, ref } from "vue";
import { refreshWorkspaces } from "../stores/workspaceStore";

const form = reactive({
  name: "",
  projectDir: "",
});

const result = ref("");

async function doImport() {
  try {
    const data = await window.bfeApi.importWorkspace({ ...form });
    result.value = JSON.stringify(data, null, 2);
    await refreshWorkspaces();
  } catch (error) {
    result.value = `导入失败：${String(error?.message || error)}`;
  }
}

async function pickProjectDirectory() {
  try {
    const data = await window.bfeApi.pickDirectory({
      title: "选择已存在的博客工程目录",
      defaultPath: form.projectDir || undefined,
    });
    if (!data.canceled && data.path) {
      form.projectDir = data.path;
    }
  } catch (error) {
    result.value = `选择目录失败：${String(error?.message || error)}`;
  }
}

async function restoreRssFromProject() {
  try {
    const data = await window.bfeApi.importSubscriptions({
      projectDir: form.projectDir,
      strategy: "merge",
    });
    result.value = JSON.stringify(data, null, 2);
  } catch (error) {
    result.value = `恢复 RSS 失败：${String(error?.message || error)}`;
  }
}

function goTutorialCenter() {
  window.dispatchEvent(new CustomEvent("bfe:open-tutorial"));
}
</script>

<template>
  <section class="panel">
    <h2>导入已有博客工程</h2>
    <p class="muted">支持导入已有目录后继续可视化编辑与发布。</p>
    <p>
      <a href="#" @click.prevent="goTutorialCenter"
        >打开教程中心（导入与恢复）</a
      >
    </p>

    <div class="section-card-grid">
      <div class="context-card">
        <p class="section-eyebrow">这页适合谁</p>
        <strong>已经有旧博客，想继续可视化维护的人</strong>
        <p class="section-helper">
          导入后你可以直接回到主题配置、本地预览和发布流程里，不需要重新从零创建。
        </p>
      </div>
      <div class="context-card">
        <p class="section-eyebrow">可选恢复</p>
        <strong>RSS 恢复是附加项</strong>
        <p class="section-helper">
          先把博客工程导入成功，再决定要不要恢复项目里的订阅快照。
        </p>
      </div>
    </div>

    <div class="grid-2">
      <div>
        <label>显示名称</label>
        <input v-model="form.name" placeholder="例如 我的旧博客" />
      </div>
      <div>
        <label>工程目录</label>
        <div class="path-input-row">
          <input v-model="form.projectDir" placeholder="例如 D:/old-blog" />
          <button class="secondary" type="button" @click="pickProjectDirectory">
            选择目录
          </button>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="primary" @click="doImport">导入工程</button>
    </div>
  </section>

  <section class="panel">
    <h2>可选：恢复 RSS 订阅</h2>
    <p class="section-helper">
      只有当这个工程目录里已经包含订阅快照时，才需要执行这一步。
    </p>
    <div class="actions">
      <button class="secondary" @click="restoreRssFromProject">
        恢复 RSS 订阅
      </button>
    </div>
  </section>

  <section class="panel" v-if="result">
    <h2>导入结果</h2>
    <pre>{{ result }}</pre>
  </section>
</template>
