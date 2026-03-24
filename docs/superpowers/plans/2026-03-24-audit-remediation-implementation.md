# BlogForEveryone Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the confirmed audit findings that currently break local development, corrupt theme/content workflows, over-block local UI flows, and leave documented behavior out of sync with the implemented product.

**Architecture:** Keep the existing Electron main-process + preload bridge + Vue renderer architecture, but fix the proven contract breaks in small, test-driven slices. Prioritize execution in user-impact order: restore runnable local verification, repair theme/content correctness, remove renderer mis-gating and data-loss paths, then align publish/backup contracts and docs.

**Tech Stack:** Electron, Vue 3 `<script setup>`, CommonJS main-process modules, Vite, Node built-in test runner, pnpm, YAML-based blog config files.

---

## File Structure Map

### Dev startup / dependency integrity
- Modify: `package.json` — keep scripts truthful if command strategy changes.
- Modify: `src/main/services/envService.js` — add focused dependency-integrity checks or repair orchestration only if needed.
- Create: `src/main/services/envService.test.js` or a narrower env helper test file if extraction is needed.
- Potentially modify: `README.md` — document the correct recovery path for broken local installs.

### Theme config correctness
- Modify: `src/renderer/src/utils/themeConfigHelpers.mjs` — centralize per-theme config-key selection.
- Modify: `src/renderer/src/utils/themeConfigHelpers.test.mjs` — add regressions for Fluid/Mainroad/background-related mapping.
- Modify: `src/renderer/src/views/ThemeConfigView.vue` — fix option hydration, Hugo RSS early-return bug, Mainroad namespace mismatch, imported-theme fallback, and capability gating.
- Modify: `src/shared/data/themeCatalog.json` — align schema keys with actual save/load contract if needed.

### Content workflow correctness
- Modify: `src/main/services/contentService.js` — unify create/list/infer behavior for non-post pages.
- Create: `src/main/services/contentService.test.js` — cover special-page path resolution and listing behavior.
- Modify: `src/renderer/src/views/ContentEditorView.vue` — stop exposing unsupported content types blindly if capability gating is needed.

### Renderer workflow gating / preview assets
- Modify: `src/renderer/src/App.vue` — narrow GitHub-login gating to publish/repo-related flows only.
- Modify: `src/renderer/src/views/WorkspaceView.vue` — make preview image paths honor Vite base path.

### Import/publish/backup contract closure
- Modify: `src/main/ipc.js` — repair import theme handling and backup-export coupling.
- Modify: `src/main/services/publishService.js` — implement or explicitly gate Hugo project-pages behavior.
- Modify: `src/main/services/backupService.js` — ensure RSS bundle is included in backup snapshot.
- Modify: `src/main/services/rssService.js` — reuse export/import contract consistently.
- Modify: `README.md`
- Modify: `docs/guides/blog-publish-pages-beginner.md`

## Task 1: Restore trustworthy local dev startup and verification entrypoints

**Files:**
- Modify: `package.json`
- Modify: `src/main/services/envService.js` (only if a repair helper or integrity check is genuinely required)
- Test: `src/main/services/envService.test.js` or extracted helper test file if created
- Docs: `README.md`

- [ ] **Step 1: Capture RED for the current startup path**

Run:
```bash
pnpm run dev
pnpm exec concurrently --version
pnpm exec cross-env --version
```

Expected: current environment reproduces the broken/incomplete dependency-tree symptom.

- [ ] **Step 2: Write the failing test for any new repair logic before touching production code**

If code changes are needed, extract the smallest pure helper first and write a failing test covering the observed integrity failure. Example API shape:

```js
function detectBrokenPackageInstall({ binExists, packageJsonExists }) {
  return { ok: false, reason: 'PACKAGE_TREE_INCOMPLETE' };
}
```

- [ ] **Step 3: Run the new focused test and confirm RED**

Run:
```bash
pnpm exec node --test src/main/services/envService.test.js
```

Expected: the new integrity case fails for the right reason.

- [ ] **Step 4: Implement the minimal fix**

Prefer the smallest truthful fix supported by evidence:
- recover from incomplete pnpm install state first (`pnpm install --force` before script rewrites), or
- make the app detect/report broken local install state clearly, or
- adjust scripts only if the external reference proves the script itself is wrong.

