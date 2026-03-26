<script setup>
import { computed, reactive, ref, onMounted } from "vue";
import {
  getSelectedWorkspace,
  workspaceState,
  refreshWorkspaces,
} from "../stores/workspaceStore";
import AsyncActionButton from "../components/AsyncActionButton.vue";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useOperationEvents } from "../composables/useOperationEvents";
import { usePublishBackupActions } from "../composables/usePublishBackupActions.mjs";

const publishForm = reactive({
  repoUrl: "",
  publishMode: "actions",
  gitUserName: "",
  gitUserEmail: "",
});

const backupForm = reactive({
  backupDir: "",
  backupRepoUrl: "",
  visibility: "private",
});

const logs = ref("");
const pagesUrl = ref("");
const { run, isBusy } = useAsyncAction();
const { events } = useOperationEvents(["publish"]);
const selectedWorkspace = computed(() => getSelectedWorkspace());
const {
  publishToGitHub,
  backupWorkspace,
  pickDirectory,
  getGithubAuthState,
} = usePublishBackupActions();

const publishReadiness = computed(() => {
  if (!selectedWorkspace.value) {
    return "未准备：先选择博客工程。";
  }
  if (!publishForm.repoUrl) {
    return "待补充：填写 GitHub 仓库地址。";
  }
  if (!publishForm.gitUserName || !publishForm.gitUserEmail) {
    return "待补充：填写 Git 提交身份。";
  }
  return "已具备基础发布条件。";
});

const publishResultSummary = computed(() => {
  if (pagesUrl.value) {
    return `发布完成，可访问 ${pagesUrl.value}`;
  }
  if (logs.value) {
    return logs.value.split("\n")[0];
  }
  return "还没有最近一次发布结果。";
});

const publishNextStep = computed(() => {
  if (pagesUrl.value) {
    return "先打开博客地址确认线上结果，再决定是否生成一份恢复用备份。";
  }
  if (publishReadiness.value !== "已具备基础发布条件。") {
    return "先补齐仓库地址、Git 身份和工作区上下文，再执行发布。";
  }
  return "进入发布设置，先完成一次可访问的线上发布。";
});

function parseGithubRepo(repoUrl) {
  const clean = String(repoUrl || "")
    .trim()
    .replace(/\.git$/i, "");
  const match = clean.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2],
  };
}

async function publish() {
  await run("publish", async () => {
    const ws = getSelectedWorkspace();
    if (!ws) {
      logs.value = "请先在其他页面选择或创建工程。";
      return;
    }

    const parsedRepo = parseGithubRepo(publishForm.repoUrl);
    if (!parsedRepo) {
      logs.value =
        "发布仓库地址格式错误。请填写完整地址，例如 https://github.com/你的用户名/你的用户名.github.io.git";
      return;
    }

    try {
      const result = await publishToGitHub({
        projectDir: ws.projectDir,
        framework: ws.framework,
        repoUrl: publishForm.repoUrl,
        publishMode: publishForm.publishMode,
        gitUserName: publishForm.gitUserName,
        gitUserEmail: publishForm.gitUserEmail,
      });

      if (!result?.ok) {
        pagesUrl.value = "";
        logs.value = `发布失败：${result?.message || "发布流程未完成。"}\n${JSON.stringify(result.logs || result, null, 2)}`;
        return;
      }

      pagesUrl.value = result.pagesUrl || "";
      logs.value = JSON.stringify(result.logs || result, null, 2);
    } catch (error) {
      logs.value = `发布失败：${String(error?.message || error)}`;
    }
  });
}

function openPagesUrl() {
  if (!pagesUrl.value) {
    return;
  }
  window.open(pagesUrl.value, "_blank");
}

async function backup() {
  await run("backup", async () => {
    const ws = getSelectedWorkspace();
    if (!ws) {
      logs.value = "请先在其他页面选择或创建工程。";
      return;
    }

    try {
      const result = await backupWorkspace({
        projectDir: ws.projectDir,
        backupDir: backupForm.backupDir,
        repoUrl: backupForm.backupRepoUrl,
        visibility: backupForm.visibility,
      });

      logs.value = JSON.stringify(result, null, 2);
    } catch (error) {
      logs.value = `备份失败：${String(error?.message || error)}`;
    }
  });
}

