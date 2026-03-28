# Wave 2 Docs And Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh README/beginner release docs and add a repeatable package/privacy verification path without changing product behavior or release-history semantics.

**Architecture:** Keep Wave 2 split between content refresh and release-readiness verification. Documentation changes stay in Markdown files; privacy verification becomes an explicit runnable script/test artifact so future release work has a concrete gate instead of relying on assumptions.

**Tech Stack:** Markdown docs, existing Node.js scripts, node:test, Electron packaging configuration, existing sanitize-release flow.

---

## File Structure Map

### Required implementation files

- Modify: `README.md`
- Modify: `docs/guides/blog-publish-pages-beginner.md`
- Modify: `docs/guides/release-signing-auto-update.md`
- Create or modify: `scripts/verify-package-privacy.js`
- Create or modify: `scripts/verify-package-privacy.test.js`

### Read-only context

- Read only: `package.json`
- Read only: `scripts/sanitize-release.js`
- Read only: `src/main/services/storeService.js`
- Read only: `src/main/services/githubAuthService.js`
- Read only: `src/main/main.js`
- Read only: `src/main/preload.js`
- Read only: `docs/guides/github-oauth-app-setup.md`
- Read only: `docs/guides/dev-runtime-troubleshooting.md`

### Must stay unchanged unless the plan is wrong

- `src/renderer/**`
- `src/main/ipc/**`
- `src/main/services/publishService.js`
- `src/main/services/workspaceWorkflowService.js`
- release tags/assets/history

---

### Task 1: README top refresh

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the failing README test or source assertions**

Add a source-level test or equivalent node:test coverage that proves the README top now:
- states the current version correctly for this wave branch,
- includes a release/download hyperlink near the top,
- points readers toward the correct publish/auth/release docs.

- [ ] **Step 2: Run the README test to verify it fails**

Run: `pnpm exec node --test "scripts/verify-package-privacy.test.js"`

Expected: FAIL because the README is still stale (`v1.1.0`) and lacks the new release-link/top-of-funnel wording. If a dedicated README test file is not added, expand the verification script test to assert README requirements and make it fail first.

- [ ] **Step 3: Update README minimally**

Required outcomes:
- current version at top is accurate,
- release/download hyperlink appears near the top,
- top summary matches today’s shipped app behavior,
- no unrelated README rewrite.

- [ ] **Step 4: Re-run the README/privacy test to verify it passes**

Run: `pnpm exec node --test "scripts/verify-package-privacy.test.js"`

Expected: PASS for the README assertions.

---

### Task 2: Beginner docs refresh

**Files:**
- Modify: `docs/guides/blog-publish-pages-beginner.md`
- Modify: `docs/guides/release-signing-auto-update.md`

- [ ] **Step 1: Write the failing doc assertions**

Add failing assertions in `scripts/verify-package-privacy.test.js` (or an adjacent new node:test file if cleaner) proving:
- publish beginner guide does not teach an outdated fully-manual repo-entry flow when the app now auto-derives the user-pages repo name,
- release/signing guide clearly distinguishes app release vs blog publish,
- release/signing guide links to the live release page.

- [ ] **Step 2: Run the doc/privacy test to verify it fails**

Run: `pnpm exec node --test "scripts/verify-package-privacy.test.js"`

Expected: FAIL because current guides still reflect stale/manual wording and do not fully meet the new release-readiness contract.

- [ ] **Step 3: Update the docs minimally**

Required outcomes:
- beginner publish guide matches current publish flow wording,
- release guide includes the release-page entry and clarifies app release vs blog publish,
- docs remain beginner-friendly and direct.

- [ ] **Step 4: Re-run the doc/privacy test to verify it passes**

Run: `pnpm exec node --test "scripts/verify-package-privacy.test.js"`

Expected: PASS for the new doc assertions.

---

### Task 3: Package/privacy verification artifact

**Files:**
- Create or modify: `scripts/verify-package-privacy.js`
- Create or modify: `scripts/verify-package-privacy.test.js`

- [ ] **Step 1: Write the failing privacy-verification test**

The test must fail until the verification script proves, at minimum:
- packaging config does not include runtime `userData/bfe-data` paths,
- runtime storage boundaries remain outside packaged inputs, including checks grounded in:
  - `storeService.js` using `app.getPath('userData')/bfe-data`
  - `main.js` assigning `sessionData` under `userData`
  - GitHub auth/session storage remaining in encrypted store data rather than packaged assets,
- `sanitize-release.js` scrub targets cover the known sensitive filenames/artifacts,
- the verification script reports or exits non-zero when those invariants are missing,
- the script can be run from repo root as a repeatable release-readiness check.

- [ ] **Step 2: Run the privacy-verification test to verify it fails**

Run: `pnpm exec node --test "scripts/verify-package-privacy.test.js"`

Expected: FAIL until the script and checks are fully implemented.

- [ ] **Step 3: Implement the privacy verification script minimally**

Required behavior:
- read `package.json` build file whitelist,
- read `scripts/sanitize-release.js`,
- check the expected sensitive artifact exclusions,
- produce a clear success/failure result suitable for future release gates.

Do **not** broaden this into full installer unpacking or destructive release cleanup.

- [ ] **Step 4: Run the privacy test to verify it passes**

Run: `pnpm exec node --test "scripts/verify-package-privacy.test.js"`

Expected: PASS.

---

### Task 4: Wave 2 verification gate

**Files:**
- Verify: `README.md`
- Verify: `docs/guides/blog-publish-pages-beginner.md`
- Verify: `docs/guides/release-signing-auto-update.md`
- Verify: `scripts/verify-package-privacy.js`
- Verify: `scripts/verify-package-privacy.test.js`

- [ ] **Step 1: Run the focused Wave 2 source/privacy slice**

Run: `pnpm exec node --test "scripts/verify-package-privacy.test.js"`

Expected: PASS.

- [ ] **Step 2: Run renderer build to prove no collateral damage**

Run: `pnpm run build:renderer`

Expected: PASS.

- [ ] **Step 3: Run broader regression for release readiness confidence**

Run: `pnpm exec node --test`

Expected: PASS.

- [ ] **Step 4: Optional release-readiness evidence artifact**

Do not modify audit/remediation reports in Wave 2. Keep this wave scoped to README, beginner docs, and the runnable package/privacy verification artifact only.

---

## Stop Conditions

Stop and re-scope instead of continuing if implementation starts to require:

- renderer or backend product-behavior changes,
- release/tag deletion,
- version bump or release creation,
- unpacking and forensics of historical installers as a prerequisite,
- broad README/doc rewrites unrelated to the release-readiness goals.

Wave 2 is done when docs are current, the release link is visible near the top, and package/privacy verification is explicit and repeatable. Only then should later release operations even be considered.
