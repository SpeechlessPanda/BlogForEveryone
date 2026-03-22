<script setup>
defineProps({
  kind: {
    type: String,
    default: "secondary",
  },
  label: {
    type: String,
    required: true,
  },
  busyLabel: {
    type: String,
    default: "处理中...",
  },
  busy: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["click"]);
</script>

<template>
  <button
    :class="[kind, { 'is-loading': busy }]"
    :disabled="disabled || busy"
    @click="$emit('click')"
  >
    <span v-if="busy" class="btn-spinner" aria-hidden="true"></span>
    {{ busy ? busyLabel : label }}
  </button>
</template>
