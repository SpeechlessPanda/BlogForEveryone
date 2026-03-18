# BlogForEveryone

面向所有想要输出自己想法观点的小白的博客搭建桌面平台，技术栈为 Electron + Vue + JavaScript。

## 产品定位

1. 目标用户：不熟悉命令行、希望全程可视化操作、迫切想要输出内容的博客新手。
2. 首版平台：Windows。
3. 当前支持框架：Hexo、Hugo。
4. 默认发布目标：GitHub Pages。
5. 当前支持主题：Hexo（Landscape、Next、Butterfly、Fluid、Volantis）+ Hugo（PaperMod、LoveIt、Stack、Mainroad、Anatole）。

## 小白使用（推荐）

1. 从 [Release](https://github.com/SpeechlessPanda/BlogForEveryone/releases) 下载并双击安装包。
2. 启动软件后，先看“环境检查”区域：
3. 若缺 Node.js / Git / pnpm，直接点击页面按钮让软件引导下载或自动安装。
4. 完成环境准备后，进行 GitHub 设备码登录。
5. 登录成功后按左侧菜单依次使用：博客创建 -> 主题配置 -> 内容编辑 -> 发布与备份。

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

## 当前状态说明

1. 当前版本聚焦 MVP 可用链路：创建 -> 配置 -> 写作 -> 发布 -> 备份/恢复。
2. 统计默认推荐“不蒜子”方案（低门槛、零注册）；可选接入 Umami/GA。
3. 若 `pnpm run dev` 启动失败，优先先执行 `pnpm run build:renderer` 检查前端编译错误。
4. 自动更新依赖 Release 资产（安装包、blockmap、latest.yml）完整上传。
5. 若要减少“未知发布者”提示，需要使用有效代码签名证书执行签名发布。

## 维护约定

1. 每次新增功能都必须同步更新 README 与项目计划书。
2. README 优先面向小白“怎么用”，开发细节放到文档指南。

***欢迎大家点点 star！***
