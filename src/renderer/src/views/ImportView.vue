<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { refreshWorkspaces } from "../stores/workspaceStore";
import { useShellActions } from "../composables/useShellActions.mjs";
import { useImportActions } from "../composables/useImportActions.mjs";
import { collectOperationMessages } from "../utils/workflowViewHelpers.mjs";

const localImportForm = reactive({
  name: "",
  projectDir: "",
});

const githubImportForm = reactive({
  name: "",
  siteType: "project-pages",
  deployRepoUrl: "",
  backupRepoUrl: "",
  localDestinationPath: "",
});

const resultState = ref({
  summary: "还没有最近一次导入结果。",
  note: "本地目录导入和 GitHub 直接恢复都会在这里输出结构化结果。",
  cards: [],
  rawText: "",
});
const githubAccountLogin = ref("");
const githubRepos = ref([]);
const githubRepoSummary = ref("还没有加载 GitHub 仓库列表。");
const githubRepoLoadFailed = ref(false);
const githubImportManualState = reactive({
  siteType: false,
  deployRepo: false,
  backupRepo: false,
  localDestinationPath: false,
});
const githubImportAutoSelection = reactive({
  deployRepoUrl: "",
  backupRepoUrl: "",
});
const shellActions = useShellActions();
const {
  importWorkspace,
  importWorkspaceFromGithub,
  listGithubRepos,
  pickDirectory,
  importSubscriptions,
} = useImportActions();

const selectedGithubDeployRepo = computed(
  () =>
    githubRepos.value.find((repo) => repo.url === githubImportForm.deployRepoUrl) ||
    parseGithubRepo(githubImportForm.deployRepoUrl),
);
const selectedGithubBackupRepo = computed(
  () =>
    githubRepos.value.find((repo) => repo.url === githubImportForm.backupRepoUrl) ||
    parseGithubRepo(githubImportForm.backupRepoUrl),
);
const githubBackupRepoChoices = computed(() => githubRepos.value);
const hasExactDeployRepoAutodetect = computed(
  () => Boolean(githubImportAutoSelection.deployRepoUrl),
);
const hasExactBackupRepoAutodetect = computed(
  () => Boolean(githubImportAutoSelection.backupRepoUrl),
);
const githubRecoveryNextStepNote = computed(() => {
  if (githubRepoLoadFailed.value) {
    return "如果 GitHub 仓库列表暂时加载失败，可手动填写恢复仓库地址继续操作。";
  }

  if (!githubBackupRepoChoices.value.length) {
    return "未读取到仓库列表时，可直接手动填写恢复源仓库地址继续恢复。";
  }

  if (hasExactDeployRepoAutodetect.value && hasExactBackupRepoAutodetect.value) {
    return "已自动识别发布仓库和恢复源仓库，下一步只需选择目标恢复目录。";
  }

  if (hasExactBackupRepoAutodetect.value) {
    return "已自动识别恢复源仓库；如果发布仓库没有唯一精确匹配，可继续手动选择。";
  }

  if (hasExactDeployRepoAutodetect.value) {
    return "已自动识别用户名站点发布仓库；如果恢复源仓库未自动识别，可继续手动选择。";
  }

  return "会基于当前 GitHub 登录名精确匹配 `${login}.github.io`；恢复源仓库支持从任意仓库中手动选择。";
});

function setResultState(summary, note, cards = [], raw = null) {
  resultState.value = {
    summary,
    note,
    cards,
    rawText: raw ? JSON.stringify(raw, null, 2) : "",
  };
}

function setStructuredError(prefix, error) {
  const messages = collectOperationMessages(error);
  setResultState(
    `${prefix}：${messages[0] || String(error?.message || error)}`,
    "错误原因会按结构化列表展示，不再折叠成单条泛化文案。",
    messages.map((message, index) => ({
      key: `${prefix}-${index}`,
      label: prefix,
      message,
    })),
    error?.operationResult || { message: String(error?.message || error) },
  );
}

