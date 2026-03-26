# BlogForEveryone Coverage & Release Verification Design

**Date:** 2026-03-26

## Goal

Raise test confidence and executable-code coverage in the current `shell-tutorial-repair` branch without gaming metrics, keep the desktop app behavior verified across the existing renderer/main/Electron surfaces, and only then commit, push, merge, and replace the published GitHub release `v1.2.0`.

## Approved Direction

Use an **honest layered verification strategy** instead of chasing a single misleading repo-wide percentage:

1. **Executable production JS/MJS coverage becomes the numeric target** — `src/main/**/*.js`, `scripts/**/*.js`, and executable renderer `.mjs` modules should be driven as high as honestly possible, ideally to 100% for the files we intentionally keep in this domain.
2. **`.vue` renderer surfaces remain a separate verification layer** — they keep structural/facade coverage plus Electron runtime verification, but they are not misrepresented as covered by a single Node coverage number unless they are actually executed by a Vue-aware runtime harness.
3. **Release replacement stays gated by real runtime verification** — coverage alone is never enough to justify replacing `v1.2.0`; the release gate must still include renderer build, Electron UI flow, and any required real-workspace validation.

This direction is explicitly chosen over “single repo-wide 100%” because the current repo structure mixes real Node execution with many source-text renderer assertions, and combining those into one number would overstate safety.

## Exact User Requirements

The implementation must satisfy all of the following together:

1. Inspect the current test surface and coverage honestly instead of claiming confidence from existing test counts alone.
2. Improve test scripts so the repo has clear, repeatable verification entry points for development, pre-merge, and release decisions.
3. Push executable production-code coverage as high as honestly possible, with the target definition made explicit.
4. Do **not** game the metric by excluding important production files just to achieve a better percentage.
5. Keep the software functioning while tests and scripts are improved; no “coverage-only” regressions are acceptable.
6. Preserve the renderer/UI/runtime guarantees already established on the `shell-tutorial-repair` branch.
7. After the improved verification stack is complete and passing, commit, push, merge, and publish a replacement `v1.2.0` release.

## Current File-Backed Diagnosis

### 1. Existing script surface

- `package.json` currently exposes:
  - `test` → `node --test`
  - `test:e2e:ui` → Playwright Electron run for `e2e/electron/editorial-workbench.spec.mjs`
  - `build:renderer` → Vite renderer build
  - packaging/release scripts for Electron Builder
- There is **no** first-class script for:
  - coverage reporting,
  - pre-merge verification,
  - release verification,
  - real-workspace verification wrapper.

### 2. Baseline measured coverage

Running `pnpm exec node --test --experimental-test-coverage` on the current worktree produced:

- `all files` → **61.54% lines / 65.15% branches / 66.32% funcs**

The current lowest/high-risk measured files include:

- `src/main/services/githubAuthService.js` → ~13% lines
- `src/main/services/rssService.js` → ~15% lines
- `src/main/services/publishService.js` → ~47% lines
- `src/main/services/previewService.js` → ~41% lines
- `src/main/main.js` → ~46% lines
- `src/main/services/env/detectEnvironment.js` → ~31% lines
- `src/main/services/env/installTooling.js` → ~40% lines

These are production chain files, not decorative helpers, so their low coverage is a real risk signal.

### 3. Renderer coverage honesty problem

- The worktree currently contains many renderer `*.facade.test.mjs` and `*.redesign.test.mjs` files.
- Representative tests such as `src/renderer/src/App.facade.test.mjs` and `src/renderer/src/views/TutorialCenterView.redesign.test.mjs` inspect file contents and regex-match source strings.
- The current Node coverage table does **not** include most `.vue` SFC runtime behavior, which matches that source-text testing pattern.
- Therefore, renderer test count is not the same thing as renderer runtime coverage.

### 4. Existing verification layers

- **Main / service / policy layer**: strongly exercised by `node --test`.
- **Renderer executable helper/composable layer**: partially exercised where logic already lives in `.mjs` files.
- **Renderer `.vue` layer**: often protected structurally, but not generally mounted/executed.
- **Electron runtime layer**: only one main journey exists today — `e2e/electron/editorial-workbench.spec.mjs`.
- **Real-workspace validation**: scripts exist under `scripts/e2e-real-workspace-prepare.js` and `scripts/e2e-real-workspace-verify.js`, but they are not promoted into top-level npm script gates.