async function pickBackupDirectory() {
  try {
    const result = await pickDirectory({
      title: "选择备份目录",
      defaultPath: backupForm.backupDir || undefined,
    });
    if (!result.canceled && result.path) {
      backupForm.backupDir = result.path;
    }
  } catch (error) {
    logs.value = `选择备份目录失败：${String(error?.message || error)}`;
  }
}

  onMounted(async () => {
  await refreshWorkspaces();
  try {
    const auth = await getGithubAuthState();
    if (auth?.account?.login && !publishForm.gitUserName) {
      publishForm.gitUserName = auth.account.login;
    }
    if (auth?.account?.email && !publishForm.gitUserEmail) {
      publishForm.gitUserEmail = auth.account.email;
    }
  } catch {
    // Ignore auth prefill failures.
  }
});

function goTutorialCenter() {
  window.dispatchEvent(new CustomEvent("bfe:open-tutorial"));
}

function jumpToZone(zoneId) {
  document.getElementById(zoneId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}
</script>

<template>
  <div
    class="page-shell page-shell--publish"
    data-page-role="publish"
    data-workflow-surface="editorial-workflow"
  >
    <div class="page-layer" data-page-layer="primary">
      <section class="panel page-hero" data-workflow-zone="hero">
        <div class="page-hero-grid">
          <div>
            <p class="page-kicker">Release control center</p>
            <h2 class="page-title">发布控制中心</h2>
            <p class="page-lead">
              先确认博客是否准备好，再决定发布模式并执行。发布结果和可访问地址应该先于技术日志出现，帮助你更快判断是否可以对外交付。
            </p>
            <div class="workflow-hero-actions" data-workflow-zone="hero-actions">
              <button
                class="primary"
                type="button"
                data-workflow-action-level="primary"
                @click="jumpToZone('publish-workbench')"
              >
                前往发布设置
              </button>
              <button
                class="secondary"
                type="button"
                data-workflow-action-level="secondary"
                @click="jumpToZone('publish-result')"
              >
                查看最近结果
              </button>
              <button
                class="secondary"
                type="button"
                data-workflow-action-level="tertiary"
                @click="jumpToZone('backup-workbench')"
              >
                跳到备份设置
              </button>
            </div>
            <div class="page-link-row">
              <a href="#" @click.prevent="goTutorialCenter"
                >不知道仓库地址怎么填？打开教程中心（发布与访问地址）</a
              >
            </div>
          </div>
          <div class="workflow-hero-note">
            <div class="page-signal page-signal--accent">
              <p class="section-eyebrow">发布准备度</p>
              <strong>{{ publishReadiness }}</strong>
              <p class="section-helper">本页默认推荐 GitHub Actions；只有明确需要时再切到命令发布。</p>
            </div>
          </div>
        </div>

        <div class="workflow-status-grid">
          <div class="page-signal page-signal--accent">
            <p class="section-eyebrow">当前工作区</p>
            <strong>{{ selectedWorkspace?.name || "尚未选择工程" }}</strong>
            <p class="section-helper">
              {{
                selectedWorkspace
                  ? `${selectedWorkspace.framework.toUpperCase()} · 主题 ${selectedWorkspace.theme || '未识别'}`
                  : "先选择一个博客工程，再填写仓库地址和 Git 身份。"
              }}
            </p>
          </div>
          <div class="page-signal">
            <p class="section-eyebrow">推荐发布方式</p>
            <strong>GitHub Actions（默认推荐）</strong>
            <p class="section-helper">Hexo 和 Hugo 都更适合先用 Actions 跑通。</p>
          </div>
          <div class="page-signal page-signal--quiet">
            <p class="section-eyebrow">发布准备度</p>
            <strong>{{ publishReadiness }}</strong>
            <p class="section-helper">准备度不足时，先补齐仓库地址、身份与预览检查。</p>
          </div>
        </div>
      </section>

      <section
        id="publish-workbench"
        class="panel workflow-section-panel"
        data-workflow-zone="publish-workbench"
      >
        <div class="workflow-section-heading">
          <div class="workflow-section-heading-copy">
            <p class="section-eyebrow">Step 01 · 对外发布</p>
            <h2>发布到 GitHub Pages</h2>
            <p class="section-helper">
              先让访问地址变成可交付结果，再决定是否补一份离线恢复用的备份仓库。
            </p>
          </div>
          <aside class="workflow-inline-note priority-panel priority-panel--support">
            <p class="section-eyebrow">发布结果摘要</p>
            <strong>{{ publishResultSummary }}</strong>
            <p class="page-result-note">{{ publishNextStep }}</p>
          </aside>
        </div>

        <div class="context-card">
          <p class="section-eyebrow">发布前检查清单</p>
          <strong>先确认这 4 件事</strong>
          <ul class="checklist">
            <li>已经选中正确的博客工程</li>
            <li>仓库地址是完整的 GitHub URL</li>
            <li>Git 提交用户名和邮箱已填写</li>
            <li>本地预览和内容都已经检查过</li>
          </ul>
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
            <label>GitHub 仓库地址</label>
            <input
              v-model="publishForm.repoUrl"
              placeholder="https://github.com/yourname/yourname.github.io.git"
            />
            <p class="muted stack-top">
              既支持 用户名.github.io（根域名），也支持 project page（会自动推断子路径）。
            </p>
          </div>
          <div>
            <label>发布模式</label>
            <select v-model="publishForm.publishMode">
              <option value="actions">GitHub Actions（推荐）</option>
              <option
                v-if="selectedWorkspace?.framework === 'hexo'"
                value="hexo-deploy"
              >
                Hexo 命令发布（hexo deploy）
              </option>
            </select>
            <p class="muted stack-top">
              Actions 适配 Hexo/Hugo；Hexo 命令发布会自动配置 deploy 并执行 clean/generate/deploy。
            </p>
          </div>
          <div>
            <label>Git 提交用户名</label>
            <input v-model="publishForm.gitUserName" placeholder="例如 ming" />
          </div>
          <div>
            <label>Git 提交邮箱</label>
            <input
              v-model="publishForm.gitUserEmail"
              placeholder="例如 123456+ming@users.noreply.github.com"
            />
            <p class="muted stack-top">
              首次发布若未配置 Git 身份，软件会用这里的信息自动写入当前工程。
            </p>
          </div>
        </div>

        <div class="actions">
          <AsyncActionButton
            kind="primary"
            label="开始发布"
            busy-label="发布中..."
            :busy="isBusy('publish')"
            data-workflow-action-level="primary"
            @click="publish"
          />
          <button
            class="secondary"
            type="button"
            data-workflow-action-level="secondary"
            @click="goTutorialCenter"
          >
            查看发布教程
          </button>
        </div>
      </section>
    </div>

    <div class="page-layer" data-page-layer="explanation">
      <section
        id="publish-result"
        class="priority-panel priority-panel--support workflow-result-panel"
        data-workflow-zone="recent-result"
      >
        <p class="section-eyebrow">最近结果</p>
        <strong>{{ publishResultSummary }}</strong>
        <p class="page-result-note">
          {{ pagesUrl ? "访问地址已经可见，可继续打开验证。" : "还没有成功发布结果时，先检查准备度与表单输入。" }}
        </p>
        <div class="actions" v-if="pagesUrl">
          <button class="secondary" @click="openPagesUrl">打开博客地址</button>
        </div>
      </section>

      <section
        id="backup-workbench"
        class="panel workflow-section-panel"
        data-workflow-zone="backup-workbench"
      >
        <div class="workflow-section-heading">
          <div class="workflow-section-heading-copy">
            <p class="section-eyebrow">Step 02 · 备份支线</p>
            <h2>备份到底层仓库</h2>
            <p class="section-helper">
              将本地博客工程打包到快照目录，可选推送到另一个 GitHub 仓库，用于换设备恢复。
            </p>
          </div>
          <aside class="workflow-inline-note priority-panel priority-panel--subtle">
            <p class="section-eyebrow">备份适用场景</p>
            <strong>发布跑通后，再补一份恢复用底仓快照。</strong>
            <p class="page-result-note">这样不会让备份动作盖过本页最重要的对外发布。</p>
          </aside>
        </div>

        <div class="grid-2">
          <div>
            <label>本地备份目录</label>
            <div class="path-input-row">
              <input
                v-model="backupForm.backupDir"
                placeholder="例如 D:/blog-backups"
              />
              <button class="secondary" type="button" @click="pickBackupDirectory">
                选择目录
              </button>
            </div>
          </div>
          <div>
            <label>备份仓库地址（可选）</label>
            <input
              v-model="backupForm.backupRepoUrl"
              placeholder="https://github.com/you/blog-backup.git"
            />
          </div>
          <div>
            <label>备份仓库可见性</label>
            <select v-model="backupForm.visibility">
              <option value="private">private</option>
              <option value="public">public</option>
            </select>
          </div>
        </div>

        <div class="actions">
          <AsyncActionButton
            kind="secondary"
            label="生成并推送备份"
            busy-label="备份中..."
            :busy="isBusy('backup')"
            data-workflow-action-level="tertiary"
            @click="backup"
          />
        </div>
      </section>
    </div>

    <div class="page-layer" data-page-layer="detail">
      <details class="advanced-panel" v-if="events.length || logs">
        <summary>查看发布日志与链路事件</summary>
        <div class="advanced-panel-content">
          <div v-if="events.length" class="list">
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
          <pre v-if="logs" class="stack-top">{{ logs }}</pre>
        </div>
      </details>
    </div>
  </div>
</template>
