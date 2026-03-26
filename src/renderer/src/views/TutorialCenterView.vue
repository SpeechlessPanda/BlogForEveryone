<script setup>
import { computed, onMounted } from "vue";
import { refreshWorkspaces, workspaceState } from "../stores/workspaceStore.js";
import { useShellActions } from "../composables/useShellActions.mjs";

const frameworkLabels = {
  hexo: "Hexo",
  hugo: "Hugo",
};

const themeExplorationTracks = [
  {
    key: "warm-start",
    eyebrow: "Warm start",
    title: "先用稳妥主题找到开笔速度",
    summary:
      "Landscape、Next、PaperMod 适合先把创建、写作、预览与发布流程走通，再决定更强的品牌表达。",
    tags: ["低门槛", "发布友好", "适合第一次上线"],
  },
  {
    key: "brand-forward",
    eyebrow: "Brand voice",
    title: "想要更强首页气质，就去看表达型方向",
    summary:
      "Butterfly、Fluid、Stack 更适合需要首屏层次、专题感和品牌记忆点的博客方向。",
    tags: ["首页表现", "专题感", "更有视觉记忆"],
  },
  {
    key: "calm-editorial",
    eyebrow: "Editorial calm",
    title: "偏安静、耐看的纸感路线也已经准备好",
    summary:
      "LoveIt、Mainroad、Anatole、Volantis 能提供更克制的排版基调，适合长期写作与内容沉淀。",
    tags: ["纸感", "长期写作", "内容优先"],
  },
];

const selectedWorkspace = computed(() => {
  return (
    workspaceState.workspaces.find(
      (item) => item.id === workspaceState.selectedWorkspaceId,
    ) || workspaceState.workspaces[0] || null
  );
});

const recentWorkspaces = computed(() => {
  return workspaceState.workspaces.slice(0, 3);
});
const shellActions = useShellActions();

const heroSummary = computed(() => {
  const workspace = selectedWorkspace.value;
  if (!workspace) {
    return "先创建一个可运行工作区，再回来继续主题、内容与发布节奏。";
  }
  return `当前已连接 ${workspace.name}，可以直接延续主题配置、内容编辑或本地预览。`;
});

const featuredWorkbenchCard = computed(() => {
  const workspace = selectedWorkspace.value;
  if (!workspace) {
    return {
      eyebrow: "Featured direction",
      title: "把教程首页当成创作开场桌面",
      summary:
        "左侧动作负责开始，右侧视觉锚点负责帮你先选一个气质方向：稳妥开局、品牌表达，或更安静的纸感路线。",
      meta: "现在最值得做的动作，是先拿到第一个可运行工作区。",
      tags: ["中密度工作台", "温润纸感", "效率不后退"],
      actionLabel: "前往创建页挑选主题",
      actionTab: "workspace",
    };
  }

  return {
    eyebrow: "Current workbench",
    title: workspace.name,
    summary: `${frameworkLabels[workspace.framework] || workspace.framework} 工作区已接入当前桌面，继续完善品牌、内容和预览会最顺手。`,
    meta: workspace.localExists
      ? workspace.projectDir
      : "记录已存在，但建议先检查本地目录是否仍可用。",
    tags: [
      frameworkLabels[workspace.framework] || workspace.framework,
      workspace.localExists ? "本地目录可继续使用" : "需要检查本地目录",
      "保持同一工作流节奏",
    ],
    actionLabel: workspace.localExists ? "继续去主题配置" : "回到工作区检查",
    actionTab: workspace.localExists ? "theme" : "workspace",
  };
});

