# GitHub OAuth App 创建与设备码登录（详细步骤）

本文用于给 BlogForEveryone 配置 GitHub 登录所需的 OAuth Client ID，并通过 Device Flow（设备码流程）完成登录。

## 0. 先理解 3 个关键词

1. **Client ID**：OAuth App 的公开标识，形如 `Iv1.xxxxx`。
2. **Device code / User code**：设备码登录时临时生成，用户在浏览器输入 User code。
3. **Access token**：授权成功后保存，用于调用 GitHub API。

## 1. 在 GitHub 创建 OAuth App（获取 Client ID）

1. 打开 GitHub，进入：头像 → **Settings**。
2. 左侧进入：**Developer settings** → **OAuth Apps**。
3. 点击：**New OAuth App**。
4. 建议填写：

   - **Application name**：`BlogForEveryone`（可按团队命名规范调整）
   - **Homepage URL**：你的 GitHub 主页或项目主页
   - **Authorization callback URL**：`http://localhost`

5. 点击 **Register application**。
6. 在应用配置页确认并勾选 **Enable Device Flow**。
7. 复制页面中的 **Client ID**。

### 必看注意事项

- ⚠️ **Enable Device Flow 必须勾选**。未开启时设备码登录会直接失败，并出现 `device_flow_disabled`。
- Client ID 可以公开（它不是密钥），但请不要把其他敏感凭据误当成 Client ID 提交到仓库。
- 若后续修改了 OAuth App 设置，可在同一应用页面再次确认 `Enable Device Flow` 仍为开启状态。

## 2. 在软件里执行设备码登录

1. 打开 BlogForEveryone 登录页。
2. 粘贴刚才复制的 **Client ID**。
3. 点击“设备码登录”。
4. 软件会给出设备码并拉起浏览器授权页。

检查点：

1. 软件中出现设备码（User code）。
2. 浏览器打开 GitHub 授权页（或 `github.com/login/device`）。

## 3. 浏览器授权

1. 若页面要求输入 code，则输入软件里显示的 User code。
2. 点击 Continue。
3. 点击 Authorize 授权。
4. 回到软件，点击刷新/完成登录状态。

检查点：

1. 软件能显示当前登录用户信息。
2. 可正常执行依赖 GitHub 登录的操作。

## 4. 常见报错与处理

1. `incorrect_client_credentials`：Client ID 填写错误，回 OAuth App 页面重新复制。
2. `device_flow_disabled`：没有开启 **Enable Device Flow**，回 OAuth App 设置页勾选后重试。
3. `bad_verification_code`：设备码过期或输入错误，重新发起登录拿新码。
4. `authorization_pending`：浏览器尚未确认授权，先完成网页授权。
5. `slow_down`：轮询过快，按响应中的 `interval` 放慢轮询再重试。

## 5. 官方参考（建议保留）

1. Creating an OAuth app（创建 OAuth App 与配置项说明）  
   <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app>

2. Authorizing OAuth apps - Device flow（设备码流程、`device_flow_disabled`、`slow_down`）  
   <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow>

3. Modifying an OAuth app（后续修改 OAuth App 配置）  
   <https://docs.github.com/en/apps/oauth-apps/maintaining-oauth-apps/modifying-an-oauth-app>
