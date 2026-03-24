# 安装包初始化调查记录（2026-03-22，2026-03-23补充）

## 目标

确认 Windows 目标的 `pnpm run package:signed` 是否保持正确发布意图，并区分：

1. 本地可复现、可修复的发布链路问题；
2. 仍需在真实 Windows 安装环境中验证的安装器初始化问题。

## 本地复现命令

```bash
pnpm run package:signed
```

Windows 侧计划验证命令（当前 Linux/WSL 环境无法直接执行）：

```powershell
Start-Process -FilePath ".\dist\BlogForEveryone Setup 1.1.0.exe" -Wait
```

## 初次复现结果（修复前）

在当前 Linux/WSL 环境中，旧版 `pnpm run package:signed` 因为没有显式指定 Windows 目标，会先走到 `electron-builder` 的 Linux 打包阶段，而不是项目真正要交付的 Windows NSIS 安装器链路。

当时的直接失败信号是：

```text
Error: image .../build/icon.ico must be at least 256x256
```

调用栈来自：

- `LinuxPackager.resolveIcon`
- `LinuxTargetHelper.computeDesktopIcons`

## 根因判断

这不是“Windows 安装器初始化偶发失败”的直接证据，而是一个更早、更确定的发布路径偏差：

1. `package.json` 的发布脚本调用了裸 `electron-builder`；
2. 在 Linux/WSL 中，这会默认走当前平台目标；
3. 于是流程先落到 Linux 打包分支，并触发 Linux 图标要求；
4. 这会把 release 资产带偏成 AppImage / Snap，而不是 `Setup.exe` / `.blockmap` / `latest.yml`。

## 已确认修复

已应用最小修复，使发布脚本回到 Windows NSIS 优先：

1. `package.json`
   - `package` 改为 `electron-builder --win`
   - `package:signed` 改为 `electron-builder --win --publish never`
   - `release` 改为 `electron-builder --win --publish always`
2. `scripts/generate-win-icon.js`
   - 回到仅生成 Windows 所需的 `.ico` 输出
3. 移除 `build.linux.icon`
   - 避免继续把发布语义引向 Linux 资产

## 修复后应当验证什么

修复后的关键验证目标不再是“Linux 包能否生成”，而是：

1. 发布脚本是否明确要求 Windows NSIS 输出；
2. 是否能够产出：
   - `BlogForEveryone Setup 1.1.0.exe`
   - `BlogForEveryone Setup 1.1.0.exe.blockmap`
   - `latest.yml`
3. 是否能在真实 Windows 环境中启动安装向导并完成首次运行。

## 当前仍未完成的验证

当前环境仍然**不能直接证明 Windows NSIS 安装器初始化可跑通**，原因是：

1. 当前运行环境为 Linux/WSL；
2. 即使脚本已经改为 `--win`，这里也未必具备完整的 Windows 交叉打包前置条件（如 Wine / Docker+Wine 等）；
3. `Start-Process .\dist\BlogForEveryone Setup 1.1.0.exe` 这一步仍需在真实 Windows 环境执行。

## 结论

本轮已确认并修复一个确定性的发布流程偏差：**release 脚本在 Linux/WSL 下默认走当前平台，导致产出 Linux 资产而不是 Windows NSIS 安装包**。

“安装器初始化偶发失败”这一原始问题在当前 Linux/WSL 环境中**仍不能直接证伪或证实**。脚本现在已经回到 Windows 目标，但真实安装与首次启动验证仍然必须在 Windows 环境完成。

## 后续建议

1. 在真实 Windows 验证环境中运行：

```powershell
Start-Process -FilePath ".\dist\BlogForEveryone Setup 1.1.0.exe" -Wait
```

2. 记录以下信息：
   - 是否成功进入安装向导；
   - 若失败，失败发生在：启动前 / 向导初始化 / 文件展开 / 首次启动；
   - 对应报错文案、截图、事件查看器日志（若有）。
3. 如果 Windows 安装器仍失败，再基于该环境中的真实失败签名继续定位，而不要把 Linux 默认打包行为和 Windows 安装初始化问题混在一起。
