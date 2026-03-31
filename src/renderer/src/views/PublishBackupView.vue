<script setup>
import { computed, reactive, ref, onMounted, watch } from "vue";
import {
  getSelectedWorkspace,
  workspaceState,
  refreshWorkspaces,
} from "../stores/workspaceStore";
import AsyncActionButton from "../components/AsyncActionButton.vue";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useOperationEvents } from "../composables/useOperationEvents";
import { useShellActions } from "../composables/useShellActions.mjs";
import { usePublishBackupActions } from "../composables/usePublishBackupActions.mjs";
import {
  buildChildOutcomeCards,
  collectOperationMessages,
} from "../utils/workflowViewHelpers.mjs";

const USER_PAGES = "user-pages";
const PUBLISH_OUTCOME_LABELS = {
  deployRepoEnsure: "发布仓库准备",
  backupRepoEnsure: "备份仓库准备",
  deployPublish: "线上发布",
  backupPush: "备份推送",
};

const publishForm = reactive({
  siteType: "project-pages",
  login: "",
  deployRepoName: "",
  backupRepoName: "",
  backupDir: "",
  createDeployRepo: true,
  createBackupRepo: true,
  publishMode: "actions",
  gitUserName: "",
  gitUserEmail: "",
});

const logs = ref("");
const pagesUrl = ref("");
const publishOutcomeCards = ref([]);
const publishOutcomeSummary = ref("");
const publishLoginManuallyEdited = ref(false);
const authLogin = ref("");
const lastWorkspaceMetadataId = ref("");
const { run, isBusy } = useAsyncAction();
const { events } = useOperationEvents(["publish"]);
const selectedWorkspace = computed(() => getSelectedWorkspace());
const shellActions = useShellActions();
const { publishToGitHub, pickDirectory, getGithubAuthState } =
  usePublishBackupActions();

const normalizedPublishLogin = computed(() =>
  String(publishForm.login || "").trim(),
);

const resolvedDeployRepoName = computed(() => {
  if (publishForm.siteType === USER_PAGES) {
    return normalizedPublishLogin.value
      ? `${normalizedPublishLogin.value}.github.io`
      : "";
  }
  return String(publishForm.deployRepoName || "").trim();
});

const deployRepoUrl = computed(() =>
  buildGithubRepoUrl(normalizedPublishLogin.value, resolvedDeployRepoName.value),
);
const backupRepoUrl = computed(() =>
  buildGithubRepoUrl(normalizedPublishLogin.value, publishForm.backupRepoName),
);
const accessAddress = computed(() => {
  if (!normalizedPublishLogin.value || !resolvedDeployRepoName.value) {
    return "等待确认 GitHub 登录信息与发布仓库名称。";
  }
  if (publishForm.siteType === USER_PAGES) {
    return `https://${normalizedPublishLogin.value}.github.io/`;
  }
  return `https://${normalizedPublishLogin.value}.github.io/${resolvedDeployRepoName.value}/`;
});

const publishReadiness = computed(() => {
  if (!selectedWorkspace.value) {
    return "未准备：先选择博客工程。";
  }
  if (!normalizedPublishLogin.value) {
    return "待补充：先登录 GitHub 以自动带入用户名。";
  }
  if (!resolvedDeployRepoName.value) {
    return "待补充：填写发布仓库名称。";
  }
  if (!publishForm.backupDir) {
    return "待补充：选择本地备份目录。";
  }
  if (!publishForm.gitUserName || !publishForm.gitUserEmail) {
    return "待补充：填写 Git 提交身份。";
  }
  return "已具备统一发布与备份条件。";
});

const publishNamingReadinessNote = computed(() => {
  if (publishForm.siteType === USER_PAGES) {
    return "准备度不足时，先确认登录状态、备份目录和 Git 身份；user-pages 会自动推导发布仓库名。";
  }
  return "准备度不足时，先补齐仓库命名、备份目录和 Git 身份。";
});

const publishResultSummary = computed(() => {
  if (publishOutcomeSummary.value) {
    return publishOutcomeSummary.value;
  }
  if (pagesUrl.value) {
    return `发布完成，可访问 ${pagesUrl.value}`;
  }
  return "还没有最近一次发布结果。";
});

