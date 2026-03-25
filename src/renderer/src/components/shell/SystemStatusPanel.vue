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
  shellAppearance: { type: String, required: true },
  shellAppearanceToggleLabel: { type: String, required: true },
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
  "toggle-shell-appearance",
]);
</script>

<template>
  <section class="shell-popup-panel" data-shell-surface="user-popup">
    <section class="shell-popup-block" data-popup-block="account">
      <div class="shell-popup-heading">
        <div>
          <p class="status-label">账户</p>
          <strong>
            {{
              isLoggedIn
                ? authState?.account?.login || "GitHub 已登录"
                : "等待 GitHub 登录"
            }}
          </strong>
        </div>
      </div>
      <div class="actions shell-popup-actions">
        <button class="secondary" @click="$emit('refresh-auth')">刷新登录状态</button>
        <button v-if="isLoggedIn" class="danger" @click="$emit('logout')">退出登录</button>
      </div>

      <div v-if="!isLoggedIn && isAuthRequiredForTab(activeTab)" class="shell-popup-stack">
        <label>GitHub OAuth Client ID</label>
        <input
          :value="authClientId"
          placeholder="例如 Iv1.xxxxxxxxxxxxxxxx"
          @input="$emit('update:auth-client-id', $event.target.value)"
        />
        <div class="actions shell-popup-actions">
          <button class="secondary" @click="$emit('fill-demo-client-id-guide')">
            这里填什么？
          </button>
          <button class="primary" @click="$emit('login')">设备码登录</button>
        </div>
        <div v-if="deviceFlow?.userCode" class="shell-popup-note">
          <strong>当前设备码</strong>
          <p class="device-code">{{ deviceFlow.userCode }}</p>
          <button class="secondary" @click="$emit('copy-user-code')">复制设备码</button>
        </div>
      </div>

      <pre v-if="authLog" class="shell-popup-log">{{ authLog }}</pre>
    </section>

    <section class="shell-popup-block" data-popup-block="appearance">
      <p class="status-label">显示模式</p>
      <strong>{{ shellAppearance === "dark" ? "暗色编辑台" : "亮色编辑台" }}</strong>
      <div class="actions shell-popup-actions">
        <button class="secondary" @click="$emit('toggle-shell-appearance')">
          {{ shellAppearanceToggleLabel }}
        </button>
      </div>
    </section>

    <section class="shell-popup-block" data-popup-block="updates">
      <p class="status-label">更新</p>
      <strong>{{ updateState.message }}</strong>
      <div class="actions shell-popup-actions">
        <button class="secondary" @click="$emit('check-updates')">检查更新</button>
        <button v-if="updateState.downloaded" class="primary" @click="$emit('install-update')">
          立即安装更新
        </button>
      </div>
      <p class="muted shell-popup-log">
        {{ updateState.downloaded ? "新版已下载完成，现在可以直接安装。" : "当前没有需要立即处理的更新阻塞。" }}
      </p>
    </section>

    <section class="shell-popup-block" data-popup-block="environment">
      <p class="status-label">环境</p>
      <strong>{{ envStatus.ready ? "环境已就绪" : "环境待补齐" }}</strong>
      <ul class="shell-popup-list">
        <li>Node.js: {{ envStatus.nodeInstalled ? "已安装" : "未安装" }}</li>
        <li>Git: {{ envStatus.gitInstalled ? "已安装" : "未安装" }}</li>
        <li>pnpm: {{ envStatus.pnpmInstalled ? "已安装" : "未安装" }}</li>
      </ul>
      <div v-if="!envStatus.ready" class="actions shell-popup-actions">
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
      <div v-else class="actions shell-popup-actions">
        <button class="secondary" @click="$emit('refresh-env')">重新检测</button>
      </div>
      <div v-if="pnpmProgress.length" class="shell-popup-note">
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
      <pre v-if="envActionLog" class="shell-popup-log">{{ envActionLog }}</pre>
    </section>
  </section>
</template>
