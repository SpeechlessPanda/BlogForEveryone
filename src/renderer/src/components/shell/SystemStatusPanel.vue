<script setup>
import { isAuthRequiredForTab } from "../../utils/workflowViewHelpers.mjs";

defineProps({
  activeTab: { type: String, required: true },
  authClientId: { type: String, required: true },
  authLog: { type: String, required: true },
  authState: { type: Object, default: null },
  deviceFlow: { type: Object, default: null },
  envActionLog: { type: String, required: true },
  envStatus: { type: Object, required: true },
  isLoggedIn: { type: Boolean, required: true },
  pnpmInstalling: { type: Boolean, required: true },
  pnpmProgress: { type: Array, required: true },
  updateState: { type: Object, required: true },
});

defineEmits([
  "update:auth-client-id",
  "check-updates",
  "install-update",
  "fill-demo-client-id-guide",
  "login",
  "logout",
  "refresh-auth",
  "copy-user-code",
  "open-installer",
  "auto-install",
  "install-pnpm",
  "refresh-env",
]);
</script>

<template>
  <section
    class="panel system-status-panel"
    data-shell-surface="system-status"
    data-status-block="overview"
  >
    <div class="system-status-heading">
      <div>
        <p class="page-kicker">Shell operations</p>
        <h2>系统状态</h2>
        <p class="section-helper">
          先确认环境、更新与登录，再决定是否继续安装、授权或发布。
        </p>
      </div>
    </div>
    <div class="system-status-grid">
      <article class="system-status-card">
        <p class="status-label">环境</p>
        <strong class="status-value">{{ envStatus.ready ? "环境已就绪" : "环境待补齐" }}</strong>
        <p class="status-detail">Node.js、Git、pnpm 会影响后续所有创建与发布动作。</p>
      </article>
      <article class="system-status-card">
        <p class="status-label">更新</p>
        <strong class="status-value">{{ updateState.message }}</strong>
        <p class="status-detail">更新流程留在系统层处理，不打断当前工作流页面。</p>
      </article>
      <article class="system-status-card">
        <p class="status-label">登录</p>
        <strong class="status-value">
          {{
            isLoggedIn
              ? authState?.account?.login
                ? `已连接 ${authState.account.login}`
                : "GitHub 已登录"
              : "等待 GitHub 登录"
          }}
        </strong>
        <p class="status-detail">需要发布、备份和仓库操作时，再把 GitHub 授权补上即可。</p>
      </article>
    </div>
    <div class="actions system-status-actions">
      <button class="secondary" @click="$emit('check-updates')">检查更新</button>
      <button
        v-if="updateState.downloaded"
        class="primary"
        @click="$emit('install-update')"
      >
        立即安装更新
      </button>
      <button class="secondary" @click="$emit('refresh-auth')">刷新登录状态</button>
      <button v-if="isLoggedIn" class="danger" @click="$emit('logout')">
        退出登录
      </button>
    </div>
    <p class="muted system-status-log">
      {{
        updateState.downloaded
          ? "新版已下载完成，现在可以直接安装。"
          : "当前没有需要立即处理的系统阻塞时，优先继续主流程。"
      }}
    </p>
  </section>

  <section
    v-if="!isLoggedIn && isAuthRequiredForTab(activeTab)"
    class="panel system-status-panel system-status-panel--auth"
    data-status-block="auth"
  >
    <h2>GitHub 登录（OAuth 设备码）</h2>
    <p class="muted">
      填写你的 GitHub OAuth App Client ID 后，点击登录会自动打开浏览器并进入设备码授权流程。
    </p>
    <label>GitHub OAuth Client ID</label>
    <input
      :value="authClientId"
      placeholder="例如 Iv1.xxxxxxxxxxxxxxxx"
      @input="$emit('update:auth-client-id', $event.target.value)"
    />
    <div class="actions system-status-actions">
      <button class="secondary" @click="$emit('fill-demo-client-id-guide')">
        这里填什么？
      </button>
      <button class="primary" @click="$emit('login')">设备码登录</button>
      <button class="secondary" @click="$emit('refresh-auth')">刷新登录状态</button>
      <button v-if="authState" class="danger" @click="$emit('logout')">
        退出登录
      </button>
    </div>
    <div
      v-if="deviceFlow?.userCode"
      class="panel tutorial-note device-code-card system-status-card system-status-card--device"
    >
      <h2>当前设备码</h2>
      <p class="device-code">{{ deviceFlow.userCode }}</p>
      <p class="muted">如果 GitHub 页面提示输入 code，请填这个码。</p>
      <div class="actions system-status-actions">
        <button class="secondary" @click="$emit('copy-user-code')">复制设备码</button>
      </div>
    </div>
    <pre v-if="authLog" class="system-status-log">{{ authLog }}</pre>
  </section>

  <section
    v-if="!envStatus.ready"
    class="panel env-alert system-status-panel system-status-panel--environment"
    data-status-block="environment"
  >
    <h2>环境检查</h2>
    <p class="muted">
      检测到当前环境不完整。你只需要确认按钮，应用会引导下载安装。
    </p>
    <ul class="system-status-list">
      <li>Node.js: {{ envStatus.nodeInstalled ? "已安装" : "未安装" }}</li>
      <li>Git: {{ envStatus.gitInstalled ? "已安装" : "未安装" }}</li>
      <li>pnpm: {{ envStatus.pnpmInstalled ? "已安装" : "未安装" }}</li>
    </ul>
    <div class="actions system-status-actions">
      <button
        v-if="!envStatus.nodeInstalled"
        class="primary"
        @click="$emit('open-installer', 'node')"
      >
        下载 Node.js
      </button>
      <button
        v-if="!envStatus.nodeInstalled && envStatus.wingetInstalled"
        class="secondary"
        @click="$emit('auto-install', 'node')"
      >
        自动安装 Node.js（winget）
      </button>
      <button
        v-if="!envStatus.gitInstalled"
        class="primary"
        @click="$emit('open-installer', 'git')"
      >
        下载 Git
      </button>
      <button
        v-if="!envStatus.gitInstalled && envStatus.wingetInstalled"
        class="secondary"
        @click="$emit('auto-install', 'git')"
      >
        自动安装 Git（winget）
      </button>
      <button
        v-if="envStatus.nodeInstalled && !envStatus.pnpmInstalled"
        class="secondary"
        :disabled="pnpmInstalling"
        @click="$emit('install-pnpm')"
      >
        {{
          pnpmInstalling
            ? "正在配置 pnpm..."
            : "安装 pnpm（失败自动换源重试）"
        }}
      </button>
      <button class="secondary" @click="$emit('refresh-env')">重新检测</button>
    </div>
    <div
      v-if="pnpmProgress.length"
      class="system-status-card system-status-card--progress stack-top"
    >
      <h3>pnpm 配置进度</h3>
      <div
        v-for="(step, idx) in pnpmProgress"
        :key="`${step.label}-${idx}`"
        class="muted system-status-progress-item"
      >
        {{
          step.status === "success"
            ? "✓"
            : step.status === "failed"
              ? "✗"
              : "⏳"
        }}
        {{ step.label }}
      </div>
    </div>
    <pre v-if="envActionLog" class="system-status-log">{{ envActionLog }}</pre>
  </section>
</template>