const publishNextStep = computed(() => {
  if (publishOutcomeCards.value.some((card) => !card.ok)) {
    return "请先处理标记为待处理的链路，再决定是否重跑统一发布。";
  }
  if (pagesUrl.value) {
    return "先打开访问地址确认线上结果，再决定是否继续内容编辑或二次发布。";
  }
  if (publishReadiness.value !== "已具备统一发布与备份条件。") {
    if (publishForm.siteType === USER_PAGES) {
      return "先确认登录状态、备份目录和 Git 身份，再执行发布。";
    }
    return "先补齐站点类型、仓库命名、备份目录和 Git 身份，再执行发布。";
  }
  return "发布成功后，这里会按链路展示仓库准备、线上发布和备份推送结果。";
});

function buildGithubRepoUrl(owner, repoName) {
  const cleanOwner = String(owner || "").trim();
  const cleanRepoName = String(repoName || "").trim();
  if (!cleanOwner || !cleanRepoName) {
    return "";
  }
  return `https://github.com/${cleanOwner}/${cleanRepoName}.git`;
}

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

function markPublishLoginEdited() {
  publishLoginManuallyEdited.value = true;
}

function prefillPublishLogin(login, { force = false } = {}) {
  if (publishLoginManuallyEdited.value) {
    return;
  }
  if (!force && publishForm.login) {
    return;
  }
  publishForm.login = String(login || "").trim();
}

function applyWorkspaceMetadata(workspace, { authLogin = "" } = {}) {
  if (!workspace) {
    lastWorkspaceMetadataId.value = "";
    if (!authLogin && !publishLoginManuallyEdited.value) {
      publishForm.login = "";
    }
    publishForm.deployRepoName = "";
    publishForm.backupRepoName = "";
    return;
  }

  const workspaceChanged =
    lastWorkspaceMetadataId.value && lastWorkspaceMetadataId.value !== workspace.id;
  lastWorkspaceMetadataId.value = workspace.id || "";

  if (workspace.siteType) {
    publishForm.siteType = workspace.siteType;
  }

  const deployRepoMeta = parseGithubRepo(workspace.deployRepo?.url);
  const backupRepoMeta = parseGithubRepo(workspace.backupRepo?.url);

  if (!authLogin) {
    if (workspaceChanged && !publishLoginManuallyEdited.value) {
      publishForm.login = "";
    }
    prefillPublishLogin(deployRepoMeta?.owner || backupRepoMeta?.owner || "");
  }
  if (publishForm.siteType !== USER_PAGES && (!publishForm.deployRepoName || workspaceChanged)) {
    publishForm.deployRepoName = workspace.deployRepo?.name || "";
  }
  publishForm.backupRepoName = workspace.backupRepo?.name || "";
}

function buildPublishSummary(result) {
  if (result?.status === "partial_success") {
    return "发布已完成，但备份链路仍需处理。";
  }
  if (result?.status === "failed" || result?.ok === false) {
    return collectOperationMessages(result)[0] || "统一发布未完成。";
  }
  if (result?.pagesUrl) {
    return `发布完成，可访问 ${result.pagesUrl}`;
  }
  return result?.message || "统一发布已完成。";
}

function buildCauseCards(messages, label) {
  return messages.map((message, index) => ({
    key: `${label}-${index}`,
    label,
    ok: false,
    message,
    causes: [],
  }));
}

async function publish() {
  await run("publish", async () => {
    const ws = getSelectedWorkspace();
    if (!ws) {
      publishOutcomeSummary.value = "请先在其他页面选择或创建工程。";
      publishOutcomeCards.value = [];
      logs.value = "";
      return;
    }

    if (publishReadiness.value !== "已具备统一发布与备份条件。") {
      publishOutcomeSummary.value = publishReadiness.value;
      publishOutcomeCards.value = [];
      return;
    }

    try {
      const result = await publishToGitHub({
        projectDir: ws.projectDir,
        framework: ws.framework,
        siteType: publishForm.siteType,
        login: normalizedPublishLogin.value,
        deployRepoName: resolvedDeployRepoName.value,
        backupRepoName: publishForm.backupRepoName,
        repoUrl: deployRepoUrl.value,
        backupRepoUrl: backupRepoUrl.value,
        createDeployRepo: publishForm.createDeployRepo,
        createBackupRepo: publishForm.createBackupRepo,
        backupDir: publishForm.backupDir,
        publishMode: publishForm.publishMode,
        gitUserName: publishForm.gitUserName,
        gitUserEmail: publishForm.gitUserEmail,
      });

      pagesUrl.value = result?.pagesUrl || accessAddress.value || "";
      publishOutcomeSummary.value = buildPublishSummary(result);
      publishOutcomeCards.value = buildChildOutcomeCards(
        result,
        PUBLISH_OUTCOME_LABELS,
      );
      logs.value = JSON.stringify(result, null, 2);
    } catch (error) {
      const messages = collectOperationMessages(error);
      pagesUrl.value = "";
      publishOutcomeSummary.value = messages[0] || "统一发布未完成。";
      publishOutcomeCards.value = buildCauseCards(messages, "发布校验");
      logs.value = JSON.stringify(
        error?.operationResult || { message: String(error?.message || error) },
        null,
        2,
      );
    }
  });
}

