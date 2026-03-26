<script setup>
defineProps({
  activeSectionMeta: { type: Object, required: true },
  activeTabMeta: { type: Object, required: true },
  isShellPopupOpen: { type: Boolean, required: true },
  shellPopupAnchorStyle: { type: Object, required: true },
});

defineEmits(["close-shell-popup"]);
</script>

<template>
  <header class="shell-topbar" data-shell-surface="topbar">
    <div class="shell-topbar-copy" data-topbar-region="page-title">
      <p class="page-kicker">{{ activeSectionMeta.label }}</p>
      <h1 class="shell-topbar-title">{{ activeTabMeta.label }}</h1>
    </div>

    <div class="shell-topbar-actions" data-topbar-region="page-actions">
      <slot name="page-actions" />
    </div>
  </header>

  <Teleport to="body">
    <div
      v-show="isShellPopupOpen"
      class="shell-popup-overlay shell-popup-overlay--sidebar"
      data-topbar-region="popup-mount"
      @click.self="$emit('close-shell-popup')"
    >
      <div class="shell-popup-panel-wrap" :style="shellPopupAnchorStyle">
        <div class="shell-popup-dismiss-row">
          <button class="secondary shell-popup-dismiss" @click="$emit('close-shell-popup')">
            关闭
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