## Proposed Design

### 1. Honest coverage contract

The repo will explicitly separate two concepts that currently get conflated:

#### 1.1 Numeric coverage domain

The primary numeric coverage goal applies to executable production JavaScript modules that are already measurable by `node --test --experimental-test-coverage`:

- `src/main/**/*.js`
- `scripts/**/*.js` that are part of product verification or release support
- executable renderer `.mjs` modules under `src/renderer/src/**` such as composables and utilities

Rules:

- No high-risk production module may be excluded just because it is difficult to test.
- Temporary exclusions, if any are required for truly non-executable surfaces, must be explicit, justified, and minimal.
- Success is not “one repo-wide 100% number”; success is “the executable-code domain is near-complete and the excluded domain is honestly named.”

For this branch, the numeric coverage contract must be concrete:

- **Hard file-level target**: every file intentionally selected in the first high-risk batch must be driven to **100% line coverage and 100% function coverage**, and to **100% branch coverage where branch structure is executable and controllable in tests**.
- If one of those selected files cannot honestly reach 100% branch coverage because a branch is tied to unreproducible OS/runtime behavior, that exception must be:
  1. named by file and line,
  2. justified in writing,
  3. reviewed before release,
  4. and must not be hidden via silent exclusion.
- **Whole measured executable-domain target for this branch**: the final `node --test --experimental-test-coverage` report must improve the current baseline materially enough to be release-meaningful. For this branch, that means reaching at least:
  - **75% lines**,
  - **75% branches**,
  - **75% functions**
  on the measured Node coverage report while also satisfying the hard file-level targets above.
- The report used for this branch must state whether it is reading Node’s built-in `all files` table directly or a documented executable-only subset filter. The implementation plan must choose one and keep it stable for the whole branch.

#### 1.2 Non-numeric renderer `.vue` domain

`.vue` files remain under a separate contract unless/until a Vue-aware runtime coverage stack is intentionally introduced.

For this branch, `.vue` confidence must come from:

- existing facade/redesign guardrails,
- focused runtime Electron validation,
- extracting new decision logic into `.mjs` helpers/composables when that logic deserves executable coverage.

This prevents the project from claiming “100% coverage” while large UI surfaces are only checked by source-text assertions.

### 2. Coverage-improvement priority order

Coverage work must follow risk, not convenience.

#### 2.1 First priority: high-risk main-process production files

The first improvement batch must target the current lowest/high-risk executable files:

1. `src/main/services/githubAuthService.js`
2. `src/main/services/rssService.js`
3. `src/main/services/publishService.js`
4. `src/main/services/previewService.js`
5. `src/main/services/env/detectEnvironment.js`
6. `src/main/services/env/installTooling.js`
7. `src/main/main.js`

Why this order:

- these files sit on authentication, publish, preview, tooling, or application bootstrap chains,
- they are more likely to break real software behavior than already-high-coverage helper files,
- increasing them materially improves release confidence rather than just the dashboard.

#### 2.2 Second priority: renderer executable logic

Where important behavior still lives inside SFCs, prefer extracting pure decisions into `.mjs` helpers/composables so they can be covered by `node:test` without inventing fake UI coverage.

Acceptable examples:

- mapping logic,
- derived summary state,
- tutorial routing transforms,
- preview/lightbox state helpers,
- content/publish/import action payload shaping.

Not acceptable:

- moving code merely to inflate the coverage percentage if the extraction does not improve clarity or testability.

#### 2.3 Third priority: runtime breadth, not percentage padding

After the numeric domain improves, the next gains should come from runtime verification breadth:

- broaden Electron Playwright journeys where the current single journey is too narrow,
- promote real-workspace verification into named script gates,
- keep `.vue` structural tests as guardrails, not as the sole proof of behavior.

### 3. Script contract redesign

The top-level script surface must become explicit and layered.

