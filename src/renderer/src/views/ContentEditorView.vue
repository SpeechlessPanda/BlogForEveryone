<script setup>
import { computed, onMounted, reactive } from "vue";
import {
  getSelectedWorkspace,
  workspaceState,
  refreshWorkspaces,
} from "../stores/workspaceStore";

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
      const result = await window.bfeApi.createAndOpenContent({
        projectDir: ws.projectDir,
        framework: ws.framework,
        type: form.type,
        title: form.title,
        slug: form.slug,
      });

      state.filePath = result.filePath;

      if (form.autoPublish && form.repoUrl) {
        const job = await window.bfeApi.watchAndAutoPublish({
          filePath: result.filePath,
          projectDir: ws.projectDir,
          framework: ws.framework,
          repoUrl: form.repoUrl,
        });
        state.jobId = job.jobId;
        state.jobStatus = job.status;
      }
    },
    "创建内容失败",
  );
}

async function refreshPublishJob() {
  if (!state.jobId) {
    openErrorModal("刷新失败", "当前没有自动发布任务可刷新。");
    return;
  }

  await runActionWithFeedback(
    "refresh",
    async () => {
      const job = await window.bfeApi.getPublishJobStatus({
        jobId: state.jobId,
      });
      if (!job) {
        throw new Error("没有找到自动发布任务。");
        return;
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
});
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

    <div class="grid-2">
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

    <div class="actions">
      <button
        class="primary"
        :class="{
          'is-loading': actionState.create === 'loading',
          'is-success': actionState.create === 'success',
          'is-fail': actionState.create === 'fail',
        }"
        :disabled="actionState.create === 'loading'"
        @click="createAndEdit"
      >
        <span
          v-if="actionState.create === 'loading'"
          class="btn-spinner"
          aria-hidden="true"
        ></span>
        {{ getActionLabel("create", "创建并打开编辑器") }}
      </button>
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
