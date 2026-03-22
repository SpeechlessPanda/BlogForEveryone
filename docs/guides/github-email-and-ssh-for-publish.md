# GitHub 提交邮箱与 SSH 配置（发布前必看）

本文解决三个高频问题：

1. 提交邮箱怎么配，是否必须用真实邮箱。
2. 发布是否必须 SSH 公钥。
3. Hexo/Hugo 发布到 GitHub Pages 可以用哪些方式。

## 1. 提交邮箱怎么选

Git 提交邮箱可以用两类：

1. 真实邮箱：提交记录会公开该邮箱，隐私性较弱。
2. GitHub noreply 邮箱：隐私更好，推荐。

GitHub 官方说明中，noreply 常见格式为：

1. ID+用户名形式：`ID+USERNAME@users.noreply.github.com`
1. 旧账号可能是：`USERNAME@users.noreply.github.com`

你可以在 GitHub 的 Settings -> Emails 页面启用“Keep my email address private”，并获取 noreply 邮箱。

## 2. 是否必须 SSH 公钥

不一定。取决于你用哪种仓库地址：

1. HTTPS 仓库地址：不强制 SSH 公钥。可使用浏览器登录凭据管理器或 PAT。
1. SSH 仓库地址（`git@github.com:...`）：必须配置 SSH 公钥。

结论：

1. 想少折腾，可先用 HTTPS。
2. 想长期稳定免输密码，建议配置 SSH。

## 3. Windows 上配置 SSH（推荐做法）

1. 检查是否已有密钥：

```bash
ls -al ~/.ssh
```

1. 如果没有，生成 ed25519 密钥：

```bash
ssh-keygen -t ed25519 -C "你的GitHub邮箱"
```

1. 启动 ssh-agent（PowerShell）：

```powershell
Get-Service -Name ssh-agent | Set-Service -StartupType Manual
Start-Service ssh-agent
```

1. 添加私钥：

```bash
ssh-add c:/Users/你的用户名/.ssh/id_ed25519
```

1. 复制公钥内容并添加到 GitHub：

```bash
cat ~/.ssh/id_ed25519.pub
```

GitHub 页面：Settings -> SSH and GPG keys -> New SSH key。

## 4. 发布方式建议（本软件内）

### 方式 A：GitHub Actions（推荐，Hexo/Hugo 都支持）

1. 软件会写入 workflow。
2. 你点击“开始发布”后，首次会做 Git 推送。
3. 适合大多数用户。

### 方式 B：Hexo 命令发布（仅 Hexo）

1. 软件会自动安装 hexo-deployer-git。
2. 软件会写入 _config.yml 的 deploy 配置。
3. 执行 hexo clean + hexo generate + hexo deploy。

## 5. 你需要提供给我哪些信息（我帮你配置）

把下面信息发给我，我可以直接给你生成准确配置：

1. 你的 GitHub 用户名。
2. 你要发布到的仓库地址（HTTPS 或 SSH）。
3. 你希望使用的提交邮箱（真实邮箱或 noreply）。
4. 你选择的发布方式（Actions 或 Hexo 命令发布）。
5. 如果用 SSH：请确认公钥是否已添加到 GitHub（是/否）。

## 参考资料

1. GitHub: 检查现有 SSH 密钥
2. GitHub: 生成 SSH 密钥并加入 ssh-agent
3. GitHub: 设置提交邮箱
4. GitHub: 电子邮件地址参考（noreply）
5. Hexo: 发布到 GitHub Pages
6. Hugo: Host on GitHub Pages
