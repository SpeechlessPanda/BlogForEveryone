<script setup>
import { reactive, ref } from "vue";
import { refreshWorkspaces } from "../stores/workspaceStore";
import { useShellActions } from "../composables/useShellActions.mjs";
import { useImportActions } from "../composables/useImportActions.mjs";

const form = reactive({
  name: "",
  projectDir: "",
});

const result = ref("");
const shellActions = useShellActions();
const { importWorkspace, pickDirectory, importSubscriptions } =
  useImportActions();

async function doImport() {
  try {
    const data = await importWorkspace({ ...form });
    const confirmationHint =
      data?.theme === "unknown"
        ? "\n\n提示：该工程主题尚未确认，请前往“主题配置”页面明确选择受支持主题，或标记为不受支持/自定义。"
        : "";
    result.value = `${JSON.stringify(data, null, 2)}${confirmationHint}`;
    await refreshWorkspaces();
  } catch (error) {
    result.value = `导入失败：${String(error?.message || error)}`;
  }
}

async function pickProjectDirectory() {
  try {
    const data = await pickDirectory({
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
    const data = await importSubscriptions({
      projectDir: form.projectDir,
      strategy: "merge",
    });
    result.value = JSON.stringify(data, null, 2);
  } catch (error) {
    result.value = `恢复 RSS 失败：${String(error?.message || error)}`;
  }
}

function goTutorialCenter() {
  shellActions.openTutorial("import-recovery");
}

function goThemeConfig() {
  shellActions.openTab("theme");
}

function goWorkspacePage() {
  shellActions.openTab("workspace");
}

function jumpToZone(zoneId) {
  document.getElementById(zoneId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
</script>

<template>
  <div
    class="page-shell page-shell--import"
    data-page-role="import"
    data-workflow-surface="editorial-workflow"
  >
    <div class="page-layer" data-page-layer="primary">
      <section class="panel page-hero" data-workflow-zone="hero">
        <div class="page-hero-grid">
          <div>
            <p class="page-kicker">Secondary entry path</p>
            <h2 class="page-title">导入已有博客工程</h2>
            <p class="page-lead">
              这是进入创作流程的次级入口：适合已经有旧博客、但想回到可视化工作流继续维护的人。导入成功后，重点不是停在结果页，而是接回主流程继续完成品牌、预览和发布。
            </p>
            <div class="workflow-hero-actions" data-workflow-zone="hero-actions">
              <button
                class="primary"
                type="button"
                data-workflow-action-level="primary"
                @click="jumpToZone('import-workbench')"
              >
                前往导入设置
              </button>
              <button
                class="secondary"
                type="button"
                data-workflow-action-level="secondary"
                @click="jumpToZone('import-result')"
              >
                查看最近结果
              </button>
              <button
                class="secondary"
                type="button"
                data-workflow-action-level="tertiary"
                @click="goThemeConfig"
              >
                前往主题配置
              </button>
            </div>
            <div class="page-link-row">
              <a href="#" @click.prevent="goTutorialCenter"
                >打开教程中心（导入与恢复）</a
              >
            </div>
          </div>
        </div>

        <div class="workflow-status-grid">
          <div class="page-signal page-signal--accent">
            <p class="section-eyebrow">次级入口</p>
            <strong>已有博客接入工作流</strong>
            <p class="section-helper">不需要重新从零创建，但导入后仍应继续走主题、预览和发布路径。</p>
          </div>
          <div class="page-signal">
            <p class="section-eyebrow">接回主流程</p>
            <strong>主题配置 → 本地预览 → 发布与备份</strong>
            <p class="section-helper">导入完成不代表结束，而是重新进入主流程的开始。</p>
          </div>
          <div class="page-signal page-signal--quiet">
            <p class="section-eyebrow">建议下一步</p>
            <strong>先确认主题，再做预览与发布检查。</strong>
            <p class="section-helper">如果主题未识别，优先在主题配置页完成确认。</p>
          </div>
        </div>
      </section>

      <section
        id="import-workbench"
        class="panel workflow-section-panel"
        data-workflow-zone="import-workbench"
      >
        <h2>导入设置</h2>
        <p class="muted">支持导入已有目录后继续可视化编辑与发布。</p>

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
    </div>

    <div class="page-layer" data-page-layer="explanation">
      <section class="priority-panel priority-panel--support workflow-result-panel">
        <p class="section-eyebrow">建议下一步</p>
        <strong>导入成功后，立即去主题配置检查主题识别与品牌素材。</strong>
        <ul class="page-guidance-list">
          <li>如果提示主题未知，先在主题配置页完成受支持主题确认。</li>
          <li>确认品牌后进入本地预览，再决定是否发布。</li>
        </ul>
        <div class="actions">
          <button class="secondary" @click="goThemeConfig">前往主题配置</button>
          <button class="secondary" @click="goWorkspacePage">查看工作区列表</button>
        </div>
      </section>

      <section
        id="import-result"
        class="panel workflow-result-panel"
        v-if="result"
        data-workflow-zone="recent-result"
      >
        <p class="section-eyebrow">导入结果摘要</p>
        <h2>导入结果</h2>
        <pre>{{ result }}</pre>
      </section>
    </div>

    <div class="page-layer" data-page-layer="detail">
      <section class="panel workflow-section-panel" data-workflow-zone="rss-restore">
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
    </div>
  </div>
</template>
