# Wave 1C Dark-Mode Readability Design

## Goal

Recalibrate dark editorial-shell text tokens so primary workflow text is easier to read in low-light conditions, while keeping the patch narrowly scoped to dark-mode readability rather than broader shell redesign.

## Why this wave exists

The current dark shell already routes primary helper/result/link text through shell tokens, but the user is still reporting unreadable text in dark mode. The problem is no longer missing dark-mode wiring; it is the readability of the actual dark text palette in real workflow surfaces.

This makes Wave 1C a token-recalibration patch, not a layout or interaction patch.

---

## External guidance applied

- **WCAG 2.1**: text contrast must remain comfortably above minimum thresholds on the actual dark background, not just theoretically acceptable in a token table.
- **Microsoft dark-mode testing guidance**: verify readability under the real dark appearance and inspect actual rendered text, not just palette intent.
- **Material dark-theme guidance**: favor clear hierarchy and avoid harsh pure-white glare by using a warm, readable text ramp for primary and secondary text.

---

## Grounded current state

### Current dark shell token state in `src/renderer/src/styles.css`

The file currently contains **multiple dark editorial token blocks**. An earlier warm-toned block already exists higher in the file, but the later editorial-shell block and the paired popup-theme block still define the colder neutral text palette that the current source/runtime proof is keyed to:

- `--shell-ink: #f3f3f3`
- `--shell-muted: #a3a3a3`
- `--shell-highlight: #ffffff`

on very dark shell backgrounds such as:

- `--shell-bg: #0b0b0b`
- `--shell-panel: #101010`
- `--shell-panel-alt: #171717`

Wave 1C is not a broad token cleanup. It is a narrow recalibration of the currently active/read-by-tests dark text palette so the runtime shell uses a warmer low-light text ramp consistently.

The text-routing selectors are already present and broad enough to reach primary workflow text:

- `.page-lead`
- `.section-helper`
- `.status-detail`
- `.action-note`
- `.page-result-note`
- `.muted`
- `.theme-preview-dialog-copy .section-eyebrow`
- `.theme-preview-zoom-status`
- dark workflow links via `.page-link-row a` / `.workflow-compact-block a`

### Existing proof already in codebase

The current test/runtime surfaces already prove token routing, not palette quality:

- `src/renderer/src/App.facade.test.mjs`
- `src/renderer/src/views/ThemeConfigView.redesign.test.mjs`
- `src/renderer/src/views/WorkspaceView.redesign.test.mjs`
- `e2e/electron/editorial-workbench.spec.mjs`

Wave 1C should keep those surfaces and only sharpen the palette contract.

---

## Approved direction

### 1. Keep the patch token-only and dark-only

Wave 1C modifies dark readability by changing only the dark shell text palette and the assertions around it.

Allowed:

- `--shell-ink`
- `--shell-muted`
- `--shell-highlight`

inside the active dark editorial-shell token block.

Not allowed:

- light-theme token changes
- layout/grid/spacing changes
- workflow logic or component structure changes
- backend/preload/auth/import/publish contract changes

### 2. Use a warmer low-light text ramp

The dark shell should move away from the current colder neutral secondary text and full-white highlight treatment.

Wave 1C will use this target dark text palette:

- `--shell-ink: #f5ede6`
- `--shell-muted: #d7c6b8`
- `--shell-highlight: #f6e6d5`

These remain high-contrast against the current dark shell backgrounds while reducing glare and increasing readability of smaller helper text.

### 3. Keep routing selectors, update only the palette they point to

The existing dark-shell selector coverage for workflow/helper/result/link text should remain intact. The patch should prefer changing the token values those selectors already consume rather than adding a new web of one-off overrides.

### 4. Runtime proof must check the actual dark palette, not just token presence

The existing editorial E2E already reads shell text palette values and checks rendered workflow surfaces. Wave 1C must extend that runtime proof so the dark palette itself is verified, not just that surfaces follow whatever the token currently is.

---

## Required behavior

1. Primary workflow helper/result text remains routed through `--shell-muted`, but that token is recalibrated to the new warmer low-light value.
2. Primary workflow links remain routed through `--shell-highlight`, but that token is recalibrated away from pure white.
3. The active dark-shell token block is the only production style area changed in this wave.
4. Existing workflow text surfaces (publish/import/theme/preview) continue to resolve to the dark shell text tokens after the palette shift.
5. Runtime E2E must prove the actual dark muted/highlight palette values used by the app and that representative workflow text still resolves to those values.

---

## File scope

### Required

- `src/renderer/src/styles.css`
- `src/renderer/src/App.facade.test.mjs`
- `e2e/electron/editorial-workbench.spec.mjs`

### Read-only context

- `src/renderer/src/views/ThemeConfigView.redesign.test.mjs`
- `src/renderer/src/views/WorkspaceView.redesign.test.mjs`

### Explicit non-goals

- no Vue component changes
- no import/publish/autodetect changes
- no README/docs changes
- no package/release/version changes in this wave
- no shell layout restyling beyond token recalibration

---

## Verification contract

Wave 1C is complete only when all of the following are true:

1. Focused source tests prove the dark shell token values were updated to the approved warmer palette.
2. Existing source tests for theme/workspace dark-shell token routing still pass.
3. Runtime E2E proves the actual dark muted/highlight palette values and confirms representative workflow text still resolves to those values.
4. `pnpm run build:renderer` passes.

Recommended exact verification commands:

```bash
pnpm exec node --test "src/renderer/src/App.facade.test.mjs" "src/renderer/src/views/ThemeConfigView.redesign.test.mjs" "src/renderer/src/views/WorkspaceView.redesign.test.mjs"
pnpm run build:renderer
pnpm run test:e2e:ui
```

---

## Ship gate for moving to Wave 2

Do not move to README/privacy/release-readiness work until this dark-mode readability recalibration is green. The user explicitly called out dark text as still unreadable, so Wave 1 should not be considered complete until this patch is verified.
