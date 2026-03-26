# Shell & Tutorial Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the shared renderer shell, workflow-page layout, tutorial routing, and workspace preview interactions so the UI matches the approved post-`v1.2.0` requirements instead of the current partially-regressed behavior.

**Architecture:** Keep the existing Electron + Vue single-shell renderer. Fix the shared shell contracts first (`App.vue`, `useAppShell.mjs`, `useShellActions.mjs`, shell popup mount), then repair the shared page-layout/CSS patterns, then upgrade workspace preview interactions and rebuild the tutorial center around explicit target-based navigation.

**Tech Stack:** Electron, Vue 3 `<script setup>`, Node built-in test runner, Playwright Electron E2E, Vite, CSS.

---

## File Structure Map

- Modify: `src/renderer/src/App.vue` — wire shared scroll reset and tutorial target state through the top-level shell.
- Modify: `src/renderer/src/composables/useAppShell.mjs` — own popup anchor metadata, tab-switch reset behavior, and tutorial target state.
- Modify: `src/renderer/src/composables/useShellActions.mjs` — upgrade `openTutorial()` from generic open to target-aware open.
- Modify: `src/renderer/src/components/shell/ShellTopBar.vue` — keep popup mount but stop implying topbar ownership; render fixed shell popup behavior.
- Modify: `src/renderer/src/components/shell/WorkflowSidebar.vue` — remain the sidebar trigger source and expose the account-trigger anchor to shell state.
- Modify: `src/renderer/src/components/shell/SystemStatusPanel.vue` only if needed to fit the tighter shell popup layout without changing content ownership.
- Modify: `src/renderer/src/components/workspace/WorkspaceHeroSection.vue` — remove hero-right note placement and route tutorial CTA to explicit target.
- Modify: `src/renderer/src/views/ImportView.vue` — remove hero-right note placement and route tutorial CTA to `import-recovery`.
- Modify: `src/renderer/src/views/PreviewView.vue` — remove hero-right and inline heading-right note placement and route tutorial CTA to `preview-check`.
- Modify: `src/renderer/src/views/PublishBackupView.vue` — remove hero-right and inline heading-right note placement and replace raw tutorial `CustomEvent` dispatch with explicit shell actions.
- Modify: `src/renderer/src/views/WorkspaceView.vue` — keep local creation progress, make preview image the main interaction target, and preserve the existing 10 preview assets.
- Modify: `src/renderer/src/views/ThemeConfigView.vue` — route tutorial CTA to `theme-config`.
- Modify: `src/renderer/src/views/ContentEditorView.vue` — route tutorial CTA to `content-editing`.
- Modify: `src/renderer/src/views/RssReaderView.vue` — route tutorial CTA to `rss-reading`.
- Modify: `src/renderer/src/views/TutorialCenterView.vue` — replace the workbench-first landing page with the approved single-page sectioned tutorial center.
- Modify: `src/renderer/src/styles.css` — centralize popup anchoring, shared lower-card hero layout, button hover language, theme preview hover/overlay styling, and tutorial-center layout.
- Verify against: `docs/guides/blog-publish-pages-beginner.md` — restore publish workflow tutorial checkpoints.
- Verify against: `docs/guides/git-first-publish-identity.md` — restore Git identity guidance inside the publish tutorial section.
- Verify against: `docs/guides/github-email-and-ssh-for-publish.md` — restore publish credential/email/SSH guidance where relevant.
- Verify against: `docs/guides/github-oauth-app-setup.md` — restore login/device-flow guidance that the tutorial center must retain.
- Verify against: `docs/guides/dev-runtime-troubleshooting.md` — restore preview troubleshooting guidance.
- Modify: `src/renderer/src/composables/useAppShell.test.mjs` — lock popup anchor state, tutorial target state, and tab-switch reset contract.
- Modify: `src/renderer/src/composables/useShellActions.test.mjs` — lock the target-aware tutorial event payload contract.
- Modify: `src/renderer/src/App.facade.test.mjs` — lock top-level shell wiring for scroll region and tutorial target flow if required by the implementation.
- Modify: `src/renderer/src/components/shell/ShellTopBar.redesign.test.mjs` — lock the sidebar-owned popup mount contract.
- Modify: `src/renderer/src/components/shell/WorkflowSidebar.redesign.test.mjs` — lock the sidebar trigger role for popup ownership.
- Modify: `src/renderer/src/components/shell/SystemStatusPanel.redesign.test.mjs` — lock compact popup content ownership without moving the content into page flow.
- Modify: `src/renderer/src/views/WorkspaceView.facade.test.mjs` — lock `workspace-create` tutorial targeting.
- Modify: `src/renderer/src/views/ThemeConfigView.facade.test.mjs` — lock `theme-config` tutorial targeting.
- Modify: `src/renderer/src/views/ContentEditorView.facade.test.mjs` — lock `content-editing` tutorial targeting.
- Modify: `src/renderer/src/views/ImportView.facade.test.mjs` — lock `import-recovery` tutorial targeting.
- Modify: `src/renderer/src/views/PreviewView.facade.test.mjs` — lock `preview-check` tutorial targeting.
- Modify: `src/renderer/src/views/RssReaderView.facade.test.mjs` — lock `rss-reading` tutorial targeting.
- Modify: `src/renderer/src/views/WorkspaceView.redesign.test.mjs` — lock removal of hero-right boxes and local-only progress semantics.
- Modify: `src/renderer/src/views/WorkspaceView.preview-assets.test.mjs` — lock preview image interaction contract while preserving the 10 preview assets.
- Modify: `src/renderer/src/views/ImportView.redesign.test.mjs` — lock removal of hero-right note placement and explicit tutorial target wiring.
- Modify: `src/renderer/src/views/PreviewView.redesign.test.mjs` — lock removal of hero-right/inline-note placement and explicit tutorial target wiring.
- Modify: `src/renderer/src/views/PublishBackupView.redesign.test.mjs` — lock removal of hero-right/inline-note placement.
- Modify: `src/renderer/src/views/PublishBackupView.facade.test.mjs` — lock removal of raw `CustomEvent("bfe:open-tutorial")` dispatch.
- Modify: `src/renderer/src/views/TutorialCenterView.redesign.test.mjs` — lock required tutorial sections, section ids, and section-entry hooks.
- Modify: `e2e/electron/editorial-workbench.spec.mjs` — verify popup placement, tab-switch reset, tutorial deep-link landing, and workspace preview overlay behavior in the running Electron app.

