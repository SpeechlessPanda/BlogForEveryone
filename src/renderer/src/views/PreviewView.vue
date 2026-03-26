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
import { useShellActions } from "../composables/useShellActions.mjs";
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
const shellActions = useShellActions();
const { startLocalPreview, openLocalPreview, stopLocalPreview } =
  usePreviewActions();

const selectedWorkspace = computed(() => getSelectedWorkspace());

const previewCheckpointState = computed(() => {
  if (preview.running && preview.url) {
    return "预览已可检查";
  }
  if (status.value) {
    return status.value;
  }
  return "尚未启动预览";
});

const previewNextStep = computed(() => {
  if (preview.running && preview.url) {
    return "确认页面结果后，再决定继续写作还是进入发布。";
  }
  if (!selectedWorkspace.value) {
    return "先选择工作区，再启动一次 localhost 检查。";
  }
  return "点击“启动并打开”，先确认博客首页能正常加载。";
});

const previewResultSummary = computed(() => {
  if (preview.running && preview.url) {
    return `最近确认：${preview.url}`;
  }
  if (status.value) {
    return status.value;
  }
  return "还没有最近一次预览结果。";
});

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
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
        status.value = "预览端口无效，请输入 1-65535 的整数。";
        return;
      }
        if (action === "start") {
        const result = await startLocalPreview({
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
        const openResult = await openLocalPreview({
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
        const result = await openLocalPreview({
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
        const stopResult = await stopLocalPreview({
          projectDir: ws.projectDir,
          framework: ws.framework,
        });
        if (!stopResult?.ok) {
          preview.running = false;
          status.value = stopResult?.message || "预览重启失败，停止旧进程时出错。";
          return;
        }
        const result = await startLocalPreview({
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
        const openResult = await openLocalPreview({
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
        const result = await stopLocalPreview({
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
  shellActions.openTutorial();
}

function jumpToZone(zoneId) {
  document.getElementById(zoneId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
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
  <div
    class="page-shell page-shell--preview"
    data-page-role="preview"
    data-workflow-surface="editorial-workflow"
  >
    <div class="page-layer" data-page-layer="primary">
      <section class="panel page-hero" data-workflow-zone="hero">
        <div class="page-hero-grid">
          <div>
            <p class="page-kicker">Checkpoint surface</p>
            <h2 class="page-title">发布前检查点</h2>
            <p class="page-lead">
              这里不是日志监控页，而是确认博客结果的检查点。先确认当前状态，再执行打开、重启或停止动作，技术链路永远排在最后。
            </p>
            <div class="workflow-hero-actions" data-workflow-zone="hero-actions">
              <button
                class="primary"
                type="button"
                data-workflow-action-level="primary"
                @click="jumpToZone('preview-workbench')"
              >
                前往预览控制台
              </button>
              <button
                class="secondary"
                type="button"
                data-workflow-action-level="secondary"
                @click="jumpToZone('preview-result')"
              >
                查看最近结果
              </button>
              <button
                class="secondary"
                type="button"
                data-workflow-action-level="tertiary"
                @click="goTutorialCenter"
              >
                打开教程中心
              </button>
            </div>
            <div class="page-link-row">
              <a href="#" @click.prevent="goTutorialCenter"
                >打开教程中心（预览与调试说明）</a
              >
            </div>
          </div>
          <div class="workflow-hero-note">
            <div class="page-signal page-signal--accent">
              <p class="section-eyebrow">建议下一步</p>
              <strong>{{ previewNextStep }}</strong>
              <p class="section-helper">当 localhost 可打开时，主题、内容与依赖链路通常已基本打通。</p>
            </div>
          </div>
        </div>

        <div class="workflow-status-grid">
          <div class="page-signal page-signal--accent">
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
          <div class="page-signal">
            <p class="section-eyebrow">当前状态</p>
            <strong>{{ preview.running ? "预览运行中" : "预览未启动" }}</strong>
            <p class="section-helper">{{ previewCheckpointState }}</p>
          </div>
          <div class="page-signal page-signal--quiet">
            <p class="section-eyebrow">建议下一步</p>
            <strong>{{ previewNextStep }}</strong>
            <p class="section-helper">先确认页面能打开，再决定是否继续写作或进入发布。</p>
          </div>
        </div>
      </section>

      <section
        id="preview-workbench"
        class="panel workflow-section-panel"
        data-workflow-zone="preview-workbench"
      >
        <div class="workflow-section-heading">
          <div class="workflow-section-heading-copy">
            <p class="section-eyebrow">Step 01 · 预览控制台</p>
            <h2>本地预览（localhost）</h2>
            <p class="section-helper">
              保存内容或主题后，先在这里确认预览地址，再决定是否重启、只打开地址或停止当前会话。
            </p>
          </div>
          <aside class="workflow-inline-note priority-panel priority-panel--support">
            <p class="section-eyebrow">预览结果摘要</p>
            <strong>{{ previewResultSummary }}</strong>
            <p class="page-result-note">{{ previewNextStep }}</p>
          </aside>
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
            data-workflow-action-level="primary"
            @click="runPreviewAction('start')"
          />
          <AsyncActionButton
            kind="secondary"
            label="重启并刷新预览"
            busy-label="处理中..."
            :busy="isBusy('preview')"
            data-workflow-action-level="secondary"
            @click="runPreviewAction('restart')"
          />
          <AsyncActionButton
            kind="secondary"
            label="仅打开地址"
            busy-label="处理中..."
            :busy="isBusy('preview')"
            data-workflow-action-level="secondary"
            @click="runPreviewAction('open')"
          />
          <AsyncActionButton
            kind="danger"
            label="停止预览"
            busy-label="处理中..."
            :busy="isBusy('preview')"
            data-workflow-action-level="tertiary"
            @click="runPreviewAction('stop')"
          />
        </div>
      </section>
    </div>

    <div class="page-layer" data-page-layer="explanation">
      <section
        id="preview-result"
        class="priority-panel priority-panel--support workflow-result-panel"
        data-workflow-zone="recent-result"
      >
        <p class="section-eyebrow">最近结果</p>
        <strong>{{ previewResultSummary }}</strong>
        <p class="page-result-note">
          {{ preview.url ? `预览地址：${preview.url}` : "还没有可确认的结果地址。" }}
        </p>
      </section>
    </div>

    <div class="page-layer" data-page-layer="detail">
      <details class="advanced-panel" v-if="preview.logs || events.length">
        <summary>查看详细日志与链路事件</summary>
        <div class="advanced-panel-content">
          <pre v-if="preview.logs">{{ preview.logs }}</pre>
          <div v-if="events.length" class="list stack-top">
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
    </div>
  </div>
</template>
