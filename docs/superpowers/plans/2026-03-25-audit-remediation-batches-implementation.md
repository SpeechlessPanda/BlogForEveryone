# Audit Remediation Batches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce BlogForEveryone's security, orchestration, and maintainability risks in five ordered batches without breaking the current editorial workbench flows.

**Architecture:** Keep the existing `renderer -> preload -> ipc -> services/policies` layering, but stop bypassing it. Batch 1 hardens command execution and Electron window security, Batch 2 extracts main-process application workflows, Batch 3 splits renderer shell and oversized views, Batch 4 removes duplicated logic and brittle event wiring, and Batch 5 adds contract tests and runtime documentation.

**Tech Stack:** Electron, Vue 3, Node.js `node:test`, Playwright, pnpm.

---

## Batch 1: Security Boundary Hardening

### Task B1: Make env command execution argv-safe

**Files:**
- Modify: `src/main/services/env/runCommand.js`
- Modify: `src/main/services/env/runCommand.test.js`

- [ ] **Step 1: Write the failing test**
  - Add `runCommand defaults to shell false for argv-safe execution`.
  - Add `runPnpmDlxWithRetry preserves argv across retry calls`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec node --test src/main/services/env/runCommand.test.js`
Expected: FAIL because current implementation still asserts `shell === true` or uses shell-based defaults.

- [ ] **Step 3: Write minimal implementation**
  - Change `runCommand()` to use explicit argv execution defaults.
  - Ensure mirror fallback retry is one-shot and does not leave persistent pnpm registry mutation behind.
  - Preserve timeout / encoding / `windowsHide` behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec node --test src/main/services/env/runCommand.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

### Task B2: Route publish commands through the safe runner

**Files:**
- Modify: `src/main/services/publishService.js`
- Modify: `src/main/services/publishService.test.js`

- [ ] **Step 1: Write the failing test**
  - Add `publishWithHexoDeploy uses argv-safe pnpm exec commands`.
  - Add `runGitCommands returns normalized failure for non-zero git status`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec node --test src/main/services/publishService.test.js`
Expected: FAIL because publish flow still uses `runShellCommand(... shell: true ...)`.

- [ ] **Step 3: Write minimal implementation**
  - Replace shell-based pnpm execution with the safe runner from Batch 1.
  - Keep log shape stable.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec node --test src/main/services/publishService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

### Task B3: Route backup push commands through the safe runner

**Files:**
- Modify: `src/main/services/backupService.js`
- Modify: `src/main/services/backupService.test.js`

- [ ] **Step 1: Write the failing test**
  - Add `pushBackupToRepo executes git steps with argv-safe options`.
  - Add `pushBackupToRepo stops on first failing git command`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec node --test src/main/services/backupService.test.js`
Expected: FAIL because backup push still uses `shell: true`.

- [ ] **Step 3: Write minimal implementation**
  - Replace shell-based git execution with the safe runner.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec node --test src/main/services/backupService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

### Task B4: Remove shell-based framework tooling execution

**Files:**
- Modify: `src/main/services/frameworkService.js`
- Modify: `src/main/services/frameworkToolingService.js`
- Modify: `src/main/services/frameworkService.test.js`
- Create: `src/main/services/frameworkToolingService.test.js`

- [ ] **Step 1: Write the failing test**
  - Add `runPnpmWithMirrorRetry keeps argv-safe execution without shell parsing`.
  - Add `initProject invokes framework commands through the safe adapter`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec node --test src/main/services/frameworkService.test.js src/main/services/frameworkToolingService.test.js`
Expected: FAIL because framework services still use `spawn(... shell: true ...)`.

- [ ] **Step 3: Write minimal implementation**
  - Reuse the safe runner from Batch 1.
  - Preserve current retry and timeout behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec node --test src/main/services/frameworkService.test.js src/main/services/frameworkToolingService.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

### Task B5: Add direct BrowserWindow security contract tests

**Files:**
- Modify: `src/main/main.js`
- Create: `src/main/main.test.js`

