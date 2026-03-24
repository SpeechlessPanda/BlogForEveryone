<script setup>
defineProps({
  activeSectionMeta: { type: Object, required: true },
  activeTabMeta: { type: Object, required: true },
  environmentStatusText: { type: String, required: true },
  loginStatusText: { type: String, required: true },
  nextStep: { type: Object, required: true },
  workspaceSummary: { type: Object, required: true },
});
</script>

<template>
  <section class="panel shell-overview">
    <div class="shell-summary shell-summary-lead">
      <p class="page-kicker">
        {{ activeTabMeta.step }} · {{ activeSectionMeta.label }}
      </p>
      <h2>{{ activeTabMeta.label }}</h2>
      <p class="muted shell-summary-copy">{{ activeTabMeta.summary }}</p>
    </div>

    <div class="shell-summary">
      <span class="status-label">环境与登录</span>
      <strong class="status-value">{{ environmentStatusText }}</strong>
      <p class="status-detail">{{ loginStatusText }}</p>
    </div>

    <div class="shell-summary">
      <span class="status-label">当前工作区</span>
      <strong class="status-value">{{ workspaceSummary.title }}</strong>
      <p class="status-detail">{{ workspaceSummary.detail }}</p>
    </div>

    <div class="shell-summary">
      <span class="status-label">建议下一步</span>
      <strong class="status-value">{{ nextStep.title }}</strong>
      <p class="status-detail">{{ nextStep.detail }}</p>
    </div>
  </section>
</template>
