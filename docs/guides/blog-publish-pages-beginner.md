# 博客发布到 GitHub Pages（详细新手版）

## 1. 先准备发布仓库

1. 登录 GitHub，点击 New repository。
2. Repository name 必须填写：用户名.github.io。
3. 仓库可见性建议先选 Public。
4. 创建完成后，复制仓库地址。

示例：

- 用户名是 ming
- 仓库名必须是 ming.github.io
- 仓库地址示例：<https://github.com/ming/ming.github.io.git>

检查点：

1. 仓库名与用户名完全一致（忽略大小写）。
2. 仓库地址末尾可带 .git。

## 2. 在软件中填写发布信息

1. 打开 发布与备份 页面。
2. 选择当前工程。
3. 在 GitHub 仓库地址 输入完整仓库 URL。
4. 点击 一键发布。

检查点：

1. 如果仓库名不是 用户名.github.io，软件会直接提示并阻止发布。
2. 发布日志中应看到 git push 成功信息。

## 3. 在 GitHub 开启 Pages

1. 进入仓库 Settings -> Pages。
2. 在 Source 里选择 GitHub Actions。
3. 保存后进入 Actions 页面等待 Deploy 工作流运行。

检查点：

1. Actions 列表里 Deploy 工作流是绿色成功。
2. 进入最新一次运行可看到 deploy step 完成。

## 4. 验证访问地址

1. 用户站点访问地址固定为：<https://用户名.github.io/>
2. 打开地址后如果是旧内容，先强制刷新。
3. 发布刚完成时可能需要 1-10 分钟生效。

## 5. 常见错误

1. 仓库名填成 blog 或 my-site。
处理：改为 用户名.github.io。

2. Actions 失败。
处理：打开失败任务日志，从第一条报错开始修复。

3. 发布成功但 404。
处理：检查 Pages Source 是否是 GitHub Actions，并等待几分钟再访问。

4. 地址打开是旧页面。
处理：重新发布一次，并清浏览器缓存。

## 6. 官方参考

1. GitHub Pages Quickstart：

<https://docs.github.com/en/pages/quickstart>

1. What is GitHub Pages（站点类型与地址规则）：

<https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages>

1. Hexo GitHub Pages：

<https://hexo.io/docs/github-pages>

1. Hugo Host on GitHub Pages：

<https://gohugo.io/host-and-deploy/host-on-github-pages/>
