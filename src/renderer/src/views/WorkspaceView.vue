<script setup>
import { computed, reactive, onMounted, onUnmounted, watch } from "vue";
import {
  workspaceState,
  refreshWorkspaces,
  refreshThemeCatalog,
} from "../stores/workspaceStore";
import AsyncActionButton from "../components/AsyncActionButton.vue";
import WorkspaceContinueSection from "../components/workspace/WorkspaceContinueSection.vue";
import WorkspaceHeroSection from "../components/workspace/WorkspaceHeroSection.vue";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useShellActions } from "../composables/useShellActions.mjs";
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
const shellActions = useShellActions();
const workspaceActions = useWorkspaceActions();
const flow = reactive({
  creating: false,
  currentStep: "idle",
  currentText: "等待开始",
  percent: 0,
});
const themePreviewLightbox = reactive({
  open: false,
  title: "",
  src: "",
  scale: 1,
  translateX: 0,
  translateY: 0,
  isDragging: false,
});

const THEME_PREVIEW_SCALE_STEP = 0.2;
const THEME_PREVIEW_MIN_SCALE = 1;
const THEME_PREVIEW_MAX_SCALE = 4;

let themePreviewDragPointerId = null;
let themePreviewDragOffsetX = 0;
let themePreviewDragOffsetY = 0;

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

const themePreviewImageStyle = computed(() => {
  return {
    transform: `translate(${themePreviewLightbox.translateX}px, ${themePreviewLightbox.translateY}px) scale(${themePreviewLightbox.scale})`,
  };
});

function clampThemePreviewScale(scale) {
  return Math.min(
    THEME_PREVIEW_MAX_SCALE,
    Math.max(THEME_PREVIEW_MIN_SCALE, Number(scale.toFixed(2))),
  );
}

function resetThemePreviewTransform() {
  themePreviewLightbox.scale = 1;
  themePreviewLightbox.translateX = 0;
  themePreviewLightbox.translateY = 0;
  themePreviewLightbox.isDragging = false;
  themePreviewDragPointerId = null;
  themePreviewDragOffsetX = 0;
  themePreviewDragOffsetY = 0;
}

function zoomThemePreview(delta) {
  const nextScale = clampThemePreviewScale(themePreviewLightbox.scale + delta);
  themePreviewLightbox.scale = nextScale;

  if (nextScale === THEME_PREVIEW_MIN_SCALE) {
    themePreviewLightbox.translateX = 0;
    themePreviewLightbox.translateY = 0;
  }
}

function handleThemePreviewWheel(event) {
  const delta = event.deltaY < 0 ? THEME_PREVIEW_SCALE_STEP : -THEME_PREVIEW_SCALE_STEP;
  zoomThemePreview(delta);
}

function handleThemePreviewPointerDown(event) {
  if (themePreviewLightbox.scale <= THEME_PREVIEW_MIN_SCALE) {
    return;
  }

  themePreviewLightbox.isDragging = true;
  themePreviewDragPointerId = event.pointerId;
  themePreviewDragOffsetX = event.clientX - themePreviewLightbox.translateX;
  themePreviewDragOffsetY = event.clientY - themePreviewLightbox.translateY;
  event.currentTarget.setPointerCapture(event.pointerId);
}

function handleThemePreviewPointerMove(event) {
  if (
    !themePreviewLightbox.isDragging ||
    themePreviewDragPointerId !== event.pointerId
  ) {
    return;
  }

  themePreviewLightbox.translateX = event.clientX - themePreviewDragOffsetX;
  themePreviewLightbox.translateY = event.clientY - themePreviewDragOffsetY;
}