function markGithubSiteTypeManual() {
  githubImportManualState.siteType = true;
}

function markGithubDeployRepoManual() {
  githubImportManualState.deployRepo = true;
}

function markGithubBackupRepoManual() {
  githubImportManualState.backupRepo = true;
}

function markGithubLocalDestinationManual() {
  githubImportManualState.localDestinationPath = true;
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
    name: match[2],
    url: String(repoUrl || "").trim(),
  };
}

function syncExactGithubRepoAutodetect() {
  const githubLogin = githubAccountLogin.value.trim();
  const deployRepoName = githubLogin ? `${githubLogin}.github.io` : "";
  const deployRepoMatches = deployRepoName
    ? githubRepos.value.filter((repo) => repo.name === deployRepoName)
    : [];
  const backupRepoMatches = githubRepos.value.filter((repo) => repo.name === "BFE");
  const uniqueDeployRepo = deployRepoMatches.length === 1 ? deployRepoMatches[0] : null;
  const uniqueBackupRepo = backupRepoMatches.length === 1 ? backupRepoMatches[0] : null;
  const previousDeployRepoUrl = githubImportAutoSelection.deployRepoUrl;
  const previousBackupRepoUrl = githubImportAutoSelection.backupRepoUrl;

  githubImportAutoSelection.deployRepoUrl = uniqueDeployRepo?.url || "";
  githubImportAutoSelection.backupRepoUrl = uniqueBackupRepo?.url || "";

  if (
    !githubImportManualState.deployRepo &&
    (!githubImportForm.deployRepoUrl || githubImportForm.deployRepoUrl === previousDeployRepoUrl)
  ) {
    githubImportForm.deployRepoUrl = githubImportAutoSelection.deployRepoUrl;
  }

  if (
    !githubImportManualState.backupRepo &&
    (!githubImportForm.backupRepoUrl || githubImportForm.backupRepoUrl === previousBackupRepoUrl)
  ) {
    githubImportForm.backupRepoUrl = githubImportAutoSelection.backupRepoUrl;
  }

  if (
    uniqueDeployRepo &&
    !githubImportManualState.siteType &&
    !githubImportManualState.deployRepo
  ) {
    githubImportForm.siteType = "user-pages";
  } else if (
    !uniqueDeployRepo &&
    !githubImportManualState.siteType &&
    !githubImportManualState.deployRepo &&
    githubImportForm.siteType === "user-pages"
  ) {
    githubImportForm.siteType = "project-pages";
  }
}

async function refreshGithubIdentity() {
  try {
    const authState = await shellActions.getGithubAuthState();
    githubAccountLogin.value = authState?.account?.login?.trim?.() || "";
  } catch {
    githubAccountLogin.value = "";
  }
}

async function refreshGithubRepoList() {
  try {
    const repos = await listGithubRepos({ visibility: "all" });
    githubRepoLoadFailed.value = false;
    githubRepos.value = Array.isArray(repos) ? repos : [];
    syncExactGithubRepoAutodetect();
    githubRepoSummary.value = githubRepos.value.length
      ? `GitHub 仓库列表已加载，共 ${githubRepos.value.length} 个仓库。`
      : "没有读取到可用仓库，请检查当前账号权限。";
  } catch (error) {
    githubRepoLoadFailed.value = true;
    githubRepos.value = [];
    syncExactGithubRepoAutodetect();
    githubRepoSummary.value =
      collectOperationMessages(error)[0] ||
      "GitHub 仓库列表加载失败；可手动填写恢复仓库地址继续操作。";
  }
}

