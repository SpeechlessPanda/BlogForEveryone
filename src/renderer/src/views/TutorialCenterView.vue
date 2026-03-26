<script setup>
import { nextTick, watch } from "vue";
import { useShellActions } from "../composables/useShellActions.mjs";

const props = defineProps({
  tutorialTarget: {
    type: String,
    default: "tutorial-home",
  },
});

const shellActions = useShellActions();

const tutorialDirectory = [
  {
    target: "workspace-create",
    eyebrow: "起步",
    title: "新建博客与工作区",
    summary: "先拿到第一个可运行工程，再继续主题、内容、预览和发布。",
  },
  {
    target: "theme-config",
    eyebrow: "品牌",
    title: "主题与外观配置",
    summary: "优先完成标题、背景、图标与头像这类高感知项。",
  },
  {
    target: "content-editing",
    eyebrow: "写作",
    title: "内容编辑",
    summary: "先写出第一篇内容，再决定是否启用自动发布。",
  },
  {
    target: "preview-check",
    eyebrow: "检查",
    title: "本地预览与调试",
    summary: "先确认 localhost 页面结果，再继续发布。",
  },
  {
    target: "publish-release",
    eyebrow: "上线",
    title: "发布、账号与访问地址",
    summary: "仓库地址、Git 身份、OAuth 登录和 Pages 地址都在这里串起来。",
  },
  {
    target: "import-recovery",
    eyebrow: "恢复",
    title: "导入已有项目",
    summary: "把旧工程接回主流程，而不是重新从零开始。",
  },
  {
    target: "rss-reading",
    eyebrow: "扩展",
    title: "RSS 订阅与阅读",
    summary: "主流程跑通后，再补订阅、同步和快照导出。",
  },
];