External reference for this task: pnpm documents that `pnpm run` exposes `node_modules/.bin`, Windows uses command shims there, and `pnpm install --force` is the safest first recovery path when shims exist but package payloads are missing. Treat `.bin exists / package dir missing` as install-integrity damage unless local repo evidence proves otherwise.

Do **not** broaden into env-service refactoring here.

- [ ] **Step 5: Re-run startup verification**

Run:
```bash
pnpm exec node --test src/main/services/envService.test.js
pnpm run dev
pnpm run build:renderer
```

Expected: the integrity check passes (if added), renderer build passes, and the dev startup path no longer fails at `concurrently/cross-env` resolution.

## Task 2: Fix imported-theme detection and theme capability contract breaks

**Files:**
- Modify: `src/main/ipc.js`
- Modify: `src/renderer/src/views/ThemeConfigView.vue`
- Modify: `src/shared/data/themeCatalog.json` (if schema path normalization is required)
- Modify: `src/renderer/src/utils/themeConfigHelpers.mjs`
- Modify: `src/renderer/src/utils/themeConfigHelpers.test.mjs`

- [ ] **Step 1: Write failing tests for theme key selection and imported-theme fallback**

Cover at least:
- Fluid uses the correct background-image config key
- Mainroad uses one consistent namespace
- imported/unknown theme does **not** silently save with `list[0]` theme rules

- [ ] **Step 2: Run focused theme tests and confirm RED**

Run:
```bash
pnpm exec node --test src/renderer/src/utils/themeConfigHelpers.test.mjs
```

Expected: new regressions fail before implementation.

- [ ] **Step 3: Implement the minimal contract fixes**

Required outcomes:
- one authoritative background/config-key mapping per supported theme
- no silent fallback from imported `unknown` theme to first supported theme
- unsupported/imported-unconfirmed themes must block theme-specific writes instead of guessing
- Mainroad load/save must read/write the same namespace

- [ ] **Step 4: Re-run focused tests**

Run the same command and expect the new theme regressions to pass.

## Task 3: Repair ThemeConfig view state hydration and save flow bugs

**Files:**
- Modify: `src/renderer/src/views/ThemeConfigView.vue`
- Modify: `src/renderer/src/utils/themeConfigHelpers.mjs` if extraction helps testability
- Modify: `src/renderer/src/utils/themeConfigHelpers.test.mjs`

- [ ] **Step 1: Add failing coverage for advanced-option hydration and Hugo RSS save behavior**

If pure extraction is needed, create a tiny helper API first and test:

```js
function hydrateThemeOptionValues(config, themeSchema) {}
function applyHugoOutputs(config, rssEnabled) {}
```

Cover:
- advanced options load existing values instead of blank/default placeholders
- turning off RSS does not skip later theme-specific personalization logic

- [ ] **Step 2: Run focused tests and confirm RED**

Run:
```bash
pnpm exec node --test src/renderer/src/utils/themeConfigHelpers.test.mjs
```

- [ ] **Step 3: Implement the minimal fixes in `ThemeConfigView.vue`**

Required outcomes:
- `optionValues` is hydrated during `loadConfig()`
- Hugo RSS removal no longer `return`s before later save logic
- save flow stays backward-compatible for already-supported themes

- [ ] **Step 4: Re-run renderer verification**

Run:
```bash
pnpm exec node --test src/renderer/src/utils/themeConfigHelpers.test.mjs
pnpm run build:renderer
```

Expected: tests pass and renderer still builds.

## Task 4: Unify non-post content creation, listing, and editing behavior

**Files:**
- Modify: `src/main/services/contentService.js`
- Create: `src/main/services/contentService.test.js`
- Modify: `src/renderer/src/views/ContentEditorView.vue`

- [ ] **Step 1: Write the failing regression tests first**

Cover at least:
- `about`, `links`, `announcement` resolve to stable canonical paths
- created non-post pages are returned by `listExistingContents()`
- `inferContentType()` recognizes the same paths that `resolveContentPath()` writes

- [ ] **Step 2: Run the focused content-service tests and confirm RED**

Run:
```bash
pnpm exec node --test src/main/services/contentService.test.js
```

Expected: failures expose the current create/list/infer mismatch.

- [ ] **Step 3: Implement the smallest consistent path contract**

