# Theme Preview Refresh & Push Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all ten theme preview screenshots with stronger public homepage captures and safely restore `git push origin main` so local `main` and `origin/main` match again without publishing any release.

**Architecture:** Keep the runtime preview filename contract stable so `WorkspaceView.vue` does not need broad runtime changes. Treat screenshot refresh and push recovery as two coordinated but separate workstreams: one updates local preview assets plus provenance, the other diagnoses and repairs the root `main` HTTPS/TLS push path with the smallest safe reversible change.

**Tech Stack:** Vue renderer asset pipeline, local static PNG assets, Markdown manifest maintenance, Git for Windows, GitHub HTTPS remote

---

## File Structure Map

### Runtime asset surfaces
- Modify: `src/renderer/public/theme-previews/*.png` — replace the ten preview screenshots while preserving current filenames.
- Modify: `docs/design-assets/theme-preview-manifest.md` — update source URL, source type, curation date, and rationale for each refreshed screenshot.

### Approved per-file screenshot source table

Use these source URLs as the approved first-choice targets for the ten final captures. Replace a source only if it is unreachable or clearly fails the design quality bar, and record that deviation explicitly in the manifest rationale.

| Final filename | Theme ID | Approved target source URL | Source note |
| --- | --- | --- | --- |
| `hexo-butterfly.png` | `hexo:butterfly` | `https://butterfly.js.org/` | official homepage if capture quality is sufficient |
| `hexo-fluid.png` | `hexo:fluid` | `https://hexo.fluid-dev.com/` | official homepage |
| `hexo-landscape.png` | `hexo:landscape` | `https://hexojs.github.io/hexo-theme-landscape/` | official demo homepage |
| `hexo-next.png` | `hexo:next` | `https://www.theme-next.org/` | official public site; docs-style homepage is acceptable only if it still shows strong theme structure |
| `hexo-volantis.png` | `hexo:volantis` | `https://volantis.js.org/examples/` | official examples homepage |
| `hugo-anatole.png` | `hugo:anatole` | `https://anatole-demo.netlify.app/` | public live demo homepage |
| `hugo-loveit.png` | `hugo:loveit` | `https://hugoloveit.com/` | official/public homepage |
| `hugo-mainroad.png` | `hugo:mainroad` | `https://mainroad-demo.netlify.app/` | public live demo homepage |
| `hugo-papermod.png` | `hugo:papermod` | `https://adityatelange.github.io/hugo-PaperMod/` | official live demo homepage |
| `hugo-stack.png` | `hugo:stack` | `https://demo.stack.jimmycai.com/` | official live demo homepage; if unreachable during execution, record the fallback source explicitly |

### Asset verification surfaces
- Modify if needed: `src/renderer/src/views/WorkspaceView.preview-assets.test.mjs` — keep asset mapping/provenance expectations aligned with the refreshed screenshots.
- Modify if needed: `src/renderer/src/views/WorkspaceView.redesign.test.mjs` — only if the preview-related source contract needs a narrow update tied directly to the refreshed asset flow.

### Push recovery surfaces
- Prefer no repo-tracked code changes if push repair can be completed through safe Git configuration cleanup.
- If a durable repo note becomes necessary, keep it narrowly scoped and justified.

### Verification / git surfaces
- Use root repo `D:\project\repository\BlogForEveryone` for push-repair diagnostics and final sync verification.

---

### Task 1: Refresh theme screenshot source set

**Files:**
- Modify: `docs/design-assets/theme-preview-manifest.md`
- Modify: `src/renderer/public/theme-previews/hexo-butterfly.png`
- Modify: `src/renderer/public/theme-previews/hexo-fluid.png`
- Modify: `src/renderer/public/theme-previews/hexo-landscape.png`
- Modify: `src/renderer/public/theme-previews/hexo-next.png`
- Modify: `src/renderer/public/theme-previews/hexo-volantis.png`
- Modify: `src/renderer/public/theme-previews/hugo-anatole.png`
- Modify: `src/renderer/public/theme-previews/hugo-loveit.png`
- Modify: `src/renderer/public/theme-previews/hugo-mainroad.png`
- Modify: `src/renderer/public/theme-previews/hugo-papermod.png`
- Modify: `src/renderer/public/theme-previews/hugo-stack.png`

- [ ] **Step 1: Gather the final failing/selection criteria before downloading**

Create a checklist for each theme source:
- real public homepage
- visible theme components/features
- better than sparse official demo if needed
- final filename preserved

- [ ] **Step 2: Download candidate homepage captures for all ten themes**

Use web/native fetch tooling to collect the chosen source images from the approved per-file source table above. Every final candidate must come from a **real public live homepage capture**, not a README banner, repository screenshot, or generic marketing landing page. Do not overwrite the final local files until you have all ten approved candidates.

Expected: one concrete chosen source per theme, with notes on what visible homepage components the capture shows.

- [ ] **Step 3: Replace the ten local preview files with the final selected images**

Keep these exact output filenames:
- `hexo-butterfly.png`
- `hexo-fluid.png`
- `hexo-landscape.png`
- `hexo-next.png`
- `hexo-volantis.png`
- `hugo-anatole.png`
- `hugo-loveit.png`
- `hugo-mainroad.png`
- `hugo-papermod.png`
- `hugo-stack.png`

- [ ] **Step 4: Update the manifest with final provenance and rationale**

For each of the ten rows in `docs/design-assets/theme-preview-manifest.md`, record:
- final filename
- theme id
- chosen public source URL
- source type (`live capture` or equivalent)
- current curation date
- rationale that explicitly mentions what visible homepage components/features justified the choice

