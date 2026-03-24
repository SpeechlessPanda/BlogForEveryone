# 博客发布到 GitHub Pages（详细新手版）

## 1. 先准备发布仓库

1. 登录 GitHub，点击 New repository。
2. Repository name 可以是两种：
   - 用户站点：`用户名.github.io`
   - project pages：任意仓库名（例如 `my-blog`）
3. 仓库可见性建议先选 Public。
4. 创建完成后，复制仓库地址。

示例：

- 用户名是 ming
- 用户站点仓库：`ming.github.io`
- project pages 仓库：`my-blog`
- 仓库地址示例：<https://github.com/ming/ming.github.io.git> 或 <https://github.com/ming/my-blog.git>

检查点：

1. 仓库地址必须是完整 GitHub URL，末尾可带 `.git`。
2. 如果你想把站点放在根域名，仓库名才需要与用户名一致。

## 2. 在软件中填写发布信息

1. 打开 发布与备份 页面。
2. 选择当前工程。
3. 在 GitHub 仓库地址 输入完整仓库 URL。
4. 点击 一键发布。

检查点：

1. 软件会根据仓库类型自动推断最终 Pages 地址。
2. Hugo 工程的一键发布会生成 GitHub Actions 工作流，并把推断出的 Pages URL 写入 `hugo --baseURL ...`，用于 project pages 子路径。
3. 发布日志中应看到 git push 成功信息。

## 3. 在 GitHub 开启 Pages

1. 进入仓库 Settings -> Pages。
2. 在 Source 里选择 GitHub Actions。
3. 保存后进入 Actions 页面等待 Deploy 工作流运行。

检查点：

1. Actions 列表里 Deploy 工作流是绿色成功。
2. 进入最新一次运行可看到 deploy step 完成。

## 4. 验证访问地址

1. 用户站点访问地址固定为：<https://用户名.github.io/>
2. project pages 访问地址通常为：<https://用户名.github.io/仓库名/>
3. 打开地址后如果是旧内容，先强制刷新。
4. 发布刚完成时可能需要 1-10 分钟生效。

## 5. 常见错误

1. 访问地址与预期不一致。
处理：先确认你发布的是用户站点还是 project pages，再按对应 URL 访问。

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
