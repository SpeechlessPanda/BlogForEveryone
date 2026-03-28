# BlogForEveryone

BlogForEveryone 是一个面向新手的博客搭建与管理桌面应用，目标是用全可视化流程替代命令行操作，让用户可以完成从创建到发布再到迁移恢复的完整链路。

当前技术栈：Electron + Vue 3 + JavaScript（Windows 优先）。

最新发布页：<https://github.com/SpeechlessPanda/BlogForEveryone/releases>

新手发布指南：[docs/guides/blog-publish-pages-beginner.md](docs/guides/blog-publish-pages-beginner.md)

GitHub 登录配置：[docs/guides/github-oauth-app-setup.md](docs/guides/github-oauth-app-setup.md)

发布与自动更新指南：[docs/guides/release-signing-auto-update.md](docs/guides/release-signing-auto-update.md)

## 当前版本与交接状态

1. 当前版本：v1.3.0。
2. 当前支持框架：Hexo、Hugo。
3. 当前支持主题（10 个）：
   - Hexo：Landscape、Next、Butterfly、Fluid、Volantis。
   - Hugo：PaperMod、LoveIt、Stack、Mainroad、Anatole。
4. 发布目标：GitHub Pages（支持 用户名.github.io 根站点，也支持 project pages 仓库；Hugo Actions 工作流会按仓库自动写入对应 baseURL）。
5. 应用更新仓库：SpeechlessPanda/BlogForEveryone（与博客内容仓库不同）。

## 面向用户的完整功能链路（已实现）

### 1. 教程中心

1. 应用内置教程中心，覆盖新手创建、发布、Git 身份、OAuth、签名更新等关键流程。
2. Shell 已按“起步准备 → 搭建博客 → 发布与维护”重组，并持续显示当前工作区、阶段与建议下一步。
3. 用户可从首页直接进入，不依赖外部文档搜索。

### 2. 环境检查与安装引导

1. 启动后自动检查 Node.js / Git / pnpm 是否可用。
2. 缺失时提供一键打开下载页入口。
3. pnpm 安装支持分阶段反馈，并包含镜像回退策略（网络失败时自动切换源重试）。
4. 仓库默认 registry 已切换为 `https://registry.npmjs.org`，避免依赖不稳定镜像导致安装失败。
5. 支持偏好设置（如开机自启动）。

### 3. GitHub 设备码登录

1. 使用 OAuth Device Flow 登录 GitHub。
2. 登录状态在侧边栏底部常驻展示。
3. 登录成功后开放发布、备份、仓库操作相关功能。

### 4. 博客创建（工作区管理）

1. 可视化新建工程：工程名、目录、框架、主题。
2. 创建流程包含进度反馈（校验 -> 初始化 -> 写记录 -> 完成）。
3. 支持目录选择器，减少手填路径错误。
4. 已管理工程支持：
   - 仅删记录。
   - 删除本地并移除记录。
   - 快捷跳转到主题配置、内容编辑、本地预览。
5. 主题选择界面已支持 10 个主题截图卡片预览与点击选中。
6. 当前这 10 张主题预览图是面向产品展示的本地策展素材，来源与替换依据记录在 `docs/design-assets/theme-preview-manifest.md`；它们不再等同于 `e2e-real-workspaces/` 下的 QA 验证截图资产。

### 5. 主题配置

1. 主题配置按工程自动识别（工程驱动主题），避免重复手选。
2. 可编辑通用字段：标题、副标题、描述、社交、统计、评论等。
3. 支持背景图、头像、favicon 的本地文件导入：
   - 自动复制到工程图片目录。
   - 自动写回对应配置路径。
4. 主题配置界面已按“基础信息 → 图片与品牌素材 → 阅读体验 → 可选增强 → 高级配置”重排，降低新手一次看到过多参数的压力。
5. 已实现多主题差异化写入逻辑（如 Next、Stack、Anatole、PaperMod、LoveIt、Mainroad 的特定字段处理），并修正了：
   - Hexo Landscape 使用 `theme_config.banner` / `theme_config.favicon`。
   - Hugo Stack 头像使用 `assets/img` 与相对路径 `img/...` 的写法。
6. 支持配置校验、保存与落盘。

### 6. 本地预览

1. 支持 start / open / restart / stop 全流程操作。
2. 预览端口支持动态探测与冲突回避。
3. 启动成功判定支持 ANSI 日志清洗，降低误判。
4. Windows 下加入预览进程树清理逻辑，降低残留进程导致的“卡住”问题。
5. Hugo 真实工作区预览在 Windows 下会自动准备 Dart Sass 运行 shim，避免主题预览因 Sass 可执行路径缺失而直接失败。

### 7. 内容编辑

1. 支持文章、关于、友链、公告四类内容入口。
2. 创建内容后可调用系统默认编辑器打开。
3. 支持结合工作区与主题上下文执行内容操作。
4. 当前这轮收敛重点是把内容编辑工作台继续对齐到“教程壳层 + 工作区上下文 + 编辑入口连续性”，减少从首页、侧边导航到编辑动作之间的割裂感。
5. 应用已支持全局浅色 / 深色模式联动，Shell、教程首页、工作区页与内容编辑工作台会随当前主题保持一致。

### 8. 发布与备份

1. 支持发布到 GitHub Pages，并能根据仓库类型覆盖用户根站点与 project pages 两种路径（Hugo Actions 构建会使用推断出的 Pages URL/base 路径）。
2. 支持工程备份到独立仓库以及恢复（备份快照包含 `.bfe/subscriptions.bundle.json` 订阅包，便于后续恢复/导入）。
3. 发布与备份页已和工作区联动，减少重复配置。