function stopThemePreviewDrag(event) {
  if (themePreviewDragPointerId !== null && themePreviewDragPointerId !== event.pointerId) {
    return;
  }

  themePreviewLightbox.isDragging = false;
  themePreviewDragPointerId = null;

  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

function openThemePreview(theme) {
  if (!theme?.preview) {
    return;
  }
  resetThemePreviewTransform();
  themePreviewLightbox.open = true;
  themePreviewLightbox.title = `${theme.name} 主题预览`;
  themePreviewLightbox.src = theme.preview;
}

function closeThemePreview() {
  resetThemePreviewTransform();
  themePreviewLightbox.open = false;
  themePreviewLightbox.title = "";
  themePreviewLightbox.src = "";
}

function handleWindowKeydown(event) {
  if (event.key === "Escape" && themePreviewLightbox.open) {
    closeThemePreview();
  }
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
  shellActions.openTab("theme");
}

function jumpToContentEditor(ws) {
  workspaceState.selectedWorkspaceId = ws.id;
  shellActions.openTab("content");
}

function jumpToPreview(ws) {
  workspaceState.selectedWorkspaceId = ws.id;
  shellActions.openTab("preview");
}

function jumpToImportView() {
  shellActions.openTab("import");
}

function jumpToZone(zoneId) {
  document.getElementById(zoneId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
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
  window.addEventListener("keydown", handleWindowKeydown);
  await refreshThemeCatalog();
  applyDefaultThemeForFramework(form.framework);
  await refreshWorkspaces();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleWindowKeydown);
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
  shellActions.openTutorial();
}
</script>

<template>
  <div
    class="page-shell page-shell--workspace"
    data-page-role="workspace"
    data-workspace-surface="editorial-workbench"
  >
    <div class="page-layer" data-page-layer="primary">
      <WorkspaceHeroSection
        data-workspace-zone="hero"
        :selected-workspace="selectedWorkspace"
        :workspace-next-action-label="workspaceNextActionLabel"
        :workspace-stage-label="workspaceStageLabel"
        :workspace-blocker-label="workspaceBlockerLabel"
        :jump-to-zone="jumpToZone"
        :jump-to-import-view="jumpToImportView"
        :go-tutorial-center="goTutorialCenter"
      />

      <section
        id="workspace-new-start"
        class="panel workspace-create-panel"
        data-workspace-zone="new-start"
      >
        <h2>新建博客工程</h2>
        <p class="section-helper">
          新开一条博客线时，先确定框架与主题气质，再填写工程名和本地路径。依赖安装统一使用 pnpm，网络问题会自动换源重试。
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
            <label>已选主题</label>
            <input :value="form.theme || '请在下方挑选主题'" readonly />
          </div>
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

      <section
        class="panel workspace-theme-panel"
        data-workspace-zone="theme-selection"
      >
        <div class="workspace-section-heading">
          <div>
            <p class="section-eyebrow">Theme direction</p>
            <h2>统一主题选择区</h2>
          </div>
          <p class="section-helper workspace-heading-note">
            所有可用主题都在这里统一展示，先看缩略图，再决定当前工作区要从哪一套主题开始。
          </p>
        </div>

        <div class="theme-hint">
          选主题时先看首页结构、文字密度和图片气质。确认方向后，再回到上方继续填写工程信息并创建工作区。
        </div>

        <div class="workspace-theme-grid" v-if="currentFrameworkThemes.length">
          <article
            v-for="item in currentFrameworkThemes"
            :key="`${form.framework}-${item.id}`"
            class="tutorial-theme-card workspace-theme-card"
            :class="{ active: item.selected }"
          >
            <button
              v-if="item.preview"
              class="theme-thumb-wrap workspace-theme-thumb-wrap workspace-theme-preview-trigger"
              type="button"
              :aria-label="`查看 ${item.name} 主题预览大图`"
              @click="openThemePreview(item)"
            >
              <img
                class="theme-thumb"
                :src="item.preview"
                :alt="`${item.name} 主题预览`"
                loading="lazy"
              />
            </button>
            <div v-else class="theme-thumb-wrap workspace-theme-thumb-wrap">
              <div class="theme-thumb-empty">暂无预览图</div>
            </div>
            <div class="workspace-theme-copy">
              <div class="workspace-theme-header">
                <div>
                  <p class="section-eyebrow">Theme preview</p>
                  <h4>{{ item.name }}</h4>
                </div>
                <span class="muted">{{ form.framework }} · {{ item.id }}</span>
              </div>
              <p class="workspace-positioning-copy">
                {{ item.selected ? "当前已选主题，创建工作区时会使用这套方向。" : "点击下方按钮即可把它设为当前创建工作区的主题，预览图片只负责查看大图。" }}
              </p>
              <div class="actions workspace-card-actions">
                <button class="primary" type="button" @click="selectThemeCard(item.id)">
                  {{ item.selected ? "当前已选" : `选用 ${item.name}` }}
                </button>
              </div>
            </div>
          </article>
        </div>

        <dialog
          v-if="themePreviewLightbox.open"
          open
          class="theme-preview-lightbox"
          @cancel.prevent="closeThemePreview"
          @click.self="closeThemePreview"
        >
          <div class="theme-preview-dialog">
            <div class="theme-preview-dialog-header">
              <div class="theme-preview-dialog-copy">
                <p class="section-eyebrow">Theme preview</p>
                <h3>{{ themePreviewLightbox.title }}</h3>
              </div>
              <div class="theme-preview-dialog-actions">
                <span class="theme-preview-zoom-status">
                  {{ Math.round(themePreviewLightbox.scale * 100) }}%
                </span>
                <button
                  class="secondary theme-preview-zoom-button"
                  type="button"
                  @click="zoomThemePreview(-THEME_PREVIEW_SCALE_STEP)"
                >
                  缩小
                </button>
                <button
                  class="secondary theme-preview-zoom-button"
                  type="button"
                  @click="zoomThemePreview(THEME_PREVIEW_SCALE_STEP)"
                >
                  放大
                </button>
                <button
                  class="secondary theme-preview-reset"
                  type="button"
                  @click="resetThemePreviewTransform"
                >
                  重置
                </button>
              </div>
              <button
                class="secondary theme-preview-close"
                type="button"
                @click="closeThemePreview"
              >
                关闭预览
              </button>
            </div>
            <div
              class="theme-preview-stage"
              :class="{ 'theme-preview-stage--dragging': themePreviewLightbox.isDragging }"
              @wheel.prevent="handleThemePreviewWheel"
              @pointerdown="handleThemePreviewPointerDown"
              @pointermove="handleThemePreviewPointerMove"
              @pointerup="stopThemePreviewDrag"
              @pointerleave="stopThemePreviewDrag"
              @pointercancel="stopThemePreviewDrag"
            >
              <img
                class="theme-preview-image"
                :src="themePreviewLightbox.src"
                :alt="themePreviewLightbox.title"
                :style="themePreviewImageStyle"
                draggable="false"
                @dragstart.prevent
              />
            </div>
          </div>
        </dialog>
      </section>
    </div>

    <div class="page-layer" data-page-layer="explanation">
      <WorkspaceContinueSection
        data-workspace-zone="continue-work"
        :workspace-state="workspaceState"
        :jump-to-theme-config="jumpToThemeConfig"
        :jump-to-content-editor="jumpToContentEditor"
        :jump-to-preview="jumpToPreview"
        :remove-workspace-record="removeWorkspaceRecord"
        :jump-to-zone="jumpToZone"
        :jump-to-import-view="jumpToImportView"
      />

      <section class="priority-panel priority-panel--support workspace-progress-panel">
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
    </div>

    <div class="page-layer" data-page-layer="detail">
      <section class="panel" v-if="logs.output">
        <h2>执行日志</h2>
        <pre>{{ logs.output }}</pre>
      </section>
    </div>
  </div>
</template>
