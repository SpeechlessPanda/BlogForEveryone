# Coverage & Release Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise honest executable-code coverage and verification quality on `shell-tutorial-repair`, keep the app behavior green, then commit, push, merge, and replace GitHub release `v1.2.0` from verified merged artifacts.

**Architecture:** Treat this as a layered verification upgrade, not a vanity-number exercise. First establish the script/gate contract in `package.json`, then raise coverage in the highest-risk low-coverage main-process modules, then improve the next measured executable batch until the branch threshold is met, and finally run the full release gate on both the feature branch and merged result before replacing `v1.2.0`.

**Tech Stack:** Node built-in test runner, Node built-in test coverage, Electron, Playwright Electron E2E, Vite, pnpm, GitHub Releases.

---

## File Structure Map

- Modify: `package.json` — add stable scripts for `test:unit`, `test:coverage`, real-workspace verification, `verify:premerge`, and `verify:release`.
- Create: `scripts/run-node-coverage.js` — run Node coverage, preserve the original test-process exit code, and invoke the threshold parser only after the coverage run completes.
- Create: `scripts/check-node-coverage.js` — parse Node’s built-in coverage report and fail the process when branch thresholds are not met.
- Create: `scripts/verify-real-workspace.js` — run `e2e-real-workspace-prepare.js` then `e2e-real-workspace-verify.js` as one explicit wrapper contract.
- Create: `docs/superpowers/reports/2026-03-26-coverage-release-report.md` — record any approved branch exceptions, the final numeric coverage result, and the plain-language honesty statement about `.vue` coverage.
- Modify: `src/main/services/githubAuthService.test.js` — raise auth lifecycle and error-path coverage for `githubAuthService.js`.
- Create: `src/main/services/rssService.test.js` — add first real service coverage for `rssService.js`.
- Modify: `src/main/services/publishService.test.js` — expand publish-path coverage for `publishService.js`.
- Modify: `src/main/services/previewService.test.js` — expand preview lifecycle coverage for `previewService.js`.
- Modify: `src/main/services/env/detectEnvironment.test.js` — expand environment-detection branch coverage.
- Modify: `src/main/services/env/installTooling.test.js` — expand tooling-install branch/error coverage.
- Modify: `src/main/main.test.js` — expand bootstrap/lifecycle coverage for `main.js`.
- Modify: `src/main/ipc/appIpc.js`
- Modify: `src/main/ipc/appIpc.test.js`
- Modify: `src/main/ipc/workspaceIpc.js`
- Modify: `src/main/ipc/workspaceIpc.test.js`
- Modify: `src/main/services/storeService.js`
- Modify: `src/main/services/storeService.test.js`
- Modify: `src/main/services/themeService.js`
- Modify: `src/main/services/themeService.test.js`
- Modify: `src/renderer/src/composables/useShellWorkspaceSummary.mjs`
- Modify: `src/renderer/src/composables/useShellWorkspaceSummary.test.mjs`
- Modify: `scripts/e2e-real-workspace-prepare.test.js`
- Modify: `scripts/e2e-real-workspace-verify.test.js`
- Verify against: `scripts/e2e-real-workspace-prepare.js`
- Verify against: `scripts/e2e-real-workspace-verify.js`
- Verify against: `e2e/electron/editorial-workbench.spec.mjs`
- Verify against: `docs/superpowers/specs/2026-03-26-coverage-release-design.md`

## Branch Coverage Contract for This Plan

- Use **Node’s raw `all files` coverage table** from `node --test --experimental-test-coverage` as the branch-wide numeric report.
- Hard requirement: the Task 2 high-risk file batch must reach **100% line coverage** and **100% function coverage**, with **100% branch coverage unless a branch exception is explicitly justified**.
- Branch-wide threshold at the end of this plan: the final raw `all files` report must be at least:
  - **75% lines**
  - **75% branches**
  - **75% functions**
- `.vue` files are not part of this numeric promise. Their safety remains guarded by facade/redesign tests plus Electron runtime verification.

### Task 1: Establish the script and gate contract

**Files:**
- Modify: `package.json`
- Create: `scripts/run-node-coverage.js`
- Create: `scripts/check-node-coverage.js`
- Create: `scripts/verify-real-workspace.js`
- Modify: `scripts/e2e-real-workspace-prepare.test.js`
- Modify: `scripts/e2e-real-workspace-verify.test.js`

- [ ] **Step 1: Add failing script/gate expectations**

Write the smallest failing checks needed to require these scripts in `package.json`:
- `test:unit`
- `test:coverage`
- `test:e2e:workspace`
- `verify:premerge`
- `verify:release`