Required outcomes:
- canonical path mapping for special pages is deterministic
- creation, listing, reading, saving, and opening all use that same contract
- renderer copy/options stay aligned with actually supported content flows

- [ ] **Step 4: Re-run focused tests**

Run the same command and expect the regression cases to pass.

## Task 5: Fix renderer workflow gating and preview asset resolution

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/views/WorkspaceView.vue`

- [ ] **Step 1: Write failing tests or extract the smallest pure helpers first**

If direct component tests are absent, extract tiny pure helpers to cover:

```js
function isTabBlockedByAuth(tabKey) {}
function resolveThemePreviewPath(baseUrl, relativeAsset) {}
```

Behavior to lock down:
- local tabs (`workspace`, `theme`, `preview`, `content`, `import`, `rss`) are not globally blocked by login unless the flow truly requires GitHub auth
- preview asset paths honor Vite base path instead of hard-coded root `/theme-previews/...`

- [ ] **Step 2: Run focused tests and confirm RED**

Run the smallest practical test command for the extracted helpers.

- [ ] **Step 3: Implement the minimal UI fixes**

Required outcomes:
- login gate matches actual product semantics (“publish/backup/repo-related” rather than everything)
- preview cards load under `base: './'`

- [ ] **Step 4: Re-run renderer verification**

Run:
```bash
pnpm run build:renderer
```

Expected: renderer compiles cleanly with the new gating/path behavior.

## Task 6: Close publish and backup contract drift

**Files:**
- Modify: `src/main/services/publishService.js`
- Modify: `src/main/services/backupService.js`
- Modify: `src/main/services/rssService.js`
- Modify: `src/main/ipc.js`
- Modify: `README.md`
- Modify: `docs/guides/blog-publish-pages-beginner.md`

- [ ] **Step 1: Write failing tests for the newly confirmed contract gaps**

Cover at least:
- Hugo project-pages publish either applies the required subpath/baseURL handling or returns an explicit unsupported/needs-user-action result
- backup flow includes RSS export so restore sees `.bfe/subscriptions.bundle.json`

- [ ] **Step 2: Run the focused tests and confirm RED**

Run the smallest targeted node test command for the new publish/backup cases.

- [ ] **Step 3: Implement the minimal contract closure**

Required outcomes:
- docs no longer promise behavior that code does not implement
- if Hugo project-pages is supported, code must implement it; otherwise the UI/docs/result objects must say it is not yet supported
- backup/import RSS contract becomes closed and reproducible

- [ ] **Step 4: Re-run focused tests and update docs**

Run the new targeted test command plus:
```bash
pnpm run build:renderer
```

## Task 7: Final verification and remaining-remediation sweep

**Files:**
- Verify all touched code and docs

- [ ] **Step 1: Run the focused regression suite**

Run:
```bash
pnpm exec node --test src/main/services/contentService.test.js src/main/services/previewService.test.js
pnpm exec node --test src/renderer/src/utils/themeConfigHelpers.test.mjs
```

- [ ] **Step 2: Run repo-level verification**

Run:
```bash
pnpm run build:renderer
pnpm run dev
```

- [ ] **Step 3: Run diagnostics on changed files**

Use language-server diagnostics on every edited JS/Vue/MJS file and require zero new errors.

- [ ] **Step 4: Re-check the original audit list line by line**

Confirm each confirmed issue is now in one of three states:
- fixed and verified
- explicitly documented as still blocked with evidence
- downgraded as non-blocking with justification

## Verification Checklist

- [ ] `pnpm run dev`
- [ ] `pnpm run build:renderer`
- [ ] `pnpm exec node --test src/main/services/contentService.test.js src/main/services/previewService.test.js`
- [ ] `pnpm exec node --test src/renderer/src/utils/themeConfigHelpers.test.mjs`
- [ ] changed-file diagnostics are clean
- [ ] README / guide claims match actual behavior after remediation

## Out of Scope

- Broad security-boundary refactors that were only present in older P0–P3 design docs but are not part of the currently confirmed audit set
- Splitting `ipc.js`, `App.vue`, or `envService.js` purely for maintainability unless a current bug fix requires a tiny extraction for testability
- TypeScript migration
- Router rewrite
- Full component-test adoption for every renderer page
