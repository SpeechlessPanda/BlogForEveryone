<script setup>
defineProps({
  activeSectionMeta: { type: Object, required: true },
  activeTabMeta: { type: Object, required: true },
  isShellPopupOpen: { type: Boolean, required: true },
  shellUserEntryLabel: { type: String, required: true },
});

defineEmits(["toggle-shell-popup", "close-shell-popup"]);
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

    <div class="shell-topbar-user">
      <button
        class="secondary shell-user-anchor"
        data-topbar-anchor="user-entry"
        @click="$emit('toggle-shell-popup')"
      >
        {{ shellUserEntryLabel }}
      </button>

      <div
        v-show="isShellPopupOpen"
        class="shell-popup-mount"
        data-topbar-region="popup-mount"
      >
        <div class="shell-popup-dismiss-row">
          <button class="secondary shell-popup-dismiss" @click="$emit('close-shell-popup')">
            关闭
          </button>
        </div>
        <slot />
      </div>
    </div>
  </header>
</template>
