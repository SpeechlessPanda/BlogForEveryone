# UI Regression Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the three broken inner workflow layouts and restore the shared sidebar utility popup so both footer entries reliably open the correct focused block, then verify broadly and merge without publishing.

**Architecture:** Keep the existing renderer shell ownership intact: `WorkflowSidebar.vue` remains the trigger owner, `useAppShell.mjs` remains shell state owner, `ShellTopBar.vue` remains popup mount owner, and `SystemStatusPanel.vue` remains popup content owner. Fix the shared editorial CSS contract first, then do the smallest per-view markup cleanup necessary in the three affected pages, and finally extend runtime/regression coverage so the popup behavior and page layouts are protected.

**Tech Stack:** Vue 3 renderer, shared `styles.css`, Node test runner, Playwright Electron E2E, pnpm scripts.

---

## File Structure Map

### Shared shell / popup behavior
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/composables/useAppShell.mjs`
- Modify: `src/renderer/src/components/shell/ShellTopBar.vue`
- Modify: `src/renderer/src/components/shell/WorkflowSidebar.vue`
- Modify: `src/renderer/src/components/shell/SystemStatusPanel.vue`
- Modify: `src/renderer/src/styles.css`
- Test: `src/renderer/src/composables/useAppShell.test.mjs`
- Test: `src/renderer/src/components/shell/ShellTopBar.redesign.test.mjs`
- Test: `src/renderer/src/components/shell/WorkflowSidebar.redesign.test.mjs`
- Test: `src/renderer/src/components/shell/SystemStatusPanel.redesign.test.mjs`
- Test: `src/renderer/src/App.facade.test.mjs`

### Affected workflow pages
- Modify: `src/renderer/src/views/ContentEditorView.vue`
- Modify: `src/renderer/src/components/content/ContentWorkflowHero.vue`
- Modify: `src/renderer/src/components/content/ExistingContentSection.vue`
- Modify: `src/renderer/src/views/PreviewView.vue`
- Modify: `src/renderer/src/views/PublishBackupView.vue`
- Test: `src/renderer/src/views/ContentEditorView.redesign.test.mjs`
- Test: `src/renderer/src/views/PreviewView.redesign.test.mjs`
- Test: `src/renderer/src/views/PublishBackupView.redesign.test.mjs`

### Runtime / integration verification
- Modify: `e2e/electron/editorial-workbench.spec.mjs`

---

### Task 1: Shell popup contract

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/composables/useAppShell.mjs`
- Modify: `src/renderer/src/components/shell/ShellTopBar.vue`
- Modify: `src/renderer/src/components/shell/WorkflowSidebar.vue`
- Modify: `src/renderer/src/components/shell/SystemStatusPanel.vue`
- Modify: `src/renderer/src/styles.css`
- Test: `src/renderer/src/composables/useAppShell.test.mjs`
- Test: `src/renderer/src/components/shell/ShellTopBar.redesign.test.mjs`
- Test: `src/renderer/src/components/shell/WorkflowSidebar.redesign.test.mjs`
- Test: `src/renderer/src/components/shell/SystemStatusPanel.redesign.test.mjs`
- Test: `src/renderer/src/App.facade.test.mjs`

- [ ] **Step 1: Write the failing tests for focused popup entry behavior**

Add/adjust assertions so the source-level shell tests require:
- a popup section key in `useAppShell.mjs`
- appearance/account footer entries to open the same popup with different target keys
- popup content support for active block targeting
- teleported popup styles no longer depending on `.layout--editorial` ancestry only.

- [ ] **Step 2: Run tests to verify RED**

Run:
`pnpm exec node --test "src/renderer/src/composables/useAppShell.test.mjs" "src/renderer/src/components/shell/ShellTopBar.redesign.test.mjs" "src/renderer/src/components/shell/WorkflowSidebar.redesign.test.mjs" "src/renderer/src/components/shell/SystemStatusPanel.redesign.test.mjs" "src/renderer/src/App.facade.test.mjs"`

Expected: FAIL because the current popup contract does not yet implement shared popup + focused block entry behavior correctly.

- [ ] **Step 3: Implement the minimal shell popup repair**

Implement only the shell-level changes needed so that:
- both footer entries open the same popup surface
- appearance click targets the appearance block
- account click targets the account block
- popup remains visible after Teleport to `body`
- popup remains fixed while the main content scrolls.

- [ ] **Step 4: Run tests to verify GREEN**

Run the same focused command again.

Expected: PASS.

- [ ] **Step 5: Run renderer build verification**

Run:
`pnpm run build:renderer`

Expected: PASS.

---

### Task 2: Workflow inner-layout cleanup

