<script setup>
import { computed, reactive, onMounted, onUnmounted, watch } from "vue";
import {
  workspaceState,
  refreshWorkspaces,
  refreshThemeCatalog,
} from "../stores/workspaceStore";
import AsyncActionButton from "../components/AsyncActionButton.vue";
import { useAsyncAction } from "../composables/useAsyncAction";
import { resolveThemePreviewPath } from "../utils/workflowViewHelpers.mjs";

const form = reactive({
  name: "",
  framework: "hexo",
  theme: "landscape",
  projectDir: "",
});

const logs = reactive({ output: "" });
const { run, isBusy } = useAsyncAction();
const flow = reactive({
  creating: false,
  currentStep: "idle",
  currentText: "等待开始",
  percent: 0,
});

const themePreviewMap = {
  "hexo:landscape": "theme-previews/hexo-landscape.png",
  "hexo:next": "theme-previews/hexo-next.png",
  "hexo:butterfly": "theme-previews/hexo-butterfly.png",
  "hexo:fluid": "theme-previews/hexo-fluid.png",
  "hexo:volantis": "theme-previews/hexo-volantis.png",
  "hugo:papermod": "theme-previews/hugo-papermod.png",
  "hugo:loveit": "theme-previews/hugo-loveit.png",
  "hugo:stack": "theme-previews/hugo-stack.png",
  "hugo:mainroad": "theme-previews/hugo-mainroad.png",
  "hugo:anatole": "theme-previews/hugo-anatole.png",
};

const previewBaseUrl = import.meta.env.BASE_URL || "./";

const currentFrameworkThemes = computed(() => {
  const list = workspaceState.themeCatalog?.[form.framework] || [];
  return list.map((item) => {
    const key = `${form.framework}:${item.id}`;
      return {
        ...item,
        preview: resolveThemePreviewPath(previewBaseUrl, themePreviewMap[key] || ""),
        selected: item.id === form.theme,
      };
  });
});

const selectedWorkspace = computed(() => {
  return (
    workspaceState.workspaces.find(
      (item) => item.id === workspaceState.selectedWorkspaceId,
    ) || null
  );
});

let flowPulseTimer = null;

function resetFlow() {
  flow.currentStep = "idle";
  flow.currentText = "等待开始";
  flow.percent = 0;
  if (flowPulseTimer) {
    window.clearInterval(flowPulseTimer);
    flowPulseTimer = null;
  }
}

function applyDefaultThemeForFramework(framework) {
  const list = workspaceState.themeCatalog?.[framework] || [];
  if (!list.length) {
    form.theme = "";
    return;
  }
  if (!list.some((item) => item.id === form.theme)) {
    form.theme = list[0].id;
  }
}

function selectThemeCard(themeId) {
  form.theme = themeId;
}

function markStep(stepKey) {
  flow.currentStep = stepKey;
  if (stepKey === "validate") {
    flow.currentText = "正在校验输入参数";
    flow.percent = Math.max(flow.percent, 10);
    return;
  }
  if (stepKey === "init") {
    flow.currentText = "正在初始化博客工程与下载主题";
    flow.percent = Math.max(flow.percent, 35);
    if (flowPulseTimer) {
      window.clearInterval(flowPulseTimer);
    }
    flowPulseTimer = window.setInterval(() => {
      if (!flow.creating) {
        return;
      }
      flow.percent = Math.min(flow.percent + 3, 75);
    }, 320);
    return;
  }
  if (stepKey === "save") {
    if (flowPulseTimer) {
      window.clearInterval(flowPulseTimer);
      flowPulseTimer = null;
    }
    flow.currentText = "正在写入工作区记录";
    flow.percent = Math.max(flow.percent, 88);
    return;
  }
  if (stepKey === "finish") {
    if (flowPulseTimer) {
      window.clearInterval(flowPulseTimer);
      flowPulseTimer = null;
    }
    flow.currentText = "创建完成";
    flow.percent = 100;
  }
}

async function handleCreateWorkspace() {
  if (isBusy("create")) {
    return;
  }
  await run("create", async () => {
    resetFlow();
    flow.creating = true;
    markStep("validate");

    if (!form.name || !form.projectDir) {
      logs.output = "请先填写工程名称和本地路径。";
      flow.creating = false;
      return;
    }

    try {
      markStep("init");
      const result = await window.bfeApi.createWorkspace({ ...form });
      markStep("save");
      workspaceState.selectedWorkspaceId = result.workspace.id;
      logs.output = JSON.stringify(result, null, 2);
      await refreshWorkspaces();
      markStep("finish");
    } catch (error) {
      logs.output = `创建工程失败：${String(error?.message || error)}`;
      flow.currentText = "创建失败，请查看下方执行日志";
    } finally {
      flow.creating = false;
      if (flowPulseTimer) {
        window.clearInterval(flowPulseTimer);
        flowPulseTimer = null;
      }
    }
  });
}