- [ ] **Step 1: Write the failing test**
  - Add `createMainWindow configures BrowserWindow with hardened webPreferences`.
  - Add `createMainWindow loads dev URL in development and dist file in production`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec node --test src/main/main.test.js`
Expected: FAIL because no direct test exists yet.

- [ ] **Step 3: Write minimal implementation**
  - Export or structure the window factory so it can be tested without changing behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec node --test src/main/main.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

**Batch 1 verification:**
- [ ] Run `pnpm exec node --test src/main/services/env/runCommand.test.js src/main/services/publishService.test.js src/main/services/backupService.test.js src/main/services/frameworkService.test.js src/main/services/frameworkToolingService.test.js src/main/main.test.js`

---

## Batch 2: Main-Process Workflow Extraction

### Task H1: Extract workspace workflow orchestration from IPC

**Files:**
- Create: `src/main/app/workspaceWorkflowService.js`
- Create: `src/main/app/workspaceWorkflowService.test.js`
- Modify: `src/main/ipc/workspaceIpc.js`
- Modify: `src/main/ipc/workspaceIpc.test.js`

- [ ] Write failing workflow service tests for create/import/backup orchestration.
- [ ] Run `pnpm exec node --test src/main/app/workspaceWorkflowService.test.js src/main/ipc/workspaceIpc.test.js` and verify RED.
- [ ] Move orchestration out of `workspaceIpc.js` into the new app service.
- [ ] Re-run the same command and verify GREEN.
- [ ] Commit.

### Task H2: Extract content publish orchestration from content service

**Files:**
- Create: `src/main/services/contentPublishWorkflowService.js`
- Create: `src/main/services/contentPublishWorkflowService.test.js`
- Modify: `src/main/services/contentService.js`
- Modify: `src/main/services/contentService.test.js`

- [ ] Write failing tests for publish job lifecycle and delegation boundaries.
- [ ] Run `pnpm exec node --test src/main/services/contentPublishWorkflowService.test.js src/main/services/contentService.test.js` and verify RED.
- [ ] Move publish job orchestration into the new workflow service.
- [ ] Re-run the same command and verify GREEN.
- [ ] Commit.

**Batch 2 verification:**
- [ ] Run `pnpm exec node --test src/main/app/workspaceWorkflowService.test.js src/main/ipc/workspaceIpc.test.js src/main/services/contentPublishWorkflowService.test.js src/main/services/contentService.test.js`

---

## Batch 3: Renderer Shell and View Decomposition

### Task H3: Split `useAppShell.mjs` into focused composables

**Files:**
- Create: `src/renderer/src/composables/useShellNavigation.mjs`
- Create: `src/renderer/src/composables/useShellNavigation.test.mjs`
- Create: `src/renderer/src/composables/useShellStatus.mjs`
- Create: `src/renderer/src/composables/useShellStatus.test.mjs`
- Create: `src/renderer/src/composables/useShellWorkspaceSummary.mjs`
- Create: `src/renderer/src/composables/useShellWorkspaceSummary.test.mjs`
- Modify: `src/renderer/src/composables/useAppShell.mjs`
- Modify: `src/renderer/src/composables/useAppShell.test.mjs`

- [ ] Write failing tests for navigation and workspace summary extraction.
- [ ] Run `pnpm exec node --test src/renderer/src/composables/useShellNavigation.test.mjs src/renderer/src/composables/useShellWorkspaceSummary.test.mjs src/renderer/src/composables/useAppShell.test.mjs` and verify RED.
- [ ] Extract modules with minimal facade changes.
- [ ] Re-run the same command and verify GREEN.
- [ ] Commit.

### Task H4: Split `ThemeConfigView.vue`

**Files:**
- Create: `src/renderer/src/components/theme-config/ThemeIdentitySection.vue`
- Create: `src/renderer/src/components/theme-config/ThemeAssetStudioSection.vue`
- Create: `src/renderer/src/components/theme-config/ThemeAdvancedConfigSection.vue`
- Create: `src/renderer/src/components/theme-config/ThemeIdentitySection.test.mjs`
- Modify: `src/renderer/src/views/ThemeConfigView.vue`
- Modify: `src/renderer/src/views/ThemeConfigView.facade.test.mjs`
- Modify: `src/renderer/src/views/ThemeConfigView.redesign.test.mjs`

- [ ] Write failing tests for extracted identity section and page delegation.
- [ ] Run `pnpm exec node --test src/renderer/src/views/ThemeConfigView.facade.test.mjs src/renderer/src/views/ThemeConfigView.redesign.test.mjs src/renderer/src/components/theme-config/ThemeIdentitySection.test.mjs` and verify RED.
- [ ] Extract the first three sub-sections with minimal page orchestration changes.
- [ ] Re-run the same command and verify GREEN.
- [ ] Run `pnpm run build:renderer`.
- [ ] Commit.

### Task H5: Split `WorkspaceView.vue` and `ContentEditorView.vue`

**Files:**
- Create: `src/renderer/src/components/workspace/WorkspaceHeroSection.vue`
- Create: `src/renderer/src/components/workspace/WorkspaceContinueSection.vue`
- Create: `src/renderer/src/components/content/ContentWorkflowHero.vue`
- Create: `src/renderer/src/components/content/ExistingContentSection.vue`
- Modify: `src/renderer/src/views/WorkspaceView.vue`
- Modify: `src/renderer/src/views/WorkspaceView.facade.test.mjs`
- Modify: `src/renderer/src/views/WorkspaceView.redesign.test.mjs`
- Modify: `src/renderer/src/views/ContentEditorView.vue`
- Modify: `src/renderer/src/views/ContentEditorView.facade.test.mjs`
- Modify: `src/renderer/src/views/ContentEditorView.redesign.test.mjs`

- [ ] Write failing tests for section extraction in both views.
- [ ] Run `pnpm exec node --test src/renderer/src/views/WorkspaceView.facade.test.mjs src/renderer/src/views/WorkspaceView.redesign.test.mjs src/renderer/src/views/ContentEditorView.facade.test.mjs src/renderer/src/views/ContentEditorView.redesign.test.mjs` and verify RED.
- [ ] Extract the stable hero/continue/existing-content sections.
- [ ] Re-run the same command and verify GREEN.
- [ ] Run `pnpm run build:renderer && pnpm exec playwright test e2e/electron/editorial-workbench.spec.mjs`.
- [ ] Commit.

---

## Batch 4: Duplication Removal and Reliability Improvements

### Task M1: Replace direct custom-event navigation with centralized shell actions

**Files:**
- Modify: `src/renderer/src/composables/useShellActions.mjs`
- Modify: `src/renderer/src/composables/useShellActions.test.mjs`
- Modify: `src/renderer/src/views/ThemeConfigView.vue`
- Modify: `src/renderer/src/views/WorkspaceView.vue`
- Modify: `src/renderer/src/views/ContentEditorView.vue`
- Modify: `src/renderer/src/views/PreviewView.vue`
- Modify: `src/renderer/src/views/PublishBackupView.vue`
- Modify: `src/renderer/src/views/ImportView.vue`
- Modify: `src/renderer/src/views/RssReaderView.vue`
- Modify: `src/renderer/src/views/TutorialCenterView.vue`

- [ ] Write failing action tests for `openTab` / `openTutorial` as the only navigation path.
- [ ] Run `pnpm exec node --test src/renderer/src/composables/useShellActions.test.mjs` and verify RED.
- [ ] Replace direct `CustomEvent` dispatch sites with centralized actions.
- [ ] Re-run the same command and verify GREEN.
- [ ] Run `pnpm run build:renderer && pnpm exec playwright test e2e/electron/editorial-workbench.spec.mjs`.
- [ ] Commit.

### Task M2: Remove `useContentActions.js` / `.mjs` duplication drift

**Files:**
- Modify: `src/renderer/src/composables/useContentActions.mjs`
- Delete or simplify: `src/renderer/src/composables/useContentActions.js`
- Modify: `src/renderer/src/composables/useContentActions.test.mjs`

- [ ] Write failing API-stability test for a single `useContentActions` export path.
- [ ] Run `pnpm exec node --test src/renderer/src/composables/useContentActions.test.mjs` and verify RED.
- [ ] Collapse duplicate entrypoints without changing call-site behavior.
- [ ] Re-run the same command and verify GREEN.
- [ ] Commit.

### Task M3: Unify workspace path validation logic

**Files:**
- Modify: `src/main/policies/workspacePathPolicy.js`
- Modify: `src/main/policies/workspacePathPolicy.test.js`
- Modify: `src/main/ipc/workspaceIpc.js`
- Modify: `src/main/services/contentService.js`
- Modify: `src/main/services/contentService.test.js`

- [ ] Write failing tests for Windows case normalization, realpath handling, and out-of-root rejection.
- [ ] Run `pnpm exec node --test src/main/policies/workspacePathPolicy.test.js src/main/services/contentService.test.js` and verify RED.
- [ ] Remove duplicated path-normalization code from IPC/service layers and reuse policy helpers.
- [ ] Re-run the same command and verify GREEN.
- [ ] Commit.

### Task M4: Improve content scanning and publish-job reliability

**Files:**
- Modify: `src/main/services/contentService.js`
- Modify: `src/main/services/contentService.test.js`
- Optional Create: `src/main/services/contentJobState.js`
- Optional Create: `src/main/services/contentJobState.test.js`

- [ ] Write failing tests for unchanged-tree rescans and stable publish-job status payloads.
- [ ] Run `pnpm exec node --test src/main/services/contentService.test.js src/main/services/contentJobState.test.js` (omit the second path until the file exists) and verify RED.
- [ ] Implement the smallest cache/state extraction that makes the test pass.
- [ ] Re-run the same command and verify GREEN.
- [ ] Commit.

---

## Batch 5: Contract Tests and Runtime Documentation

### Task L1: Add direct preload API contract tests

**Files:**
- Create: `src/main/preload.test.js`
- Modify: `src/main/preload.js`

- [ ] Write failing tests for exposed `window.bfeApi` groups and callback boundaries.
- [ ] Run `pnpm exec node --test src/main/preload.test.js` and verify RED.
- [ ] Export or structure preload logic minimally so the contract can be tested.
- [ ] Re-run the same command and verify GREEN.
- [ ] Commit.

### Task L2: Document runtime troubleshooting without prematurely changing the dev script

**Files:**
- Modify: `README.md`
- Optional Create: `docs/guides/dev-runtime-troubleshooting.md`

- [ ] Add checklist-style troubleshooting notes for `pnpm run dev`, stale port `5173` processes, and shell differences.
- [ ] Manually verify with `pnpm run dev` and `netstat -ano | findstr :5173`.
- [ ] Commit.

---

## Full verification gates

- [ ] **After Batch 1:** `pnpm exec node --test src/main/services/env/runCommand.test.js src/main/services/publishService.test.js src/main/services/backupService.test.js src/main/services/frameworkService.test.js src/main/services/frameworkToolingService.test.js src/main/main.test.js`
- [ ] **After Batch 2:** `pnpm exec node --test src/main/app/workspaceWorkflowService.test.js src/main/ipc/workspaceIpc.test.js src/main/services/contentPublishWorkflowService.test.js src/main/services/contentService.test.js`
- [ ] **After Batch 3:** `pnpm exec node --test src/renderer/src/composables/useAppShell.test.mjs src/renderer/src/views/ThemeConfigView.facade.test.mjs src/renderer/src/views/ThemeConfigView.redesign.test.mjs src/renderer/src/views/WorkspaceView.facade.test.mjs src/renderer/src/views/WorkspaceView.redesign.test.mjs src/renderer/src/views/ContentEditorView.facade.test.mjs src/renderer/src/views/ContentEditorView.redesign.test.mjs && pnpm run build:renderer && pnpm exec playwright test e2e/electron/editorial-workbench.spec.mjs`
- [ ] **After Batch 4:** `pnpm exec node --test src/renderer/src/composables/useShellActions.test.mjs src/renderer/src/composables/useContentActions.test.mjs src/main/policies/workspacePathPolicy.test.js src/main/services/contentService.test.js && pnpm run build:renderer`
- [ ] **After Batch 5 / before merge:** `pnpm exec node --test && pnpm run build:renderer && pnpm exec playwright test e2e/electron/editorial-workbench.spec.mjs`
