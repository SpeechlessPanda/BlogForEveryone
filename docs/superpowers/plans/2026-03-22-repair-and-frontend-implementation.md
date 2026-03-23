# BlogForEveryone Repair and Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed theme/configuration regressions, correct the platform-mismatched preview test, and ship the guided workflow frontend refresh without rewriting the app architecture.

**Architecture:** Keep the existing Electron main process + preload bridge + Vue single-shell renderer. Apply minimal behavior fixes where root cause is known, then reorganize the renderer around a workflow shell and progressive disclosure in the heaviest pages.

**Tech Stack:** Electron, Vue 3 `<script setup>`, Node built-in test runner, Vite, YAML, TOML.

---

## File Structure Map

- Modify: `src/main/services/previewService.test.js` — align preview cleanup expectations with platform behavior.
- Modify: `src/main/services/themeService.js` — add theme-aware local asset storage/path behavior for Stack avatar assets.
- Modify: `src/renderer/src/views/ThemeConfigView.vue` — write correct Landscape keys, write Stack avatar values in theme-compatible format, improve section hierarchy.
- Modify: `src/renderer/src/App.vue` — group tabs into workflow sections and add shell-level context/next-step summary.
- Modify: `src/renderer/src/styles.css` — support grouped shell navigation, summary cards, and stronger visual hierarchy.
- Modify: `src/renderer/src/views/WorkspaceView.vue` — emphasize create/continue flow and reduce destructive-action prominence.
- Modify: `src/renderer/src/views/PreviewView.vue` — prioritize status and primary preview actions over logs.
- Modify: `src/renderer/src/views/ContentEditorView.vue` — separate writing from optional auto-publish concerns.
- Modify: `src/renderer/src/views/PublishBackupView.vue` — split publish flow from maintenance/backup and add a clearer pre-publish checklist.
- Modify: `src/renderer/src/views/ImportView.vue` — frame import as an alternate starting path.
- Modify: `src/renderer/src/views/RssReaderView.vue` — visually demote RSS as an optional extension.
- Modify: `src/renderer/src/views/TutorialCenterView.vue` only if necessary to align wording with the new workflow.
- Modify: `README.md` and/or tutorial copy later so product guidance matches shipped behavior.

## Task 1: Fix the preview cleanup regression test

**Files:**
- Modify: `src/main/services/previewService.test.js`
- Verify against: `src/main/services/previewService.js`

- [ ] **Step 1: Write the failing expectation update in the test**

Change the second test so it asserts behavior that is true on the current platform:
- `kill()` is always called for a tracked process.
- `processTreeKiller(pid)` is called only on Windows.

- [ ] **Step 2: Run the test to verify RED is meaningful**

Run: `pnpm exec node --test src/main/services/previewService.test.js`

Expected before the fix: the existing cleanup test fails on Linux because it still expects `killerPid === 4321`.

- [ ] **Step 3: Implement the minimal test change**

Adjust the assertion to branch on `process.platform` or assert the platform-conditional contract directly.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `pnpm exec node --test src/main/services/previewService.test.js`

Expected: both subtests pass.

## Task 2: Fix Hexo Landscape background and favicon mapping

**Files:**
- Modify: `src/renderer/src/views/ThemeConfigView.vue`
- Verify against: `e2e-real-workspaces/hexo-landscape/node_modules/hexo-theme-landscape/_config.yml`

- [ ] **Step 1: Add failing regression coverage for Landscape key mapping**

Before changing production code, add or extract testable mapping logic that proves:
- Hexo Landscape background writes `theme_config.banner`
- Hexo Landscape favicon writes `theme_config.favicon`
- generic Hexo fallback behavior remains intact for other themes

- [ ] **Step 2: Run the new focused test and confirm RED**

Use the repo’s Node test runner against the new test file.

- [ ] **Step 3: Implement the minimal mapping fix**

Update `ThemeConfigView.vue` so:
- `applyPersonalization()` writes `theme_config.banner` and `theme_config.favicon` for Landscape
- `applyLocalBackgroundImage()` writes `theme_config.banner` for Landscape
- `uploadLocalFavicon()` writes `theme_config.favicon` for Landscape
- `loadConfig()` reads Landscape values back from the same keys

- [ ] **Step 4: Re-run the focused test**

Expected: mapping tests pass.

## Task 3: Fix Hugo Stack avatar path/storage behavior

**Files:**
- Modify: `src/main/services/themeService.js`
- Modify: `src/renderer/src/views/ThemeConfigView.vue`
- Verify against: `e2e-real-workspaces/hugo-stack/themes/hugo-theme-stack/layouts/_partials/helper/image.html`

- [ ] **Step 1: Add failing regression coverage for Stack avatar handling**