async function pickProjectDirectory() {
  try {
    const result = await window.bfeApi.pickDirectory({
      title: "选择博客工程目录",
      defaultPath: form.projectDir || undefined,
    });
    if (!result.canceled && result.path) {
      form.projectDir = result.path;
    }
  } catch (error) {
    logs.output = `选择目录失败：${String(error?.message || error)}`;
  }
}

async function removeWorkspaceRecord(id, deleteLocal = false) {
  try {
    const result = await window.bfeApi.removeWorkspace({ id, deleteLocal });
    logs.output = JSON.stringify(result, null, 2);
    if (workspaceState.selectedWorkspaceId === id) {
      workspaceState.selectedWorkspaceId = "";
    }
    await refreshWorkspaces();
  } catch (error) {
    logs.output = `删除工程失败：${String(error?.message || error)}`;
  }
}

function jumpToThemeConfig(ws) {
  workspaceState.selectedWorkspaceId = ws.id;
  window.dispatchEvent(
    new CustomEvent("bfe:open-tab", { detail: { tabKey: "theme" } }),
  );
}

function jumpToContentEditor(ws) {
  workspaceState.selectedWorkspaceId = ws.id;
  window.dispatchEvent(
    new CustomEvent("bfe:open-tab", { detail: { tabKey: "content" } }),
  );
}

function jumpToPreview(ws) {
  workspaceState.selectedWorkspaceId = ws.id;
  window.dispatchEvent(
    new CustomEvent("bfe:open-tab", { detail: { tabKey: "preview" } }),
  );
}

async function handleInstallDeps() {
  await run("install-deps", async () => {
    if (!form.projectDir) {
      logs.output = "请先填写工程目录。";
      return;
    }
    try {
      const result = await window.bfeApi.installProjectDependencies({
        projectDir: form.projectDir,
      });
      logs.output = JSON.stringify(result, null, 2);
    } catch (error) {
      logs.output = `安装依赖失败：${String(error?.message || error)}`;
    }
  });
}

onMounted(async () => {
  await refreshThemeCatalog();
  applyDefaultThemeForFramework(form.framework);
  await refreshWorkspaces();
});

onUnmounted(() => {
  if (flowPulseTimer) {
    window.clearInterval(flowPulseTimer);
    flowPulseTimer = null;
  }
});

watch(
  () => form.framework,
  (framework) => {
    applyDefaultThemeForFramework(framework);
  },
);

watch(
  () => workspaceState.themeCatalog,
  () => {
    applyDefaultThemeForFramework(form.framework);
  },
);

function goTutorialCenter() {
  window.dispatchEvent(new CustomEvent("bfe:open-tutorial"));
}
</script>

