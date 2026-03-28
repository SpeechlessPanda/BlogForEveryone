# Wave 1C Dark-Mode Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recalibrate the active dark editorial-shell text palette so primary workflow text is easier to read in low-light conditions without broadening into a shell redesign.

**Architecture:** CSS-token patch only. Update the active dark-shell text tokens in `styles.css`, then tighten source/runtime proof so the app verifies the actual dark muted/highlight palette used on representative workflow text. No Vue component, backend, or auth-flow changes are allowed.

**Tech Stack:** CSS custom properties, node:test source-shape tests, Playwright Electron UI verification, existing renderer build pipeline.

---

## File structure map

### Required implementation files
- Modify: `src/renderer/src/styles.css`
- Modify: `src/renderer/src/App.facade.test.mjs`
- Modify: `e2e/electron/editorial-workbench.spec.mjs`

### Read-only context
- Read-only: `src/renderer/src/views/ThemeConfigView.redesign.test.mjs`
- Read-only: `src/renderer/src/views/WorkspaceView.redesign.test.mjs`

### Must stay unchanged in Wave 1C
- `src/main/**`
- `src/renderer/src/views/**/*.vue`
- `src/renderer/src/composables/**`
- `README.md`
- `package.json`

---

### Task 1: Dark-shell text token recalibration

**Files:**
- Modify: `src/renderer/src/styles.css`
- Modify: `src/renderer/src/App.facade.test.mjs`
- Modify: `e2e/electron/editorial-workbench.spec.mjs`

- [ ] **Step 1: Write the failing tests**

Strengthen the focused source/runtime checks so they prove:
- the active dark editorial-shell token block uses the approved warmer palette
- dark shell workflow links use the approved highlight token rather than pure white
- runtime E2E proves the actual muted/highlight palette values on the live dark shell before checking representative workflow text

- [ ] **Step 2: Run the focused dark-readability slice to verify RED**

Run:

```bash
pnpm exec node --test "src/renderer/src/App.facade.test.mjs" "src/renderer/src/views/ThemeConfigView.redesign.test.mjs" "src/renderer/src/views/WorkspaceView.redesign.test.mjs"
```

Expected:
- FAIL on the newly-added dark-palette assertions.

- [ ] **Step 3: Implement the minimal CSS-token fix**

Update only the active dark-shell token block in `styles.css` so that:
- `--shell-ink = #f5ede6`
- `--shell-muted = #d7c6b8`
- `--shell-highlight = #f6e6d5`

Do not change light-mode tokens, layout/grid structure, or workflow logic.

- [ ] **Step 4: Re-run the focused source slice to verify GREEN**

Run again:

```bash
pnpm exec node --test "src/renderer/src/App.facade.test.mjs" "src/renderer/src/views/ThemeConfigView.redesign.test.mjs" "src/renderer/src/views/WorkspaceView.redesign.test.mjs"
```

Expected:
- PASS

- [ ] **Step 5: Run renderer build verification**

Run:

```bash
pnpm run build:renderer
```

Expected:
- PASS

- [ ] **Step 6: Run dark-mode runtime proof**

Run:

```bash
pnpm run test:e2e:ui
```

Expected runtime proof:
- the editorial journey still passes
- dark shell runtime palette values match the approved warmer muted/highlight values
- representative workflow text still resolves to those values on publish/import/theme/preview surfaces

- [ ] **Step 7: Stop at Wave 1C boundary**

Do not broaden into README/docs, package/privacy, import/publish flow changes, versioning, or release operations from this task.

---

## Wave 1C stop conditions

Stop and re-scope if any of these become necessary:
- Vue component/template changes
- publish/import/backend contract changes
- light-theme retuning
- README/docs/release metadata edits
- release-history cleanup or tag/release deletion work
