<script setup>
import { computed, reactive, onMounted, onUnmounted, watch } from "vue";
import {
  workspaceState,
  refreshWorkspaces,
  refreshThemeCatalog,
} from "../stores/workspaceStore";
import AsyncActionButton from "../components/AsyncActionButton.vue";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useWorkspaceActions } from "../composables/useWorkspaceActions.mjs";
import { resolveThemePreviewPath } from "../utils/workflowViewHelpers.mjs";

const form = reactive({
  name: "",
  framework: "hexo",
  theme: "landscape",
  projectDir: "",
});

const logs = reactive({ output: "" });
const { run, isBusy } = useAsyncAction();
const workspaceActions = useWorkspaceActions();
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

const workspaceStageLabel = computed(() => {
  if (flow.creating) {
    return "创建进行中";
  }
  if (selectedWorkspace.value) {
    return "进入品牌与内容完善阶段";
  }
  return "开始搭建第一篇博客";
});

const workspaceNextActionLabel = computed(() => {
  if (flow.creating) {
    return flow.currentText;
  }
  if (selectedWorkspace.value) {
    return "继续前往主题配置、内容编辑或本地预览。";
  }
  return "先填写工程信息并创建一个可运行的工作区。";
});

const workspaceBlockerLabel = computed(() => {
  if (flow.creating) {
    return "创建流程运行中，请先等待当前步骤完成。";
  }
  if (!form.name || !form.projectDir) {
    return "需要先填写工程名称与本地路径。";
  }
  if (!currentFrameworkThemes.value.length) {
    return "当前框架还没有可选主题。";
  }
  return "当前没有明显阻塞，可以继续创建。";
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
      const result = await workspaceActions.createWorkspace({ ...form });
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
    const result = await workspaceActions.pickDirectory({
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
    const result = await workspaceActions.removeWorkspace({ id, deleteLocal });
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
      const result = await workspaceActions.installProjectDependencies({
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
  <div class="page-shell page-shell--workspace" data-page-role="workspace">
    <div class="page-layer" data-page-layer="primary">
      <section class="panel page-hero">
        <div class="page-hero-grid">
          <div>
            <p class="page-kicker">Workflow entry</p>
            <h2 class="page-title">博客创建工作台</h2>
            <p class="page-lead">
              这是主创建入口：先拿到一个可运行工作区，再去做品牌、写作、预览和发布。页面会优先告诉你当前博客、当前阶段、建议下一步与阻塞状态。
            </p>
            <div class="page-link-row">
              <a href="#" @click.prevent="goTutorialCenter"
                >不知道怎么填？打开教程中心（新建博客保姆指南）</a
              >
            </div>
          </div>
          <div class="page-hero-aside">
            <div class="page-signal page-signal--accent">
              <p class="section-eyebrow">建议下一步</p>
              <strong>{{ workspaceNextActionLabel }}</strong>
              <p class="section-helper">
                先完成创建，再继续去主题配置、内容编辑或预览，会更稳。
              </p>
            </div>
          </div>
        </div>

        <div class="page-status-grid">
          <div class="page-signal page-signal--accent">
            <p class="section-eyebrow">当前博客</p>
            <strong>{{ selectedWorkspace?.name || "还没有选中的工作区" }}</strong>
            <p class="section-helper">
              {{
                selectedWorkspace
                  ? `${selectedWorkspace.framework} · ${selectedWorkspace.projectDir}`
                  : "创建成功后，这里会成为主题配置、预览和发布的默认上下文。"
              }}
            </p>
          </div>
          <div class="page-signal">
            <p class="section-eyebrow">当前阶段</p>
            <strong>{{ workspaceStageLabel }}</strong>
            <p class="section-helper">创建页负责把博客正式接入主流程。</p>
          </div>
          <div class="page-signal">
            <p class="section-eyebrow">建议下一步</p>
            <strong>{{ workspaceNextActionLabel }}</strong>
            <p class="section-helper">优先保证工作区可运行，再继续调整视觉与内容。</p>
          </div>
          <div class="page-signal page-signal--quiet">
            <p class="section-eyebrow">当前阻塞</p>
            <strong>{{ workspaceBlockerLabel }}</strong>
            <p class="section-helper">阻塞解除后，创建按钮就是本页最强行动点。</p>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>新建博客工程</h2>
        <p class="muted">
          通过点击选择框架和主题，不需要写命令。依赖安装统一使用 pnpm，网络问题会自动换源重试。
        </p>

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
          选主题时请主要留意主题框架页面的效果。背景图片是示例素材，不要让示例背景压过真正的布局与文字风格判断。
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
      </section>
    </div>

    <div class="page-layer" data-page-layer="explanation">
      <section class="priority-panel priority-panel--support">
        <p class="section-eyebrow">创建流程说明</p>
        <strong>{{ flow.currentText }}（{{ flow.percent }}%）</strong>
        <div class="progress-wrap stack-top">
          <div class="progress-bar-track">
            <div
              class="progress-bar-fill"
              :style="{ width: `${flow.percent}%` }"
            ></div>
          </div>
        </div>
        <p class="page-result-note">
          创建完成后，这个工作区会成为后续主题配置、内容编辑、本地预览和发布的默认入口。
        </p>
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
            <div class="actions stack-top">
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
    </div>

    <div class="page-layer" data-page-layer="detail">
      <section class="panel" v-if="logs.output">
        <h2>执行日志</h2>
        <pre>{{ logs.output }}</pre>
      </section>
    </div>
  </div>
</template>

<style scoped>
.theme-hint {
  margin-top: 14px;
  padding: 10px 12px;
   border: 1px solid var(--line);
   border-radius: 10px;
   background: linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(243, 236, 226, 0.84));
   color: var(--ink-soft);
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
   border: 1px solid rgba(131, 110, 85, 0.28);
   border-radius: 12px;
   background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(245, 238, 228, 0.92));
   padding: 10px;
   cursor: pointer;
   box-shadow: 0 10px 20px rgba(var(--shadow-tint), 0.08);
}

.theme-card.active {
   border-color: var(--brand);
   box-shadow: 0 0 0 2px rgba(47, 109, 91, 0.16);
}

.theme-thumb-wrap {
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 8px;
  overflow: hidden;
   background: var(--panel-strong);
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
   color: var(--muted);
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
