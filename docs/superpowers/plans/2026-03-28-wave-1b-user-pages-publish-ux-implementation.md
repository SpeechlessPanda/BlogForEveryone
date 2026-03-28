# Wave 1B User-Pages Publish UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the user-pages publish path stop reading as if the deploy repository name must be manually filled, while keeping project-pages manual and leaving backend behavior unchanged.

**Architecture:** Renderer-only UX correction in `PublishBackupView.vue`. User-pages will surface the deploy repository as a derived read-only value from the normalized login, while project-pages keeps the existing editable repo-name input. Focused source-shape tests will lock that contract and the payload shape must stay unchanged.

**Tech Stack:** Vue 3 renderer, node:test source-shape tests, existing renderer build pipeline.

---

## File structure map

### Required implementation files
- Modify: `src/renderer/src/views/PublishBackupView.vue`
- Modify: `src/renderer/src/views/PublishBackupView.redesign.test.mjs`
- Modify: `src/renderer/src/views/PublishBackupView.facade.test.mjs`

### Read-only context
- Read-only: `src/renderer/src/styles.css`

### Must stay unchanged in Wave 1B
- `src/main/**`
- `src/renderer/src/views/ImportView.vue`
- `src/renderer/src/composables/**`
- `package.json`

---

### Task 1: User-pages publish UX simplification

**Files:**
- Modify: `src/renderer/src/views/PublishBackupView.vue`
- Modify: `src/renderer/src/views/PublishBackupView.redesign.test.mjs`
- Modify: `src/renderer/src/views/PublishBackupView.facade.test.mjs`

- [ ] **Step 1: Write the failing tests**

Strengthen the focused publish tests so they prove:
- user-pages no longer presents deploy repo naming as a manual fill step
- user-pages shows the deploy repo as derived from `${normalizedPublishLogin}.github.io`
- project-pages still keeps the manual deploy repo name input
- readiness/copy no longer frames missing deploy repo name as the blocker in user-pages mode
- publish payload field set remains unchanged

- [ ] **Step 2: Run the focused publish slice to verify RED**

Run:

```bash
pnpm exec node --test "src/renderer/src/views/PublishBackupView.redesign.test.mjs" "src/renderer/src/views/PublishBackupView.facade.test.mjs"
```

Expected:
- FAIL on the newly-added user-pages UX assertions.

- [ ] **Step 3: Implement the minimal renderer-only fix**

Update `PublishBackupView.vue` so that:
- when `publishForm.siteType === USER_PAGES`, the deploy repository is shown as a derived/read-only outcome, not as a generic repo-name field the user is asked to fill
- the user-pages copy and readiness text align with the real derived behavior
- `project-pages` continues to use the editable deploy repo name input
- `publishToGitHub(...)` still receives the same payload field set as before

Do not change backend calls, payload keys, or import flow.

- [ ] **Step 4: Re-run the focused publish slice to verify GREEN**

Run again:

```bash
pnpm exec node --test "src/renderer/src/views/PublishBackupView.redesign.test.mjs" "src/renderer/src/views/PublishBackupView.facade.test.mjs"
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

- [ ] **Step 6: Stop at Wave 1B boundary**

Do not broaden into import autodetect, dark-theme work, docs, package/privacy, or release flow from this task.

---

## Wave 1B stop conditions

Stop and re-scope if any of these become necessary:
- backend publish validation changes
- new preload/API surface
- import/recovery flow changes
- version bump or release operations
- styling-only redesign beyond what is necessary to make the user-pages repo read as derived state