const statusBand = computed(() => {
  const workspace = selectedWorkspace.value;

  return [
    {
      eyebrow: "当前工作区",
      title: workspace ? workspace.name : "还没有已连接工作区",
      detail: workspace
        ? `${frameworkLabels[workspace.framework] || workspace.framework} · ${workspace.localExists ? "本地项目在线" : "等待本地目录确认"}`
        : "创建或导入一个项目后，这里会成为主题、内容、预览与发布的默认上下文。",
    },
    {
      eyebrow: "当前节奏",
      title: workspace ? "先确认主题方向，再预览首页" : "先拿到可运行的第一篇博客",
      detail: workspace
        ? "教程首页会先把继续动作、最近工作和主题方向放在同一张桌面里。"
        : "完成工作区创建后，就能把首页从教程目录切换成持续使用的工作台。",
    },
    {
      eyebrow: "最新状态",
      title: workspace?.localExists ? "可继续编辑与预览" : "需要先补齐工作区上下文",
      detail: workspace?.localExists
        ? "优先继续主题配置或内容编辑，能最快看到自己的品牌首页。"
        : "如果你已有项目，也可以直接从导入入口接回当前工作流。",
    },
  ];
});

function openTab(tabKey) {
  shellActions.openTab(tabKey);
}

function continueLastWork() {
  const workspace = selectedWorkspace.value;
  if (!workspace) {
    openTab("workspace");
    return;
  }

  workspaceState.selectedWorkspaceId = workspace.id;
  openTab(workspace.localExists ? "theme" : "workspace");
}

function openWorkspaceContext(workspace, tabKey) {
  workspaceState.selectedWorkspaceId = workspace.id;
  openTab(tabKey);
}

onMounted(() => {
  refreshWorkspaces().catch(() => {});
});
</script>

