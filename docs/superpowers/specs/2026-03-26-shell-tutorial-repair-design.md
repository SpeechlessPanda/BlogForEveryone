# BlogForEveryone Shell & Tutorial Repair Design

**Date:** 2026-03-26

## Goal

Repair the renderer so the sidebar account popup, cross-view hero layouts, tutorial flows, per-view progress behavior, and workspace theme preview interactions all match the intended guided workflow instead of the partially-regressed release behavior that shipped in `v1.2.0`.

## Approved Direction

Use a **three-layer repair** instead of isolated page tweaks:

1. **Shell/navigation behavior** — fix the sidebar-adjacent popup, tab-switch scroll reset, and tutorial deep-link contract in the shared shell.
2. **Shared page layout/styling** — remove lingering title-adjacent right-side boxes, normalize top-of-page card placement, and restore clear hover affordances through shared CSS patterns.
3. **Workspace-only rich media** — enhance the ten theme preview cards with hover zoom and a true application-scaled fullscreen preview overlay.

This direction follows the actual renderer ownership boundaries already present in `App.vue`, `useAppShell.mjs`, `useShellActions.mjs`, `styles.css`, `WorkspaceView.vue`, and `TutorialCenterView.vue`.

## Exact User Requirements

The implementation must satisfy all of the following together:

1. The login-status popup must appear **near the sidebar user login status**, remain **fixed relative to the shell**, and **must not scroll with the main content area**.
2. The title-adjacent right-side boxes still remaining in **导入恢复 / 博客创建 / 本地预览 / 发布与备份** must be moved out of the hero-right position and placed into the lower card flow.
3. Each screen must have **independent progress meaning**, not feel like a single shared progress bar reused across the whole app.
4. Switching tabs must always reset the newly opened screen to the **top of its scroll region**.
5. Every button must show an obvious **hover-state interaction** before click.
6. The ten theme preview images in **博客创建** must slightly enlarge on hover and open in an **application-scaled fullscreen overlay** when clicked, with an explicit exit control.
7. The tutorial center must restore the missing tutorial content and become a **single-page, sectioned tutorial center**.
8. Clicking the tutorial entry on any workflow screen must open the tutorial center and land on the **corresponding tutorial section**, not just a generic landing page.

## Current File-Backed Diagnosis

### Shell behavior

- `src/renderer/src/components/shell/WorkflowSidebar.vue` owns the current account trigger via `data-sidebar-entry="user"`.
- `src/renderer/src/components/shell/ShellTopBar.vue` still owns the popup Teleport mount even though the trigger lives in the sidebar.
- `src/renderer/src/components/shell/SystemStatusPanel.vue` contains the popup content blocks (account, appearance, updates, environment).
- `src/renderer/src/composables/useAppShell.mjs` only stores `isShellPopupOpen`; it does not track popup anchor semantics or scroll reset behavior.
- `src/renderer/src/App.vue` mounts all views into one shared `.content-view-scroll` region.
- `src/renderer/src/styles.css` positions `.shell-popup-overlay--sidebar` using fixed full-screen overlay padding instead of a true sidebar-local anchor.

### Tutorial behavior

- `src/renderer/src/composables/useShellActions.mjs` exposes `openTutorial()` with **no target payload**.
- `src/renderer/src/composables/useAppShell.mjs` listens for `bfe:open-tutorial` and only switches `activeTab` to `tutorial`.
- `src/renderer/src/views/TutorialCenterView.vue` is currently a workbench-like landing page, not a true tutorial catalog/detail surface.
- Workflow views (`WorkspaceView.vue`, `ThemeConfigView.vue`, `ContentEditorView.vue`, `PreviewView.vue`, `ImportView.vue`, `RssReaderView.vue`) all route tutorial actions into the same generic open.
- `src/renderer/src/views/PublishBackupView.vue` is additionally inconsistent because it dispatches `new CustomEvent("bfe:open-tutorial")` directly instead of using `useShellActions`.

### Shared hero/layout regressions

- `src/renderer/src/components/workspace/WorkspaceHeroSection.vue` still uses `page-hero-grid` with `.page-hero-aside`.
- `src/renderer/src/views/ImportView.vue`, `PreviewView.vue`, and `PublishBackupView.vue` still use `.workflow-hero-note` hero-side panels and additional inline right-side note blocks.
- `src/renderer/src/styles.css` still defines the shared hero/right-column structure through `.page-hero-grid`, `.page-hero-aside`, `.workflow-inline-note`, and related selectors.

