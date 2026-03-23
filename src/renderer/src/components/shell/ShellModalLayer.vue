<script setup>
defineProps({
  activeInfoModal: { type: Object, required: true },
  errorModal: { type: Object, required: true },
  infoModal: { type: Object, required: true },
});

defineEmits(["close-info", "close-error"]);
</script>

<template>
  <div v-if="infoModal.visible" class="modal-backdrop" @click.self="$emit('close-info')">
    <div class="modal-panel">
      <h2>{{ activeInfoModal.title }}</h2>
      <p>{{ activeInfoModal.content }}</p>
      <div class="actions">
        <button class="primary" @click="$emit('close-info')">我知道了</button>
      </div>
    </div>
  </div>

  <div
    v-if="errorModal.visible"
    class="modal-backdrop"
    @click.self="$emit('close-error')"
  >
    <div class="modal-panel">
      <h2>{{ errorModal.title }}</h2>
      <p class="muted error-text">{{ errorModal.message }}</p>
      <div class="actions">
        <button class="danger" @click="$emit('close-error')">关闭</button>
      </div>
    </div>
  </div>
</template>