**Files:**
- Modify: `src/renderer/src/views/ContentEditorView.vue`
- Modify: `src/renderer/src/components/content/ContentWorkflowHero.vue`
- Modify: `src/renderer/src/components/content/ExistingContentSection.vue`
- Modify: `src/renderer/src/views/PreviewView.vue`
- Modify: `src/renderer/src/views/PublishBackupView.vue`
- Modify: `src/renderer/src/styles.css`
- Test: `src/renderer/src/views/ContentEditorView.redesign.test.mjs`
- Test: `src/renderer/src/views/PreviewView.redesign.test.mjs`
- Test: `src/renderer/src/views/PublishBackupView.redesign.test.mjs`

- [ ] **Step 1: Write failing tests for the three page layout contracts**

Require the redesign tests to fail unless:
- no page keeps a same-weight full-size inner helper/result panel nested inside the main workflow panel
- support/result content is rendered as subordinate compact blocks rather than duplicate primary panels
- content editor, preview, and publish each preserve a single primary section container with smaller summary/support blocks beneath or within normal flow
- no broken empty right-side inner rail or oversized blank inner panel remains in the affected workbench body.

- [ ] **Step 2: Run tests to verify RED**

Run:
`pnpm exec node --test "src/renderer/src/views/ContentEditorView.redesign.test.mjs" "src/renderer/src/views/PreviewView.redesign.test.mjs" "src/renderer/src/views/PublishBackupView.redesign.test.mjs"`

Expected: FAIL against the current nested-card markup/CSS.

- [ ] **Step 3: Implement the shared CSS cleanup first, then minimal page markup cleanup**

Repair the shared editorial nested-card rules in `styles.css`, then only flatten/reorder page-local wrappers where the shared fix is insufficient.

- [ ] **Step 4: Run tests to verify GREEN**

Run the same focused test command again.

Expected: PASS.

- [ ] **Step 5: Run renderer build verification**

Run:
`pnpm run build:renderer`

Expected: PASS.

---

### Task 3: Runtime regression coverage

**Files:**
- Modify: `e2e/electron/editorial-workbench.spec.mjs`
- Test support only if strictly necessary: reuse already-touched shell/page files from Tasks 1-2, but do not broaden scope beyond this regression set.

- [ ] **Step 1: Write failing runtime assertions for popup and page behavior**

Extend the Electron journey so it explicitly proves:
- sidebar footer appearance entry opens the popup and surfaces the appearance block first
- sidebar footer account entry opens the popup and surfaces the account block first
- updates/environment content still exists inside the same popup
- popup remains visible during scroll
- the three affected pages no longer present the broken oversized internal-box structure during the exercised journey.

This task must preserve compatibility with the existing prepared workspace verification path; do not introduce UI changes that break the wrapper-driven `test:e2e:workspace` contract validated in Task 4.

- [ ] **Step 2: Run E2E to verify RED**

Run:
`pnpm run test:e2e:ui`

Expected: FAIL until the runtime behavior and/or selectors line up with the new contract.

- [ ] **Step 3: Implement only the minimal runtime-alignment changes needed**

If Tasks 1-2 already make runtime behavior correct, only update the E2E assertions/selectors. If runtime still fails, fix the smallest remaining product issue inside the already-in-scope files.

- [ ] **Step 4: Run E2E to verify GREEN**

Run:
`pnpm run test:e2e:ui`

Expected: PASS.

---

### Task 4: Broad verification and integration completion

**Files:**
- Reuse the files changed in Tasks 1-3 only.

- [ ] **Step 1: Run broad coverage-oriented verification**

Run:
`pnpm run test:coverage`

Expected: PASS.

- [ ] **Step 2: Run the full Node test suite**

Run:
`pnpm exec node --test`

Expected: PASS.

- [ ] **Step 3: Run renderer build**

Run:
`pnpm run build:renderer`

Expected: PASS.

- [ ] **Step 4: Run UI runtime verification**

Run:
`pnpm run test:e2e:ui`

Expected: PASS.

- [ ] **Step 5: Run workspace-flow verification**

Precondition: this command must use the already-approved prepared wrapper contract from `package.json` and the real-workspace scripts. Do not substitute a direct partial script call.

Run:
`pnpm run test:e2e:workspace`

Expected: PASS after the full prepare → verify wrapper flow completes with no stale manifest/report reuse.

- [ ] **Step 6: Completion handoff**

After all verification commands pass, the implementation is ready for this exact git completion path, with **no publish step**:

- commit on the repair branch
- push the repair branch to origin
- merge the repair branch into local `main`
- rerun required verification on merged `main` if merge changes execution context
- push merged local `main` to origin

Do not replace a release and do not publish in this task.