### Workspace preview media

- `src/renderer/src/views/WorkspaceView.vue` already owns the ten preview assets, local preview lightbox state, and current `dialog.theme-preview-lightbox` rendering.
- `src/renderer/src/styles.css` currently gives theme cards only very light hover motion and requires a separate “放大预览” button instead of treating the preview image itself as the entry point.

## Proposed Design

### 1. Shell and navigation contract

#### 1.1 Sidebar account popup

Keep popup state and rendering in the shell layer, but change the behavior from “full overlay padded toward the sidebar” to “shell-owned floating card anchored beside the sidebar account entry.”

The sidebar remains the trigger owner, while the shell becomes responsible for:

- opening and closing the popup,
- receiving or resolving the trigger element reference,
- measuring the trigger bounding rect on open,
- rendering the popup in a fixed-position shell layer using that trigger rect,
- re-positioning on window resize,
- dismissing it on outside click, tab change, or explicit close,
- ensuring popup visibility is independent from the main content scroll region.

Concrete contract:

- `WorkflowSidebar.vue` remains the source of the account trigger and must expose the active trigger element or an anchor rect to the shell contract.
- `useAppShell.mjs` becomes the owner of `isShellPopupOpen` plus popup anchor metadata (`anchorEl` or equivalent rect/state), instead of a bare boolean-only popup toggle.
- `ShellTopBar.vue` may keep the Teleport mount, but it must render a compact floating card that is visually anchored beside `[data-sidebar-entry="user"]`, not a top-right page drawer.
- Desktop verification target: after opening from the sidebar user entry, the popup’s viewport position remains unchanged while `.content-view-scroll` is scrolled.

#### 1.2 Tab-switch scroll reset

When `activeTab` changes, the shell must:

1. close the popup,
2. reset `.content-view-scroll` to `scrollTop = 0`,
3. allow the newly opened screen to start at its own top.

This behavior must live in shared shell state rather than being reimplemented inside individual views.

#### 1.3 Tutorial target contract

Replace the current boolean-style tutorial open event with a target-aware contract:

- `openTutorial(target)` in `useShellActions.mjs`
- a matching tutorial target state in `useAppShell.mjs`
- targeted rendering/scroll behavior in `TutorialCenterView.vue`

Required target keys:

- `tutorial-home`
- `workspace-create`
- `theme-config`
- `content-editing`
- `preview-check`
- `publish-release`
- `import-recovery`
- `rss-reading`

Required page → target → section mapping:

| Source surface | Trigger target | Tutorial section id |
| --- | --- | --- |
| `WorkspaceView.vue` | `workspace-create` | `tutorial-workspace-create` |
| `ThemeConfigView.vue` | `theme-config` | `tutorial-theme-config` |
| `ContentEditorView.vue` | `content-editing` | `tutorial-content-editing` |
| `PreviewView.vue` | `preview-check` | `tutorial-preview-check` |
| `PublishBackupView.vue` | `publish-release` | `tutorial-publish-release` |
| `ImportView.vue` | `import-recovery` | `tutorial-import-recovery` |
| `RssReaderView.vue` | `rss-reading` | `tutorial-rss-reading` |
| generic tutorial entry / tutorial tab | `tutorial-home` | `tutorial-home` |

Sequencing contract:

1. workflow screen dispatches `openTutorial(target)`;
2. shell switches `activeTab` to `tutorial` and resets `.content-view-scroll` to top;
3. `TutorialCenterView.vue` renders the tutorial surface with the matching `data-tutorial-section` target;
4. after render, the shared scroll region scrolls the matching section heading into view.

All workflow views must use the same centralized helper instead of dispatching raw window events.

### 2. Shared workflow-page layout

The four regressed workflow pages — **博客创建、导入恢复、本地预览、发布与备份** — should share one top-of-page structure:

1. title and page explanation,
2. primary and secondary actions,
3. one lower card row for state / next step / blocker / result framing.

That means the current right-side hero panels and inline heading-side note blocks must be removed from hero-right placement and re-expressed as lower cards within the main flow.

