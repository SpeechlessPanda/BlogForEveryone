# Wave 2 Docs, Privacy, And Release-Readiness Design

## Goal

Refresh beginner-facing documentation so it matches the current product behavior, add an explicit release-page entry near the top of the README, and add a repeatable package/privacy verification path that proves release artifacts do not bundle local app data, test-account remnants, or known sensitive files.

## Why This Wave Exists

Wave 1 closed the highest-priority blocker/security/core-UX fixes. The next safe wave is release-readiness:

1. the public docs are stale and can mislead beginners,
2. the release entry points are buried,
3. packaging/privacy is structurally safer than the user fears, but it is not yet expressed as a repeatable verification artifact.

This wave must stay out of destructive release-history cleanup. Deleting old releases/tags or re-releasing a historical baseline remains deferred until the semantics are explicit.

---

## Grounded Current State

### README is stale and missing the release entry point

From `README.md` in the current Wave 1 worktree:

- line 9 still says `当前版本：v1.1.0。`
- there is no release-page hyperlink near the top
- the body already contains many useful beginner-facing sections, but the first-screen orientation is now inaccurate for the current shipped state (`v1.3.5` on main at the start of Wave 2)

### Beginner docs exist but are not aligned into a release-ready top-of-funnel

Current docs reviewed directly:

- `docs/guides/blog-publish-pages-beginner.md`
- `docs/guides/release-signing-auto-update.md`
- `docs/guides/github-oauth-app-setup.md`
- `docs/guides/dev-runtime-troubleshooting.md`

Grounded issues:

- publish beginner guide still reflects an older, more manual publish flow (`GitHub 仓库地址` wording) rather than the current user-pages simplification and backup-aware release flow
- release/signing guide contains correct release mechanics, but it does not serve as a clear release/download entry from the README top
- beginner guides are useful but scattered; the README top does not funnel users into the right next link quickly enough

### Packaging/privacy currently looks structurally safe, but verification is implicit

Grounded from current source:

- `package.json` build files include only:
  - `src/main/**/*`
  - `dist/renderer/**/*`
  - `src/img/**/*`
  - `src/shared/**/*`
  - `package.json`
- `storeService.js` writes runtime data under:
  - `app.getPath('userData')/bfe-data`
  - fallback `.tmp-user-data` only when Electron app paths are unavailable
- `githubAuthService.js` stores auth via encrypted ciphertext in the store layer and does not persist plaintext access tokens in normal state shape
- `scripts/sanitize-release.js` already removes:
  - `dist/builder-debug.yml`
  - `dist/builder-effective-config.yaml`
  - `.bfe/subscriptions.bundle.json`
  - `.bfe/metadata.json`
  - and recursively deletes `db.json`, `auth.json`, `token.txt` under `dist` and `.bfe`

This means the app is already closer to safe packaging than the user fears. However, the project still lacks a dedicated, repeatable Wave 2 artifact that says: “here is the exact check that proves packaged release inputs/outputs do not contain local app data or known sensitive files.”

### Security boundary note that remains outside this wave

The earlier audit already identified a remaining theme-upload trust-boundary issue, but Wave 1A has already closed that in the Wave 1 worktree. Wave 2 should not reopen or redesign that work.

---

## Approved Direction

Wave 2 stays narrow and does three things only:

1. **README refresh**
   - Update the visible current-version/release guidance at the top.
   - Add a clear release/download hyperlink near the top.
   - Reword the top summary so it matches the actual current product flow.

2. **Beginner-doc refresh**
   - Update the publish beginner guide so it reflects the current release flow and user-pages/project-pages wording.
   - Update the app-release/signing guide so it clearly distinguishes app release vs blog publish and points to the live release page.
   - Keep the docs beginner-friendly and direct.

3. **Package/privacy verification path**
   - Add a repeatable verification artifact for privacy/release readiness.
   - The artifact must prove, using current repo/build/package conventions, that release packaging does not intentionally include local runtime store data, auth/session files, or known sensitive files.
   - The verification may be implemented as a script plus test, or equivalent automation with a written report path, but it must be runnable and not just descriptive prose.

---

## Required Behavior

### A. README top section

The README top must, at minimum:

1. show the current product version accurately for this wave branch,
2. include a release/download link near the top,
3. explain in simple language what the app does today,
4. point beginners toward the correct publish/auth/release guidance.

### B. Beginner-facing docs

The updated docs must:

1. stay aligned with the actual current UI/flow,
2. avoid teaching a manual step when the current product auto-derives it,
3. clearly separate:
   - app release/update flow
   - blog publish flow
   - GitHub OAuth setup flow
4. remain readable for beginners, not release engineers only.

### C. Package/privacy verification

The project must gain a repeatable check that verifies all of the following:

1. packaged release inputs do not rely on runtime `userData/bfe-data` contents,
2. runtime storage boundaries remain outside packaged release inputs, including:
   - `app.getPath('userData')/bfe-data`
   - `app.getPath('sessionData')`
   - GitHub auth/session ciphertext stored through the store layer rather than package assets,
3. sensitive filenames and obvious local-state artifacts are scrubbed from release staging/output,
4. no known test-account artifact is intentionally bundled by the packaging configuration,
5. the check is runnable from the repo and suitable for future release gates.

This wave does **not** need to prove that every Windows installer byte has been manually unpacked and audited. It does need to add a concrete, repeatable repo/build-level verification path that materially increases confidence and can be run before shipping.

---

## File Scope

### Required implementation scope

- `README.md`
- `docs/guides/blog-publish-pages-beginner.md`
- `docs/guides/release-signing-auto-update.md`
- one or more new/updated Wave 2 verification files under `scripts/` and/or tests if needed for package/privacy verification

### Read-only context

- `package.json`
- `scripts/sanitize-release.js`
- `src/main/services/storeService.js`
- `src/main/services/githubAuthService.js`
- `src/main/main.js`
- `src/main/preload.js`
- `docs/guides/github-oauth-app-setup.md`
- `docs/guides/dev-runtime-troubleshooting.md`

### Must stay out of scope in Wave 2

- publish/import renderer logic
- backend publish/import contracts
- theme IPC security work already handled in Wave 1A
- version bump / release creation / release deletion
- deleting historical releases/tags/assets

---

## Verification Contract

Wave 2 is only done when all of the following are true:

1. docs/source tests (new or existing) that lock the updated README/docs/privacy verification path pass,
2. any new privacy/package verification script/test passes,
3. `pnpm run build:renderer` still passes,
4. the broader regression suite chosen for this wave remains green,
5. there is a clear Wave 2 artifact path that future release work can cite.

---

## Explicit Non-Goals

Wave 2 does **not**:

- delete old releases,
- delete tags,
- rename or recreate historical versions,
- re-release a historical baseline like “v0”,
- redesign the app shell,
- broaden package privacy work into unrelated Electron hardening.

Those remain later, separately-scoped work.
