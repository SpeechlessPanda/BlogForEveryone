<script setup>
import { reactive, onMounted, watch } from "vue";
import {
  workspaceState,
  refreshWorkspaces,
  refreshThemeCatalog,
} from "../stores/workspaceStore";

const form = reactive({
  name: "",
  framework: "hexo",
  theme: "landscape",
  projectDir: "",
});

const logs = reactive({ output: "" });
const flow = reactive({
  creating: false,
  currentStep: "idle",
  steps: [
    { key: "validate", label: "校验输入", done: false },
    { key: "init", label: "初始化博客工程", done: false },
    { key: "save", label: "写入工作区记录", done: false },
    { key: "finish", label: "完成", done: false },
  ],
});

function resetFlow() {
  flow.currentStep = "idle";
  for (const item of flow.steps) {
    item.done = false;
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

function markStep(stepKey) {
  flow.currentStep = stepKey;
  const target = flow.steps.find((x) => x.key === stepKey);
  if (target) {
    target.done = true;
  }
}

async function handleCreateWorkspace() {
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
  } finally {
    flow.creating = false;
  }
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

async function handleInstallDeps() {
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
}

onMounted(async () => {
  await refreshThemeCatalog();
  applyDefaultThemeForFramework(form.framework);
  await refreshWorkspaces();
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
      <button
        class="primary"
        :disabled="flow.creating"
        @click="handleCreateWorkspace"
      >
        {{ flow.creating ? "创建中..." : "创建工程" }}
      </button>
      <button class="secondary" @click="handleInstallDeps">
        安装工程依赖（pnpm）
      </button>
    </div>

    <div class="panel" style="margin-top: 12px">
      <h2>创建流程进度</h2>
      <div
        v-for="step in flow.steps"
        :key="step.key"
        class="muted"
        style="margin-bottom: 6px"
      >
        {{ step.done ? "✓" : flow.currentStep === step.key ? "⏳" : "○" }}
        {{ step.label }}
      </div>
    </div>
  </section>

  <section class="panel">
    <h2>已管理工程</h2>
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
            去主题配置
          </button>
          <button class="secondary" @click="jumpToContentEditor(ws)">
            去发布内容
          </button>
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
