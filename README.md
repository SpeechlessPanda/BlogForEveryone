# BlogForEveryone

面向新手的博客搭建桌面平台，技术栈为 Electron + Vue + JavaScript。

## 产品定位

1. 目标用户：不熟悉命令行、希望全程可视化操作的博客新手。
2. 首版平台：Windows。
3. 当前支持框架：Hexo、Hugo。
4. 默认发布目标：GitHub Pages。

## 当前已实现功能

1. 可视化创建 Hexo/Hugo 博客工程，并支持依赖安装流程。
2. 主题配置可视化编辑：基础信息、评论、统计、主题专属字段、全部展开字段。
3. 背景图与图标支持本地文件转存到工程图片目录（默认 `source/img` 或 `static/img`），自动回填可用路径。
4. 内容编辑支持四类内容：新博客文章、关于页、友链页、公告页；可自动创建 Markdown 并调用系统默认编辑器。
5. 发布与备份：支持发布到 GitHub 仓库，支持本地备份与可选推送到备份仓库。
6. 导入恢复：支持导入现有工程并恢复 RSS 订阅快照。
7. RSS 阅读：支持订阅、同步、通知、导出与导入。
8. GitHub OAuth 设备码登录：应用内展示设备码并完成授权。
9. 环境检查与安装引导：缺失 Git/Node/pnpm 时给出下载与自动安装入口。
10. 教程中心目录化：按模块分区展示详细步骤和注意事项。
11. 自动更新：应用启动自动检查 Release 新版本，后台下载并支持一键重启安装。
12. 代码签名发布流程：支持通过证书环境变量进行签名打包，降低安全提示。

## 环境要求

1. Node.js 20+
2. Git
3. pnpm
4. Hexo CLI 与 Hugo（二选一或都安装）

Hexo 安装示例：

```bash
pnpm add -g hexo-cli
```

Hugo 安装示例（Windows）：

```bash
choco install hugo-extended -y
```

## 本地开发

1. 安装依赖：

```bash
pnpm install
```

2. 启动开发模式：

```bash
pnpm run dev
```

3. 构建渲染层：

```bash
pnpm run build:renderer
```

4. 打包安装程序：

```bash
pnpm run package
```

5. 签名打包（需预先配置证书环境变量）：

```bash
pnpm run package:signed
```

6. 发布到 GitHub Release（自动更新所需）：

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

## 当前状态说明

1. 当前版本聚焦 MVP 可用链路：创建 -> 配置 -> 写作 -> 发布 -> 备份/恢复。
2. 统计默认推荐“不蒜子”方案（低门槛、零注册）；可选接入 Umami/GA。
3. 若 `pnpm run dev` 启动失败，优先先执行 `pnpm run build:renderer` 检查前端编译错误。
4. 自动更新依赖 Release 资产（安装包、blockmap、latest.yml）完整上传。
5. 若要减少“未知发布者”提示，需要使用有效代码签名证书执行签名发布。
