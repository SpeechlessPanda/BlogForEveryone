import { reactive } from "vue";

export function useAsyncAction() {
  const actionMap = reactive({});

  function isBusy(key) {
    return actionMap[key] === true;
  }

  async function run(key, task) {
    if (actionMap[key]) {
      return;
    }
    actionMap[key] = true;
    try {
      return await task();
    } finally {
      actionMap[key] = false;
    }
  }

  return {
    actionMap,
    isBusy,
    run,
  };
}
