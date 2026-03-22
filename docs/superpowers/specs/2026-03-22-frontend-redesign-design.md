# BlogForEveryone Frontend Redesign Design

**Date:** 2026-03-22

## Goal

Refresh the desktop app so first-time blog creators feel guided from setup to publish, while preserving the current Electron + Vue single-shell architecture and avoiding a framework rewrite.

## Current UX Diagnosis

1. `src/renderer/src/App.vue` presents all major tabs as equal-priority tools, so the product feels like a control panel instead of a guided journey.
2. `src/renderer/src/views/ThemeConfigView.vue` mixes basic identity fields, theme-specific configuration, raw config editing, asset upload, analytics, comments, and RSS controls in one long page.
3. Several operational views (`WorkspaceView.vue`, `PreviewView.vue`, `PublishBackupView.vue`, `ContentEditorView.vue`) emphasize commands and logs more than outcome framing and “what to do next.”
4. Workspace context exists in `workspaceStore.js`, but many pages still make the user repeatedly re-orient around the selected project.
5. `src/renderer/src/styles.css` already has a coherent warm visual language, but hierarchy is too flat because many panels and actions have similar weight.

## Design Directions Considered

### Direction A — Guided workflow shell

Rework the shell into a staged path: **Start → Build → Check → Publish → Optional tools**. Keep the existing single-shell tab implementation, but group views, highlight the recommended next action, and surface the current workspace plus readiness context at the shell level.

**Pros**
- Best fit for beginner positioning.
- Uses existing `App.vue` tab state and `bfe:open-tab` behavior.
- Improves orientation without adding routing complexity.

**Cons**
- Requires coordinated changes in the shell and several views.

### Direction B — Dashboard-first home

Turn the tutorial/home area into a richer landing dashboard with environment state, login state, current workspace, quick actions, and progress cues, while leaving most inner pages mostly unchanged.

**Pros**
- Lower implementation risk.
- Improves first-run experience quickly.

**Cons**
- Deep pages remain dense and intimidating.
- Solves entry experience more than ongoing workflow clarity.

### Direction C — Progressive disclosure inside current tabs

Keep the current shell and reduce complexity within individual pages by collapsing advanced controls, separating beginner basics from expert controls, and demoting raw config/log panels.

**Pros**
- Very compatible with the existing codebase.
- Ideal for the heavy theme/configuration screens.

**Cons**
- Does not fully solve shell-level “where do I go next?” confusion.

## Recommended Direction

Use **Direction A as the primary redesign** and **Direction C as the supporting detail pattern**.

This combination keeps the current architecture intact while solving the product’s biggest usability problem: the app does not currently communicate a beginner-safe sequence. The shell should teach the journey; each heavy page should reveal advanced controls only after the basics are clear.

## Proposed Information Architecture

### Shell structure

Group the current tabs into workflow sections in `App.vue`:

- **开始**
  - 教程中心
  - 导入恢复
- **搭建博客**
  - 博客创建
  - 主题配置
  - 内容编辑
- **检查与发布**
  - 本地预览
  - 发布与备份
- **扩展**
  - RSS 阅读

The shell should also expose a compact summary area that always shows:

- current workspace
- framework/theme
- readiness state
- recommended next action

System utilities currently in the sidebar footer should remain available but become visually secondary.

### View-level restructuring

#### Tutorial center

Keep it as the onboarding knowledge base, but make it feel like the first step in the workflow rather than a disconnected documentation island. Each section should reinforce the next app action.

#### Workspace view

Keep theme preview cards and the progress flow, but restructure the page as:

1. Create your first blog
2. Creation progress
3. Existing blogs / continue setup

Destructive actions should be visually weaker than “continue setup” actions.

#### Theme configuration view

Split the page into explicit sections:

1. Current blog
2. Basic identity
3. Images
4. Reading experience
5. Optional engagement
6. Theme-specific settings
7. Advanced raw config

The raw flattened config editor should remain available for power users, but not at equal priority with the beginner flow.

#### Preview view

Restructure around reassurance:

1. Selected blog and preview address
2. Primary actions (start/open/restart/stop)
3. Friendly status summary
4. Logs and events

#### Content editor view

Separate writing from deployment concerns:

1. Create new content
2. Optional auto-publish settings
3. Edit existing content
4. Recent task status

#### Publish & backup view

Separate the “publish my blog” climax from maintenance:

1. Publish your blog
2. Pre-publish checklist
3. Result and blog URL
4. Backup and recovery

#### Import view

Present import as an alternate starting path, not just an admin utility.

#### RSS view

Keep it functional but clearly optional, positioned as an extension rather than part of the core blog-creation path.

## Interaction Principles

1. Persist the selected workspace and visibly reuse it everywhere.
2. Show one primary action per page before secondary operations.
3. Put “what this step does” and “what to do next” near the top of each workflow page.
4. Keep logs available, but visually subordinate to user-facing outcomes.
5. Preserve the warm visual system from `styles.css`; improve hierarchy rather than replacing the aesthetic.

## Constraints

- Keep Electron + Vue + current single-shell approach.
- No router rewrite.
- No design-system library adoption.
- No enterprise/admin visual direction.
- Keep compatibility with existing `window.bfeApi` and `workspaceStore` patterns.

## Implementation Notes

The redesign should be delivered incrementally:

1. Shell/navigation hierarchy in `App.vue` and `styles.css`.
2. Theme configuration information hierarchy, because it is the most intimidating view.
3. Workflow page cleanup (`WorkspaceView.vue`, `PreviewView.vue`, `ContentEditorView.vue`, `PublishBackupView.vue`, `ImportView.vue`, `RssReaderView.vue`).
4. Documentation updates so the README and tutorial guidance match the new UI flow.
