# GitHub OAuth App 创建向导（设备码登录）

## 你卡住的那一步先看这里

你发的页面是 GitHub 的设备授权页面，这里要求输入“设备码（user code）”。

1. 这个码不是 GitHub 发邮件给你的，也不是仓库名。
2. 这个码来自应用发起设备码登录时返回的 user code。
3. 如果浏览器打开的是 complete 链接，通常不需要手动填码；如果进入了你截图这个页面，就要手动填码。

## A. 在 GitHub 创建 OAuth App

1. 打开 GitHub 右上角头像 -> Settings。
2. 左侧拉到底部 -> Developer settings。
3. 进入 OAuth Apps -> New OAuth App。
4. 填写如下：
   - Application name: BlogForEveryone（可自定义）
   - Homepage URL: http://localhost
   - Authorization callback URL: http://localhost
5. 点击 Register application。
6. 创建成功后复制 Client ID。

## B. 在软件里填什么

1. 打开应用首页的 GitHub 登录（OAuth 设备码）区域。
2. 在“GitHub OAuth Client ID”输入框粘贴刚才的 Client ID（形如 Iv1.xxxxxxxx）。
3. 点击“设备码登录”。
4. 浏览器会打开 GitHub 授权页。

## C. 如果出现“输入设备码”页面

1. 在应用内查看登录日志区域（设备码登录请求返回时会展示 user code）。
2. 把 user code 输入到 GitHub 页面中。
3. 点击 Continue 并确认授权。
4. 回到应用，点“刷新登录状态”，应显示当前登录用户名。

## D. 常见问题

1. 提示 Bad verification code：重新点击“设备码登录”，用最新 user code。
2. 提示设备码过期：重新发起设备码登录。
3. 一直 pending：确认 GitHub 页面已点击授权。
4. 登录成功但应用无状态：点击“刷新登录状态”，或重新打开应用。
