# 发布、代码签名与自动更新指南

注意：本指南是“桌面应用本身”的发布流程，不是博客内容发布流程。
博客发布请看：docs/guides/blog-publish-pages-beginner.md

最新发布页：<https://github.com/SpeechlessPanda/BlogForEveryone/releases>

## 1. 自动更新机制

1. 应用启动后会自动检查 GitHub Release 是否有新版本。
2. 发现新版本后会在后台自动下载。
3. 下载完成后，界面显示“立即重启并安装”，也支持退出应用时自动安装。
4. 自动更新依赖 `latest.yml` 与安装包（`.exe`）一起发布到 Release。

## 2. 发布命令

1. 普通发布（不自动上传）：

```bash
pnpm run package
```

当前脚本会显式构建 Windows NSIS 产物，而不是跟随当前平台默认生成 Linux 包。

1. 自动上传到 GitHub Release（需要 `GH_TOKEN`）：

```bash
pnpm run release
```

## 3. 代码签名（减少 Windows 安全提示）

未签名安装包会出现“未知发布者”提示。要减少此提示，需要配置有效代码签名证书。

### 3.1 推荐环境变量

1. `CSC_LINK`：证书文件地址（可为本地路径或 base64）。
2. `CSC_KEY_PASSWORD`：证书密码。
3. `GH_TOKEN`：用于发布 Release（当使用 `pnpm run release` 时）。

在 CI（GitHub Actions）中，推荐使用 `production-release` 环境下的环境级 Secrets：

- `BFE_CODESIGN_PFX_B64`：PFX 证书文件的 Base64 内容
- `BFE_CODESIGN_PFX_PASSWORD`：PFX 证书密码

工作流会在 Runner 临时目录还原证书，并映射为：

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

### 3.2 签名打包（已强制校验）

```bash
pnpm run package:signed
```

`package:signed` 与 `release` 现在都会先执行 `verify:windows-signing-env`：

- 必须提供 `CSC_LINK`
- 必须提供 `CSC_KEY_PASSWORD`

缺少任一变量会直接失败，避免误发未签名安装包。

### 3.3 签名发布

```bash
pnpm run release
```

## 4. GitHub 仓库要求

1. Release 需要发布在 `SpeechlessPanda/BlogForEveryone`。
2. 每个版本需要对应 tag（例如 `v0.1.1`）。
3. Release 资产建议至少包含：
   - `BlogForEveryone-Setup x.y.z.exe`
   - `BlogForEveryone-Setup x.y.z.exe.blockmap`
   - `latest.yml`

4. 推荐启用分支与标签保护：
   - `main` 开启 PR 评审和状态检查
   - `v*` 标签开启保护规则（限制创建/更新/删除）

## 5. 与博客发布仓库的区别

1. 应用发布仓库：SpeechlessPanda/BlogForEveryone（用于安装包与自动更新）。
2. 博客发布仓库：必须是 用户名.github.io（用于你的网站内容）。
3. 两者用途不同，不要混用。

## 6. 验证清单

1. 安装当前版本后启动应用。
2. 发布更高版本到 Release。
3. 在旧版本中点击“立即检查更新”。
4. 确认看到下载进度并可“立即重启并安装”。

## 7. Windows 警告最小化建议（SmartScreen）

1. 使用同一发行者证书持续签名（避免频繁切换证书主体）。
2. 保持稳定下载渠道（优先 GitHub Release 官方资产链接）。
3. 证书签名时启用时间戳（RFC3161）以保证证书过期后签名仍可验证。
4. 只发布签名构建（`package:signed` / `release`），不要把本地未签名包用于正式分发。

## 8. CI 自动发布流程（推荐）

仓库当前采用两条工作流：

1. `.github/workflows/ci.yml`
   - 触发：`main` 的 push / pull_request
   - 核心命令：`pnpm run verify:premerge`
   - 目的：合并前持续验证（lint/test/build/UI e2e）

2. `.github/workflows/release-windows.yml`
   - 触发：`v*` tag push，或手动 `workflow_dispatch`
   - 环境：`production-release`（可配置审批）
   - 核心流程：
     - 校验 tag 与 `package.json` 版本一致
     - 还原签名证书并校验 `verify:windows-signing-env`
     - 执行 `pnpm run release`（内含 `verify:release`）
     - 对产物执行 `signtool verify`
     - 上传产物并生成 provenance attestation

发布前脚本链路（当前）：

- `release` -> `verify:release` -> `verify:git-clean` + `verify:premerge` + `package:signed`
- 可选完整验证：`verify:release:full` -> `verify:release` + `test:e2e:workspace`

这意味着：

1. 工作区不干净会直接阻断发布。
2. 未配置签名变量会直接阻断发布。
3. 未通过 premerge 测试/构建会直接阻断发布。
4. 真实工作区验证建议在发布前单独执行 `pnpm run verify:release:full`，但不再作为发布强门禁，避免外部网络/工具波动反复阻断正式发版。
