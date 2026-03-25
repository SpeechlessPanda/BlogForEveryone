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
  <section class="panel shell-overview" data-shell-surface="summary">
    <div class="shell-summary shell-summary-lead" data-summary-card="lead">
      <p class="page-kicker">
        {{ activeTabMeta.step }} · {{ activeSectionMeta.label }}
      </p>
      <h2>{{ activeTabMeta.label }}</h2>
      <p class="muted shell-summary-copy">{{ activeTabMeta.summary }}</p>
      <div class="shell-summary-metric">
        <span class="status-label">当前焦点</span>
        <strong class="status-value">{{ activeSectionMeta.label }}</strong>
      </div>
    </div>

    <div class="shell-summary" data-summary-card="readiness">
      <div class="shell-summary-metric">
        <span class="status-label">环境与登录</span>
        <strong class="status-value">{{ environmentStatusText }}</strong>
      </div>
      <p class="status-detail">{{ loginStatusText }}</p>
    </div>

    <div class="shell-summary" data-summary-card="workspace">
      <div class="shell-summary-metric">
        <span class="status-label">当前工作区</span>
        <strong class="status-value">{{ workspaceSummary.title }}</strong>
      </div>
      <p class="status-detail">{{ workspaceSummary.detail }}</p>
    </div>

    <div class="shell-summary" data-summary-card="next-step">
      <div class="shell-summary-metric">
        <span class="status-label">建议下一步</span>
        <strong class="status-value">{{ nextStep.title }}</strong>
      </div>
      <p class="status-detail">{{ nextStep.detail }}</p>
    </div>
  </section>
</template>
