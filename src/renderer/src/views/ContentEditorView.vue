<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  getSelectedWorkspace,
  workspaceState,
  refreshWorkspaces,
} from "../stores/workspaceStore";
import AsyncActionButton from "../components/AsyncActionButton.vue";
import ContentWorkflowHero from "../components/content/ContentWorkflowHero.vue";
import ExistingContentSection from "../components/content/ExistingContentSection.vue";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useShellActions } from "../composables/useShellActions.mjs";
import { useContentActions } from "../composables/useContentActions";

const ACTION_IDLE_RESET_MS = 1400;

const form = reactive({
  type: "post",
  title: "",
  slug: "",
  autoPublish: true,
  repoUrl: "",
});

const state = reactive({
  filePath: "",
  jobId: "",
  jobStatus: "",
});

const selectedWorkspace = computed(() => getSelectedWorkspace());
const existingList = ref([]);
const selectedExistingPath = ref("");
const existingEditor = reactive({
  title: "",
  body: "",
});
const { run, isBusy } = useAsyncAction();
const shellActions = useShellActions();
const contentActions = useContentActions();

const actionState = reactive({
  create: "idle",
  refresh: "idle",
});

const errorModal = reactive({
  visible: false,
  title: "操作失败",
  message: "",
});

const contentRecentResult = computed(() => {
  if (state.filePath) {
    return `已创建或更新：${state.filePath}`;
  }
  if (state.jobStatus) {
    return `自动发布状态：${state.jobStatus}`;
  }
  return "还没有最近一次写作结果。";
});

const contentNextStep = computed(() => {
  if (state.jobStatus) {
    return "确认自动发布结果后，可继续预览或直接进入发布页。";
  }
  if (state.filePath) {
    return "继续润色内容，然后去本地预览检查真实页面。";
  }
  return "先创建第一篇内容，再决定是否启用自动发布。";
});

function goTutorialCenter() {
  shellActions.openTutorial("content-editing");
}

