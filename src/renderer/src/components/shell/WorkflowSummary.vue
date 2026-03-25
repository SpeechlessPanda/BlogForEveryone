<script setup>
defineProps({
  activeSectionMeta: { type: Object, required: true },
  activeTabMeta: { type: Object, required: true },
  nextStep: { type: Object, required: true },
  workspaceSummary: { type: Object, required: true },
});
</script>

<template>
  <section
    class="shell-summary"
    data-shell-surface="summary"
    data-summary-layout="compact"
  >
    <article class="shell-summary-chip" data-summary-item="step">
      <span class="status-label">当前流程</span>
      <strong>{{ activeTabMeta.step }} · {{ activeSectionMeta.label }}</strong>
    </article>

    <article class="shell-summary-chip" data-summary-item="workspace">
      <span class="status-label">工作区</span>
      <strong>{{ workspaceSummary.title }}</strong>
    </article>

    <article class="shell-summary-chip" data-summary-item="next-step">
      <span class="status-label">建议下一步</span>
      <strong>{{ nextStep.title }}</strong>
    </article>
  </section>
</template>