const tutorialSections = [
  {
    id: "tutorial-workspace-create",
    title: "新建博客与工作区",
    intro:
      "创建页负责拿到第一个可运行工程。先选框架、主题方向和工程目录，再让这个工作区成为后续主题、内容、预览与发布的默认上下文。",
    howTo: [
      "在新建博客页先填写博客名称，再选择工程目录。",
      "优先挑一个容易快速成型的主题方向，把第一版先跑通。",
      "创建成功后继续保留这个工作区上下文，再进入主题配置。",
    ],
    checkpoints: [
      "看到当前工作区名称与工程目录后，再继续到主题配置。",
      "如果本地目录状态异常，先回创建页确认目录，再继续后面的流程。",
    ],
    notes: [
      "如果你已经有旧博客，不要重建，直接去“导入已有项目”把旧工程接回当前工作流。",
    ],
    tabKey: "workspace",
    actionTitle: "新建博客页",
    actionHelper: "从这里开始创建第一个工程，或回到工作区列表确认上下文。",
  },
  {
    id: "tutorial-theme-config",
    title: "主题与外观配置",
    intro:
      "主题配置页先解决品牌感知最强的部分：标题、简介、背景、图标、头像和正文阅读体验。高级与原始配置应该放在后面。",
    howTo: [
      "先填写站点标题、简介、GitHub 链接与邮箱，再处理背景图和图标。",
      "保存全部配置后，立刻去预览页检查真实页面，而不是只看表单。",
      "评论、统计与 RSS 属于后置能力，先把首页观感和正文阅读感稳定下来。",
    ],
    checkpoints: [
      "确认标题、背景、图标与头像都已经落到正确工程后，再去本地预览。",
      "只有当基础外观已经稳定时，再回头补评论、统计或 RSS。",
    ],
    notes: [
      "主题配置页的目标是先统一品牌语言，再处理主题专属参数，这样后续预览更容易判断结果。",
    ],
    tabKey: "theme",
    actionTitle: "主题配置页",
    actionHelper: "打开品牌与外观工作台，继续处理标题、素材和阅读体验。",
  },
  {
    id: "tutorial-content-editing",
    title: "内容编辑",
    intro:
      "写作页负责让第一篇内容真正落地。先把文章、关于页或友链页写出来，再决定是否开启自动发布。",
    howTo: [
      "先选择当前工作区和内容类型，再填写标题与 slug。",
      "点击“创建并打开编辑器”后，优先完成正文，再考虑自动发布。",
      "已有内容优先在“已有内容二次编辑”区域继续改，避免重复创建。",
    ],
    checkpoints: [
      "能看到新建结果或已有内容被成功保存后，再去预览页检查真实页面。",
      "如果要启用自动发布，先确保发布页里的仓库地址已经确认无误。",
    ],
    notes: [
      "写作页最重要的是把内容真正写出来；自动流程属于后置项，应该在手动预览和发布都跑通后再开。",
    ],
    tabKey: "content",
    actionTitle: "内容编辑页",
    actionHelper: "继续写作、保存已有内容，或为后续预览准备第一批页面。",
  },
  {
    id: "tutorial-preview-check",
    title: "本地预览与调试",
    intro:
      "预览页不是日志页，而是发布前检查点。先确认 localhost 页面能正常打开，再决定继续写作还是进入发布。",
    howTo: [
      "在预览页选择当前工程，先使用默认端口启动并打开本地预览。",
      "保存主题或内容后，优先重新打开或重启预览，确认首页与文章页都能加载。",
      "如果只是想再次确认页面，使用“仅打开地址”，不要跳过结果检查。",
    ],
    checkpoints: [
      "页面能在 localhost 正常打开后，再继续发布与备份。",
      "如果启动失败，先确认依赖已安装、`concurrently` 和 `wait-on` 正常、5173 没被占用。",
    ],
    notes: [
      "开发运行仍异常时，先清理残留进程：`cmd /c taskkill /PID <PID> /T /F`。",
      "如果还不稳定，按调试文档先运行 `pnpm run build:renderer`，再运行 `pnpm exec node --test` 后重试。",
    ],
    tabKey: "preview",
    actionTitle: "本地预览页",
    actionHelper: "打开检查点页面，重新确认 localhost 地址、端口和最近结果。",
  },
  {
    id: "tutorial-publish-release",
    title: "发布、账号与访问地址",
    intro:
      "发布与备份页要把仓库地址、Git 身份、账号登录和最终访问地址串成一条线。这里的说明直接来自发布、Git 身份、邮箱/SSH 与 OAuth 指南。",
    howTo: [
      "在发布与备份页选择当前工程，填写完整 GitHub 仓库 HTTPS 地址，再点发布。",
      "首次发布如果缺 Git 身份，就在页面里填写 Git 用户名和邮箱；推荐使用绑定 GitHub 的邮箱或 `users.noreply.github.com` 邮箱。",
      "Hexo 和 Hugo 都优先使用 GitHub Actions；只有 Hexo 才考虑命令发布作为备选。",
      "如果需要账号登录，先在登录区域填 GitHub OAuth App 的 Client ID，点击设备登录，并在浏览器完成授权。",
    ],
    checkpoints: [
      "用户站地址通常是 `https://用户名.github.io/`，项目页通常是 `https://用户名.github.io/仓库名/`。",
      "发布后去 GitHub Settings → Pages，把 Source 确认为 GitHub Actions，并检查 Actions 部署记录。",
      "页面可能需要 1-10 分钟和一次强制刷新；如果还是 404，先检查仓库地址类型、Actions 结果和缓存。",
    ],
    notes: [
      "HTTPS 仓库地址不需要 SSH key；只有 SSH 地址才需要 SSH 配置。",
      "OAuth Device Flow 常见报错包括 `incorrect_client_credentials`、`device_flow_disabled`、`Bad verification code`、`authorization_pending` 和 `slow_down`。",
      "推荐 OAuth App 参数：应用名 `BlogForEveryone`、主页 `https://github.com/你的用户名`、回调 `http://localhost`，并开启 Device Flow。",
    ],
    tabKey: "publish",
    actionTitle: "发布与备份页",
    actionHelper: "回到发布控制中心，继续填写仓库地址、Git 身份并完成线上发布。",
  },
  {
    id: "tutorial-import-recovery",
    title: "导入已有项目",
    intro:
      "导入页是次级入口。它的目标不是停在结果页，而是把旧工程重新接回主题、预览和发布的主流程。",
    howTo: [
      "在导入页填写显示名称并选择旧博客工程目录。",
      "导入成功后，先确认主题是否已识别；如果提示未知主题，先去主题配置页完成确认。",
      "只有工程里已经有订阅快照时，才需要执行 RSS 恢复。",
    ],
    checkpoints: [
      "导入后优先去主题配置，再去本地预览，最后确认发布。",
      "如果只是恢复旧工程，不要重复创建新的工作区，以免把上下文拆散。",
    ],
    notes: [
      "导入成功只是回到主流程的开始，后续仍然要完成品牌、预览和发布检查。",
    ],
    tabKey: "import",
    actionTitle: "导入页",
    actionHelper: "打开次级入口，把已有工程接回可视化工作流。",
  },
  {
    id: "tutorial-rss-reading",
    title: "RSS 订阅与阅读",
    intro:
      "RSS 是扩展区，不和博客创建、预览、发布争抢优先级。主流程跑通后，再补订阅、同步和快照导出最稳妥。",
    howTo: [
      "先填写 RSS 地址和可选标题，再添加订阅。",
      "同步后优先在订阅列表里确认未读数量和最新文章是否正常。",
      "如果要换设备恢复，记得把订阅导出到对应博客工程目录。",
    ],
    checkpoints: [
      "确认新增订阅已自动完成首次同步后，再决定是否导出快照。",
      "导出的 subscriptions.bundle.json 适合在导入工程后重新恢复订阅上下文。",
    ],
    notes: [
      "RSS 更适合在主流程稳定后慢慢补齐，它负责灵感和阅读，不负责替代创建、预览和发布。",
    ],
    tabKey: "rss",
    actionTitle: "RSS 页",
    actionHelper: "打开订阅与阅读区，继续添加源、同步更新或导出快照。",
  },
];

