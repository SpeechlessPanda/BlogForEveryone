# GitHub OAuth App 创建与设备码登录（新手版）

## 0. 先理解 3 个概念

1. Client ID：你在 GitHub OAuth App 页面拿到的应用标识，形如 Iv1.xxxxx。
2. User code（设备码）：登录时临时生成，用户在网页上输入。
3. Access token：授权成功后由应用保存并用于调用 GitHub API。

## 1. 在 GitHub 创建 OAuth App

1. 进入 GitHub -> 头像 -> Settings。
2. 打开 Developer settings -> OAuth Apps -> New OAuth App。
3. 推荐填写：

   - Application name：BlogForEveryone（可自定义）
   - Homepage URL：<https://github.com/你的用户名>
   - Authorization callback URL：<http://localhost>

4. 点击 Register application。
5. 在应用设置页开启 Enable Device Flow。
6. 复制 Client ID。

检查点：

1. 页面上能看到 Client ID。
2. Enable Device Flow 已勾选。

## 2. 在软件中执行设备码登录

1. 打开软件的登录区域。
2. 粘贴 Client ID。
3. 点击设备码登录。
4. 浏览器会跳到 GitHub 授权页面。

检查点：

1. 软件中出现“当前设备码”。
2. 浏览器能打开 github.com/login/device 或自动完成授权页。

## 3. 如果浏览器要求输入设备码

1. 把软件里显示的设备码复制到网页输入框。
2. 点击 Continue。
3. 点击 Authorize 授权。
4. 回到软件点击刷新登录状态。

检查点：

1. 侧边栏显示登录用户名。
2. 可访问需要登录权限的页面。

## 4. 常见错误与处理

1. incorrect_client_credentials：Client ID 填错，回 OAuth App 页面重新复制。
2. device_flow_disabled：未开启 Enable Device Flow。
3. Bad verification code：设备码过期或输错，重新发起登录拿新码。
4. authorization_pending：授权页面还没确认，继续在浏览器完成授权。
5. slow_down：轮询太快，等待几秒后重试。

## 5. 官方参考

1. GitHub OAuth Authorizing OAuth apps（Device Flow）：

   <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow>

2. GitHub OAuth 错误码与限流说明：

   <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#error-codes-for-the-device-flow>
