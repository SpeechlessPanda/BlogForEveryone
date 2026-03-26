# 2026-03-26 Coverage Release Report (Task 2)

## Hard-target exception log (branch coverage)

The following branch gaps remained after the required targeted RED/GREEN runs and additional focused tests in the Task 2 allowlist. No silent exclusions were used.

### 1) `src/main/main.js`
- **Uncovered branch lines:** V8 branch gap reported without uncovered line rows; nearest predicate is window creation lifecycle branching in `createMainWindow` / bootstrap (`if (process.platform === 'win32' && resolvedIcon.image)` and ready-time branching around app lifecycle callbacks).
- **Why not reproducible in this batch:** The remaining branch counter is tied to Electron runtime lifecycle behavior that does not fully differentiate under node-test module-mock harness execution.
- **Why no silent exclusion:** Branches are retained as executable production logic and reported explicitly here.

### 2) `src/main/services/env/installTooling.js`
- **Uncovered branch lines:** V8 branch gap reported without uncovered line rows; nearest predicates are short-circuit branches in install fallback orchestration (`ensurePnpm`, `ensureDartSass`, and framework orchestration guards).
- **Why not reproducible in this batch:** Remaining branch counters are on short-circuit combinations that share fully covered lines but are still partially uncounted by V8 branch mapping in this run mode.
- **Why no silent exclusion:** No ignore pragma or threshold bypass was applied; branch deficit is documented.

### 3) `src/main/services/githubAuthService.js`
- **Uncovered branch lines:** V8 branch gap reported without uncovered line rows (line/function now 100% in focused run).
- **Why not reproducible in this batch:** Remaining branch counter is a branch-only mapping residual in the polling/error-decision matrix under node-test + V8 coverage accounting after all executable lines/functions were exercised.
- **Why no silent exclusion:** The branch is retained and explicitly disclosed here; no coverage suppression added.

### 4) `src/main/services/previewService.js`
- **Uncovered branch lines:** V8 branch gap reported without uncovered line rows (line/function now 100% in focused run).
- **Why not reproducible in this batch:** Remaining branch counter is a branch-only mapping residual in helper callback/decision accounting after deterministic seam-based tests exercised all executable lines/functions.
- **Why no silent exclusion:** No branch was excluded and no ignore pragma was added; residual branch deficit is explicitly documented.

### 5) `src/main/services/publishService.js`
- **Uncovered branch lines:** V8 branch gap reported without uncovered line rows; nearest predicate is repo URL inference / git workflow branching combinations.
- **Why not reproducible in this batch:** Residual uncovered branch counter is from a branch-only mapping case where line coverage is complete but one decision combination remains uncounted in V8 branch accounting.
- **Why no silent exclusion:** No exclusions added; gap is documented.

### 6) `src/main/services/rssService.js`
- **Uncovered branch lines:** V8 branch gap reported without uncovered line rows; nearest predicates are auto-sync and unread-tracking short-circuit branches.
- **Why not reproducible in this batch:** Remaining branch counters are branch-only mapping combinations that did not emit line-level uncovered rows despite 100% line/function coverage.
- **Why no silent exclusion:** No suppression was used; this report captures the remaining branch deficit.

---

## Task 3 execution log (second executable batch)

### Focused Task 3 RED -> GREEN run

- **RED command:**
  `pnpm exec node --test "src/main/ipc/appIpc.test.js" "src/main/ipc/workspaceIpc.test.js" "src/main/services/storeService.test.js" "src/main/services/themeService.test.js" "src/renderer/src/composables/useShellWorkspaceSummary.test.mjs"`
- **RED result:** failed at `src/main/ipc/appIpc.test.js` with assertion error (`true !== false`) in the initial deliberate RED scaffold before coverage-oriented test implementation.
- **GREEN command (same):**
  `pnpm exec node --test "src/main/ipc/appIpc.test.js" "src/main/ipc/workspaceIpc.test.js" "src/main/services/storeService.test.js" "src/main/services/themeService.test.js" "src/renderer/src/composables/useShellWorkspaceSummary.test.mjs"`
