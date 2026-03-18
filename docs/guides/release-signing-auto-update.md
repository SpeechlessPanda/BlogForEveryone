# 发布、代码签名与自动更新指南

注意：本指南是“桌面应用本身”的发布流程，不是博客内容发布流程。
博客发布请看：docs/guides/blog-publish-pages-beginner.md

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

### 3.2 签名打包

```bash
pnpm run package:signed
```

### 3.3 签名发布

```bash
pnpm run release
```

## 4. GitHub 仓库要求

1. Release 需要发布在 `SpeechlessPanda/BlogForEveryone`。
2. 每个版本需要对应 tag（例如 `v0.1.1`）。
3. Release 资产建议至少包含：
   - `BlogForEveryone Setup x.y.z.exe`
   - `BlogForEveryone Setup x.y.z.exe.blockmap`
   - `latest.yml`

## 5. 与博客发布仓库的区别

1. 应用发布仓库：SpeechlessPanda/BlogForEveryone（用于安装包与自动更新）。
2. 博客发布仓库：必须是 用户名.github.io（用于你的网站内容）。
3. 两者用途不同，不要混用。

## 6. 验证清单

1. 安装当前版本后启动应用。
2. 发布更高版本到 Release。
3. 在旧版本中点击“立即检查更新”。
4. 确认看到下载进度并可“立即重启并安装”。