function openPagesUrl() {
  if (!pagesUrl.value) {
    return;
  }
  window.open(pagesUrl.value, "_blank");
}

async function pickBackupDirectory() {
  try {
    const result = await pickDirectory({
      title: "选择本地备份目录",
      defaultPath: publishForm.backupDir || undefined,
    });
    if (!result.canceled && result.path) {
      publishForm.backupDir = result.path;
    }
  } catch (error) {
    const messages = collectOperationMessages(error);
    publishOutcomeSummary.value = messages[0] || "选择本地备份目录失败。";
  }
}

onMounted(async () => {
  await refreshWorkspaces();

  try {
    const auth = await getGithubAuthState();
    authLogin.value = auth?.account?.login || "";
    prefillPublishLogin(auth?.account?.login, { force: true });
    if (auth?.account?.login && !publishForm.gitUserName) {
      publishForm.gitUserName = auth.account.login;
    }
    if (auth?.account?.email && !publishForm.gitUserEmail) {
      publishForm.gitUserEmail = auth.account.email;
    }

    applyWorkspaceMetadata(selectedWorkspace.value, {
      authLogin: auth?.account?.login || ""
    });
  } catch {
    // Ignore auth prefill failures.
    authLogin.value = "";
    applyWorkspaceMetadata(selectedWorkspace.value, {
      authLogin: authLogin.value
    });
  }
});

watch(() => workspaceState.selectedWorkspaceId, () => {
  applyWorkspaceMetadata(selectedWorkspace.value, { authLogin: authLogin.value });
});