Also add failing expectations for these exact command contracts:
- `test:unit` → `pnpm exec node --test`
- `test:coverage` → `node scripts/run-node-coverage.js`
- `test:e2e:workspace` → `node scripts/verify-real-workspace.js`
- `verify:premerge` → `pnpm run test:coverage && pnpm exec node --test && pnpm run build:renderer && pnpm run test:e2e:ui`
- `verify:release` → `pnpm run verify:premerge && pnpm run test:e2e:workspace && pnpm run package:signed`

- [ ] **Step 2: Run the focused script tests and confirm RED**

Run:
`pnpm exec node --test "scripts/e2e-real-workspace-prepare.test.js" "scripts/e2e-real-workspace-verify.test.js"`

Expected: RED because the script/gate contract does not fully exist yet.

- [ ] **Step 3: Implement the minimal script contract**

Update `package.json` so:
- `test:unit` runs the stable Node suite
- `test:coverage` runs `scripts/run-node-coverage.js`
- `scripts/run-node-coverage.js` must:
  - execute `node --test --experimental-test-coverage`,
  - preserve the original Node test-process exit code,
  - pass the captured coverage output to `scripts/check-node-coverage.js`,
  - fail if either the tests fail or the thresholds fail,
  - avoid a shell pipeline that can mask the real test failure status
- `test:e2e:workspace` runs `scripts/verify-real-workspace.js`
- `scripts/verify-real-workspace.js` runs **prepare → verify**, fails on any non-zero step, and rejects stale-output reuse
- `verify:premerge` runs `test:coverage`, `pnpm exec node --test`, `pnpm run build:renderer`, and `pnpm run test:e2e:ui`
- `verify:release` runs `verify:premerge`, `pnpm run test:e2e:workspace`, and `pnpm run package:signed`

`scripts/check-node-coverage.js` must enforce:
- raw Node `all files` coverage mode,
- branch thresholds of **75% lines / 75% branches / 75% functions**,
- non-zero exit on threshold miss,
- stable machine-readable failure text naming which threshold failed.

- [ ] **Step 4: Re-run the focused script tests and keep them GREEN**

Run:
`pnpm exec node --test "scripts/e2e-real-workspace-prepare.test.js" "scripts/e2e-real-workspace-verify.test.js"`

Expected: PASS.

### Task 2: Raise the highest-risk main-process files to the hard coverage target

**Files:**
- Modify: `src/main/services/githubAuthService.test.js`
- Create: `src/main/services/rssService.test.js`
- Modify: `src/main/services/publishService.test.js`
- Modify: `src/main/services/previewService.test.js`
- Modify: `src/main/services/env/detectEnvironment.test.js`
- Modify: `src/main/services/env/installTooling.test.js`
- Modify: `src/main/main.test.js`
- Create: `docs/superpowers/reports/2026-03-26-coverage-release-report.md`

- [ ] **Step 1: Add failing coverage-driving tests for the high-risk batch**

Add targeted tests for missing success/error/branch paths in:
- auth lifecycle and token handling
- RSS subscription/refresh/export logic
- publish success/failure branches
- preview lifecycle and blocked paths
- environment detection branches
- tooling install fallback/error branches
- main bootstrap/lifecycle branches

- [ ] **Step 2: Run the focused high-risk batch and confirm RED**

Run:
`pnpm exec node --test "src/main/services/githubAuthService.test.js" "src/main/services/rssService.test.js" "src/main/services/publishService.test.js" "src/main/services/previewService.test.js" "src/main/services/env/detectEnvironment.test.js" "src/main/services/env/installTooling.test.js" "src/main/main.test.js"`

Expected: RED before implementation is complete.

- [ ] **Step 3: Implement the minimal tests/supporting refactors**

Only make production-code changes if a branch is currently untestable without a small seam. Prefer dependency injection and existing mocking patterns over broad refactors.

If any targeted file cannot honestly reach 100% branch coverage, record the exception immediately in `docs/superpowers/reports/2026-03-26-coverage-release-report.md` with:
- file path,
- exact uncovered branch lines,
- reason the branch is not reproducible,
- why no silent exclusion is being used.

- [ ] **Step 4: Re-run the focused high-risk batch and verify the hard target**

Run:
`pnpm exec node --test --experimental-test-coverage "src/main/services/githubAuthService.test.js" "src/main/services/rssService.test.js" "src/main/services/publishService.test.js" "src/main/services/previewService.test.js" "src/main/services/env/detectEnvironment.test.js" "src/main/services/env/installTooling.test.js" "src/main/main.test.js"`

Expected: PASS, with the targeted files meeting the hard file-level coverage contract or producing an explicitly justified branch exception.

### Task 3: Raise the second executable batch until the branch threshold is met