function jumpToZone(zoneId) {
  document.getElementById(zoneId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

async function createAndEdit() {
  const ws = getSelectedWorkspace();
  if (!ws) {
    openErrorModal("创建失败", "请先选择工程。");
    return;
  }

  await runActionWithFeedback(
    "create",
    async () => {
      const result = await contentActions.createAndOpenContent({
        workspaceId: ws.id,
        type: form.type,
        title: form.title,
        slug: form.slug,
      });

      state.filePath = result.filePath;
      await refreshExistingContents();

      if (form.autoPublish && form.repoUrl) {
        const job = await contentActions.watchAndAutoPublish({
          workspaceId: ws.id,
          filePath: result.filePath,
          repoUrl: form.repoUrl,
        });
        state.jobId = job.jobId;
        state.jobStatus = job.status;
      }
    },
    "创建内容失败",
  );
}

async function refreshExistingContents() {
  const ws = getSelectedWorkspace();
  if (!ws) {
    existingList.value = [];
    selectedExistingPath.value = "";
    existingEditor.title = "";
    existingEditor.body = "";
    return;
  }

  await run("load-existing", async () => {
    const list = await contentActions.listExistingContents({
      workspaceId: ws.id,
    });
    existingList.value = list || [];
    if (!existingList.value.length) {
      selectedExistingPath.value = "";
      existingEditor.title = "";
      existingEditor.body = "";
      return;
    }

    if (
      !existingList.value.some(
        (item) => item.filePath === selectedExistingPath.value,
      )
    ) {
      selectedExistingPath.value = existingList.value[0].filePath;
    }

    await loadSelectedExistingContent();
  });
}

async function loadSelectedExistingContent() {
  const filePath = selectedExistingPath.value;
  const ws = getSelectedWorkspace();
  if (!filePath) {
    existingEditor.title = "";
    existingEditor.body = "";
    return;
  }
  if (!ws) {
    existingEditor.title = "";
    existingEditor.body = "";
    return;
  }

  await run("read-existing", async () => {
    const detail = await contentActions.readExistingContent({
      workspaceId: ws.id,
      filePath,
    });
    existingEditor.title = detail.title || "";
    existingEditor.body = detail.body || "";
  });
}

async function saveExistingContentChanges() {
  if (!selectedExistingPath.value) {
    openErrorModal("保存失败", "请先选择要编辑的内容。");
    return;
  }

  const ws = getSelectedWorkspace();
  if (!ws) {
    openErrorModal("保存失败", "请先选择工程。");
    return;
  }

  await run("save-existing", async () => {
    await contentActions.saveExistingContent({
      workspaceId: ws.id,
      filePath: selectedExistingPath.value,
      title: existingEditor.title,
      body: existingEditor.body,
    });
    await refreshExistingContents();
  });
}

async function openSelectedExistingInEditor() {
  if (!selectedExistingPath.value) {
    openErrorModal("打开失败", "请先选择要打开的内容。");
    return;
  }

  const ws = getSelectedWorkspace();
  if (!ws) {
    openErrorModal("打开失败", "请先选择工程。");
    return;
  }

  await run("open-existing", async () => {
    await contentActions.openExistingContent({
      workspaceId: ws.id,
      filePath: selectedExistingPath.value,
    });
  });
}

async function refreshPublishJob() {
  if (!state.jobId) {
    openErrorModal("刷新失败", "当前没有自动发布任务可刷新。");
    return;
  }

  await runActionWithFeedback(
    "refresh",
    async () => {
      const job = await contentActions.getPublishJobStatus({
        jobId: state.jobId,
      });
      if (!job) {
        throw new Error("没有找到自动发布任务。");
      }
      state.jobStatus = job.status;
    },
    "刷新发布状态失败",
  );
}

function openErrorModal(title, error) {
  errorModal.visible = true;
  errorModal.title = title;
  errorModal.message = String(error?.message || error || "未知错误");
}

function closeErrorModal() {
  errorModal.visible = false;
}

function scheduleActionReset(key) {
  window.setTimeout(() => {
    if (actionState[key] !== "loading") {
      actionState[key] = "idle";
    }
  }, ACTION_IDLE_RESET_MS);
}

async function runActionWithFeedback(key, task, failTitle) {
  actionState[key] = "loading";
  try {
    await task();
    actionState[key] = "success";
  } catch (error) {
    actionState[key] = "fail";
    openErrorModal(failTitle, error);
  } finally {
    scheduleActionReset(key);
  }
}

function getActionLabel(key, idleLabel) {
  if (actionState[key] === "success") {
    return "success";
  }
  if (actionState[key] === "fail") {
    return "fail";
  }
  return idleLabel;
}

onMounted(async () => {
  await refreshWorkspaces();
  await refreshExistingContents();
});

watch(
  () => workspaceState.selectedWorkspaceId,
  async () => {
    await refreshExistingContents();
  },
);

watch(
  () => selectedExistingPath.value,
  async () => {
    await loadSelectedExistingContent();
  },
);
</script>

<template>
  <div
    class="page-shell page-shell--content"
    data-page-role="content-editor"
    data-workflow-surface="editorial-workflow"
  >
    <div class="page-layer" data-page-layer="primary">
      <ContentWorkflowHero
        data-workflow-zone="hero"
        :content-next-step="contentNextStep"
        :selected-workspace="selectedWorkspace"
        :existing-count="existingList.length"
        :jump-to-zone="jumpToZone"
        :go-tutorial-center="goTutorialCenter"
      />

      <section
        id="content-create-zone"
        class="panel workflow-section-panel"
        data-workflow-zone="create-content"
      >
        <div class="workflow-section-heading">
          <div class="workflow-section-heading-copy">
            <p class="section-eyebrow">Step 01 · 新建内容</p>
            <h2>新建内容</h2>
            <p class="section-helper">
              新建博客、关于、友链或公告时，优先完成写作入口，再决定是否刷新自动发布状态。
            </p>
          </div>
        </div>

        <div class="workflow-compact-block workflow-result-block">
          <p class="section-eyebrow">写作结果摘要</p>
          <strong>{{ contentRecentResult }}</strong>
          <p class="page-result-note">{{ contentNextStep }}</p>
        </div>

        <div class="grid-2 stack-top">
          <div>
            <label>当前工程</label>
            <select v-model="workspaceState.selectedWorkspaceId">
              <option value="">请选择</option>
              <option
                v-for="ws in workspaceState.workspaces"
                :key="ws.id"
                :value="ws.id"
              >
                {{ ws.name }}
              </option>
            </select>
            <p class="muted stack-top">当前主题：{{ selectedWorkspace?.theme || "未识别" }}</p>
          </div>
          <div>
            <label>内容类型</label>
            <select v-model="form.type">
              <option value="post">新博客文章</option>
              <option value="about">关于页</option>
              <option value="links">友链页</option>
              <option value="announcement">公告页</option>
            </select>
          </div>
          <div>
            <label>标题</label>
            <input v-model="form.title" placeholder="例如 这是我的第一篇博客" />
          </div>
          <div>
            <label>slug（可选）</label>
            <input v-model="form.slug" placeholder="例如 first-post" />
          </div>
        </div>

        <div class="actions">
          <AsyncActionButton
            kind="primary"
            label="创建并打开编辑器"
            busy-label="创建中..."
            :busy="actionState.create === 'loading' || isBusy('create')"
            data-workflow-action-level="primary"
            @click="createAndEdit"
          />
          <button
            class="secondary"
            data-workflow-action-level="tertiary"
            :class="{
              'is-loading': actionState.refresh === 'loading',
              'is-success': actionState.refresh === 'success',
              'is-fail': actionState.refresh === 'fail',
            }"
            :disabled="actionState.refresh === 'loading'"
            @click="refreshPublishJob"
          >
            <span
              v-if="actionState.refresh === 'loading'"
              class="btn-spinner"
              aria-hidden="true"
            ></span>
            {{ getActionLabel("refresh", "刷新自动发布状态") }}
          </button>
        </div>
      </section>

      <ExistingContentSection
        data-workflow-zone="existing-content"
        :existing-list="existingList"
        :selected-existing-path="selectedExistingPath"
        :existing-editor="existingEditor"
        :is-busy="isBusy"
        :refresh-existing-contents="refreshExistingContents"
        :save-existing-content-changes="saveExistingContentChanges"
        :open-selected-existing-in-editor="openSelectedExistingInEditor"
        @update:selected-existing-path="selectedExistingPath = $event"
      />
    </div>

    <div class="page-layer" data-page-layer="detail">
      <details class="advanced-panel">
        <summary>自动流程（后置）</summary>
        <div class="advanced-panel-content">
          <p class="section-helper">
            如果只是先把文章写出来，可以先不配这部分。等你确认手动预览和发布都正常后，再打开自动发布。
          </p>
          <div class="grid-2">
            <div>
              <label>保存后自动发布（需要仓库地址）</label>
              <select v-model="form.autoPublish">
                <option :value="true">true</option>
                <option :value="false">false</option>
              </select>
            </div>
            <div>
              <label>发布仓库地址</label>
              <input
                v-model="form.repoUrl"
                placeholder="https://github.com/you/your-blog.git"
              />
            </div>
          </div>
        </div>
      </details>

      <section v-if="state.filePath || state.jobStatus" class="panel">
        <h2>任务详情</h2>
        <p class="muted">文件路径：{{ state.filePath || "-" }}</p>
        <p class="muted">任务状态：{{ state.jobStatus || "-" }}</p>
      </section>
    </div>

    <div
      v-if="errorModal.visible"
      class="modal-backdrop"
      @click.self="closeErrorModal"
    >
      <div class="modal-panel">
        <h2>{{ errorModal.title }}</h2>
        <p class="muted error-text">{{ errorModal.message }}</p>
        <div class="actions">
          <button class="danger" @click="closeErrorModal">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>