Create a focused test around the asset-path behavior proving:
- Stack avatar uploads are stored in a Hugo-assets-compatible location
- the written config value is `img/<file>` without a leading slash
- other Hugo asset uploads retain current behavior where required

- [ ] **Step 2: Run the focused test and confirm RED**

Use `pnpm exec node --test ...` for the new test file.

- [ ] **Step 3: Implement the minimal fix**

Update production code so Stack avatar uploads:
- store the file under an `assets/img` path (or equivalent theme-compatible assets path)
- persist `params.sidebar.avatar = "img/<name>"`
- keep Anatole avatar behavior unchanged
- continue exposing a readable current avatar value in the UI

- [ ] **Step 4: Re-run the focused test**

Expected: avatar regression tests pass.

## Task 4: Reorganize the shell into a guided workflow

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/styles.css`

- [ ] **Step 1: Add or identify shell-level verification targets**

Because renderer tests are sparse, capture verifiable acceptance criteria in code comments or a checklist before implementation:
- grouped navigation sections render in the sidebar
- current workspace and recommended next action are visible
- system utilities remain accessible but visually secondary

- [ ] **Step 2: Implement grouped navigation data in `App.vue`**

Refactor the tab metadata into grouped workflow sections while preserving the existing active-tab logic and custom events.

- [ ] **Step 3: Add shell summary state**

Derive and display:
- current workspace
- framework/theme
- environment/login readiness snapshot
- recommended next action based on app state and selected workspace

- [ ] **Step 4: Update styles for the new hierarchy**

Add styles for:
- grouped sidebar sections
- shell summary card(s)
- stronger separation between primary workflow and secondary system controls

- [ ] **Step 5: Run renderer build verification**

Run: `pnpm run build:renderer`

Expected: build succeeds.

## Task 5: Reduce intimidation in Theme Configuration

**Files:**
- Modify: `src/renderer/src/views/ThemeConfigView.vue`
- Modify: `src/renderer/src/styles.css` if shared styles are needed

- [ ] **Step 1: Reorganize the page into staged sections**

Preserve current behavior but reorder the UI into:
1. current blog/theme
2. basic identity
3. images
4. reading experience
5. optional engagement
6. theme-specific settings
7. advanced/raw config

- [ ] **Step 2: Demote advanced/raw config**

Keep the flattened config editor available, but behind a lower-priority presentation such as a collapsible or visually secondary section.

- [ ] **Step 3: Add beginner-safe helper copy**

Place short “what this does” guidance near the top of each major section, especially the image and advanced sections.

- [ ] **Step 4: Re-run renderer build verification**

Run: `pnpm run build:renderer`

Expected: build succeeds.

## Task 6: Clean up the workflow pages to match the new shell

**Files:**
- Modify: `src/renderer/src/views/WorkspaceView.vue`
- Modify: `src/renderer/src/views/PreviewView.vue`
- Modify: `src/renderer/src/views/ContentEditorView.vue`
- Modify: `src/renderer/src/views/PublishBackupView.vue`
- Modify: `src/renderer/src/views/ImportView.vue`
- Modify: `src/renderer/src/views/RssReaderView.vue`

- [ ] **Step 1: Workspace view**

Emphasize “create your first blog” and “continue setup,” and visually demote destructive remove actions.

- [ ] **Step 2: Preview view**

Move selected-workspace context and preview status above logs/events. Keep logs, but make them secondary.

- [ ] **Step 3: Content editor view**

Separate content creation from optional auto-publish configuration and keep recent task status visible.

- [ ] **Step 4: Publish & backup view**

Split the page into a clear publish flow plus a separate maintenance/backup section, including a pre-publish checklist.

- [ ] **Step 5: Import and RSS views**

Reframe import as an alternate starting path and RSS as an optional extension.

- [ ] **Step 6: Re-run renderer build verification**

Run: `pnpm run build:renderer`

Expected: build succeeds.

## Task 7: Manual QA and behavior validation

**Files:**
- Verify changed renderer flows in a local run
- Verify generated project configs in the real-workspace fixtures where applicable

- [ ] **Step 1: Run focused tests**

Run the targeted Node tests added for preview cleanup, Landscape mapping, and Stack avatar behavior.

- [ ] **Step 2: Run renderer build**

Run: `pnpm run build:renderer`

- [ ] **Step 3: Manual shell and page QA**

Launch the app or closest runnable dev flow and verify:
- grouped workflow navigation renders correctly
- Theme Configuration is easier to scan
- preview and publish pages show the new hierarchy without broken interactions

- [ ] **Step 4: Fixture validation**

Use the existing real-workspace fixtures or regeneration scripts to confirm:
- Landscape config now writes banner/favicon keys that the theme actually consumes
- Stack avatar config now resolves to a non-empty rendered image path