**Files:**
- Modify: `src/main/ipc/appIpc.js`
- Modify: `src/main/ipc/appIpc.test.js`
- Modify: `src/main/ipc/workspaceIpc.js`
- Modify: `src/main/ipc/workspaceIpc.test.js`
- Modify: `src/main/services/storeService.js`
- Modify: `src/main/services/storeService.test.js`
- Modify: `src/main/services/themeService.js`
- Modify: `src/main/services/themeService.test.js`
- Modify: `src/renderer/src/composables/useShellWorkspaceSummary.mjs`
- Modify: `src/renderer/src/composables/useShellWorkspaceSummary.test.mjs`
- Modify: `docs/superpowers/reports/2026-03-26-coverage-release-report.md`

- [ ] **Step 1: Add failing coverage tests for the second batch**

Target the currently weak measured branches in this exact risk-first order from the current report:
1. `src/main/ipc/appIpc.js`
2. `src/main/services/themeService.js`
3. `src/renderer/src/composables/useShellWorkspaceSummary.mjs`
4. `src/main/ipc/workspaceIpc.js`
5. `src/main/services/storeService.js`

- [ ] **Step 2: Run the second batch and confirm RED**

Run:
`pnpm exec node --test "src/main/ipc/appIpc.test.js" "src/main/ipc/workspaceIpc.test.js" "src/main/services/storeService.test.js" "src/main/services/themeService.test.js" "src/renderer/src/composables/useShellWorkspaceSummary.test.mjs"`

Expected: RED before missing branches are covered.

- [ ] **Step 3: Implement the minimum coverage-oriented fixes**

Prefer test additions first. Only extract or refactor if a branch is genuinely hard to exercise otherwise.

- [ ] **Step 4: Re-run branch-wide coverage and keep iterating until threshold is met**

Run:
`pnpm exec node --test --experimental-test-coverage`

Expected: the raw `all files` report reaches at least **75/75/75**.

If not, continue within this task only by taking the next file from the exact risk-first order above, then rerun coverage again. Do not drift into easier but lower-value files until the ordered list is exhausted.

### Task 4: Lock the full verification and release gate

**Files:**
- Modify: `package.json` if the gate chain still needs adjustment
- Modify: `scripts/check-node-coverage.js` if gate parsing still needs adjustment
- Modify: `scripts/verify-real-workspace.js` if wrapper sequencing still needs adjustment
- Modify: `docs/superpowers/reports/2026-03-26-coverage-release-report.md`
- Verify against: all changed test files
- Verify against: `e2e/electron/editorial-workbench.spec.mjs`
- Verify against: `scripts/e2e-real-workspace-prepare.js`
- Verify against: `scripts/e2e-real-workspace-verify.js`

- [ ] **Step 1: Run the full pre-merge gate**

Run:
`pnpm run verify:premerge`

Expected: PASS.

- [ ] **Step 2: Run the full release gate**

Run:
`pnpm run verify:release`

Expected: PASS.

- [ ] **Step 3: Re-run the raw coverage command and record the final honest number**

Run:
`pnpm exec node --test --experimental-test-coverage`

Expected: PASS with final branch-wide threshold satisfied.

Then append to `docs/superpowers/reports/2026-03-26-coverage-release-report.md`:
- final numeric coverage result,
- any approved branch exceptions,
- explicit honesty statement that `.vue` safety is still provided by facade/redesign/Electron layers rather than Node runtime coverage.

### Task 5: Commit, push, merge, and replace release v1.2.0

**Files:**
- Verify against: all files changed in Tasks 1-4
- Verify against: GitHub release/tag state for `v1.2.0`

- [ ] **Step 1: Review the final diff and split commits atomically**

Group commits by script-contract work, high-risk service coverage work, and any second-batch/supporting coverage work. Do not collapse unrelated concerns into one giant commit.

- [ ] **Step 2: Push the feature branch and merge into `main`**

Push the feature branch, merge it into `main`, and switch to the merged result.

- [ ] **Step 3: Re-run the full release gate on the merged result**

Run on merged `main`:
- `pnpm run verify:release`

Expected: PASS again on the merged commit, not only on the feature branch.

- [ ] **Step 3.5: Push merged `main` before release replacement**

Push the verified merged `main` commit to origin before rebuilding or replacing the published release. The release/tag must never point at a commit that is only local.

- [ ] **Step 4: Rebuild release artifacts from the merged commit**

Run:
`pnpm run package:signed`

Expected: PASS, with artifact names agreeing with `latest.yml`.

- [ ] **Step 5: Replace GitHub release `v1.2.0` using the merged artifacts only**

Update the published release so the assets are rebuilt from the verified merged commit already pushed to origin. If tag movement is required, move the tag intentionally only after verifying the final merged commit hash, then confirm both the tag and release point at that pushed merged commit.

- [ ] **Step 6: Perform final release verification**

Verify:
- git status is clean
- merged `main` is the source of the release artifacts
- GitHub release page for `v1.2.0` shows the intended replacement assets
- local/remote refs match the intended final commit
