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
    title: "首次发布与 GitHub Pages",
    summary: "把站点类型、仓库命名、登录、Actions 和最终地址拆成单用途教程来学。",
  },
  {
    target: "import-recovery",
    eyebrow: "恢复",
    title: "导入与恢复",
    summary: "把本地导入、GitHub 直连导入、BFE 恢复和 baseURL 修复拆开讲清楚。",
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
      "如果你准备第一次把内容上线，先去“首次发布与 GitHub Pages”里的 first publish prerequisites，再回来开自动流程。",
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
    title: "首次发布与 GitHub Pages",
    intro:
      "本节是首次发布的索引页。先按你卡住的位置挑出单用途卡片，再回到发布与备份页完成当前动作，不要在这里继续把站点类型、仓库命名、登录、发布与地址混成一节。",
    howTo: [
      "先挑出和你当前问题完全对应的单用途卡片，不要试图在父节里一次吃完全部发布知识。",
      "看完单卡后回到发布与备份页完成当前动作，再回来决定是否需要下一张卡。",
      "如果你还没判断自己卡在站点类型、前置条件还是最终地址，先从 user site vs project site 或 first publish prerequisites 开始。",
    ],
    checkpoints: [
      "你应该已经知道下一步要看哪一张单用途卡，而不是继续停在父节里找混合答案。",
      "完成当前单卡对应动作后，回到发布与备份页核对结果，再决定是否跳到 publish with GitHub Actions 或 understand the final blog address。",
      "如果问题明显是登录阻塞，就只回到 sign in to GitHub；不要把登录排错和发布结果混成一个结论。",
    ],
    notes: [
      "本节先做首次发布路线图，不直接重复站点类型、仓库命名、Git 身份、Pages 地址或 OAuth 细节。",
      "固定备份仓库名必须使用 BFE；这条底线继续以下面的 warning 和 backup repository purpose and naming 卡片为准。",
      "需要完整的动作细节时，直接进入下面的单用途教程，再回到发布与备份页执行。",
    ],
    lessons: [
      {
        title: "user site vs project site",
        summary: "先决定你要根站点还是仓库子路径站点，这一步会影响后面的命名、访问地址和 baseURL。",
        bullets: [
          "用户站点只放在 `用户名.github.io`，访问地址是根路径。",
          "项目站点放在普通仓库里，访问地址会带上仓库名子路径。",
          "一旦站点类型选错，后面的仓库名、Pages 配置和最终地址都会跟着错。",
        ],
      },
      {
        title: "deploy repository naming rules",
        summary: "发布仓库只负责线上访问，不负责恢复历史。命名规则先确认，再点统一发布。",
        bullets: [
          "用户站点的发布仓库名必须等于 `用户名.github.io`。",
          "项目站点可以用 `my-blog` 这类仓库名，但最终地址会变成 `/my-blog/`。",
          "不要把发布仓库名写成备份仓库名；两条链路应该分开。",
        ],
      },
      {
        title: "backup repository purpose and naming",
        summary: "备份仓库负责恢复，不负责线上访问。它是统一发布链路里的底仓。",
        bullets: [
          "固定备份仓库名必须使用 BFE。",
          "BFE 负责保存恢复用快照，和发布仓库各司其职。",
          "如果你换电脑或要做 GitHub 直连导入，先想到 BFE，而不是发布仓库。",
        ],
      },
      {
        title: "first publish prerequisites",
        summary: "第一次发布前，把工程上下文、Git 身份、备份目录和站点命名补齐，避免跑到一半才中断。",
        bullets: [
          "先确认当前工程已经能本地预览，再来做第一次线上发布。",
          "Git 提交身份必须完整，邮箱优先使用 GitHub 绑定邮箱或 `users.noreply.github.com`。",
          "发布与备份要一起跑通，所以本地备份目录也要先选好。",
        ],
      },
      {
        title: "sign in to GitHub",
        summary: "需要登录时，只处理 GitHub 设备码登录这一个动作，不要把登录排错和发布排错混在一起。",
        bullets: [
          "先填写 GitHub OAuth App 的 Client ID，再点设备码登录。",
          "浏览器授权完成后，再回到软件刷新登录状态。",
          "如果 Git 邮箱不想暴露真实地址，可使用 `users.noreply.github.com` 邮箱完成提交身份。",
        ],
      },
      {
        title: "publish with GitHub Actions",
        summary: "Hexo 和 Hugo 的首次上线都优先走 GitHub Actions，让 Pages、构建和发布路径保持一致。",
        bullets: [
          "统一发布完成后，去仓库的 Actions 查看构建是否成功。",
          "GitHub Settings → Pages 的 Source 应保持为 GitHub Actions。",
          "Hexo 的命令发布只作为备选，不是默认教学路径。",
        ],
      },
      {
        title: "understand the final blog address",
        summary: "上线完成后，先判断最终地址是否符合站点类型，再决定是不是配置问题。",
        bullets: [
          "用户站点通常是 `https://用户名.github.io/`。",
          "项目站点通常是 `https://用户名.github.io/仓库名/`。",
          "如果地址没错但页面还没出来，给 Pages 1-10 分钟并强制刷新一次。",
        ],
      },
    ],
    warnings: [
      {
        title: "先记住两条底线",
        bodyHtml:
          '固定备份仓库名必须使用 <code>BFE</code>。不要把发布仓库和恢复底仓写成同一个仓库。',
      },
      {
        title: "登录卡住先拆开排查",
        body:
          "先回到 sign in to GitHub 核对 Client ID、Device Flow 和浏览器授权，再回来继续发布，不要把登录问题和发布结果混成一个结论。",
      },
    ],
    tabKey: "publish",
    actionTitle: "发布与备份页",
    actionHelper: "回到发布控制中心，继续填写站点命名、Git 身份并完成首次上线。",
  },
  {
    id: "tutorial-import-recovery",
    title: "导入与恢复",
    intro:
      "本节是导入与恢复的分流入口。先判断你现在是本地导入、GitHub 恢复，还是路径修复，再去对应单卡，不要在这里把导入、恢复、发布修复混成同一节。",
    howTo: [
      "先判断你现在是本地导入、GitHub 恢复，还是路径修复，再打开对应的单用途卡片。",
      "看完对应单卡后回到导入页或原来的工作流页面继续操作，不要在父节里继续追步骤细节。",
      "如果你是从 GitHub 找回旧博客，优先看 import from GitHub into a local path 和 recover from backup/import differences。",
    ],
    checkpoints: [
      "你应该已经知道自己接下来要回导入页、主题配置页、本地预览页还是发布与备份页，而不是继续停在总览里。",
      "只有当路径异常或资源错位时，再跳到 base URL / subpath mismatch repair；不要把它和恢复动作混在一起。",
      "完成对应单卡后，再回到原来的工作流页面继续验证。",
    ],
    notes: [
      "本节先帮你判断该看哪张恢复卡片，不直接重复本地导入、GitHub 恢复、恢复差异或 baseURL 修复细节。",
      "GitHub 直连导入时，以备份仓库 BFE 作为权威导入源；具体动作继续以下面的 warning 和对应单卡为准。",
      "看完对应单卡后回到导入页或原来的工作流页面继续操作，把恢复结果接回主流程。",
    ],
    lessons: [
      {
        title: "import from GitHub into a local path",
        summary: "GitHub 直连导入的重点不是随便拉一个仓库，而是把恢复底仓还原到你指定的本地路径。",
        bullets: [
          "先选一个新的本地恢复目录，避免覆盖还没确认的旧工程。",
          "GitHub 直连导入时，以备份仓库 BFE 作为权威导入源。",
          "导入完成后马上检查主题识别、内容目录和 `.bfe` 快照是否都在。",
        ],
      },
      {
        title: "recover from backup/import differences",
        summary: "发布仓库负责线上可访问页面，BFE 负责恢复快照；两者看起来像“同一个博客”，用途却不同。",
        bullets: [
          "线上访问异常时先看发布仓库和 GitHub Pages。",
          "需要找回内容、配置和恢复快照时先看 BFE。",
          "如果导入结果和线上页面不一致，优先以恢复目标为准去核对 BFE，而不是盲改发布仓库。",
        ],
      },
      {
        title: "base URL / subpath mismatch repair",
        summary: "导入后最常见的“能打开但路径不对”问题，通常来自用户站点 / 项目站点和 baseURL / 子路径不一致。",
        bullets: [
          "用户站点应该输出根路径，不该继续保留旧的仓库子路径。",
          "项目站点必须保留仓库子路径，否则静态资源和页面跳转会 404。",
          "修完后先本地预览，再重新通过 GitHub Actions 发布确认。",
        ],
      },
    ],
    warnings: [
      {
        title: "恢复时先认清权威源",
        bodyHtml:
          'GitHub 直连导入时，以备份仓库 <code>BFE</code> 作为权威导入源。发布仓库负责访问地址，不负责完整恢复历史。',
      },
      {
        title: "不要跳过路径检查",
        body:
          "如果导入后首页能开但资源、文章或主题样式错位，先修 baseURL / 子路径，再继续编辑内容或再次发布。",
      },
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

      <div v-if="section.lessons?.length" class="tutorial-cluster-grid">
        <article
          v-for="lesson in section.lessons"
          :key="`${section.id}-${lesson.title}`"
          class="info-card tutorial-lesson-card"
        >
          <p class="section-eyebrow">Single-purpose tutorial</p>
          <h3>{{ lesson.title }}</h3>
          <p class="section-helper">{{ lesson.summary }}</p>
          <ul class="checklist">
            <li v-for="item in lesson.bullets" :key="item">{{ item }}</li>
          </ul>
        </article>
      </div>

      <div v-if="section.warnings?.length" class="tutorial-callout-grid">
        <article
          v-for="warning in section.warnings"
          :key="`${section.id}-${warning.title}`"
          class="tutorial-callout tutorial-callout--warning"
        >
          <p class="section-eyebrow">Warning / caution</p>
          <strong>{{ warning.title }}</strong>
          <p v-if="warning.body" class="section-helper">{{ warning.body }}</p>
          <p v-if="warning.bodyHtml" class="section-helper" v-html="warning.bodyHtml"></p>
        </article>
      </div>
    </section>
  </div>
</template>
