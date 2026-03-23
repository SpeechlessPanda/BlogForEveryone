<script setup>
defineProps({
  envActionLog: { type: String, required: true },
  envStatus: { type: Object, required: true },
  pnpmInstalling: { type: Boolean, required: true },
  pnpmProgress: { type: Array, required: true },
});

defineEmits([
  "open-installer",
  "auto-install",
  "install-pnpm",
  "refresh-env",
]);
</script>

<template>
  <section v-if="!envStatus.ready" class="panel env-alert">
    <h2>环境检查</h2>
    <p class="muted">
      检测到当前环境不完整。你只需要确认按钮，应用会引导下载安装。
    </p>
    <ul>
      <li>Node.js: {{ envStatus.nodeInstalled ? "已安装" : "未安装" }}</li>
      <li>Git: {{ envStatus.gitInstalled ? "已安装" : "未安装" }}</li>
      <li>pnpm: {{ envStatus.pnpmInstalled ? "已安装" : "未安装" }}</li>
    </ul>
    <div class="actions">
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
    <div v-if="pnpmProgress.length" class="panel stack-top">
      <h2>pnpm 配置进度</h2>
      <div
        v-for="(step, idx) in pnpmProgress"
        :key="`${step.label}-${idx}`"
        class="muted"
        style="margin-bottom: 6px"
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
    <pre v-if="envActionLog">{{ envActionLog }}</pre>
  </section>
</template>
