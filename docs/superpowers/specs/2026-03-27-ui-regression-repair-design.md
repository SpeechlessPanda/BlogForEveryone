# BlogForEveryone UI Regression Repair Design

**Goal:** Repair the current renderer regressions where the content-editor / local-preview / publish screens show chaotic oversized inner boxes, and restore the sidebar footer popup so both footer entries open the shared utility surface correctly.

**Approved Direction:** Shared shell/layout repair first, then minimal page-local cleanup only where the shared fix is not sufficient.

---

## Exact user requirements

1. 修复三个界面内部“框混乱”的问题：
   - 内容编辑页
   - 本地预览页
   - 发布到 GitHub Pages 页
2. 修复侧边栏底部两个入口点击后不弹出环境检查 / 更新相关界面的问题。
3. 两个入口不拆成两个独立弹层，而是打开同一个工具弹层。
4. 两个入口需要“分块聚焦”：
   - 点击“模式”时默认聚焦显示模式块
   - 点击“账户”时默认聚焦账户块
   - 同一弹层内仍保留更新块和环境块
5. 修复完成后必须跑完整验证，包括 E2E 和能覆盖大部分代码的测试。
6. 修复完成后执行 commit / push / merge（本地和远程都做），但**不要 publish**。

---

## Current grounded diagnosis

### 1. Three workflow pages are broken by a shared nested-card pattern

The three affected pages all use the same editorial workflow vocabulary from `src/renderer/src/styles.css`:

- `.panel`
- `.priority-panel`
- `.context-card`
- `.page-signal`
- `.page-shell`
- `.page-layer`
- `.workflow-status-grid`

The current regression is not three isolated template bugs. It is mainly caused by a shared visual contract where:

- outer workflow sections render as large `.panel` surfaces,
- inner summary/help/result areas render as additional `.priority-panel` or `.context-card` surfaces,
- late-file `.layout--editorial` overrides flatten those surfaces into the same bordered visual language,
- several pages stack these nested surfaces without a dedicated inner composition layout.

This produces “big box inside big box” rendering and large empty card areas.

### 2. Page-local markup amplifies the shared CSS problem

Affected page/component ownership:

- `src/renderer/src/views/ContentEditorView.vue`
- `src/renderer/src/components/content/ContentWorkflowHero.vue`
- `src/renderer/src/components/content/ExistingContentSection.vue`
- `src/renderer/src/views/PreviewView.vue`
- `src/renderer/src/views/PublishBackupView.vue`
- shared shell surface in `src/renderer/src/styles.css`

Specific page-local issue pattern:

- a large outer workflow panel contains another summary/support card,
- then the page adds another separate result/log/checklist card below,
- but the inner containers still inherit the same heavy bordered visual treatment,
- which makes the middle of the screen read like oversized duplicated boxes.

### 3. The sidebar footer popup bug is a shell-mount styling mismatch

Current ownership is correct in principle:

- `WorkflowSidebar.vue` owns the footer click triggers
- `useAppShell.mjs` owns popup visibility and anchor metadata
- `App.vue` wires sidebar trigger to popup state
- `ShellTopBar.vue` owns the Teleport mount
- `SystemStatusPanel.vue` owns popup content blocks

The current break point is styling ownership:

- the popup is teleported to `body`
- but popup selectors are still scoped as descendants of `.layout--editorial`
- once teleported, the popup is no longer under `.layout--editorial`
- therefore overlay positioning, z-index, panel sizing, and visible popup presentation do not apply correctly

Result: the click path and popup-open state exist, but the utility surface does not appear correctly.

---

## Repair design

## 1. Shared popup contract

### 1.1 Ownership stays the same

Do **not** redesign this into two separate popup systems.

Required ownership after repair:

- `WorkflowSidebar.vue` remains the footer trigger owner
- `useAppShell.mjs` remains popup state owner
- `ShellTopBar.vue` remains popup Teleport mount owner
- `SystemStatusPanel.vue` remains popup content owner

### 1.2 Shared utility popup with focused block entry

Click behavior contract:

- clicking the **appearance/mode** footer entry opens the shared utility popup and focuses the appearance block first
- clicking the **account** footer entry opens the same shared utility popup and focuses the account block first
- the popup still renders the updates block and environment block in the same surface

Implementation contract:

- `useAppShell.mjs` must store popup visibility plus an active popup section key
- the popup section key must be derived from the sidebar entry that opened it
- `SystemStatusPanel.vue` must react to that section key with one exact behavior contract:
  - the matching popup block must receive the active-state marker first
  - the popup surface must scroll that block into view if needed
  - the first interactive control inside that active block becomes the initial keyboard focus target when the popup opens

Required section mapping:

- appearance/mode footer entry → appearance block
- account footer entry → account block

This is not optional “one of visible / scroll / focus”; all three are part of the repair contract.

### 1.3 Teleport-safe popup styling

Popup styles must no longer depend on the teleported node being a descendant of `.layout--editorial`.

Required outcome:

- the popup overlay and panel styles must still apply after Teleport to `body`
- popup surface must be viewport-visible and layered above the shell
- popup must remain fixed while the main workflow scroll region moves

---

## 2. Shared workflow inner-layout repair

### 2.1 Shared rule

The repair should first reduce the visual weight and nesting of inner workflow support/result cards in the shared editorial layer.

Required outcome:

