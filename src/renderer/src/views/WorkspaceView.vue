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
import { getThemeDisplayMetadata } from "../utils/themeDisplayMetadata.mjs";
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

const featuredThemeIdByFramework = {
  hexo: "fluid",
  hugo: "papermod",
};

const recommendedThemeIdsByFramework = {
  hexo: ["next", "butterfly"],
  hugo: ["stack", "loveit"],
};

const previewBaseUrl = import.meta.env.BASE_URL || "./";

const currentFrameworkThemes = computed(() => {
  const list = workspaceState.themeCatalog?.[form.framework] || [];

  return list.map((item) => {
    const key = `${form.framework}:${item.id}`;
    const display = getThemeDisplayMetadata(form.framework, item.id) || {
      tags: [],
      positioningCopy: "",
    };
    const featured = featuredThemeIdByFramework[form.framework] === item.id;
    const recommended = recommendedThemeIdsByFramework[form.framework]?.includes(
      item.id,
    );

    return {
      ...item,
      display,
      featured,
      recommended,
      preview: resolveThemePreviewPath(previewBaseUrl, themePreviewMap[key] || ""),
      selected: item.id === form.theme,
    };
  });
});

const featuredTheme = computed(() => {
  return (
    currentFrameworkThemes.value.find((item) => item.featured) ||
    currentFrameworkThemes.value[0] ||
    null
  );
});

const recommendedThemes = computed(() => {
  return currentFrameworkThemes.value.filter(
    (item) => item.id !== featuredTheme.value?.id,
  );
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

function jumpToImportView() {
  window.dispatchEvent(
    new CustomEvent("bfe:open-tab", { detail: { tabKey: "import" } }),
  );
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
  <div
    class="page-shell page-shell--workspace"
    data-page-role="workspace"
    data-workspace-surface="editorial-workbench"
  >
    <div class="page-layer" data-page-layer="primary">
      <section class="panel page-hero workspace-hero" data-workspace-zone="hero">
        <div class="page-hero-grid">
          <div>
            <p class="page-kicker">Workflow entry</p>
            <h2 class="page-title">博客创建工作台</h2>
            <p class="page-lead">
              这里把新建与继续工作分开处理：先挑一个更像成品的主题方向，再启动工作区；已有博客则直接回到主题、内容或预览环节继续推进。
            </p>
            <div class="actions workspace-hero-actions">
              <button
                class="primary"
                type="button"
                @click="jumpToZone('workspace-new-start')"
              >
                快速创建新博客
              </button>
              <button
                class="secondary"
                type="button"
                @click="jumpToZone('workspace-continue')"
              >
                继续现有工作
              </button>
              <button class="secondary" type="button" @click="jumpToImportView">
                导入已有项目
              </button>
            </div>
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
                快速创建、继续现有工作、导入已有项目都保留在这一屏，不用切换思路找入口。
              </p>
            </div>
            <div class="page-signal page-signal--quiet">
              <p class="section-eyebrow">继续工作入口</p>
              <strong>优先回到最近工作区，再决定是否调整主题与内容。</strong>
              <p class="section-helper">
                最近工作区卡片会把继续完善动作放到最前面，删除动作压到最后。
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
        data-workspace-zone="theme-curation"
      >
        <div class="workspace-section-heading">
          <div>
            <p class="section-eyebrow">Theme direction</p>
            <h2>精选首发主题</h2>
          </div>
          <p class="section-helper workspace-heading-note">
            这里不只看缩略图，还会告诉你每套主题更像哪一种成品气质。
          </p>
        </div>

        <div class="theme-hint">
          选主题时请主要留意布局、留白和文字秩序。示例背景只是辅助，不应压过你对阅读感与品牌感的判断。
        </div>

        <div v-if="featuredTheme" class="workspace-featured-theme tutorial-feature-card">
          <div class="workspace-featured-theme-media theme-thumb-wrap">
            <img
              v-if="featuredTheme.preview"
              class="theme-thumb"
              :src="featuredTheme.preview"
              :alt="`${featuredTheme.name} 主题预览`"
              loading="lazy"
            />
            <div v-else class="theme-thumb-empty">暂无预览图</div>
          </div>
          <div class="workspace-featured-theme-copy">
            <p class="section-eyebrow">编辑部精选</p>
            <h3>{{ featuredTheme.name }}</h3>
            <p class="workspace-theme-framework muted">
              {{ form.framework }} · {{ featuredTheme.id }}
            </p>
            <div class="tutorial-tag-row workspace-tag-row">
              <span
                v-for="tag in featuredTheme.display.tags"
                :key="`${featuredTheme.id}-${tag}`"
                class="tutorial-tag theme-display-tag"
              >
                {{ tag }}
              </span>
            </div>
            <p class="workspace-positioning-copy">
              {{ featuredTheme.display.positioningCopy }}
            </p>
            <div class="actions workspace-featured-actions">
              <button
                class="primary"
                type="button"
                @click="selectThemeCard(featuredTheme.id)"
              >
                选用 {{ featuredTheme.name }}
              </button>
            </div>
          </div>
        </div>

        <div class="workspace-section-heading workspace-section-heading--compact">
          <div>
            <p class="section-eyebrow">Curated collection</p>
            <h3>推荐继续看</h3>
          </div>
          <p class="section-helper workspace-heading-note">
            每张卡都保留预览图、主题名称、标签和一句定位说明，帮助你按成品方向来选。
          </p>
        </div>

        <div class="workspace-theme-grid" v-if="recommendedThemes.length">
          <button
            v-for="item in recommendedThemes"
            :key="`${form.framework}-${item.id}`"
            class="tutorial-theme-card workspace-theme-card"
            :class="{
              active: item.selected,
              'workspace-theme-card--recommended': item.recommended,
            }"
            type="button"
            @click="selectThemeCard(item.id)"
          >
            <div class="theme-thumb-wrap workspace-theme-thumb-wrap">
              <img
                v-if="item.preview"
                class="theme-thumb"
                :src="item.preview"
                :alt="`${item.name} 主题预览`"
                loading="lazy"
              />
              <div v-else class="theme-thumb-empty">暂无预览图</div>
            </div>
            <div class="workspace-theme-copy">
              <div class="workspace-theme-header">
                <div>
                  <p class="section-eyebrow">
                    {{ item.recommended ? "推荐继续看" : "稳定备选" }}
                  </p>
                  <h4>{{ item.name }}</h4>
                </div>
                <span class="muted">{{ form.framework }} · {{ item.id }}</span>
              </div>
              <div class="tutorial-tag-row workspace-tag-row">
                <span
                  v-for="tag in item.display.tags"
                  :key="`${item.id}-${tag}`"
                  class="tutorial-tag theme-display-tag"
                >
                  {{ tag }}
                </span>
              </div>
              <p class="workspace-positioning-copy">
                {{ item.display.positioningCopy }}
              </p>
            </div>
          </button>
        </div>
      </section>
    </div>

    <div class="page-layer" data-page-layer="explanation">
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
            class="workspace-card tutorial-recent-card"
            v-for="ws in workspaceState.workspaces"
            :key="ws.id"
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
