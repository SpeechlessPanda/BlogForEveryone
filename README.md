# BlogForEveryone

面向所有想要输出自己想法观点的小白的博客搭建桌面平台，技术栈为 Electron + Vue + JavaScript。

## 产品定位

1. 目标用户：不熟悉命令行、希望全程可视化操作、迫切想要输出内容的博客新手。
2. 首版平台：Windows。
3. 当前支持框架：Hexo、Hugo。
4. 默认发布目标：GitHub Pages。
5. 发布仓库命名规则：必须使用 用户名.github.io（例如 ming.github.io）。
6. 当前支持主题：Hexo（Landscape、Next、Butterfly、Fluid、Volantis）+ Hugo（PaperMod、LoveIt、Stack、Mainroad、Anatole）。

## 小白使用（推荐）

1. 从 [Release](https://github.com/SpeechlessPanda/BlogForEveryone/releases) 下载并双击安装包。
2. 启动软件后，先看“环境检查”区域：
3. 若缺 Node.js / Git / pnpm，直接点击页面按钮让软件引导下载或自动安装。
4. 完成环境准备后，进行 GitHub 设备码登录。
5. 登录成功后按左侧菜单依次使用：博客创建 -> 主题配置 -> 内容编辑 -> 发布与备份。
6. 发布前先在 GitHub 创建公开仓库，仓库名必须为 用户名.github.io。
7. 发布后到仓库 Settings -> Pages 确认 Source 为 GitHub Actions，再到 Actions 看部署是否为绿色成功。

说明：普通用户不需要提前手动安装环境，软件已内置自动检测与安装引导。

## 本地开发

仅开发者需要下面的命令。

1. 安装依赖：

```bash
pnpm install
```

1. 启动开发模式：

```bash
pnpm run dev
```

1. 构建渲染层：

```bash
pnpm run build:renderer
```

1. 打包安装程序：

```bash
pnpm run package
```

1. 签名打包（需预先配置证书环境变量）：

```bash
pnpm run package:signed
```

1. 发布到 GitHub Release（自动更新所需）：

```bash
pnpm run release
```

## 目录结构

1. `src/main`：Electron 主进程、IPC、服务层。
2. `src/renderer`：Vue 前端界面。
3. `src/shared/data`：主题配置元数据。
4. `docs/plans`：项目计划与迭代说明。
5. `docs/guides`：操作向导文档。

## 文档入口

1. 项目计划书：`docs/plans/2026-03-16-blog-builder-platform-plan.md`
2. GitHub OAuth 教程：`docs/guides/github-oauth-app-setup.md`
3. 发布、签名与自动更新：`docs/guides/release-signing-auto-update.md`
4. 新手发布到 GitHub Pages：`docs/guides/blog-publish-pages-beginner.md`
5. 首次发布 Git 身份配置：`docs/guides/git-first-publish-identity.md`
6. GitHub 提交邮箱与 SSH 配置：`docs/guides/github-email-and-ssh-for-publish.md`

## 当前状态说明

1. 当前版本聚焦 MVP 可用链路：创建 -> 配置 -> 写作 -> 发布 -> 备份/恢复。
2. 统计默认推荐“不蒜子”方案（低门槛、零注册）；可选接入 Umami/GA。
3. 若 `pnpm run dev` 启动失败，优先先执行 `pnpm run build:renderer` 检查前端编译错误。
4. 自动更新依赖 Release 资产（安装包、blockmap、latest.yml）完整上传。
5. 若要减少“未知发布者”提示，需要使用有效代码签名证书执行签名发布。
6. 博客发布仓库与应用发布仓库不是同一个概念：
   - 博客发布仓库：用于你的网站内容，必须是 用户名.github.io
   - 应用发布仓库：用于本软件更新，目前是 SpeechlessPanda/BlogForEveryone

## v0.3.3 更新说明（工程管理与 RSS 体验）

1. 修复“创建工程显示成功但目录为空”问题：当 Hexo/Hugo 初始化失败时，系统不再写入工程记录，并会直接提示失败原因。
2. 工作区管理支持两种删除方式：
   - 仅删除应用内记录（保留本地工程目录）
   - 删除本地目录并移除记录（不可恢复）
3. 工作区列表新增快捷按钮：可一键跳转“主题配置”“发布与备份”页面。
4. 主题配置页与发布页改为“工程驱动主题”：选中工程后自动确定主题，不再重复手选主题。
5. 多处路径输入框支持系统弹窗选择目录/文件，减少手动复制路径出错。
6. RSS 阅读体验增强：
   - 点击文章后即时标记已读并递减未读数
   - 侧边栏 RSS 入口显示总未读提醒，便于快速感知更新

## 教程参考来源

1. GitHub Pages Quickstart：<https://docs.github.com/en/pages/quickstart>
2. What is GitHub Pages：<https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages>
3. GitHub OAuth Device Flow：<https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow>
4. Hexo 部署到 GitHub Pages：<https://hexo.io/docs/github-pages>
5. Hugo 部署到 GitHub Pages：<https://gohugo.io/host-and-deploy/host-on-github-pages/>
6. giscus 官方配置：<https://giscus.app/zh-CN>

## 维护约定

1. 每次新增功能都必须同步更新 README 与项目计划书。
2. README 优先面向小白“怎么用”，开发细节放到文档指南。

***欢迎大家点点 star！***