async function doImport() {
  try {
    const data = await importWorkspace({ ...localImportForm });
    await refreshWorkspaces();
    const note =
      data?.theme === "unknown"
        ? "该工程主题尚未确认，请继续前往主题配置页补齐。"
        : "导入完成后，继续回到主题配置、本地预览和发布流程。";
    setResultState(
      `本地目录已导入：${data?.name || localImportForm.name || localImportForm.projectDir}`,
      note,
      [
        {
          key: "local-directory",
          label: "本地目录导入",
          message: localImportForm.projectDir || "已选择工程目录。",
        },
      ],
      data,
    );
  } catch (error) {
    setStructuredError("本地目录导入失败", error);
  }
}

async function doGithubImport() {
  try {
    const data = await importWorkspaceFromGithub({
      name: githubImportForm.name,
      localDestinationPath: githubImportForm.localDestinationPath,
      siteType: githubImportForm.siteType,
      deployRepo: selectedGithubDeployRepo.value || undefined,
      backupRepo: selectedGithubBackupRepo.value,
    });
    await refreshWorkspaces();
    setResultState(
      "GitHub 直接恢复完成。",
      "恢复后请先确认主题，再接回本地预览和统一发布工作台。",
      [
        {
          key: "github-backup",
          label: "恢复来源",
          message: selectedGithubBackupRepo.value?.url || "已选择恢复源仓库。",
        },
        {
          key: "github-destination",
          label: "目标恢复目录",
          message: githubImportForm.localDestinationPath,
        },
      ],
      data,
    );
  } catch (error) {
    setStructuredError("GitHub 直接恢复失败", error);
  }
}

async function pickProjectDirectory() {
  try {
    const data = await pickDirectory({
      title: "选择已存在的博客工程目录",
      defaultPath: localImportForm.projectDir || undefined,
    });
    if (!data.canceled && data.path) {
      localImportForm.projectDir = data.path;
    }
  } catch (error) {
    setStructuredError("选择目录失败", error);
  }
}

async function pickGithubDestinationDirectory() {
  try {
    const data = await pickDirectory({
      title: "选择 GitHub 恢复目标目录",
      defaultPath: githubImportForm.localDestinationPath || undefined,
    });
    if (!data.canceled && data.path) {
      githubImportManualState.localDestinationPath = true;
      githubImportForm.localDestinationPath = data.path;
    }
  } catch (error) {
    setStructuredError("选择恢复目标目录失败", error);
  }
}

async function restoreRssFromProject() {
  try {
    const data = await importSubscriptions({
      projectDir: localImportForm.projectDir,
      strategy: "merge",
    });
    setResultState(
      "RSS 订阅已恢复。",
      "如需继续排查导入结果，可回看上面的本地目录或 GitHub 恢复摘要。",
      [
        {
          key: "rss-restore",
          label: "RSS 恢复",
          message: localImportForm.projectDir || "已使用当前本地工程目录。",
        },
      ],
      data,
    );
  } catch (error) {
    setStructuredError("恢复 RSS 失败", error);
  }
}

function goTutorialCenter() {
  shellActions.openTutorial("import-recovery");
}

function goThemeConfig() {
  shellActions.openTab("theme");
}

function goWorkspacePage() {
  shellActions.openTab("workspace");
}

