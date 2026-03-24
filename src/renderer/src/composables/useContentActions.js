import { createContentActions } from "./useContentActions.mjs";

export function useContentActions() {
  return createContentActions(window.bfeApi);
}