This same layout rule should also keep the page visually consistent with the earlier fixed theme/content pages, so the product stops feeling half-updated.

### 3. Independent progress semantics

There must not be one visually-shared progress concept that implies the whole app is on one global progress bar.

Instead:

- `WorkspaceView.vue` keeps creation progress because it represents a true multi-step flow.
- `ThemeConfigView.vue`, `ContentEditorView.vue`, `ImportView.vue`, `PreviewView.vue`, `PublishBackupView.vue`, `RssReaderView.vue`, and `TutorialCenterView.vue` must not introduce or retain a hero-level step progress bar that implies one shared global workflow meter.
- Those pages may keep status cards, readiness labels, next-step cards, logs, or result summaries, but those elements must be framed as local state summaries rather than numeric step progress.
- Shell-level status panels may still show environment/update progress, but those must remain clearly separate from page workflow progress.

The design language should stay consistent, but the state meaning must remain local to each page.

### 4. Global hover affordances

All buttons across the editorial shell need a stronger hover-state language. The hover behavior should be applied centrally in `styles.css`, not patched per view.

Hover goals:

- visibly signal clickability before activation,
- keep primary / secondary / danger actions visually distinct,
- work in both light and dark shell appearance,
- preserve keyboard focus states rather than replacing them.

Expected interaction style:

- slight lift or scale,
- stronger border/background contrast,
- subtle shadow reinforcement,
- no large motion that feels noisy or inconsistent.

### 5. Workspace theme preview interactions

`WorkspaceView.vue` should treat the preview image as the main interaction target.

Required behavior:

- hovering a theme preview image slightly enlarges the image/media area,
- clicking the image opens a larger fullscreen-style preview overlay sized relative to the application viewport,
- the overlay provides an explicit close button, click-outside close, and Esc close,
- theme selection remains a separate decision from previewing so users do not accidentally reselect a theme while only trying to inspect it.

The existing preview asset map should be preserved.

### 6. Tutorial center redesign

The tutorial center must become a **single-page, sectioned knowledge surface** instead of a generic workbench landing page.

Recommended structure:

1. sticky/local section navigation,
2. concise intro explaining how tutorials map to the workflow,
3. dedicated sections for each workflow area,
4. clear “open corresponding screen” actions on every workflow section.

The current workbench-first copy in `TutorialCenterView.vue` should be replaced or demoted so tutorial content is once again the center of gravity.

The new tutorial center must support targeted entry from any workflow screen and scroll to the matching section when opened from that screen.

#### 6.1 Tutorial content contract

The redesigned tutorial center must contain these required sections:

1. `tutorial-home` — explains how the tutorial center maps to the workflow and how to jump back into the product.
2. `tutorial-workspace-create` — creating a first workspace, choosing framework, choosing theme, and confirming local path inputs.
3. `tutorial-theme-config` — setting brand title, assets, reading rhythm, and compatibility checks.
4. `tutorial-content-editing` — creating content, continuing existing content, and using preview as the checkpoint after writing.
5. `tutorial-preview-check` — starting localhost preview, checking the address, restarting/stopping preview, and reading logs only as a fallback.
6. `tutorial-publish-release` — preparing GitHub repository info, Git identity, Pages expectations, and backup sequencing.
7. `tutorial-import-recovery` — importing an existing blog, confirming theme recognition, and optionally restoring RSS state.
8. `tutorial-rss-reading` — adding subscriptions, refreshing feeds, and using RSS as a reading/idea surface instead of a publishing surface.

Each workflow section must contain, at minimum:

- one section heading and short intro,
- one “在软件里怎么做” checklist,
- one “完成检查点 / 下一步” block,
- one “打开对应页面” action that routes back into the owning workflow screen.

Content source of truth:

- Publish/account guidance must be restored from `docs/guides/blog-publish-pages-beginner.md`, `docs/guides/git-first-publish-identity.md`, `docs/guides/github-email-and-ssh-for-publish.md`, and `docs/guides/github-oauth-app-setup.md`.
- Preview troubleshooting guidance must be restored from `docs/guides/dev-runtime-troubleshooting.md`.
- Workspace/theme/content/import/RSS sections must be rebuilt from the current workflow-page guidance already present in the renderer views, keeping terminology aligned with the in-product labels.
- `docs/guides/release-signing-auto-update.md` is for application release management and must not become a main tutorial-center workflow section for blog authoring.

