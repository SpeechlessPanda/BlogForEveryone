# BlogForEveryone

面向新手的博客搭建桌面平台，技术栈为 Electron + Vue + JavaScript。

## 已支持能力

1. 可视化创建 Hexo/Hugo 博客工程。
2. 内置 Hexo/Hugo 各 5 个主流主题配置元数据，并支持可视化编辑。
3. 默认通过 GitHub Actions 发布到 GitHub Pages。
4. 本地工程可备份到本地快照目录，并可选推送到备份仓库。
5. 可导入已有博客目录并继续管理。
6. 内置 RSS 订阅、同步、阅读和系统通知。
7. 订阅可导出为工程内 .bfe/subscriptions.bundle.json，便于换设备恢复。
8. 已接入 GitHub OAuth 设备码登录真实流程（需用户提供 OAuth App Client ID）。
9. 支持 Git/Node 缺失时一键使用 winget 静默安装（用户确认后执行）。

## 环境要求

1. Node.js 20+
2. Git
3. pnpm（应用内可自动安装）
4. Hexo CLI 与 Hugo（二选一或都安装）

Hexo 安装示例：

pnpm add -g hexo-cli

Hugo 安装示例（Windows）：

choco install hugo-extended -y

## 启动

1. 安装依赖

pnpm install

1. 启动开发模式

pnpm run dev

1. 打包 Windows 安装程序

pnpm run package

## 目录说明

- src/main: Electron 主进程与服务层
- src/renderer: Vue 前端界面
- src/shared/data: 主题配置元数据
- docs/plans: 项目计划文档
- docs/guides: 操作向导文档

## 快速向导文档

1. GitHub OAuth App 创建与设备码登录：docs/guides/github-oauth-app-setup.md

## 当前实现说明

1. GitHub OAuth 设备码登录已接入真实流程（你需要在 GitHub 创建 OAuth App 并提供 Client ID）。
2. 主题配置提供“可视化字段 + 高级 JSON 编辑”双模式；后续可扩展到完整 YAML/TOML 注释级编辑。
3. RSS 已支持后台轮询同步与系统通知。
4. 启动时会检测 Node.js/Git/pnpm，缺失时可一键打开下载入口或使用 winget 静默安装；pnpm 安装和依赖下载失败时会自动切换镜像源重试。
