# 安装包初始化调查记录（2026-03-22）

## 目标

确认 `pnpm run package:signed` 是否能稳定走通本地打包链路，并区分：

1. 本地可复现、可修复的问题；
2. 仍需在 Windows 安装环境中验证的初始化问题。

## 本地复现命令

```bash
pnpm run package:signed
```

Windows 侧计划验证命令（当前 Linux/WSL 环境无法直接执行）：

```powershell
Start-Process -FilePath ".\dist\BlogForEveryone Setup 1.1.0.exe" -Wait
```

## 初次复现结果（修复前）

在当前 WSL/Linux 环境中，`pnpm run package:signed` 会在 `electron-builder` 的 Linux 打包阶段失败，未进入 Windows 安装器验证阶段。

关键报错：

```text
Error: image .../build/icon.ico must be at least 256x256
```

调用栈来自：

- `LinuxPackager.resolveIcon`
- `LinuxTargetHelper.computeDesktopIcons`

## 根因判断

这不是“安装器初始化偶发失败”的直接证据，而是一个更早、更确定的本地打包配置问题：

1. `package.json` 只配置了 Windows `build.win.icon = build/icon.ico`；
2. Linux 打包阶段仍需要可用于 Linux 平台的图标输入；
3. 现有 `generate-win-icon.js` 只生成 `.ico`，没有显式 Linux PNG 图标；
4. 因此 `electron-builder` 在 Linux/WSL 下会先因为图标配置失败，导致后续安装器路径根本无法验证。

## 已确认修复

已应用最小修复：

1. `scripts/generate-win-icon.js`
   - 除 `build/icon.ico` 外，额外生成 `build/icon.png`（512x512）；
2. `package.json`
   - 新增 `build.linux.icon = "build/icon.png"`；
   - 保留 `build.win.icon = "build/icon.ico"` 供 NSIS/Windows 使用。

## 修复后验证结果

再次运行：

```bash
pnpm run package:signed
```

本地结果：

1. 图标阶段不再报 `build/icon.ico must be at least 256x256`；
2. `electron-builder` 已成功产出 Linux 制品：
   - `dist/BlogForEveryone-1.1.0.AppImage`
   - `dist/blog-for-everyone_1.1.0_amd64.snap`
   - `dist/linux-unpacked/`
3. 说明“本地打包链在 Linux 图标配置层面”的阻塞已解除。

## 当前仍未完成的验证

当前环境仍然**不能直接验证 Windows NSIS 安装器初始化**，原因是：

1. 当前运行环境为 Linux/WSL；
2. `pnpm run package:signed` 在这里默认产出的是 Linux 包，而不是 Windows `Setup.exe`；
3. 因此 `Start-Process .\dist\BlogForEveryone Setup 1.1.0.exe` 这一步仍需在真实 Windows 验证环境执行。

## 结论

本轮已确认并修复一个确定性的本地打包阻塞：**Linux 打包图标配置错误**。

“安装器初始化偶发失败”这一原始问题在当前 Linux/WSL 环境中**尚不能直接证伪或证实**，因为本地只能走到 Linux 产物生成，无法直接启动 Windows NSIS 安装器。

## 后续建议

1. 在 Windows 验证环境中运行：

```powershell
Start-Process -FilePath ".\dist\BlogForEveryone Setup 1.1.0.exe" -Wait
```

2. 记录以下信息：
   - 是否成功进入安装向导；
   - 若失败，失败发生在：启动前 / 向导初始化 / 文件展开 / 首次启动；
   - 对应报错文案、截图、事件查看器日志（若有）。
3. 如果 Windows 安装器仍失败，再基于该环境中的真实失败签名继续定位，而不要把 Linux 图标配置问题和 Windows 安装初始化问题混在一起。
