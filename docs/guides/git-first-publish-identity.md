# 首次发布前的 Git 身份配置指南

## 为什么会卡在首次发布

Git 在提交时必须有 user.name 和 user.email。
如果未设置，会导致首次发布时 commit 失败。

官方参考：

1. Git First-Time Setup（Your Identity）：<https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup>

## 在本软件里的推荐做法

1. 进入 发布与备份 页面。
2. 填写 Git 提交用户名（建议与你的 GitHub 用户名一致）。
3. 填写 Git 提交邮箱（建议使用你的 GitHub 邮箱或 noreply 邮箱）。
4. 点击一键发布。
5. 软件会自动执行当前工程级别的 Git 配置：
   - git config user.name "你的用户名"
   - git config user.email "你的邮箱"

说明：软件默认写入当前工程（local config），不会影响你机器上其他仓库。

## 如果你想手动配置（终端）

在工程目录执行：

1. git config user.name "你的用户名"
2. git config user.email "你的邮箱"
3. git config --list --show-origin

如果你希望全局生效，可改为 --global：

1. git config --global user.name "你的用户名"
2. git config --global user.email "你的邮箱"

## 常见问题

1. 邮箱填什么
建议优先使用 GitHub 绑定邮箱；如果不想公开真实邮箱，可使用 GitHub noreply 邮箱。

2. 提示权限不足
请确认工程目录可写，或将工程迁移到非系统受限目录（如 D:/blogs）。

3. 修改后还是失败
先看发布日志里的第一条 git 错误，再逐条处理。

## 相关文档

1. Git 配置与身份：<https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup>
2. GitHub Pages Quickstart：<https://docs.github.com/en/pages/quickstart>