<template>
  <section class="panel">
    <h2>新建博客工程</h2>
    <p class="muted">
      通过点击选择框架和主题，不需要写命令。依赖安装统一使用
      pnpm，网络问题会自动换源重试。
    </p>
    <p>
      <a href="#" @click.prevent="goTutorialCenter"
        >不知道怎么填？打开教程中心（新建博客保姆指南）</a
      >
    </p>

    <div class="section-card-grid">
      <div class="context-card">
        <p class="section-eyebrow">推荐顺序</p>
        <strong>创建工程 → 安装依赖 → 去主题配置</strong>
        <p class="section-helper">
          先拿到一个可运行工作区，再继续调整外观、预览和内容，会比一开始就改高级项更稳。
        </p>
      </div>
      <div class="context-card">
        <p class="section-eyebrow">当前工作区</p>
        <strong>{{ selectedWorkspace?.name || "还没有选中的工作区" }}</strong>
        <p class="section-helper">
          {{
            selectedWorkspace
              ? `${selectedWorkspace.framework} · ${selectedWorkspace.projectDir}`
              : "创建成功后，这里会成为后续主题配置、预览和发布的默认上下文。"
          }}
        </p>
      </div>
    </div>

    <div class="grid-2">
      <div>
        <label>工程名称</label>
        <input v-model="form.name" placeholder="例如 my-first-blog" />
      </div>
      <div>
        <label>本地路径</label>
        <div class="path-input-row">
          <input
            v-model="form.projectDir"
            placeholder="例如 D:/blogs/my-first-blog"
          />
          <button class="secondary" type="button" @click="pickProjectDirectory">
            选择目录
          </button>
        </div>
      </div>
      <div>
        <label>框架</label>
        <select v-model="form.framework">
          <option value="hexo">Hexo</option>
          <option value="hugo">Hugo</option>
        </select>
      </div>
      <div>
        <label>主题</label>
        <select v-model="form.theme">
          <option
            v-for="item in workspaceState.themeCatalog?.[form.framework] || []"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </option>
        </select>
      </div>
    </div>

    <div class="theme-hint">
      选主题时请主要留意主题框架页面的效果。背景图片是随意添加的示例素材，不要被背景图影响判断。
    </div>

    <div class="theme-grid" v-if="currentFrameworkThemes.length">
      <button
        v-for="item in currentFrameworkThemes"
        :key="`${form.framework}-${item.id}`"
        class="theme-card"
        :class="{ active: item.selected }"
        type="button"
        @click="selectThemeCard(item.id)"
      >
        <div class="theme-thumb-wrap">
          <img
            v-if="item.preview"
            class="theme-thumb"
            :src="item.preview"
            :alt="`${item.name} 主题预览`"
            loading="lazy"
          />
          <div v-else class="theme-thumb-empty">暂无预览图</div>
        </div>
        <div class="theme-meta">
          <strong>{{ item.name }}</strong>
          <span class="muted">{{ form.framework }} · {{ item.id }}</span>
        </div>
      </button>
    </div>

    <div class="actions">
      <AsyncActionButton
        kind="primary"
        label="创建工程"
        busy-label="创建中..."
        :busy="isBusy('create') || flow.creating"
        @click="handleCreateWorkspace"
      />
      <AsyncActionButton
        kind="secondary"
        label="安装工程依赖（pnpm）"
        busy-label="安装中..."
        :busy="isBusy('install-deps')"
        @click="handleInstallDeps"
      />
    </div>

    <div class="panel" style="margin-top: 12px">
      <h2>创建流程进度</h2>
      <div class="progress-wrap">
        <div class="progress-bar-track">
          <div
            class="progress-bar-fill"
            :style="{ width: `${flow.percent}%` }"
          ></div>
        </div>
        <div class="muted" style="margin-top: 8px">
          {{ flow.currentText }}（{{ flow.percent }}%）
        </div>
      </div>
    </div>
  </section>

  <section class="panel">
    <h2>已管理工程</h2>
    <p class="section-helper">
      如果你已经有工作区，优先继续去主题配置、内容编辑或本地预览。删除动作放在最后，避免误操作。
    </p>
    <div class="list" v-if="workspaceState.workspaces.length">
      <div
        class="list-item"
        v-for="ws in workspaceState.workspaces"
        :key="ws.id"
      >
        <strong>{{ ws.name }}</strong>
        <div class="muted">{{ ws.framework }} | {{ ws.projectDir }}</div>
        <div class="muted">
          {{ ws.localExists ? "本地存在" : "本地不存在" }}
        </div>
        <div class="actions" style="margin-top: 8px">
          <button class="secondary" @click="jumpToThemeConfig(ws)">
            继续去主题配置
          </button>
          <button class="secondary" @click="jumpToContentEditor(ws)">
            去内容编辑
          </button>
          <button class="secondary" @click="jumpToPreview(ws)">
            去本地预览
          </button>
        </div>
        <div class="actions workspace-danger-actions">
          <button class="danger" @click="removeWorkspaceRecord(ws.id, false)">
            仅删记录
          </button>
          <button class="danger" @click="removeWorkspaceRecord(ws.id, true)">
            删除本地并移除
          </button>
        </div>
      </div>
    </div>
    <p class="muted" v-else>暂无工程。</p>
  </section>

  <section class="panel" v-if="logs.output">
    <h2>执行日志</h2>
    <pre>{{ logs.output }}</pre>
  </section>
</template>

<style scoped>
.theme-hint {
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #f8fafc;
  color: #334155;
  line-height: 1.5;
}

.theme-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.theme-card {
  text-align: left;
  border: 1px solid #d4d4d8;
  border-radius: 12px;
  background: #ffffff;
  padding: 10px;
  cursor: pointer;
}

.theme-card.active {
  border-color: #0f766e;
  box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.15);
}

.theme-thumb-wrap {
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 8px;
  overflow: hidden;
  background: #e5e7eb;
}

.theme-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.theme-thumb-empty {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #6b7280;
  font-size: 13px;
}

.theme-meta {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.workspace-danger-actions {
  padding-top: 8px;
  border-top: 1px dashed rgba(131, 110, 85, 0.24);
}

@media (max-width: 640px) {
  .theme-grid {
    grid-template-columns: 1fr;
  }
}
</style>