function openTab(tabKey) {
  shellActions.openTab(tabKey);
}

function resolveTutorialSectionId(target) {
  if (!target || target === "tutorial-home") {
    return "tutorial-home";
  }
  if (target.startsWith("tutorial-")) {
    return target;
  }
  return `tutorial-${target}`;
}

function scrollToTutorialTarget(target = props.tutorialTarget) {
  const section = document.getElementById(resolveTutorialSectionId(target));
  section?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

watch(
  () => props.tutorialTarget,
  (target) => {
    nextTick(() => scrollToTutorialTarget(target));
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="page-shell page-shell--tutorial tutorial-center"
    data-page-role="tutorial"
    data-tutorial-surface="sectioned-tutorial-center"
  >
    <section id="tutorial-home" class="panel page-hero tutorial-home-hero">
      <div class="page-hero-grid">
        <div>
          <p class="page-kicker">Tutorial center</p>
          <h2 class="page-title">教程中心</h2>
          <p class="page-lead">
            这里不是旧的工作台首页，而是一张按流程拆开的教程面板。你可以从新建、主题、写作、预览、发布、导入和 RSS 中任选一节，直接跳到当前卡住的步骤。
          </p>
          <div class="page-link-row">
            <button class="primary" type="button" @click="openTab('workspace')">
              打开新建博客页
            </button>
            <button class="secondary" type="button" @click="openTab('publish')">
              打开发布与备份页
            </button>
          </div>
        </div>
      </div>

      <div class="tutorial-home-guidance-grid">
        <article class="page-signal page-signal--accent tutorial-home-signal">
          <p class="section-eyebrow">怎么使用</p>
          <strong>先点工作流页面里的教程入口，再让这里自动滚到对应章节。</strong>
          <p class="section-helper">如果你是从侧边栏直接进入教程页，就先从下面的目录挑一节开始。</p>
        </article>
        <article class="page-signal tutorial-home-signal">
          <p class="section-eyebrow">主流程顺序</p>
          <strong>新建 / 导入 → 主题 → 写作 → 预览 → 发布</strong>
          <p class="section-helper">RSS 属于扩展区，建议在主流程稳定后再补齐。</p>
        </article>
      </div>

      <div class="tutorial-directory-grid">
        <article
          v-for="card in tutorialDirectory"
          :key="card.target"
          class="tutorial-directory-card"
        >
          <p class="section-eyebrow">{{ card.eyebrow }}</p>
          <h3>{{ card.title }}</h3>
          <p class="section-helper">{{ card.summary }}</p>
          <button class="secondary" type="button" @click="scrollToTutorialTarget(card.target)">
            查看本节教程
          </button>
        </article>
      </div>
    </section>

    <section
      v-for="section in tutorialSections"
      :id="section.id"
      :key="section.id"
      class="panel tutorial-flow-section"
      :data-tutorial-zone="section.id"
    >
      <div class="tutorial-section-heading">
        <div>
          <p class="section-eyebrow">Workflow tutorial</p>
          <h2>{{ section.title }}</h2>
        </div>
        <p class="section-helper tutorial-section-helper">{{ section.intro }}</p>
      </div>

      <div class="tutorial-flow-grid">
        <article class="context-card tutorial-flow-card">
          <p class="section-eyebrow">在软件里怎么做</p>
          <ul class="checklist">
            <li v-for="item in section.howTo" :key="item">{{ item }}</li>
          </ul>
        </article>

        <article class="context-card tutorial-flow-card">
          <p class="section-eyebrow">完成检查点 / 下一步</p>
          <ul class="checklist">
            <li v-for="item in section.checkpoints" :key="item">{{ item }}</li>
          </ul>
        </article>

        <article class="info-card tutorial-flow-card">
          <p class="section-eyebrow">来源提示</p>
          <ul class="checklist">
            <li v-for="item in section.notes" :key="item">{{ item }}</li>
          </ul>
        </article>

        <article class="context-card tutorial-action-panel">
          <p class="section-eyebrow">打开对应页面</p>
          <strong>{{ section.actionTitle }}</strong>
          <p class="section-helper">{{ section.actionHelper }}</p>
          <div class="actions">
            <button class="primary" type="button" @click="openTab(section.tabKey)">
              打开对应页面
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
