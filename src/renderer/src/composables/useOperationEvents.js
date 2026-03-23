import { onMounted, onUnmounted, ref } from "vue";

export function useOperationEvents(scopes = []) {
  const events = ref([]);
  let release = null;

  function pushEvent(event) {
    if (!event) {
      return;
    }
    if (Array.isArray(scopes) && scopes.length > 0) {
      if (!scopes.includes(event.scope)) {
        return;
      }
    }
    events.value = [event, ...events.value].slice(0, 30);
  }

  onMounted(() => {
    if (window.bfeApi?.onOperationEvent) {
      release = window.bfeApi.onOperationEvent(pushEvent);
    }
  });

  onUnmounted(() => {
    if (typeof release === "function") {
      release();
    }
  });

  return {
    events,
  };
}