<template>
  <section
    class="page-shell page-shell--tutorial tutorial-workbench"
    data-page-role="tutorial"
    data-tutorial-surface="editorial-workbench"
  >
    <header class="panel tutorial-brand-header" data-tutorial-zone="brand-header">
      <div>
        <p class="page-kicker">Tutorial home · Editorial workbench</p>
        <h2 class="page-title tutorial-brand-title">BlogForEveryone</h2>
        <p class="page-lead tutorial-brand-lead">
          把新手引导、当前工程与主题灵感收进同一张开场桌面：既像编辑台，也保持真正能继续工作的效率。
        </p>
      </div>

      <div class="tutorial-brand-meta">
        <div class="tutorial-meta-chip">
          <span class="status-label">首屏定位</span>
          <strong>中密度创作工作台</strong>
        </div>
        <p class="section-helper">
          先判断当前项目和下一步，再决定是继续、创建，还是导入已有博客。
        </p>
      </div>
    </header>

    <section class="panel tutorial-workbench-hero" data-tutorial-zone="hero">
      <div class="tutorial-workbench-copy">
        <p class="section-eyebrow">Primary workbench hero</p>
        <h3 class="tutorial-hero-title">先延续当前创作，再开启下一篇博客。</h3>
        <p class="tutorial-hero-lead">{{ heroSummary }}</p>

        <div class="actions tutorial-workbench-actions">
          <button class="primary" type="button" @click="continueLastWork">
            继续上次工作
          </button>
          <button class="secondary" type="button" @click="openTab('workspace')">
            新建博客
          </button>
          <button class="secondary" type="button" @click="openTab('import')">
            导入已有项目
          </button>
        </div>

        <p class="action-note tutorial-hero-note">
          {{
            selectedWorkspace
              ? `当前默认工作区：${selectedWorkspace.name}`
              : "还没有默认工作区时，创建和导入都会把这里变成后续的继续入口。"
          }}
        </p>
      </div>

      <article class="tutorial-feature-card">
        <p class="section-eyebrow">{{ featuredWorkbenchCard.eyebrow }}</p>
        <h3>{{ featuredWorkbenchCard.title }}</h3>
        <p class="section-helper">{{ featuredWorkbenchCard.summary }}</p>
        <p class="tutorial-feature-meta">{{ featuredWorkbenchCard.meta }}</p>

        <div class="tutorial-tag-row">
          <span
            v-for="tag in featuredWorkbenchCard.tags"
            :key="tag"
            class="tutorial-tag"
          >
            {{ tag }}
          </span>
        </div>

        <button
          class="secondary tutorial-feature-action"
          type="button"
          @click="openTab(featuredWorkbenchCard.actionTab)"
        >
          {{ featuredWorkbenchCard.actionLabel }}
        </button>
      </article>
    </section>

    <section class="panel tutorial-status-band" data-tutorial-zone="recent-work">
      <div class="tutorial-section-heading">
        <div>
          <p class="section-eyebrow">Recent work and status band</p>
          <h3>最近工作与当前状态</h3>
        </div>
        <p class="section-helper tutorial-section-helper">
          不再只是教程目录，而是把当前项目、继续动作和状态提示放在一眼就能判断的位置。
        </p>
      </div>

      <div class="tutorial-status-grid">
        <article v-for="item in statusBand" :key="item.eyebrow" class="tutorial-status-card">
          <p class="status-label">{{ item.eyebrow }}</p>
          <strong>{{ item.title }}</strong>
          <p class="section-helper">{{ item.detail }}</p>
        </article>
      </div>

      <div class="tutorial-recent-grid">
        <article
          v-for="workspace in recentWorkspaces"
          :key="workspace.id"
          class="tutorial-recent-card"
        >
          <p class="section-eyebrow">Recent workspace</p>
          <h4>{{ workspace.name }}</h4>
          <p class="tutorial-recent-meta">
            {{ frameworkLabels[workspace.framework] || workspace.framework }} ·
            {{ workspace.projectDir }}
          </p>
          <p class="section-helper">
            {{
              workspace.localExists
                ? "可以继续主题配置、内容编辑或本地预览。"
                : "已记录此项目，但建议先确认本地目录是否仍然存在。"
            }}
          </p>
          <div class="page-link-row tutorial-recent-actions">
            <button class="secondary" type="button" @click="openWorkspaceContext(workspace, 'theme')">
              继续配置
            </button>
            <button class="secondary" type="button" @click="openWorkspaceContext(workspace, 'preview')">
              打开预览
            </button>
          </div>
        </article>

        <article v-if="!recentWorkspaces.length" class="tutorial-recent-card tutorial-recent-card--empty">
          <p class="section-eyebrow">Recent workspace</p>
          <h4>还没有最近项目</h4>
          <p class="section-helper">
            先从“新建博客”拿到第一个工作区，或从“导入已有项目”把旧工程接回现在的工作台。
          </p>
          <div class="page-link-row tutorial-recent-actions">
            <button class="secondary" type="button" @click="openTab('workspace')">
              去创建页
            </button>
            <button class="secondary" type="button" @click="openTab('import')">
              去导入页
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="panel theme-exploration-rail" data-tutorial-zone="theme-rail">
      <div class="tutorial-section-heading">
        <div>
          <p class="section-eyebrow">Theme exploration rail</p>
          <h3>主题探索入口</h3>
        </div>
        <p class="section-helper tutorial-section-helper">
          首屏只给你经过筛选的气质方向，而不是一次丢出一整墙等权重缩略图。
        </p>
      </div>

      <div class="tutorial-theme-grid">
        <article
          v-for="track in themeExplorationTracks"
          :key="track.key"
          class="tutorial-theme-card"
        >
          <p class="section-eyebrow">{{ track.eyebrow }}</p>
          <h4>{{ track.title }}</h4>
          <p class="section-helper">{{ track.summary }}</p>
          <div class="tutorial-tag-row">
            <span v-for="tag in track.tags" :key="tag" class="tutorial-tag tutorial-tag--quiet">
              {{ tag }}
            </span>
          </div>
          <button class="secondary tutorial-theme-action" type="button" @click="openTab('workspace')">
            去工作区继续挑选主题
          </button>
        </article>
      </div>
    </section>
  </section>
</template>