## Task 1: Repair the shared shell popup and navigation contract

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/composables/useAppShell.mjs`
- Modify: `src/renderer/src/composables/useShellActions.mjs`
- Modify: `src/renderer/src/components/shell/ShellTopBar.vue`
- Modify: `src/renderer/src/components/shell/WorkflowSidebar.vue`
- Modify: `src/renderer/src/styles.css`
- Modify: `src/renderer/src/composables/useAppShell.test.mjs`
- Modify: `src/renderer/src/composables/useShellActions.test.mjs`
- Modify: `src/renderer/src/components/shell/ShellTopBar.redesign.test.mjs`
- Modify: `src/renderer/src/components/shell/WorkflowSidebar.redesign.test.mjs`
- Modify: `src/renderer/src/components/shell/SystemStatusPanel.redesign.test.mjs`
- Modify: `src/renderer/src/App.facade.test.mjs`

- [ ] **Step 1: Add failing shell regression coverage**

Extend the existing source-based tests so they prove the new contract before implementation:
- `useAppShell.mjs` owns popup anchor metadata plus tutorial target state
- `setActiveTab()` resets the shared scroll region and closes the popup
- `useShellActions.mjs` exposes `openTutorial(target)` instead of a payload-free open
- `ShellTopBar.vue` keeps the popup mount but no longer implies topbar-owned user navigation
- `WorkflowSidebar.vue` remains the popup trigger owner
- `SystemStatusPanel.vue` remains the popup content owner

- [ ] **Step 2: Run the focused shell tests and confirm RED**

Run:
`pnpm exec node --test "src/renderer/src/composables/useAppShell.test.mjs" "src/renderer/src/composables/useShellActions.test.mjs" "src/renderer/src/components/shell/ShellTopBar.redesign.test.mjs" "src/renderer/src/components/shell/WorkflowSidebar.redesign.test.mjs" "src/renderer/src/components/shell/SystemStatusPanel.redesign.test.mjs" "src/renderer/src/App.facade.test.mjs"`

Expected before the fix: at least one assertion fails because popup state is still boolean-only, tutorial open is still generic, or tab-switch reset is not yet represented.

- [ ] **Step 3: Implement the minimal shell contract change**

Update production code so:
- the sidebar trigger can provide anchor context to shell state
- popup rendering stays fixed to the shell instead of scrolling with `.content-view-scroll`
- tab switches close the popup and reset the shared scroll region to top
- tutorial opens now carry a target payload through the shell contract

- [ ] **Step 4: Re-run the focused shell tests and keep them GREEN**

Run:
`pnpm exec node --test "src/renderer/src/composables/useAppShell.test.mjs" "src/renderer/src/composables/useShellActions.test.mjs" "src/renderer/src/components/shell/ShellTopBar.redesign.test.mjs" "src/renderer/src/components/shell/WorkflowSidebar.redesign.test.mjs" "src/renderer/src/components/shell/SystemStatusPanel.redesign.test.mjs" "src/renderer/src/App.facade.test.mjs"`

Expected: all focused shell tests pass.

## Task 2: Remove the lingering hero-right layouts and restore shared hover affordances

**Files:**
- Modify: `src/renderer/src/components/workspace/WorkspaceHeroSection.vue`
- Modify: `src/renderer/src/views/ImportView.vue`
- Modify: `src/renderer/src/views/PreviewView.vue`
- Modify: `src/renderer/src/views/PublishBackupView.vue`
- Modify: `src/renderer/src/styles.css`
- Modify: `src/renderer/src/views/WorkspaceView.redesign.test.mjs`
- Modify: `src/renderer/src/views/ImportView.redesign.test.mjs`
- Modify: `src/renderer/src/views/PreviewView.redesign.test.mjs`
- Modify: `src/renderer/src/views/PublishBackupView.redesign.test.mjs`

- [ ] **Step 1: Add failing layout/hover regression coverage**

Update the redesign tests so they fail unless:
- Workspace/Import/Preview/Publish stop using lingering hero-right note structures (`page-hero-aside`, `workflow-hero-note`, `workflow-inline-note` in the affected surfaces)
- the replacement information is expected in lower-card/status-row placement
- hover affordance hooks or shared style expectations are represented centrally rather than patched page-by-page
- focus-visible behavior remains explicit instead of being replaced by hover-only styling

- [ ] **Step 2: Run the focused page-layout tests and confirm RED**

Run:
`pnpm exec node --test "src/renderer/src/views/WorkspaceView.redesign.test.mjs" "src/renderer/src/views/ImportView.redesign.test.mjs" "src/renderer/src/views/PreviewView.redesign.test.mjs" "src/renderer/src/views/PublishBackupView.redesign.test.mjs"`

Expected before the fix: the affected pages still expose old hero-right or inline-note structures.

- [ ] **Step 3: Implement the shared layout and hover changes**

Update the affected pages and `styles.css` so:
- title-adjacent right-side boxes are removed from the hero/heading edge
- state / next-step / result framing moves into lower card rows within the main page flow
- button hover behavior is visibly stronger for primary / secondary / danger actions while preserving focus styles
- non-workspace pages do not gain a misleading shared progress bar

- [ ] **Step 4: Re-run the focused page-layout tests and keep them GREEN**

Run:
`pnpm exec node --test "src/renderer/src/views/WorkspaceView.redesign.test.mjs" "src/renderer/src/views/ImportView.redesign.test.mjs" "src/renderer/src/views/PreviewView.redesign.test.mjs" "src/renderer/src/views/PublishBackupView.redesign.test.mjs"`

Expected: all focused page-layout tests pass.

## Task 3: Upgrade workspace theme preview interactions without changing selection semantics

**Files:**
- Modify: `src/renderer/src/views/WorkspaceView.vue`
- Modify: `src/renderer/src/styles.css`
- Modify: `src/renderer/src/views/WorkspaceView.redesign.test.mjs`
- Modify: `src/renderer/src/views/WorkspaceView.preview-assets.test.mjs`

- [ ] **Step 1: Add failing preview-interaction regression coverage**

Add or extend tests so they fail unless:
- the preview image itself is the main open-preview target
- hover interaction is represented for the preview media area
- the preview overlay exposes an explicit close control
- the 10 shipped preview assets remain unchanged

- [ ] **Step 2: Run the focused workspace-preview tests and confirm RED**

Run:
`pnpm exec node --test "src/renderer/src/views/WorkspaceView.redesign.test.mjs" "src/renderer/src/views/WorkspaceView.preview-assets.test.mjs"`

Expected before the fix: the current image interaction remains button-led or lacks the required fullscreen-style overlay contract.

- [ ] **Step 3: Implement the minimal workspace-preview interaction change**

Update production code so:
- hovering the preview image slightly enlarges the media area
- clicking the image opens the app-scaled overlay
- close button, outside-click close, and Esc close all work
- choosing a theme remains separate from simply previewing it

- [ ] **Step 4: Re-run the focused workspace-preview tests and keep them GREEN**

Run:
`pnpm exec node --test "src/renderer/src/views/WorkspaceView.redesign.test.mjs" "src/renderer/src/views/WorkspaceView.preview-assets.test.mjs"`

Expected: focused workspace preview tests pass and the preview asset manifest test still passes.

## Task 4: Restore tutorial content and convert every workflow tutorial CTA to target-based entry

**Files:**
- Reference: `src/renderer/src/composables/useShellActions.mjs` should already expose the target-based tutorial contract after Task 1; only touch it here if `tutorial-home` or section-return actions reveal a gap.
- Modify: `src/renderer/src/components/workspace/WorkspaceHeroSection.vue`
- Modify: `src/renderer/src/views/ThemeConfigView.vue`
- Modify: `src/renderer/src/views/ContentEditorView.vue`
- Modify: `src/renderer/src/views/PreviewView.vue`
- Modify: `src/renderer/src/views/ImportView.vue`
- Modify: `src/renderer/src/views/PublishBackupView.vue`
- Modify: `src/renderer/src/views/RssReaderView.vue`
- Modify: `src/renderer/src/views/TutorialCenterView.vue`
- Modify: `src/renderer/src/styles.css`
- Verify against: `docs/guides/blog-publish-pages-beginner.md`
- Verify against: `docs/guides/git-first-publish-identity.md`
- Verify against: `docs/guides/github-email-and-ssh-for-publish.md`
- Verify against: `docs/guides/github-oauth-app-setup.md`
- Verify against: `docs/guides/dev-runtime-troubleshooting.md`
- Modify: `src/renderer/src/composables/useShellActions.test.mjs`
- Modify: `src/renderer/src/views/WorkspaceView.facade.test.mjs`
- Modify: `src/renderer/src/views/ThemeConfigView.facade.test.mjs`
- Modify: `src/renderer/src/views/ContentEditorView.facade.test.mjs`
- Modify: `src/renderer/src/views/ImportView.facade.test.mjs`
- Modify: `src/renderer/src/views/PreviewView.facade.test.mjs`
- Modify: `src/renderer/src/views/RssReaderView.facade.test.mjs`
- Modify: `src/renderer/src/views/TutorialCenterView.redesign.test.mjs`
- Modify: `src/renderer/src/views/PublishBackupView.facade.test.mjs`

- [ ] **Step 1: Add failing tutorial-center regression coverage**

Update tutorial/source tests so they fail unless:
- each workflow surface uses an explicit tutorial target
- `PublishBackupView.vue` stops dispatching raw tutorial custom events
- `TutorialCenterView.vue` exposes the required section ids and sectioned content structure
- the tutorial center is no longer only a generic workbench landing page
- the restored publish/account/preview tutorial copy is sourced from the required guide documents instead of ad hoc replacement text

- [ ] **Step 2: Run the focused tutorial tests and confirm RED**

Run:
`pnpm exec node --test "src/renderer/src/composables/useShellActions.test.mjs" "src/renderer/src/views/WorkspaceView.facade.test.mjs" "src/renderer/src/views/ThemeConfigView.facade.test.mjs" "src/renderer/src/views/ContentEditorView.facade.test.mjs" "src/renderer/src/views/ImportView.facade.test.mjs" "src/renderer/src/views/PreviewView.facade.test.mjs" "src/renderer/src/views/RssReaderView.facade.test.mjs" "src/renderer/src/views/PublishBackupView.facade.test.mjs" "src/renderer/src/views/TutorialCenterView.redesign.test.mjs"`

Expected before the fix: the current tutorial center and page CTAs still reflect the generic open behavior.

- [ ] **Step 3: Implement the minimal target-based tutorial redesign**

Update production code so:
- every workflow tutorial CTA opens `openTutorial(<required-target>)`
- the tutorial center contains the required section ids and restored workflow content
- each section includes “在软件里怎么做”, “完成检查点 / 下一步”, and an “打开对应页面” action
- tutorial landing scrolls to the correct section after the shell activates the tutorial tab

- [ ] **Step 4: Re-run the focused tutorial tests and keep them GREEN**

Run:
`pnpm exec node --test "src/renderer/src/composables/useShellActions.test.mjs" "src/renderer/src/views/WorkspaceView.facade.test.mjs" "src/renderer/src/views/ThemeConfigView.facade.test.mjs" "src/renderer/src/views/ContentEditorView.facade.test.mjs" "src/renderer/src/views/ImportView.facade.test.mjs" "src/renderer/src/views/PreviewView.facade.test.mjs" "src/renderer/src/views/RssReaderView.facade.test.mjs" "src/renderer/src/views/PublishBackupView.facade.test.mjs" "src/renderer/src/views/TutorialCenterView.redesign.test.mjs"`

Expected: focused tutorial tests pass.

## Task 5: Extend runtime verification and finish integration

**Files:**
- Modify: `e2e/electron/editorial-workbench.spec.mjs`
- Verify against: all files touched in Tasks 1-4

- [ ] **Step 1: Add Electron runtime checks for the repaired behaviors**

Extend the existing Electron workbench spec so it covers:
- sidebar popup placement staying fixed while the main content scrolls
- tab-switch reset to top for the newly opened view
- tutorial CTA landing on the correct tutorial section
- workspace preview overlay open/close behavior
- hover/focus behavior on these named probes:
  - a primary workflow CTA in `WorkspaceHeroSection.vue`
  - a secondary tutorial CTA in one workflow page
  - a danger action in `SystemStatusPanel.vue` or an equivalent destructive action surface

- [ ] **Step 2: Run the Electron UI spec as integration verification**

Run:
`pnpm run test:e2e:ui`

Expected: the runtime spec exposes any remaining integration gap that unit/source tests did not catch.

- [ ] **Step 3: Apply the smallest remaining integration fixes**

Only if the runtime spec exposes remaining gaps, fix the exact shared contract or page-level behavior that caused the failure. Do not widen scope beyond the approved repair set.

- [ ] **Step 4: Run the final verification stack**

Run:
1. `pnpm exec node --test "src/renderer/src/composables/useAppShell.test.mjs" "src/renderer/src/composables/useShellActions.test.mjs" "src/renderer/src/components/shell/ShellTopBar.redesign.test.mjs" "src/renderer/src/components/shell/WorkflowSidebar.redesign.test.mjs" "src/renderer/src/components/shell/SystemStatusPanel.redesign.test.mjs" "src/renderer/src/App.facade.test.mjs" "src/renderer/src/views/WorkspaceView.facade.test.mjs" "src/renderer/src/views/WorkspaceView.redesign.test.mjs" "src/renderer/src/views/WorkspaceView.preview-assets.test.mjs" "src/renderer/src/views/ThemeConfigView.facade.test.mjs" "src/renderer/src/views/ContentEditorView.facade.test.mjs" "src/renderer/src/views/ImportView.facade.test.mjs" "src/renderer/src/views/ImportView.redesign.test.mjs" "src/renderer/src/views/PreviewView.facade.test.mjs" "src/renderer/src/views/PreviewView.redesign.test.mjs" "src/renderer/src/views/PublishBackupView.facade.test.mjs" "src/renderer/src/views/PublishBackupView.redesign.test.mjs" "src/renderer/src/views/RssReaderView.facade.test.mjs" "src/renderer/src/views/TutorialCenterView.redesign.test.mjs"`
2. `pnpm run build:renderer`
3. `pnpm run test:e2e:ui`

Expected:
- focused renderer tests pass
- renderer build passes
- Electron UI runtime verification passes