If a non-official public site is chosen because it demonstrates the theme better than the official demo, the rationale must say that explicitly.

- [ ] **Step 5: Verify the asset folder shape is intact**

Run a directory read/verification that confirms all ten runtime filenames still exist in `src/renderer/public/theme-previews/`.

Expected: exactly the ten expected runtime files remain present.

### Task 2: Lock preview asset runtime expectations

**Files:**
- Modify if needed: `src/renderer/src/views/WorkspaceView.preview-assets.test.mjs`
- Modify if needed: `src/renderer/src/views/WorkspaceView.redesign.test.mjs`

- [ ] **Step 1: Write or tighten the failing preview-asset regression checks**

The test layer must still prove:
- the ten runtime preview filenames are exactly the ones expected by `WorkspaceView.vue`
- no theme preview mapping was silently dropped or renamed
- any manifest-linked provenance expectations still match the refreshed asset set if the test already locks them

- [ ] **Step 2: Run the preview-focused test slice to confirm RED if updates are required**

Run: `pnpm exec node --test "src/renderer/src/views/WorkspaceView.redesign.test.mjs" "src/renderer/src/views/WorkspaceView.preview-assets.test.mjs"`

Expected: RED only if test expectations legitimately need to change for the refreshed assets.

- [ ] **Step 3: Apply the minimal test updates needed for the refreshed assets**

Only update tests if the refreshed screenshots changed a contract already asserted by those files. Do not broaden runtime behavior scope.

- [ ] **Step 4: Re-run the same preview-focused test slice to GREEN**

Run: `pnpm exec node --test "src/renderer/src/views/WorkspaceView.redesign.test.mjs" "src/renderer/src/views/WorkspaceView.preview-assets.test.mjs"`

Expected: PASS.

- [ ] **Step 5: Verify renderer build still passes with the refreshed assets**

Run: `pnpm run build:renderer`

Expected: PASS.

### Task 3: Repair the blocked root push path safely

**Files:**
- Prefer environment/configuration only
- No repo-tracked file changes unless narrowly justified

- [ ] **Step 1: Reproduce the current push failure with root-state evidence**

Run from `D:\project\repository\BlogForEveryone`:
- `GIT_MASTER=1 git status --short --branch`
- `GIT_MASTER=1 git rev-parse --short HEAD`
- `GIT_MASTER=1 git rev-parse --short origin/main`
- `GIT_MASTER=1 git remote -v`

Expected: capture the exact local/remote state and transport target before any push retry.

- [ ] **Step 2: Inspect and resolve the conflicting HTTPS backend configuration**

Inspect relevant Git config origins and values, then apply the smallest safe reversible change so Git stops mixing `openssl` and `schannel` backends for this user environment.

Change-order contract:
- first inspect system-level and user-level origins
- prefer neutralizing the conflicting **user-level** `http.sslbackend` override before touching any system-level Git configuration
- do not change system-level config unless the user-level cleanup is proven insufficient and the exact reason is recorded

Expected: one clearly chosen HTTPS/TLS backend path, with the conflicting override removed or neutralized.

- [ ] **Step 3: Run a read-only remote connectivity check before retrying push**

Run a safe remote read such as:
- `GIT_MASTER=1 git ls-remote origin`

Expected: successful remote handshake/read. If it still fails, capture the new exact error and stop arbitrary config churn.

Fallback-path contract:
- after user-level backend cleanup, if `git ls-remote origin` still fails over HTTPS, the only allowed next step is to evaluate a documented non-history-rewriting fallback path
- the preferred fallback is an SSH transport migration only if read-only SSH auth can be proven first (for example a safe GitHub SSH auth check)
- if no safe fallback path can be verified, stop and report the push as externally blocked rather than guessing

- [ ] **Step 4: Retry the real push only after the read-only remote check succeeds**

Run: `GIT_MASTER=1 git push origin main`

Expected: PASS, with no history rewrite, no force push, and no release publication.

If this still fails after a successful HTTPS `git ls-remote origin`, capture the exact push-only error first, then evaluate the same approved safe fallback path (read-only SSH proof before any SSH transport switch). If that fallback also cannot be verified safely, stop with a blocked report instead of inventing more transport changes.

- [ ] **Step 5: Verify local and remote `main` now match**

Run:
- `GIT_MASTER=1 git status --short --branch`
- `GIT_MASTER=1 git rev-parse --short HEAD`
- `GIT_MASTER=1 git rev-parse --short origin/main`

Expected: root repo clean and local `HEAD` equal to `origin/main`.

### Task 4: Final verification and handoff

**Files:**
- Reuse changed files only

- [ ] **Step 1: Run the full final verification stack relevant to this task**

Run from root repo:
- `pnpm exec node --test "src/renderer/src/views/WorkspaceView.redesign.test.mjs" "src/renderer/src/views/WorkspaceView.preview-assets.test.mjs"`
- `pnpm run build:renderer`

Expected: PASS.

- [ ] **Step 2: Re-read the manifest and preview folder for final consistency**

Confirm that:
- all ten final files exist in `src/renderer/public/theme-previews/`
- the manifest rows match the actual final chosen sources and filenames

- [ ] **Step 3: Report the final asset provenance and push outcome clearly**

Final report must include:
- the folder where the refreshed screenshots now live
- where the provenance is documented
- whether root `main` was successfully pushed to `origin/main`
- explicit confirmation that no release/publish action was taken