### 9. 导入恢复

1. 支持导入已有工程并接入后续可视化流程（会尝试从项目配置推断已识别主题；无法识别时保留为 `unknown`）。
2. 可与工作区体系联动继续配置、预览、发布。

### 10. RSS 阅读

1. 支持订阅、拉取、阅读、未读统计。
2. 点击文章可即时标记已读并更新计数。
3. 侧边栏显示 RSS 总未读数。

### 11. 自动更新与安装包发布链路

1. 启动后可检查更新，支持下载后安装。
2. Release 流程当前以 Windows NSIS 安装包为准，资产应包含 `BlogForEveryone Setup x.y.z.exe`、对应 `.exe.blockmap` 与 `latest.yml`。
3. 支持签名发布链路（证书环境变量已预留）。

## 开发与验证能力（已实现）

1. 真实工作区 E2E 脚本已落地：prepare / serve / capture / verify。
2. `scripts/e2e-real-workspace-verify.js` 依赖 `scripts/e2e-real-workspace-prepare.js` 生成的 `e2e-real-workspaces/manifest.json`；在全新工作区或清空验证产物后，应先执行 prepare，再执行 verify。
3. verify 脚本会校验多主题预览与构建结果，并输出结构化报告。
4. 主题截图采集脚本可批量生成 QA 验证截图；它们与产品内使用的 `src/renderer/public/theme-previews/*.png` 是两套不同用途的素材。
5. 已添加 previewService 单元测试，覆盖 Windows 进程树清理关键分支，并修正了跨平台断言。
6. 已添加 `themeConfigHelpers` 测试，覆盖 Landscape 背景/图标路径与 Stack 头像路径规则。
7. 已新增 Electron UI E2E 入口：`pnpm exec playwright test e2e/electron/editorial-workbench.spec.mjs`，使用 Playwright 驱动真实桌面应用，覆盖教程首页、侧边栏导航、内容编辑工作台与弹出编辑动作前后的桌面 UI 路径，并校验关键浅色 / 深色界面表面与 Shell / 页面上下文连续性。
8. `scripts/e2e-real-workspace-prepare.js` 与 `scripts/e2e-real-workspace-verify.js` 继续负责真实工作区验证，重点覆盖实际工作区下的主题预览、构建与发布链路；它与 Playwright 的桌面 UI Journey 互补，前者验证真实工程结果，后者验证桌面壳层、页面跳转与工作区连续性。
9. 当前发布脚本会显式使用 Windows 目标打包（`electron-builder --win`），避免在 Linux/WSL 环境下默认产出 AppImage / Snap 资产。
10. 当前最新一轮真实工作区验证已在 10 个主题上跑通 prepare + verify，全量结果可由 `scripts/e2e-real-workspace-prepare.js` 与 `scripts/e2e-real-workspace-verify.js` 重新生成与复核。

## 本地开发命令

```bash
pnpm install
pnpm run dev
pnpm run build:renderer
pnpm run test:e2e:ui
pnpm run package
pnpm run package:signed
pnpm run release
```

如果 `pnpm run dev` 启动失败，按下面顺序排查：

1. 先执行 `pnpm install`，确认本地依赖已完整安装。
2. 再执行 `pnpm exec concurrently --version` 与 `pnpm exec wait-on --help`，确认本地 dev 依赖可解析。
3. 执行 `netstat -ano | findstr :5173`，确认是否有残留 Vite / Electron 进程占用了端口。
4. 如果 5173 被旧进程占用，优先用 `cmd /c taskkill /PID <PID> /T /F` 清理，再重试 `pnpm run dev`。
5. 若仍失败，再执行 `pnpm run build:renderer` 查看前端编译错误。

详细 checklist 见：[docs/guides/dev-runtime-troubleshooting.md](docs/guides/dev-runtime-troubleshooting.md)

补充说明：仓库当前默认使用 npm 官方源；如果你的 shell 显式设置了代理或自定义 registry，请先确认它不会覆盖 `.npmrc`。

## 目录结构

1. src/main：Electron 主进程、IPC、服务层。
2. src/renderer：Vue 前端。
3. src/shared/data：主题配置元数据。
4. docs/plans：计划与交接文档。
5. docs/guides：操作教程。
6. scripts：工程准备、验证、截图、发布辅助脚本。

## 交接文档入口

1. 项目计划书：[docs/plans/2026-03-16-blog-builder-platform-plan.md](docs/plans/2026-03-16-blog-builder-platform-plan.md)
2. 当前待处理问题清单：[docs/plans/2026-03-22-open-issues-handover.md](docs/plans/2026-03-22-open-issues-handover.md)
3. 新手发布指南：[docs/guides/blog-publish-pages-beginner.md](docs/guides/blog-publish-pages-beginner.md)
4. OAuth 配置指南：[docs/guides/github-oauth-app-setup.md](docs/guides/github-oauth-app-setup.md)
5. 发布与自动更新指南：[docs/guides/release-signing-auto-update.md](docs/guides/release-signing-auto-update.md)
6. 本地开发运行排障：[docs/guides/dev-runtime-troubleshooting.md](docs/guides/dev-runtime-troubleshooting.md)

## 维护约定

1. 新功能必须同步更新 README 与项目计划书。
2. README 用于说明已实现能力与使用路径；详细设计放在 docs/plans 和 docs/guides。
3. .qa 与 e2e-real-workspaces 目录默认不纳入代码版本追踪。
