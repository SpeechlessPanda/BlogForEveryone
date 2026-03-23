<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  getSelectedWorkspace,
  workspaceState,
  refreshWorkspaces,
} from "../stores/workspaceStore";
import AsyncActionButton from "../components/AsyncActionButton.vue";
import { useAsyncAction } from "../composables/useAsyncAction";
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

function goTutorialCenter() {
  window.dispatchEvent(new CustomEvent("bfe:open-tutorial"));
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
  <section class="panel">
    <h2>内容编辑</h2>
    <p class="muted">
      新建博客/关于/友链/公告时，软件会自动创建 Markdown 并打开系统默认编辑器。
    </p>
    <p>
      <a href="#" @click.prevent="goTutorialCenter"
        >打开教程中心：内容编辑与自动发布完整步骤</a
      >
    </p>

    <div class="section-card-grid">
      <div class="context-card">
        <p class="section-eyebrow">当前工作区</p>
        <strong>{{ selectedWorkspace?.name || "尚未选择工程" }}</strong>
        <p class="section-helper">
          {{
            selectedWorkspace
              ? `${selectedWorkspace.framework.toUpperCase()} · 主题 ${selectedWorkspace.theme || '未识别'}`
              : "先选择工作区，写出的文章和页面才会进入正确的博客目录。"
          }}
        </p>
      </div>
      <div class="context-card">
        <p class="section-eyebrow">推荐顺序</p>
        <strong>先写第一篇内容，再考虑自动发布</strong>
        <p class="section-helper">
          先确认 Markdown 创建和保存都正常，再启用保存后自动发布，会更容易排查问题。
        </p>
      </div>
    </div>

    <div class="grid-2" style="margin-top: 12px">
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
        <p class="muted" style="margin: 6px 0 0 0">
          当前主题：{{ selectedWorkspace?.theme || "未识别" }}
        </p>
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

    <details class="advanced-panel">
      <summary>自动发布（进阶，可稍后再配）</summary>
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

    <div class="actions">
      <AsyncActionButton
        kind="primary"
        label="创建并打开编辑器"
        busy-label="创建中..."
        :busy="actionState.create === 'loading' || isBusy('create')"
        @click="createAndEdit"
      />
      <button
        class="secondary"
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

    <div class="panel" style="margin-top: 12px">
      <h2>已有内容二次编辑</h2>
      <p class="muted">
        读取当前工程已有文章/页面，支持直接修改标题与正文后保存，也可以一键用外部编辑器打开。
      </p>
      <div class="grid-2">
        <div>
          <label>选择已有内容</label>
          <select v-model="selectedExistingPath">
            <option value="">请选择</option>
            <option
              v-for="item in existingList"
              :key="item.filePath"
              :value="item.filePath"
            >
              {{ item.type }} | {{ item.title }} | {{ item.relativePath }}
            </option>
          </select>
        </div>
        <div>
          <label>标题</label>
          <input v-model="existingEditor.title" placeholder="文章标题" />
        </div>
      </div>
      <div style="margin-top: 10px">
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
          @click="refreshExistingContents"
        />
        <AsyncActionButton
          kind="primary"
          label="保存标题与正文"
          busy-label="保存中..."
          :busy="isBusy('save-existing')"
          @click="saveExistingContentChanges"
        />
        <AsyncActionButton
          kind="secondary"
          label="用外部编辑器打开"
          busy-label="打开中..."
          :busy="isBusy('open-existing')"
          @click="openSelectedExistingInEditor"
        />
      </div>
    </div>

    <div
      v-if="state.filePath || state.jobStatus"
      class="panel"
      style="margin-top: 12px"
    >
      <h2>最近一次任务</h2>
      <p class="muted">文件路径：{{ state.filePath || "-" }}</p>
      <p class="muted">任务状态：{{ state.jobStatus || "-" }}</p>
    </div>

    <div
      v-if="errorModal.visible"
      class="modal-backdrop"
      @click.self="closeErrorModal"
    >
      <div class="modal-panel">
        <h2>{{ errorModal.title }}</h2>
        <p class="muted" style="font-size: 14px">{{ errorModal.message }}</p>
        <div class="actions">
          <button class="danger" @click="closeErrorModal">关闭</button>
        </div>
      </div>
    </div>
  </section>
</template>
