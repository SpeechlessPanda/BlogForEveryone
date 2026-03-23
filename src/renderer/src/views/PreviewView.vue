<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  workspaceState,
  refreshWorkspaces,
  getSelectedWorkspace,
} from "../stores/workspaceStore";
import AsyncActionButton from "../components/AsyncActionButton.vue";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useOperationEvents } from "../composables/useOperationEvents";
import { usePreviewActions } from "../composables/usePreviewActions.mjs";

const status = ref("");
const preview = reactive({
  port: "",
  url: "",
  running: false,
  logs: "",
});
const { run, isBusy } = useAsyncAction();
const { events } = useOperationEvents(["preview"]);
const previewActions = usePreviewActions();

const selectedWorkspace = computed(() => getSelectedWorkspace());

function getDefaultPort(framework) {
  return framework === "hexo" ? "4000" : "1313";
}

function applyDefaultPort() {
  const ws = selectedWorkspace.value;
  if (!ws) {
    preview.port = "";
    return;
  }
  preview.port = preview.port || getDefaultPort(ws.framework);
}

async function runPreviewAction(action) {
  await run("preview", async () => {
    const ws = selectedWorkspace.value;
    if (!ws) {
      status.value = "请先选择工程。";
      return;
    }

    try {
        const port = Number(preview.port || getDefaultPort(ws.framework));
        if (action === "start") {
        const result = await previewActions.startLocalPreview({
          projectDir: ws.projectDir,
          framework: ws.framework,
          port,
        });
        preview.logs = JSON.stringify(result.logs || result, null, 2);
        if (!result.ok) {
          preview.running = false;
          status.value = result.message || "预览启动失败。";
          return;
        }
        preview.running = true;
        preview.url = result.url;
        const openResult = await previewActions.openLocalPreview({
          framework: ws.framework,
          projectDir: ws.projectDir,
          url: result.url,
        });
        if (!openResult?.ok) {
          status.value = `预览已启动，但未能打开地址：${openResult?.message || "请手动打开预览地址。"}`;
          return;
        }
        status.value = `预览已启动：${result.url}`;
        return;
      }

      if (action === "open") {
        const result = await previewActions.openLocalPreview({
          framework: ws.framework,
          projectDir: ws.projectDir,
          port,
        });
        if (!result?.ok) {
          status.value = result?.message || "预览地址打开失败。";
          return;
        }
        preview.url = result.url;
        status.value = `已打开：${result.url}`;
        return;
      }

      if (action === "restart") {
        const stopResult = await previewActions.stopLocalPreview({
          projectDir: ws.projectDir,
          framework: ws.framework,
        });
        if (!stopResult?.ok) {
          preview.running = false;
          status.value = stopResult?.message || "预览重启失败，停止旧进程时出错。";
          return;
        }
        const result = await previewActions.startLocalPreview({
          projectDir: ws.projectDir,
          framework: ws.framework,
          port,
        });
        preview.logs = JSON.stringify(result.logs || result, null, 2);
        if (!result.ok) {
          preview.running = false;
          status.value = result.message || "预览重启失败。";
          return;
        }
        preview.running = true;
        preview.url = result.url;
        const openResult = await previewActions.openLocalPreview({
          framework: ws.framework,
          projectDir: ws.projectDir,
          url: result.url,
        });
        if (!openResult?.ok) {
          status.value = `预览已重启，但未能打开地址：${openResult?.message || "请手动打开预览地址。"}`;
          return;
        }
        status.value = `预览已重启：${result.url}`;
        return;
      }

      if (action === "stop") {
        const result = await previewActions.stopLocalPreview({
          projectDir: ws.projectDir,
          framework: ws.framework,
        });
        preview.running = false;
        if (!result?.ok) {
          status.value = result?.message || "预览停止失败。";
          return;
        }
        status.value = "预览已停止。";
      }
    } catch (error) {
      status.value = `预览操作失败：${String(error?.message || error)}`;
    }
  });
}

