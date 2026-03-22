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

const status = ref("");
const preview = reactive({
  port: "",
  url: "",
  running: false,
  logs: "",
});
const { run, isBusy } = useAsyncAction();
const { events } = useOperationEvents(["preview"]);

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
        const result = await window.bfeApi.startLocalPreview({
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
        await window.bfeApi.openLocalPreview({
          framework: ws.framework,
          projectDir: ws.projectDir,
          url: result.url,
        });
        status.value = `预览已启动：${result.url}`;
        return;
      }

      if (action === "open") {
        const result = await window.bfeApi.openLocalPreview({
          framework: ws.framework,
          projectDir: ws.projectDir,
          port,
        });
        preview.url = result.url;
        status.value = `已打开：${result.url}`;
        return;
      }

      if (action === "restart") {
        await window.bfeApi.stopLocalPreview({
          projectDir: ws.projectDir,
          framework: ws.framework,
        });
        const result = await window.bfeApi.startLocalPreview({
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
        await window.bfeApi.openLocalPreview({
          framework: ws.framework,
          projectDir: ws.projectDir,
          url: result.url,
        });
        status.value = `预览已重启：${result.url}`;
        return;
      }

      if (action === "stop") {
        await window.bfeApi.stopLocalPreview({
          projectDir: ws.projectDir,
          framework: ws.framework,
        });
        preview.running = false;
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
    <pre v-if="preview.logs">{{ preview.logs }}</pre>
  </section>

  <section class="panel" v-if="events.length">
    <h2>预览链路事件</h2>
    <div class="list">
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
  </section>
</template>