Required script families:

#### 3.1 Unit / module layer

- `test:unit` — the repo’s focused Node test execution layer
- `test:coverage` — runs Node test coverage and emits a stable summary

The coverage script must be the authoritative source for the executable-code coverage number.

Required command intent:

- `test:unit` must run the repo’s Node suite in a stable, non-coverage mode.
- `test:coverage` must run the same logical unit suite with coverage enabled and fail if the declared branch target thresholds are not met.

#### 3.2 Runtime UI layer

- keep `test:e2e:ui` for the Electron editorial workbench journey
- extend only if needed by the coverage strategy; do not multiply E2E cases just to fake numeric progress

#### 3.3 Real-workspace verification layer

- add a named wrapper script for the prepare/verify flow already present in `scripts/e2e-real-workspace-prepare.js` and `scripts/e2e-real-workspace-verify.js`

This layer exists to verify that the application still works in a real filesystem/project context and should be part of release confidence even if it is not part of the main numeric coverage report.

Required wrapper contract:

- the wrapper must run **prepare first, then verify**;
- it must fail on any non-zero step;
- it must not silently reuse stale verification output from an earlier run;
- it must surface the final verification artifact/report path in a predictable way so release verification can point to it.

#### 3.4 Gate scripts

Required gate scripts:

- `verify:premerge`
  - must run `test:coverage`,
  - must run `pnpm exec node --test`,
  - must run `build:renderer`,
  - must run `test:e2e:ui`,
  - may run selected focused Node suites if needed.

- `verify:release`
  - must include `verify:premerge`,
  - must include the real-workspace verification wrapper,
  - must run `package:signed`,
  - must prove the branch is safe enough to package and replace release `v1.2.0`.

The gate chain is therefore explicit:

1. `test:coverage`
2. `pnpm exec node --test`
3. `pnpm run build:renderer`
4. `pnpm run test:e2e:ui`
5. real-workspace wrapper
6. `pnpm run package:signed`

If any step fails, the branch is not releasable and cannot proceed to release replacement.

### 4. Coverage reporting contract

The implementation must make coverage output actionable instead of just verbose.

Required outcomes:

- a stable way to run coverage repeatedly,
- a summary that makes low-coverage files obvious,
- a way to distinguish executable-code coverage from renderer structure checks,
- no misleading “all software behavior is covered” claim.

The final output must include both:

1. the measured numeric result,
2. and a short plain-language statement that `.vue` behavior is still validated through facade/redesign/Electron layers rather than counted as Node runtime coverage.

### 5. Release replacement contract

Replacing GitHub release `v1.2.0` remains an explicit user-directed action and must only happen after the new verification design is implemented and passing.

Release replacement prerequisites:

1. improved test scripts exist and are used,
2. executable-code coverage has materially improved according to the new contract,
3. `pnpm exec node --test` passes,
4. `pnpm run build:renderer` passes,
5. `pnpm run test:e2e:ui` passes,
6. real-workspace verification passes,
7. branch history is reviewed and clean before commit/push/merge,
8. packaging/release artifacts are rebuilt from the final merged commit before re-pointing the release/tag.

Coverage improvement is therefore a release gate input, not a substitute for end-to-end verification.

Release replacement sequence must be explicit and non-guessable:

1. finish implementation on the feature branch and verify all gates there,
2. commit and push the feature branch,
3. merge into the integration target (`main` unless explicitly changed),
4. rerun the full **release gate on the merged result**, not just on the feature branch,
5. build fresh signed artifacts from that merged commit,
6. confirm the generated artifact names and `latest.yml` agree,
7. push the final merged commit if needed,
8. replace the published `v1.2.0` release assets from those freshly-built merged artifacts,
9. if the replacement strategy includes moving the `v1.2.0` tag, that must be done intentionally and verified against the final merged commit hash,
10. verify the final GitHub release page and uploaded asset set after replacement.

Branch-built artifacts are not sufficient for final replacement if the merged result has not been re-verified.

## File Responsibilities After Repair

- `package.json`
  - own the top-level script contract for unit, coverage, pre-merge, and release verification.