## File Responsibilities After Repair

- `src/renderer/src/App.vue`
  - provide shared shell scroll ref / target state wiring to top-level views.
- `src/renderer/src/composables/useAppShell.mjs`
  - own popup visibility, tutorial target state, and tab-switch reset behavior.
- `src/renderer/src/composables/useShellActions.mjs`
  - own the target-aware navigation event contract.
- `src/renderer/src/components/shell/ShellTopBar.vue`
  - render the shell-owned popup mount without implying topbar ownership.
- `src/renderer/src/components/shell/WorkflowSidebar.vue`
  - remain the sidebar trigger source for account/open-popup behavior.
- `src/renderer/src/components/shell/SystemStatusPanel.vue`
  - keep popup content blocks while allowing a tighter shell popup layout.
- `src/renderer/src/components/workspace/WorkspaceHeroSection.vue`
  - remove hero-right note layout and use lower-card framing.
- `src/renderer/src/views/ImportView.vue`
  - remove hero-right note and route tutorials with explicit target.
- `src/renderer/src/views/PreviewView.vue`
  - remove hero-right and inline heading-right note layouts; route tutorials with explicit target.
- `src/renderer/src/views/PublishBackupView.vue`
  - remove hero-right and inline heading-right note layouts; replace raw `CustomEvent` tutorial dispatch with shell actions.
- `src/renderer/src/views/WorkspaceView.vue`
  - keep local creation progress, improve theme preview media interactions, route tutorials with explicit target.
- `src/renderer/src/views/TutorialCenterView.vue`
  - become the single-page tutorial center with sectioned content and targeted landing behavior.
- `src/renderer/src/styles.css`
  - centralize popup placement, shared hero/card layout, button hover states, theme preview motion, and tutorial-center layout styles.

## Verification Requirements

The repair is not complete unless all of these are verified with fresh evidence:

1. Sidebar user popup opens from `[data-sidebar-entry="user"]`, renders in a fixed-position shell layer, stays visually anchored beside the sidebar account entry on desktop, and does not move when `.content-view-scroll` is scrolled.
2. Switching tabs resets the new page to the top of `.content-view-scroll` before the user starts interacting with the newly opened page.
3. Workflow hero-right boxes and heading-side inline notes are gone from Workspace, Import, Preview, and Publish pages; the replacement state cards appear in lower card rows inside the main page flow.
4. Hovering primary / secondary / danger buttons changes shared interactive styling before click (lift/scale and stronger contrast/shadow), while keyboard focus remains visible.
5. Workspace theme preview images enlarge on hover and clicking the image opens an app-scaled overlay that provides visible close button, outside-click close, and Esc close.
6. Tutorial buttons from each workflow page open the tutorial center at the correct section according to the required page→target→section mapping table above.
7. Tutorial center visibly contains restored workflow tutorial content for all required sections instead of only generic landing-page copy.
8. Existing renderer build and Electron workflow tests still pass, with additional regression coverage added for the repaired behaviors.

Required verification surfaces:

- source-structure tests for affected view files (`*.redesign.test.mjs`, `App.facade.test.mjs`, `useAppShell.test.mjs`, `WorkspaceView.preview-assets.test.mjs`, `TutorialCenterView.redesign.test.mjs`)
- Electron runtime verification for popup placement, tab-switch scroll reset, tutorial deep-link landing, and workspace preview overlay behavior
- fresh `pnpm run build:renderer`
- fresh targeted Node test runs for updated renderer test files

## Constraints

- Keep the existing Electron + Vue single-shell architecture.
- Do not introduce a router rewrite.
- Do not add external UI libraries for popup, dialog, or routing.
- Keep the repair incremental and test-driven.
- Fix the actual shared contracts first, then the page-level manifestations.

## Implementation Sequence

1. Repair shell state and event contracts (`App.vue`, `useAppShell.mjs`, `useShellActions.mjs`, popup-related shell components).
2. Repair shared layout and hover styling (`styles.css`) alongside the four affected workflow pages.
3. Upgrade `WorkspaceView.vue` theme preview interactions.
4. Redesign `TutorialCenterView.vue` around sectioned tutorial content and targeted deep-link entry.
5. Add/adjust regression coverage, then run build and Electron runtime verification.