- large outer workflow panels stay as the main section container
- inner summary/result/help surfaces stop reading like duplicated giant bordered cards
- support cards inside a workflow panel must render as compact subordinate information blocks, not same-weight sibling panels

### 2.2 Page-local cleanup only where needed

After the shared CSS/layout fix, do page-local cleanup only in the three affected areas:

- `ContentEditorView.vue` (+ related content section components)
- `PreviewView.vue`
- `PublishBackupView.vue`

Allowed page-local changes:

- flatten or reorder nested support/result cards
- move support copy into compact lower-flow panels
- simplify nested helper wrappers

Not allowed:

- broad redesign of unrelated workflow pages
- changing tutorial-target behavior in this repair
- changing publish logic or content-editing logic

### 2.3 Visual acceptance contract for the three pages

The following structural outcomes must be true after repair:

- `ContentEditorView.vue`
  - the main content-creation section remains the outer primary panel
  - any recent-result / support / helper content inside that area must render as compact subordinate blocks, not full-height duplicate inner panels
  - the right-side “current writing status” style support card must no longer appear as a separate floating giant card beside the editor section

- `PreviewView.vue`
  - the preview result summary must not render as a giant nested panel inside another giant panel
  - recent result / current status / logs must read as one ordered vertical workflow, with compact summary blocks above technical details
  - there must be no empty right rail or visually duplicated oversized box within the preview workbench area

- `PublishBackupView.vue`
  - publish summary, readiness/help, and backup support content must not render as full-size nested cards inside the main release panel
  - checklist/support content may remain, but only as compact subordinate blocks within the page flow
  - there must be no oversized blank inner panel occupying most of the publish workbench body

---

## 3. Files expected to change

### Shared shell / popup files

- `src/renderer/src/App.vue`
- `src/renderer/src/composables/useAppShell.mjs`
- `src/renderer/src/components/shell/ShellTopBar.vue`
- `src/renderer/src/components/shell/WorkflowSidebar.vue`
- `src/renderer/src/components/shell/SystemStatusPanel.vue` *(only if needed for focused block behavior)*
- `src/renderer/src/styles.css`

### Page-local layout files

- `src/renderer/src/views/ContentEditorView.vue`
- `src/renderer/src/components/content/ContentWorkflowHero.vue`
- `src/renderer/src/components/content/ExistingContentSection.vue`
- `src/renderer/src/views/PreviewView.vue`
- `src/renderer/src/views/PublishBackupView.vue`

### Tests likely to change

- `src/renderer/src/composables/useAppShell.test.mjs`
- `src/renderer/src/components/shell/ShellTopBar.redesign.test.mjs`
- `src/renderer/src/components/shell/WorkflowSidebar.redesign.test.mjs`
- `src/renderer/src/components/shell/SystemStatusPanel.redesign.test.mjs`
- `src/renderer/src/App.facade.test.mjs`
- `src/renderer/src/views/ContentEditorView.redesign.test.mjs`
- `src/renderer/src/views/PreviewView.redesign.test.mjs`
- `src/renderer/src/views/PublishBackupView.redesign.test.mjs`
- `e2e/electron/editorial-workbench.spec.mjs`

---

## 4. Verification contract

The fix is not complete unless all of the following are verified fresh:

1. The three affected pages no longer show giant duplicated inner boxes:
   - content editor
   - local preview
   - publish to GitHub Pages
2. Clicking the two sidebar footer entries opens the shared utility popup.
3. Clicking “模式” lands with the appearance block as the default focused/visible section.
4. Clicking “账户” lands with the account block as the default focused/visible section.
5. The shared utility popup still contains updates and environment blocks.
6. The popup remains visible and fixed while the main content scrolls.
7. Broad regression checks pass, including:
   - `pnpm run test:coverage`
   - `pnpm exec node --test`
   - `pnpm run build:renderer`
   - `pnpm run test:e2e:ui`
   - `pnpm run test:e2e:workspace`

### 4.1 Workspace E2E prerequisite contract

`pnpm run test:e2e:workspace` must be treated as a prepared verification gate, not an ad hoc command.

Required assumption for planning/execution:

- the command must be run through the existing repo wrapper that prepares then verifies the real workspace flow
- no stale manifest/report output may be reused
- the gate only counts as passing if the wrapper exits zero after the full prepare → verify chain

The planner must not replace this with a partial direct call to only one underlying script.

---

## 5. Delivery boundary

After implementation and verification:

- commit changes on a dedicated repair branch
- push that branch remotely
- merge the branch into `main` locally
- push merged `main` to origin so remote `main` matches the verified local merge result
- do **not** publish any release in this task

### 5.1 Git completion contract

For zero-context execution, the git integration path is fixed:

1. implement and verify on a dedicated repair branch
2. commit the repair branch changes
3. push the repair branch to origin
4. merge the repair branch into local `main`
5. rerun the required verification on the merged `main` result if merge changes execution context
6. push merged `main` to origin

Allowed merge outcome:

- branch → `main`

Not part of this task:

- publishing a release
- retagging any release
- creating a replacement release asset set

---

## 6. Constraints

- Fix root causes before symptoms.
- Keep the existing shell architecture unless a specific break point proves it impossible.
- Use TDD / RED→GREEN for any new bug regression coverage.
- Do not fake success with source-text-only checks when runtime behavior is the real issue.
- Do not publish a release as part of this repair.
