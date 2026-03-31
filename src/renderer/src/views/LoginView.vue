<script setup>
defineProps({
  authClientId: { type: String, required: true },
  authLog: { type: String, required: true },
  deviceFlow: { type: Object, default: null },
});

defineEmits([
  "update:auth-client-id",
  "fill-demo-client-id-guide",
  "login",
  "copy-user-code",
]);
</script>

<template>
  <div class="page-shell" data-page-role="login" data-workflow-surface="editorial-workflow">
    <div class="page-layer" data-page-layer="primary">
      <section class="panel page-hero" data-workflow-zone="auth-login">
        <p class="page-kicker">Step 00 · Account access</p>
        <h2 class="page-title">登录 GitHub</h2>
        <p class="page-lead">
          发布和导入恢复依赖 GitHub 授权。先填写 OAuth Client ID，然后使用设备码完成登录。
        </p>

        <div class="grid-2 stack-top">
          <div>
            <label>GitHub OAuth Client ID</label>
            <input
              :value="authClientId"
              placeholder="例如 Iv1.xxxxxxxxxxxxxxxx"
              @input="$emit('update:auth-client-id', $event.target.value)"
            />
          </div>
        </div>

        <div class="actions">
          <button class="secondary" @click="$emit('fill-demo-client-id-guide')">这里填什么？</button>
          <button class="primary" @click="$emit('login')">设备码登录</button>
        </div>

        <div v-if="deviceFlow?.userCode" class="workflow-compact-block stack-top">
          <p class="section-eyebrow">当前设备码</p>
          <p class="device-code">{{ deviceFlow.userCode }}</p>
          <button class="secondary" @click="$emit('copy-user-code')">复制设备码</button>
        </div>

        <pre v-if="authLog" class="shell-popup-log stack-top">{{ authLog }}</pre>
      </section>
    </div>
  </div>
</template>