function jumpToZone(zoneId) {
  document.getElementById(zoneId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

onMounted(async () => {
  await refreshGithubIdentity();
  await refreshGithubRepoList();
});
</script>

<template>
  <div
    class="page-shell page-shell--import"
    data-page-role="import"
    data-workflow-surface="editorial-workflow"
  >
    <div class="page-layer" data-page-layer="primary">
      <section class="panel page-hero" data-workflow-zone="hero">
        <div class="page-hero-grid">
          <div>
            <p class="page-kicker">Secondary entry path</p>
            <h2 class="page-title">导入已有博客工程</h2>
            <p class="page-lead">
              这是进入创作流程的次级入口：除了本地目录导入，现在也支持 GitHub 直接恢复。无论哪条入口成功，下一步都应该回到主题、预览和发布主流程。
            </p>
            <div class="workflow-hero-actions" data-workflow-zone="hero-actions">
              <button
                class="primary"
                type="button"
                data-workflow-action-level="primary"
                @click="jumpToZone('local-import-workbench')"
              >
                前往本地导入
              </button>
              <button
                class="secondary"
                type="button"
                data-workflow-action-level="secondary"
                @click="jumpToZone('github-import-workbench')"
              >
                前往 GitHub 恢复
              </button>
              <button
                class="secondary"
                type="button"
                data-workflow-action-level="tertiary"
                @click="jumpToZone('import-result')"
              >
                查看最近结果
              </button>
            </div>
            <div class="page-link-row">
              <a href="#" @click.prevent="goTutorialCenter"
                >打开教程中心（导入与恢复）</a
              >
            </div>
          </div>
        </div>

        <div class="workflow-status-grid">
          <div class="page-signal page-signal--accent">
            <p class="section-eyebrow">次级入口</p>
            <strong>已有博客接入工作流</strong>
            <p class="section-helper">本地目录导入和 GitHub 直接恢复都属于接回工作流的次级入口。</p>
          </div>
          <div class="page-signal">
            <p class="section-eyebrow">接回主流程</p>
            <strong>主题配置 → 本地预览 → 发布与备份</strong>
            <p class="section-helper">导入完成不代表结束，而是重新进入主流程的开始。</p>
          </div>
          <div class="page-signal page-signal--quiet">
            <p class="section-eyebrow">建议下一步</p>
            <strong>先确认主题，再做预览与发布检查。</strong>
            <p class="section-helper">GitHub 直接恢复时，还要先确认目标恢复目录是否正确。</p>
          </div>
        </div>
      </section>

      <section
        id="local-import-workbench"
        class="panel workflow-section-panel"
        data-workflow-zone="local-import-workbench"
      >
        <h2>本地目录导入</h2>
        <p class="muted">适合当前电脑上已经存在博客工程目录的情况。</p>

        <div class="grid-2">
          <div>
            <label>显示名称</label>
            <input v-model="localImportForm.name" placeholder="例如 我的旧博客" />
          </div>
          <div>
            <label>工程目录</label>
            <div class="path-input-row">
              <input
                v-model="localImportForm.projectDir"
                placeholder="例如 D:/old-blog"
              />
              <button class="secondary" type="button" @click="pickProjectDirectory">
                选择目录
              </button>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="primary" @click="doImport">导入工程</button>
        </div>
      </section>

      <section
        id="github-import-workbench"
        class="panel workflow-section-panel"
        data-workflow-zone="github-import-workbench"
      >
        <div class="workflow-section-heading">
          <div class="workflow-section-heading-copy">
            <p class="section-eyebrow">Step 02 · GitHub 直接恢复</p>
            <h2>GitHub 直接恢复</h2>
            <p class="section-helper">
              从 GitHub 仓库恢复博客工程，并落到你选择的目标恢复目录。
            </p>
          </div>
        </div>

        <div class="workflow-compact-block workflow-compact-block--support">
          <p class="section-eyebrow">GitHub 仓库列表</p>
          <strong>{{ githubRepoSummary }}</strong>
          <p class="page-result-note">{{ githubRecoveryNextStepNote }}</p>
        </div>

        <div class="grid-2 stack-top">
          <div>
            <label>恢复后的工作区名称（可选）</label>
            <input v-model="githubImportForm.name" placeholder="例如 从 GitHub 恢复的博客" />
          </div>
          <div>
            <label>站点类型</label>
            <select v-model="githubImportForm.siteType" @change="markGithubSiteTypeManual">
              <option value="project-pages">project-pages</option>
              <option value="user-pages">user-pages</option>
            </select>
          </div>
          <div>
            <label>发布仓库（可选）</label>
            <select
              v-if="githubRepos.length"
              v-model="githubImportForm.deployRepoUrl"
              @change="markGithubDeployRepoManual"
            >
              <option value="">不附带发布仓库元数据</option>
              <option v-for="repo in githubRepos" :key="`deploy-${repo.url}`" :value="repo.url">
                {{ repo.owner }}/{{ repo.name }}
              </option>
            </select>
            <input
              v-else
              v-model="githubImportForm.deployRepoUrl"
              placeholder="https://github.com/用户名/用户名.github.io.git"
              @input="markGithubDeployRepoManual"
            />
          </div>
          <div>
            <label>恢复源仓库</label>
            <select
              v-if="githubBackupRepoChoices.length"
              v-model="githubImportForm.backupRepoUrl"
              @change="markGithubBackupRepoManual"
            >
              <option value="">请选择恢复源仓库</option>
              <option v-for="repo in githubBackupRepoChoices" :key="repo.url" :value="repo.url">
                {{ repo.owner }}/{{ repo.name }}
              </option>
            </select>
            <input
              v-else
              v-model="githubImportForm.backupRepoUrl"
              placeholder="https://github.com/用户名/任意仓库.git"
              @input="markGithubBackupRepoManual"
            />
          </div>
          <div>
            <label>目标恢复目录</label>
            <div class="path-input-row">
              <input
                v-model="githubImportForm.localDestinationPath"
                placeholder="例如 D:/restored-blog"
                @input="markGithubLocalDestinationManual"
              />
              <button class="secondary" type="button" @click="pickGithubDestinationDirectory">
                选择目录
              </button>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="secondary" type="button" @click="refreshGithubRepoList">
            刷新 GitHub 仓库列表
          </button>
          <button class="primary" @click="doGithubImport">从 GitHub 恢复</button>
        </div>
      </section>
    </div>

    <div class="page-layer workflow-balanced-grid" data-page-layer="explanation">
      <section class="priority-panel priority-panel--support workflow-result-panel">
        <p class="section-eyebrow">建议下一步</p>
        <strong>导入成功后，立即去主题配置检查主题识别与品牌素材。</strong>
        <ul class="page-guidance-list">
          <li>如果提示主题未知，先在主题配置页完成受支持主题确认。</li>
          <li>确认品牌后进入本地预览，再决定是否统一发布。</li>
        </ul>
        <div class="actions">
          <button class="secondary" @click="goThemeConfig">前往主题配置</button>
          <button class="secondary" @click="goWorkspacePage">查看工作区列表</button>
        </div>
      </section>

      <section
        id="import-result"
        class="panel workflow-result-panel"
        data-workflow-zone="recent-result"
      >
        <p class="section-eyebrow">导入结果摘要</p>
        <h2>导入结果</h2>
        <strong>{{ resultState.summary }}</strong>
        <p class="page-result-note">{{ resultState.note }}</p>
        <div v-if="resultState.cards.length" class="stack-top">
          <article
            v-for="card in resultState.cards"
            :key="card.key"
            class="workflow-compact-block workflow-compact-block--support"
          >
            <p class="section-eyebrow">{{ card.label }}</p>
            <p class="page-result-note">{{ card.message }}</p>
          </article>
        </div>
      </section>
    </div>

    <div class="page-layer" data-page-layer="detail">
      <section class="panel workflow-section-panel" data-workflow-zone="rss-restore">
        <h2>可选：恢复 RSS 订阅</h2>
        <p class="section-helper">
          只有当本地目录导入的工程里已经包含订阅快照时，才需要执行这一步。
        </p>
        <div class="actions">
          <button class="secondary" @click="restoreRssFromProject">
            恢复 RSS 订阅
          </button>
        </div>
      </section>

      <details class="advanced-panel" v-if="resultState.rawText">
        <summary>查看导入原始结果</summary>
        <div class="advanced-panel-content">
          <pre>{{ resultState.rawText }}</pre>
        </div>
      </details>
    </div>
  </div>
</template>
