<script setup>
import { computed, ref } from "vue";

const tutorialSections = [
  {
    key: "quick-start",
    title: "00. 快速开始（10 分钟）",
    summary:
      "从零开始的最短路径：环境检查、登录、创建、写作、发布。每一步都给出可验证结果。",
    steps: [
      "先看环境检查：Node.js、Git、pnpm 都显示已安装后再继续。",
      "完成 GitHub 登录，侧边栏出现你的用户名才算成功。",
      "进入博客创建，填工程名和目录后创建工程，等待流程显示“完成”。",
      "点击安装工程依赖，日志出现成功信息再进入下一步。",
      "进入本地预览页面，启动 localhost，确认能看到默认首页。",
      "进入内容编辑，新建一篇文章并保存。",
      "进入发布与备份，填写发布仓库并执行发布。",
      "发布成功后点击“打开博客地址”验证页面可访问。",
    ],
    notes: [
      "建议把工程放在 D:/blog 或 D:/workspace，避免系统目录权限问题。",
      "任何步骤卡住都先看日志原文，不要跳步骤。",
      "首次发布后页面可能需要 1-10 分钟生效，这是 GitHub Pages 正常行为。",
    ],
  },
  {
    key: "oauth",
    title: "01. GitHub 登录（设备码）",
    summary:
      "面向新手的 OAuth 设备码登录流程，重点区分 Client ID、设备码、访问令牌。",
    steps: [
      "在 GitHub 打开 Settings > Developer settings > OAuth Apps，创建一个 OAuth App。",
      "Homepage URL 建议填 https://github.com/你的用户名，Authorization callback URL 填 http://localhost。",
      "在 OAuth App 页面勾选 Enable Device Flow（这是设备码登录必须项）。",
      "创建后复制 Client ID，粘贴到应用登录区，再点“设备码登录”。",
      "如果网页要求输入 code，请填应用里显示的“当前设备码”。",
      "授权后回到应用，点击刷新登录状态，直到看到用户名。",
    ],
    notes: [
      "Client ID 通常形如 Iv1.xxxxx，它不是 Access Token。",
      "若网页显示 Device connected 但应用失败，通常是网络或代理问题，重试并检查网络。",
      "设备码有有效期，过期后要重新发起登录。",
    ],
  },
  {
    key: "create-blog",
    title: "02. 创建博客工程",
    summary:
      "解释每个输入框该填什么、慢速阶段如何判断正常，以及失败时怎么回退。",
    steps: [
      "工程名建议只用小写字母、数字、短横线，例如 my-first-blog。",
      "框架选择建议：初学者优先 Hexo，追求速度可选 Hugo。",
      "点击创建后，按“校验输入 -> 初始化工程 -> 写入记录 -> 完成”观察流程状态。",
      "创建完成后必须安装依赖，否则主题配置和发布会失败。",
      "网络慢时安装依赖可能较久，优先看日志是否仍在输出。",
    ],
    notes: [
      "目录路径含空格一般可用，但出现异常时优先换成纯英文路径。",
      "如果创建失败，不会写入工作区记录；修复后可直接重试。",
    ],
  },
  {
    key: "theme-images",
    title: "03. 主题配置与图片",
    summary: "不使用图床，只填本地图片路径，软件会自动转存并写入主题配置。",
    steps: [
      "先在工作区里选定工程，主题会自动跟随工程。",
      "背景图推荐使用“选择文件”按钮，避免手输路径错误。",
      "目录保持默认更稳：Hexo 为 source/img，Hugo 为 static/img。",
      "若想固定资源地址，可填写背景图文件名，例如 home-bg.jpg。",
      "点击转存并应用背景图后，确认状态提示已写入配置。",
      "图标同理，上传后会自动写入主题配置中的 favicon 字段。",
    ],
    notes: [
      "建议图片名只用英文、数字、短横线，避免空格与中文导致路径兼容问题。",
      "更换图片后若页面没更新，先重新发布再清缓存。",
    ],
  },
  {
    key: "comments-analytics",
    title: "04. 评论与浏览量统计",
    summary:
      "先用低门槛统计方案，再按需接入 Giscus、Umami、GA。每项都给最小可用配置。",
    steps: [
      "浏览量统计默认启用不蒜子，一般无需注册。",
      "若需要更完整分析，再配置 Umami 或 GA。",
      "配置 Giscus 第一步：进入你的博客仓库，打开 Settings -> Features，勾选 Discussions。",
      "配置 Giscus 第二步：仓库主页切换到 Discussions，创建一个分类（例如 Announcements 或 General）。",
      "配置 Giscus 第三步：打开 https://giscus.app，Language 选中文（可选），Repository 填 owner/repo。",
      "配置 Giscus 第四步：在页面上选择 Discussion category，并复制 repoId、categoryId。",
      "配置 Giscus 第五步：把 repo、repoId、category、categoryId、mapping 填回本软件并保存。",
      "保存后重新发布，再打开文章页验证评论区是否出现。",
    ],
    notes: [
      "Giscus 仓库必须公开、已安装 giscus app、并启用 Discussions。",
      "广告拦截插件会影响统计脚本，排查时先临时关闭后刷新验证。",
    ],
  },
  {
    key: "content",
    title: "05. 写文章与页面内容",
    summary: "自动创建 Markdown 并调用系统默认编辑器，不需要命令行。",
    steps: [
      "进入“内容编辑”，选择内容类型：文章、关于、友链或公告。",
      "填写标题（slug 可不填），点击创建并打开编辑器。",
      "在系统默认 Markdown 编辑器中写完并保存。",
      "如果开启保存后自动发布，系统会在检测到保存后触发发布。",
      "写完后回到应用，检查自动发布状态是否显示成功。",
    ],
    notes: [
      "若未自动打开编辑器，请检查系统默认应用是否可处理 .md 文件。",
      "标题建议简洁，后续修改 slug 会改变旧链接。",
    ],
  },
  {
    key: "git-email-ssh",
    title: "06. 提交邮箱、SSH 与发布方式",
    summary:
      "发布不只一种方式。本节说明 noreply 邮箱、SSH 是否必需，以及 Hexo/Hugo 推荐发布路径。",
    steps: [
      "优先在 GitHub 设置里开启邮箱隐私，使用 noreply 邮箱作为提交邮箱。",
      "如果仓库地址是 HTTPS，不强制需要 SSH 公钥；如果是 git@github.com 则必须配置 SSH。",
      "Windows 下可用 ssh-keygen -t ed25519 生成密钥，再把 .pub 公钥加到 GitHub。",
      "本软件发布模式优先选 GitHub Actions；Hexo 还可选 hexo deploy 命令发布。",
      "若你不确定选哪种，把用户名、仓库地址、邮箱发给我，我可以给你一键配置建议。",
    ],
    notes: [
      "noreply 邮箱隐私更好，但必须保证该邮箱与 GitHub 归属规则匹配。",
      "SSH 不是强制项，核心是你要有可用的推送凭据。",
    ],
  },
  {
    key: "publish",
    title: "07. 发布、访问地址与备份",
    summary:
      "重点规则：发布仓库必须是 用户名.github.io。按检查清单执行，发布后立即可验证。",
    steps: [
      "先在 GitHub 创建公开仓库，仓库名必须是 用户名.github.io。",
      "发布仓库地址填写完整 URL，例如 https://github.com/用户名/用户名.github.io.git。",
      "首次发布前填写 Git 提交用户名和邮箱，软件会自动配置当前工程的 Git 身份。",
      "点击一键发布，等待日志显示 push 与 deploy 成功。",
      "进入仓库 Settings -> Pages，确认 Source 为 GitHub Actions。",
      "进入仓库 Actions，确认 Deploy 工作流为绿色成功。",
      "访问 https://用户名.github.io/ 验证页面。",
      "每次大改前都执行本地备份，必要时推送到独立备份仓库。",
    ],
    notes: [
      "如果仓库名不是 用户名.github.io，本软件会阻止发布并提示修正。",
      "如果提示 Git 身份缺失，请按发布页提示填写用户名和邮箱后重试。",
      "发布后出现 404 时，先等 1-10 分钟，再检查 Actions 和 Pages 配置。",
    ],
  },
  {
    key: "troubleshoot",
    title: "08. 常见故障排查",
    summary: "按症状给出最短排查路径，避免一次改动太多导致问题叠加。",
    steps: [
      "症状：创建工程很慢。处理：看日志是否持续输出，卡住再换网络后重试。",
      "症状：登录后重开软件仍显示未登录。处理：检查是否点了退出登录，确认本地数据库可写。",
      "症状：页面样式不更新。处理：保存主题配置后重新发布，并强制刷新浏览器缓存。",
      "症状：评论区不显示。处理：检查仓库公开性、giscus app 安装、Discussions 开关与参数。",
      "症状：发布后 404。处理：先确认仓库名是 用户名.github.io，再查 Actions 与 Pages。",
    ],
    notes: [
      "排错时一次只改一个变量，改完立刻验证，避免问题叠加。",
      "无法定位时，把日志原文复制出来再处理，不要只凭感觉判断。",
    ],
  },
];

const activeSectionKey = ref(tutorialSections[0].key);

const activeSection = computed(() => {
  return (
    tutorialSections.find((item) => item.key === activeSectionKey.value) ||
    tutorialSections[0]
  );
});
</script>

<template>
  <section class="tutorial-layout-full">
    <aside class="tutorial-directory">
      <h2>教程中心</h2>
      <p class="muted">点击左侧目录进入详细教程。</p>
      <button
        v-for="section in tutorialSections"
        :key="section.key"
        :class="['tutorial-link', { active: activeSectionKey === section.key }]"
        @click="activeSectionKey = section.key"
      >
        {{ section.title }}
      </button>
    </aside>

    <article class="tutorial-article">
      <h3>{{ activeSection.title }}</h3>
      <p class="muted">{{ activeSection.summary }}</p>

      <h4>操作步骤</h4>
      <ol>
        <li v-for="step in activeSection.steps" :key="step">{{ step }}</li>
      </ol>

      <h4>注意事项</h4>
      <ul class="tutorial-note">
        <li v-for="note in activeSection.notes" :key="note">{{ note }}</li>
      </ul>
    </article>
  </section>
</template>
