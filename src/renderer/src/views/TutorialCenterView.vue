<script setup>
import { computed, ref } from "vue";

const tutorialSections = [
  {
    key: "quick-start",
    title: "00. 快速开始（10 分钟）",
    summary: "从零开始的最短路径：登录、创建工程、写第一篇文章并发布。",
    steps: [
      "打开应用后先完成 GitHub 登录，看到“登录成功”再继续。",
      "进入“博客创建”，填写工程名与目录，选择 Hexo 或 Hugo。",
      "点击“创建工程”，等待进度完成后再点“安装工程依赖（pnpm）”。",
      "进入“内容编辑”，类型选“新博客文章”，填标题后点“创建并打开编辑器”。",
      "保存文章后，进入“发布与备份”执行发布。",
    ],
    notes: [
      "Windows 建议把工程放在 D:/blog 或 D:/workspace，不要放系统目录。",
      "任何步骤卡住时先看状态日志，再到“常见故障排查”章节。",
    ],
  },
  {
    key: "oauth",
    title: "01. GitHub 登录（设备码）",
    summary:
      "面向小白的 OAuth 配置与登录步骤，避免把 Client ID、Token 和用户名混淆。",
    steps: [
      "在 GitHub 打开 Settings > Developer settings > OAuth Apps，创建一个 OAuth App。",
      "Homepage URL 可填任意可访问地址，例如 https://github.com/你的用户名。",
      "Authorization callback URL 可填 http://localhost。",
      "创建后复制 Client ID，粘贴到应用登录区，再点“设备码登录”。",
      "如果网页要求输入 code，请填应用里显示的“当前设备码”。授权后回到应用等待完成。",
    ],
    notes: [
      "Client ID 通常形如 Iv1.xxxxx，它不是 Access Token。",
      "若网页显示 Device connected 但应用失败，通常是网络拦截，先关闭代理插件后重试。",
    ],
  },
  {
    key: "create-blog",
    title: "02. 创建博客工程",
    summary:
      "解释每个输入框该填什么、为什么这样填，以及慢速阶段如何判断是否正常。",
    steps: [
      "工程名建议只用小写字母、数字、短横线，例如 my-first-blog。",
      "框架二选一：Hexo 生态更丰富，Hugo 构建更快。新手通常先用 Hexo。",
      "创建完成后务必安装依赖，否则主题配置和发布会失败。",
      "如果你网络较慢，依赖安装阶段耗时较长是正常现象。",
    ],
    notes: [
      "目录路径含空格一般可用，但出现异常时优先换成纯英文路径。",
      "切换主题后建议重新打开“主题配置”页面，确保加载到对应字段。",
    ],
  },
  {
    key: "theme-images",
    title: "03. 主题配置与图片",
    summary:
      "不使用图床。直接把本地图片转存到工程内图片目录（默认 img），并自动回填可用 URL。",
    steps: [
      "进入“主题配置”，先选择工程与主题。",
      "在“背景与图标”里填写本地背景图路径。",
      "图片目录保持默认即可：Hexo 使用 source/img，Hugo 使用 static/img。",
      "如果你希望固定文件名，填写“背景图文件名（可选）”，例如 home-bg.jpg。",
      "点击“转存并应用背景图”，系统会复制文件并把背景图 URL 自动改为 /img/xxx。",
      "图标同理，填写本地图标路径后点“上传并应用博客图标”。",
    ],
    notes: [
      "建议图片名只用英文、数字、短横线，避免空格与中文导致路径兼容问题。",
      "更换图片后若页面没更新，清浏览器缓存或强制刷新。",
    ],
  },
  {
    key: "comments-analytics",
    title: "04. 评论与浏览量统计",
    summary:
      "默认推荐“零额外操作”的浏览量方案，并提供 Giscus/Umami/GA 的进阶配置。",
    steps: [
      "浏览量统计默认启用“不蒜子”，一般不需要额外注册。",
      "如果你需要更详细数据，再补 Umami 或 GA。",
      "配置 Giscus 第一步：进入你的博客仓库，打开 Settings -> Features，勾选 Discussions。",
      "配置 Giscus 第二步：仓库主页切换到 Discussions，创建一个分类（例如 Announcements 或 General）。",
      "配置 Giscus 第三步：打开 https://giscus.app，Language 选中文（可选），Repository 填 owner/repo。",
      "配置 Giscus 第四步：在页面上选择 Discussion category，并复制 repoId、categoryId。",
      "配置 Giscus 第五步：把 repo、repoId、category、categoryId、mapping 填回本软件并保存。",
      "保存后重新发布博客，再打开任意文章页验证评论区是否出现。",
    ],
    notes: [
      "广告拦截插件会长期阻止统计脚本。请在扩展设置中“永久关闭”或“对你的博客域名加入永久白名单”，不要只临时关闭。",
      "Giscus 的 repo 必须是 owner/repo 格式；repoId 与 categoryId 必须和 giscus.app 输出一致。",
    ],
  },
  {
    key: "content",
    title: "05. 写文章与页面内容",
    summary: "自动创建 Markdown 并调用系统默认编辑器，适合不熟悉命令行的用户。",
    steps: [
      "进入“内容编辑”，选择内容类型：文章、关于、友链或公告。",
      "填写标题（slug 可不填），点击“创建并打开编辑器”。",
      "在系统默认 Markdown 编辑器中写完并保存。",
      "若开启“保存后自动发布”，系统会检测文件保存并触发发布流程。",
    ],
    notes: [
      "若未自动打开编辑器，请检查系统默认应用是否可处理 .md 文件。",
      "标题建议简洁，后续修改 slug 会影响旧链接。",
    ],
  },
  {
    key: "publish",
    title: "06. 发布、访问地址与备份",
    summary: "讲清“发布后去哪里看”以及仓库命名规则，减少首次发布后的困惑。",
    steps: [
      "发布仓库地址填写完整 URL，例如 https://github.com/用户名/仓库名.git。",
      "点击发布后，等待任务结束并查看返回日志。",
      "若仓库名是 用户名.github.io，访问地址为 https://用户名.github.io/。",
      "若仓库名是 blog，访问地址通常为 https://用户名.github.io/blog/。",
      "建议每次大改前执行一次备份，必要时推送到单独备份仓库。",
    ],
    notes: [
      "发布失败优先检查 Actions 运行日志与仓库 Pages 设置。",
      "仓库名尽量只用英文、数字、短横线。",
    ],
  },
  {
    key: "troubleshoot",
    title: "07. 常见故障排查",
    summary: "按“症状 -> 原因 -> 处理”给出可执行步骤，适合完全新手逐条排查。",
    steps: [
      "症状：创建工程很慢。处理：先看进度日志，若停在依赖下载可等待或切换网络。",
      "症状：页面白屏或配置没生效。处理：先保存主题配置，再重新发布并清缓存。",
      "症状：评论区不显示。处理：检查 Discussions 是否开启、Giscus 参数是否完整。",
      "症状：浏览量为 0。处理：确认不蒜子启用，临时关闭广告拦截后再刷新。",
      "症状：发布后 404。处理：确认 Pages 分支和部署动作成功。",
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
  <section class="panel tutorial-panel tutorial-layout">
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
      <ul>
        <li v-for="note in activeSection.notes" :key="note">{{ note }}</li>
      </ul>
    </article>
  </section>
</template>