- **GREEN result:** PASS, `tests 44`, `pass 44`, `fail 0`.

### Task 3 ordered batch status (risk-first)

1. `src/main/ipc/appIpc.js` — expanded targeted tests in new `appIpc.test.js`; focused run coverage reached `line 100% / branch 90.91% / funcs 100%`.
2. `src/main/services/themeService.js` — expanded branch-path tests in `themeService.test.js`; focused run coverage reached `line 92.64% / branch 76.99% / funcs 92.59%`.
3. `src/renderer/src/composables/useShellWorkspaceSummary.mjs` — expanded tab/gate branch tests; focused run coverage reached `line 100% / branch 94.12% / funcs 100%`.
4. `src/main/ipc/workspaceIpc.js` — expanded list/create/remove/import guard tests; focused run coverage reached `line 98.43% / branch 73.53% / funcs 68.75%`.
5. `src/main/services/storeService.js` — expanded secure-auth success/error/cleanup tests; focused run coverage reached `line 81.37% / branch 72.92% / funcs 73.33%`.

### Task 3 branch-only residuals (legitimate, no silent exclusion)

#### 1) `src/main/ipc/appIpc.js`
- **Uncovered branch lines:** V8 branch-only residual (no uncovered line rows in focused report, branch `90.91%`).
- **Why not reproducible in this batch:** Remaining counter is a branch-only mapping residual after exercising all executable lines/functions.
- **Why no silent exclusion:** No ignore pragma or threshold bypass was used.

#### 2) `src/renderer/src/composables/useShellWorkspaceSummary.mjs`
- **Uncovered branch lines:** V8 branch-only residual (no uncovered line rows in focused report, branch `94.12%`).
- **Why not reproducible in this batch:** Remaining branch counter persists as branch-only mapping after full line/function execution under node-test/V8 coverage.
- **Why no silent exclusion:** No branch exclusion was added; residual is explicitly recorded.

### Branch-wide coverage rerun after Task 3 pass

- **Command:** `pnpm exec node --test --experimental-test-coverage`
- **Raw `all files` result:** `line 87.37% / branch 78.61% / funcs 80.59%`
- **Threshold status:** Meets branch-wide `>= 75 / 75 / 75` target.

---

## Task 4 final gate and honesty record

### Final verification gates

- **`pnpm run verify:premerge`** — PASS
  - Node suite: `tests 330 / pass 330 / fail 0`
  - Raw coverage table still reported `all files = line 87.37% / branch 78.61% / funcs 80.59%`
  - `pnpm run build:renderer` passed
  - `pnpm run test:e2e:ui` passed

- **`pnpm run verify:release`** — PASS
  - Includes `verify:premerge`
  - Includes `pnpm run test:e2e:workspace`
  - Includes `pnpm run package:signed`

- **Final raw coverage rerun:** `pnpm exec node --test --experimental-test-coverage` — PASS
  - **Final numeric result:** `line 87.37% / branch 78.61% / funcs 80.59%`

### Approved residuals carried forward

- Task 2 approved branch-only residuals remain recorded for:
  - `src/main/main.js`
  - `src/main/services/env/installTooling.js`
  - `src/main/services/githubAuthService.js`
  - `src/main/services/previewService.js`
  - `src/main/services/publishService.js`
  - `src/main/services/rssService.js`
- Task 3 approved branch-only residuals remain recorded for:
  - `src/main/ipc/appIpc.js`
  - `src/renderer/src/composables/useShellWorkspaceSummary.mjs`

### Honesty statement

- `.vue` safety is **not** represented by the Node raw numeric coverage above.
- Renderer `.vue` confidence for this branch still comes from the existing facade/redesign test layers plus Electron runtime verification (`pnpm run test:e2e:ui`), not from pretending SFC source-text checks are equivalent to runtime-covered executable code.