function goTutorialCenter() {
  shellActions.openTutorial("publish-release");
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
              统一发布与备份现在收敛到一个工作台：先决定 GitHub Pages 站点类型和命名，再一次性跑完发布仓库准备、线上发布和恢复用备份链路。
            </p>
            <div class="workflow-hero-actions" data-workflow-zone="hero-actions">
              <button
                class="primary"
                type="button"
                data-workflow-action-level="primary"
                @click="jumpToZone('publish-workbench')"
              >
                前往发布工作台
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
                @click="jumpToZone('publish-naming')"
              >
                查看仓库命名规则
              </button>
            </div>
            <div class="page-link-row">
              <a href="#" @click.prevent="goTutorialCenter"
                >不知道站点类型怎么选？打开教程中心（发布与访问地址）</a
              >
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
                  : "先选择一个博客工程，再填写 GitHub 命名与 Git 身份。"
              }}
            </p>
          </div>
          <div class="page-signal">
            <p class="section-eyebrow">GitHub Pages 站点类型</p>
            <strong>{{ publishForm.siteType === USER_PAGES ? "用户站点" : "项目站点" }}</strong>
            <p class="section-helper">
              用户站点固定使用 <code>用户名.github.io</code>，项目站点则会在访问地址里附带仓库名。
            </p>
          </div>
          <div class="page-signal page-signal--quiet">
            <p class="section-eyebrow">发布准备度</p>
            <strong>{{ publishReadiness }}</strong>
            <p class="section-helper">{{ publishNamingReadinessNote }}</p>
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
            <p class="section-eyebrow">Step 01 · 统一发布与备份</p>
            <h2>统一发布与备份</h2>
            <p class="section-helper">
              这里是发布仓库、访问地址和恢复底仓的唯一入口。内容编辑页里的自动发布会直接沿用这里的仓库设置。
            </p>
          </div>
        </div>

        <div
          id="publish-naming"
          class="workflow-compact-block workflow-compact-block--support"
        >
          <p class="section-eyebrow">发布前检查清单</p>
          <strong>仓库命名与访问地址</strong>
          <ul class="checklist">
            <li>用户站点固定命名为 <code>用户名.github.io</code></li>
            <li>项目站点访问地址示例：<code>https://用户名.github.io/仓库名/</code></li>
            <li>备份仓库可沿用工作区元数据，或按团队命名规范填写</li>
            <li>如仓库不存在，可勾选自动创建并在同一次发布中完成</li>
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
          </div>
          <div>
            <label>GitHub 用户名（登录后自动带入，可手动调整）</label>
            <input
              v-model="publishForm.login"
              placeholder="登录后自动带入，也可手动调整"
              @input="markPublishLoginEdited"
            />
            <p class="muted stack-top">
              登录后会自动带入 GitHub 用户名；如需发布到其他账号，可手动调整。
            </p>
          </div>
          <div>
            <label>GitHub Pages 站点类型</label>
            <select v-model="publishForm.siteType">
              <option value="project-pages">project-pages</option>
              <option value="user-pages">user-pages</option>
            </select>
          </div>
          <div v-if="publishForm.siteType === USER_PAGES">
            <label>发布仓库（自动推导）</label>
            <p class="workflow-access-address">
              <code>{{ resolvedDeployRepoName || "等待 GitHub 用户名" }}</code>
            </p>
            <p class="muted stack-top">
              用户站点固定使用 <code>{{ normalizedPublishLogin || "用户名" }}.github.io</code>，无需手动填写发布仓库名。
            </p>
          </div>
          <div v-else>
            <label>发布仓库名称</label>
            <input
              v-model="publishForm.deployRepoName"
              placeholder="例如 my-blog"
            />
            <p class="muted stack-top">当前仓库：{{ resolvedDeployRepoName || "等待填写" }}</p>
          </div>
          <div>
            <label>备份仓库名称</label>
            <input v-model="publishForm.backupRepoName" placeholder="例如 blog-backup" />
            <p class="muted stack-top">{{ backupRepoUrl || "等待填写 GitHub 用户名" }}</p>
          </div>
          <div>
            <label>访问地址预期</label>
            <p class="workflow-access-address" data-workflow-surface="access-address">
              <code>{{ accessAddress }}</code>
            </p>
          </div>
          <div>
            <label>本地备份目录</label>
            <div class="path-input-row">
              <input
                v-model="publishForm.backupDir"
                placeholder="例如 D:/blog-backups/demo"
              />
              <button class="secondary" type="button" @click="pickBackupDirectory">
                选择目录
              </button>
            </div>
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
          </div>
          <div>
            <label>自动创建发布仓库</label>
            <select v-model="publishForm.createDeployRepo">
              <option :value="true">true</option>
              <option :value="false">false</option>
            </select>
          </div>
          <div>
            <label>自动创建备份仓库</label>
            <select v-model="publishForm.createBackupRepo">
              <option :value="true">true</option>
              <option :value="false">false</option>
            </select>
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
          </div>
        </div>

        <div class="actions">
          <AsyncActionButton
            kind="primary"
            label="开始统一发布"
            busy-label="统一发布中..."
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

    <div class="page-layer workflow-balanced-grid" data-page-layer="explanation">
      <section
        id="publish-result"
        class="workflow-compact-block workflow-result-block"
        data-workflow-zone="recent-result"
      >
        <div>
          <p class="section-eyebrow">最近结果</p>
          <strong>{{ publishResultSummary }}</strong>
          <p class="page-result-note">{{ publishNextStep }}</p>
        </div>
        <div>
          <p class="section-eyebrow">结构化链路结果</p>
          <strong>{{ publishOutcomeCards.length ? "按子步骤展示" : "等待第一次执行" }}</strong>
          <p class="page-result-note">不会再把部分成功压缩成一行泛化错误。</p>
        </div>
        <div class="actions" v-if="pagesUrl">
          <button class="secondary" @click="openPagesUrl">打开博客地址</button>
        </div>

        <div v-if="publishOutcomeCards.length" class="publish-outcome-list stack-top">
          <article
            v-for="card in publishOutcomeCards"
            :key="card.key"
            class="workflow-compact-block workflow-compact-block--support"
          >
            <p class="section-eyebrow">{{ card.label }}</p>
            <strong>{{ card.ok ? "已完成" : "待处理" }}</strong>
            <p class="page-result-note">{{ card.message }}</p>
            <ul v-if="card.causes.length" class="page-guidance-list">
              <li v-for="cause in card.causes" :key="`${card.key}-${cause}`">
                {{ cause }}
              </li>
            </ul>
          </article>
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