- `scripts/e2e-real-workspace-prepare.js`
  - remain the workspace-preparation utility, but become reachable through a named package script or wrapper flow.
- `scripts/e2e-real-workspace-verify.js`
  - remain the real-workspace verification utility, but become reachable through a named package script or wrapper flow.
- `src/main/services/githubAuthService.js`
  - gain focused branch/error-path coverage for auth lifecycle and token persistence behavior.
- `src/main/services/rssService.js`
  - gain focused service coverage for subscription, refresh, export, and error-path handling.
- `src/main/services/publishService.js`
  - gain focused publish-path and failure coverage.
- `src/main/services/previewService.js`
  - gain focused preview lifecycle and blocked-path coverage.
- `src/main/services/env/detectEnvironment.js`
  - gain focused environment detection branch coverage.
- `src/main/services/env/installTooling.js`
  - gain focused tooling-install branch/error coverage without mutating real user state.
- `src/main/main.js`
  - gain realistic bootstrap/lifecycle sanity coverage where possible.
- `src/renderer/src/**/*.mjs`
  - absorb extracted renderer decision logic only when the extraction improves clarity and measurable behavior coverage.
- `e2e/electron/editorial-workbench.spec.mjs`
  - remain the primary runtime UI proof and expand only where it closes meaningful release-risk gaps.

## Verification Requirements

The final design is acceptable only if all of the following are true:

1. A fresh baseline coverage script exists and can be run from `package.json` without ad hoc command knowledge.
2. Coverage output clearly represents executable production code and does not silently masquerade source-text `.vue` tests as runtime UI coverage.
3. The highest-risk low-coverage production files receive real additional tests, not artificial exclusions.
4. The improved verification stack still keeps the existing application functionality green:
   - `pnpm exec node --test`
   - `pnpm run build:renderer`
   - `pnpm run test:e2e:ui`
5. Real-workspace verification is promoted into the release decision rather than remaining an obscure side script.
6. The final pre-merge and release gates are named, repeatable, and suitable for a human or CI runner.
7. The branch can only proceed to commit/push/merge/release once all verification gates are green on fresh runs.
8. The final release sequence is rerun on the merged commit before `v1.2.0` replacement.

Required verification surfaces:

- Node coverage command output
- focused Node test commands for newly-covered high-risk files
- full `pnpm exec node --test`
- fresh `pnpm run build:renderer`
- fresh `pnpm run test:e2e:ui`
- fresh real-workspace verification wrapper
- fresh `pnpm run package:signed`
- git diff/release verification before replacing `v1.2.0`

Minimum runtime verification floor for this branch:

- the current Electron editorial-workbench journey must continue proving the already-repaired shell/tutorial/workspace behaviors,
- the release flow may add runtime assertions, but it may not remove the current shell/tutorial/workspace proof without replacing it with an equally strong explicit runtime contract.

## Constraints

- Do not introduce deceptive exclusions just to hit a round number.
- Do not claim repo-wide 100% unless `.vue` runtime behavior is genuinely measurable by the chosen tooling.
- Do not break the current `shell-tutorial-repair` UI/runtime guarantees while improving coverage.
- Do not replace release `v1.2.0` until the final branch is verified from fresh commands.
- Prefer the existing testing idioms already used in the repo (`node --test`, injected dependency seams, focused module tests) before introducing heavier new infrastructure.

## Implementation Sequence

1. Add and stabilize the missing script contract (`test:unit`, `test:coverage`, real-workspace wrapper, `verify:premerge`, `verify:release`).
2. Improve coverage in the highest-risk low-coverage main-process files first.
3. Improve executable renderer `.mjs` coverage where meaningful and extract logic only when it clarifies testability.
4. Re-run honest coverage and verify the executable-code target moved materially upward.
5. Re-run runtime/build/real-workspace verification stack.
6. Only after all gates are green, prepare commit/push/merge and replace release `v1.2.0` from verified final artifacts.

The implementation plan must translate this spec into exact commands, exact file targets, and an explicit decision on whether the branch will use Node’s raw `all files` report or a documented executable-only reporting subset for the final numeric threshold.
