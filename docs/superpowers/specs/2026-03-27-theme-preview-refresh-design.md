# BlogForEveryone Theme Preview Refresh & Push Repair Design

**Goal:** Replace all ten local theme preview screenshots with stronger public homepage captures that clearly show each theme’s visible components, then repair the blocked `main -> origin/main` push path without publishing a new release.

## Approved Direction

This work has two coordinated parts:

1. **Theme preview asset refresh** — keep the existing runtime filenames and local folder structure, but replace every screenshot with a better homepage capture sourced from the best public live example for that theme.
2. **Git transport repair** — fix the current HTTPS/TLS push blockage safely and minimally so the already-merged local `main` commit can be pushed to `origin/main`.

The two parts stay coordinated because the final delivery requires both refreshed assets and a successful remote sync, but they remain separate in responsibility: asset quality should not be conflated with Git transport debugging.

## Exact User Requirements

1. All ten theme preview images must be replaced.
2. The new images must come from real public homepage examples, not weak placeholders.
3. The image selection must reflect what the theme visibly contains, so the capture must show meaningful components and functionality.
4. The files must be downloaded and stored in the same local preview folder already used by the renderer.
5. The existing push problem on `main` must be investigated and, if possible, repaired.
6. This work must not publish or replace any GitHub release.

## Grounded Current State

### Local preview asset state

- The current runtime folder is `src/renderer/public/theme-previews/`.
- The current filenames are:
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
- `src/renderer/src/views/WorkspaceView.vue` already maps the ten themes to those exact filenames through `themePreviewMap` and `resolveThemePreviewPath(previewBaseUrl, ...)`.
- Therefore the refresh must keep filenames stable unless the renderer mapping is intentionally updated.

### Existing provenance manifest

- `docs/design-assets/theme-preview-manifest.md` is the current source-of-truth manifest for preview provenance.
- It already records filename, theme id, source URL / repo path, source type, curation date, and rationale.
- The new refresh must update this manifest rather than introduce a second competing provenance file.

### Current push failure state

- Root repo status has already been verified as local `main` ahead of `origin/main`.
- The current root transport error is:
  - `schannel: failed to receive handshake, SSL/TLS connection failed`
- Local Git configuration currently shows a concrete backend conflict signal:
  - system config: `http.sslbackend openssl`
  - user config: `http.sslbackend schannel`
- This conflict is a grounded candidate root cause and must be treated as part of the push-repair diagnosis.

## Theme Screenshot Replacement Contract

### 1. File-location and filename contract

- Final images must be saved in `src/renderer/public/theme-previews/`.
- The existing ten runtime filenames must remain unchanged unless implementation proves a mapping change is necessary and safe.
- `WorkspaceView.vue` should preferably remain unchanged for this task if the filenames are preserved.

### 2. Allowed source policy

- The accepted sourcing rule is **best public live example**, not “official demos only.”
- Official demo/homepage sources should still be preferred when they are strong enough.
- If the official source is too sparse, too marketing-oriented, or does not show a meaningful built homepage, a better public live example is allowed.

### 3. Screenshot selection quality bar

Each of the ten final images must satisfy all of the following:

1. It represents a real built homepage, not a generic README banner or empty landing page.
2. The visible capture clearly shows meaningful theme structure, such as some combination of:
   - top navigation
   - hero/header area
   - article list or article cards
   - sidebar/profile rail
   - tags/categories/meta blocks
   - search affordance
   - pagination/footer
   - theme-specific layout personality (dense portal, minimal reader, magazine stack, etc.)
3. The final crop must prioritize homepage comprehension over decorative whitespace.
4. The ten images should have a reasonably consistent visual framing so the preview gallery does not feel arbitrarily mixed.

### 4. Manifest contract

For each refreshed screenshot, `docs/design-assets/theme-preview-manifest.md` must record:

- final filename
- theme id
- final chosen public source URL
- source type (for example `live capture`)
- curation date
- short rationale describing what visible components/features justified the choice

If a non-official public site is used because it better demonstrates the theme, the rationale must say so explicitly.

## Push Repair Contract

### 1. Safety boundary

- This is a transport/debugging repair only.
- Do not rewrite history.
- Do not publish a release.
- Do not retag anything.
- Do not use destructive Git operations to “work around” HTTPS push failure.

### 2. Diagnosis order

The implementation must use this order:

1. Verify current local/remote branch state on root `main`.
2. Re-read current remote URL and relevant Git HTTP/TLS configuration.
3. Resolve the concrete backend conflict if present.
4. Re-test low-risk remote connectivity (`git ls-remote origin` or equivalent read-only verification) before retrying `git push origin main`.
5. Only if HTTPS remains blocked after safe backend/config cleanup, evaluate a documented fallback path that still preserves history and does not require publish/release changes.

### 3. Configuration-change safety rules

- Prefer the smallest reversible change that directly addresses the proven conflict.
- Document exactly what changed and why.
- Do not mutate repository history.
- Do not force-push.
- Do not claim the push is fixed until `git push origin main` actually succeeds.

## Expected Files to Change

### Asset refresh files

- `src/renderer/public/theme-previews/*` — all ten screenshots replaced
- `docs/design-assets/theme-preview-manifest.md` — provenance updated
- `src/renderer/src/views/WorkspaceView.preview-assets.test.mjs` — updated only if the provenance/asset expectations need refreshed locking
- `src/renderer/src/views/WorkspaceView.redesign.test.mjs` — only if it hard-codes assumptions about preview asset structure that legitimately changed

### Push repair files

- Prefer no source-file changes if the push issue is purely environment/configuration-side.
- If a durable repo-tracked note or script is needed, it must be narrowly justified and directly tied to safe push diagnostics.

## Verification Contract

### Asset refresh verification

At minimum, the implementation must verify:

1. All ten files still exist in `src/renderer/public/theme-previews/`.
2. The filenames still match the ten runtime mappings.
3. The updated manifest entries match the final chosen sources.
4. `WorkspaceView` preview-related tests still pass.
5. Renderer build still passes.

### Push repair verification

At minimum, the implementation must verify:

1. Root repo branch state before retrying push.
2. Remote connectivity after the chosen fix path.
3. `git push origin main` actually succeeds.
4. Root `main` and `origin/main` resolve to the same commit after the push.

## Delivery Boundary

- This task ends when:
  - the ten screenshots are replaced and documented,
  - local preview asset mapping still works,
  - and root `main` has been successfully pushed to `origin/main`.
- This task explicitly does **not** include release publication or release replacement.

## Constraints

- Keep the runtime preview filenames stable unless there is a compelling verified reason to change them.
- Do not accept low-information screenshots just because they are official.
- Do not fake “better previews” with images that fail to show meaningful homepage structure.
- Do not claim the push issue is solved based on config edits alone; only a successful `git push origin main` counts.
