# 交接问题清单（2026-03-22 更新）

本文档用于明确当前版本中仍然建议后续继续跟进的问题，并记录本轮已经确认或修正的事项，避免下一位开发者被旧结论误导。

## 本轮已确认或已修正

1. “所有主题小组件都异常”这一条结论已过期：实际复核后，Hugo Stack 的 archives / tag-cloud 组件数据写入与渲染是工作的，不应再按“全局小组件故障”处理。
2. Hexo Landscape 背景图 / favicon 的问题已定位为错误配置键，并已按 `theme_config.banner` / `theme_config.favicon` 修正。
3. Hugo Stack 头像问题已定位为资源目录与路径格式不匹配，并已改为 `assets/img` + `img/...` 的写法。
4. 默认安装走 npmmirror 导致依赖安装失败的问题已修正为 npm 官方源。
5. `previewService.test.js` 的失败属于 Linux / Windows 平台断言不一致，已修正为跨平台预期。

## 1. 安装包初始化偶发失败

1. 发布后的安装包在初始化软件时仍有概率失败。
2. 需要继续定位失败场景、触发条件，以及是否与首次启动资源准备或权限初始化有关。

## 2. 主题选择界面图片状态已复核

1. 当前仓库中的 10 张 `src/renderer/public/theme-previews/*.png` 已与 `e2e-real-workspaces/screenshots/*.png` 逐字节比对，结果一致。
2. 对应的 `e2e-real-workspaces/verify-report.json` 显示最近一轮 10/10 主题验证通过，因此“预览图尚未替换”的旧结论不再适用于当前代码树。
3. 后续只有在主题真实表现发生明显变化时，才需要重新运行截图链并替换素材；否则无需为“替换预览图”单独再开一轮工作。

## 3. 前端视觉重构仍可继续迭代

1. 当前已经完成第一轮 guided workflow shell + 页面层级整理，但动画、微交互与细节统一性仍有继续打磨空间。
2. 后续如果继续视觉升级，应在现有 workflow shell 基础上做增量优化，而不是回退到扁平 tab 工具柜结构。

## 4. 安装包初始化仍需 Windows 环境补充验证

1. 本轮已确认并修复 Linux/WSL 本地打包链中的确定性阻塞：`package:signed` 原先会因 Linux 图标配置错误提前失败，现已通过新增 `build/icon.png` + `build.linux.icon` 修正。
2. 当前 Linux/WSL 环境只能验证 Linux 制品产出，无法直接验证 Windows NSIS 安装器初始化；对应调查记录见 `docs/plans/2026-03-22-installer-init-investigation.md`。
3. 若仍需关闭“安装包初始化偶发失败”这一问题，下一步必须在真实 Windows 环境里运行 `dist/BlogForEveryone Setup 1.1.0.exe` 并记录失败签名。

## 5. 测试脚本有效性仍需持续加强

1. 当前虽然已补上 preview cleanup 与 theme config helper 的回归测试，但主题配置、预览渲染、发布初始化相关链路仍需要更贴近真实场景的断言。
2. 后续重点应放在主题配置结果、预览输出、发布初始化与真实工作区 fixture 验证，而不是只增加浅层单元测试数量。
