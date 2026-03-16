<template>
  <section class="panel tutorial-panel">
    <h2>教程中心</h2>
    <p class="muted">这里汇总所有关键操作教程。每个功能页也有对应的就地教程卡片。</p>

    <h3>1. GitHub OAuth 设备码登录</h3>
    <ol>
      <li>先在 GitHub 创建 OAuth App，拿到 Client ID。</li>
      <li>应用中填写 Client ID，点击“设备码登录”。</li>
      <li>如果 GitHub 页面要求填设备码，输入应用日志里的 user code。</li>
      <li>授权完成后，回到应用点击“刷新登录状态”。</li>
    </ol>

    <h3>2. 环境安装</h3>
    <ol>
      <li>若缺少 Node 或 Git，可点“下载”打开官网。</li>
      <li>也可点“自动安装（winget）”静默安装。</li>
      <li>Node 可用后，点“安装 pnpm”。</li>
    </ol>

    <h3>3. 新建博客</h3>
    <ol>
      <li>填写工程名和目录，选择框架与主题。</li>
      <li>点击“创建工程”。</li>
      <li>点击“安装工程依赖（pnpm）”。</li>
    </ol>

    <h3>4. 主题配置</h3>
    <ol>
      <li>先选择工程与主题。</li>
      <li>在可视化配置区填写选项并保存。</li>
      <li>复杂项在高级 JSON 区手动调整。</li>
    </ol>

    <h3>5. 发布与备份</h3>
    <ol>
      <li>发布：填 GitHub 仓库地址，点击一键发布。</li>
      <li>备份：填本地备份目录，可选填备份仓库地址并推送。</li>
    </ol>

    <h3>6. 导入与恢复</h3>
    <ol>
      <li>填入已有博客工程目录并导入。</li>
      <li>如目录有 .bfe/subscriptions.bundle.json，可恢复 RSS 订阅。</li>
    </ol>

    <h3>7. RSS 订阅</h3>
    <ol>
      <li>新增 RSS 地址后点击“添加订阅”。</li>
      <li>点击“立即同步”获取更新并触发通知。</li>
      <li>可导出订阅快照到博客工程目录。</li>
    </ol>
  </section>
</template>