function goTutorialCenter() {
  window.dispatchEvent(new CustomEvent("bfe:open-tutorial"));
}

onMounted(async () => {
  await refreshWorkspaces();
  applyDefaultPort();
});

watch(
  () => workspaceState.selectedWorkspaceId,
  () => {
    preview.url = "";
    preview.logs = "";
    preview.running = false;
    preview.port = "";
    applyDefaultPort();
  },
);
</script>

<template>
  <section class="panel">
    <h2>本地预览（localhost）</h2>
    <p class="muted">
      单独的预览功能页。保存内容或主题后可直接重启预览，查看最新页面变化。
    </p>
    <p>
      <a href="#" @click.prevent="goTutorialCenter"
        >打开教程中心（预览与调试说明）</a
      >
    </p>

    <div class="section-card-grid">
      <div class="context-card">
        <p class="section-eyebrow">当前博客</p>
        <strong>{{ selectedWorkspace?.name || "尚未选择工程" }}</strong>
        <p class="section-helper">
          {{
            selectedWorkspace
              ? `${selectedWorkspace.framework.toUpperCase()} · 默认端口 ${getDefaultPort(selectedWorkspace.framework)}`
              : "先从下拉框里选中工作区，预览才知道要启动哪一个博客。"
          }}
        </p>
      </div>
      <div class="context-card">
        <p class="section-eyebrow">当前状态</p>
        <strong>{{ preview.running ? "预览运行中" : "预览未启动" }}</strong>
        <p class="section-helper">
          {{ status || "启动后应用会自动打开地址；如果页面没更新，优先使用“重启并刷新预览”。" }}
        </p>
      </div>
      <div class="context-card">
        <p class="section-eyebrow">建议下一步</p>
        <strong>先确认 localhost 能打开</strong>
        <p class="section-helper">
          只要预览页能正常打开，说明主题、内容和依赖链路已经基本打通，可以继续去写内容或发布。
        </p>
      </div>
    </div>

    <div class="grid-2">
      <div>
        <label>选择工程</label>
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
      </div>
      <div>
        <label>框架</label>
        <input :value="selectedWorkspace?.framework || '-'" readonly />
      </div>
      <div>
        <label>预览端口</label>
        <input v-model="preview.port" />
      </div>
      <div>
        <label>预览地址</label>
        <input :value="preview.url || 'http://localhost/'" readonly />
      </div>
    </div>

    <div class="actions">
      <AsyncActionButton
        kind="primary"
        label="启动并打开"
        busy-label="处理中..."
        :busy="isBusy('preview')"
        @click="runPreviewAction('start')"
      />
      <AsyncActionButton
        kind="secondary"
        label="重启并刷新预览"
        busy-label="处理中..."
        :busy="isBusy('preview')"
        @click="runPreviewAction('restart')"
      />
      <AsyncActionButton
        kind="secondary"
        label="仅打开地址"
        busy-label="处理中..."
        :busy="isBusy('preview')"
        @click="runPreviewAction('open')"
      />
      <AsyncActionButton
        kind="danger"
        label="停止预览"
        busy-label="处理中..."
        :busy="isBusy('preview')"
        @click="runPreviewAction('stop')"
      />
    </div>

    <p class="muted">{{ status }}</p>
  </section>

  <details class="advanced-panel" v-if="preview.logs || events.length">
    <summary>查看详细日志与链路事件</summary>
    <div class="advanced-panel-content">
      <pre v-if="preview.logs">{{ preview.logs }}</pre>
      <div v-if="events.length" class="list" style="margin-top: 12px">
        <div
          class="list-item"
          v-for="evt in events"
          :key="`${evt.opId}-${evt.ts}`"
        >
          <strong>{{ evt.phase }}</strong>
          <div class="muted">{{ evt.message }}</div>
          <div class="muted">{{ evt.ts }}</div>
        </div>
      </div>
    </div>
  </details>
</template>
