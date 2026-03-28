# Wave 1B User-Pages Publish UX Design

## Goal

Make the `user-pages` publish path stop reading as if the user still needs to manually provide a deploy repository name. After login, the publish page should clearly show that the deploy repository is derived as `${login}.github.io`, while keeping `project-pages` naming manual.

## Why this wave exists

The current publish experience already computes the user-pages deploy repository name from the normalized GitHub login, but the UI still presents a manual `发布仓库名称` field and readiness text that implies the user must fill that name. That mismatch creates unnecessary beginner friction and directly conflicts with the intended beginner-safe publish flow.

## Grounded current state

### Current renderer behavior

From `src/renderer/src/views/PublishBackupView.vue` in the current `wave1-ux-security-hardening` worktree:

- `resolvedDeployRepoName` already derives `${normalizedPublishLogin}.github.io` when `publishForm.siteType === USER_PAGES`.
- `deployRepoUrl`, `accessAddress`, and the publish payload already use the derived user-pages repo name.
- `publishReadiness` still returns `待补充：填写发布仓库名称。` whenever `resolvedDeployRepoName` is empty, even though for user-pages the field is derived.
- The template still renders a generic `发布仓库名称` input block with:
  - the field disabled for `user-pages`
  - placeholder text `会自动固定为 用户名.github.io`
  - helper text `当前仓库：{{ resolvedDeployRepoName || "等待填写" }}`

### Current test state

From `src/renderer/src/views/PublishBackupView.redesign.test.mjs` and `src/renderer/src/views/PublishBackupView.facade.test.mjs`:

- tests already prove user-pages naming guidance exists
- tests already prove the payload shape and `${normalizedPublishLogin}.github.io` derivation exist
- tests do **not** yet prove that user-pages no longer reads as a manual repo-name step

## Approved direction

1. **Renderer-only UX correction**
   - This wave modifies only `PublishBackupView.vue` and its focused tests.
   - No backend, preload, IPC, auth contract, or import flow changes are allowed.

2. **User-pages deploy naming becomes visibly derived, not manually requested**
   - When `siteType === user-pages`, the page must no longer present the deploy repository as a field the user should fill.
   - The UI should instead present it as a derived, read-only outcome from the normalized GitHub login.

3. **Project-pages remains manual**
   - `project-pages` must continue to expose a manual deploy repository name field.
   - This wave must not guess project-pages repository names.

4. **Readiness copy must match real behavior**
   - For `user-pages`, readiness should not imply that the deploy repo name itself is a manual missing input.
   - The gating dependency remains the normalized GitHub login; once the login exists, the user-pages repo name is derived.

5. **Publish payload shape stays unchanged**
   - The payload into `publishToGitHub(...)` must remain the same field set as before.
   - Only the UX/copy/field presentation changes in this wave.

## Required behavior

### User-pages mode

- The page must clearly show that the deploy repository is fixed as `${login}.github.io`.
- The user must not be asked to manually fill a deploy repo name in this mode.
- The presentation can be a read-only field, derived preview block, or similar static display, but it must read as derived state rather than required manual input.
- Readiness/copy must treat missing login as the blocker, not missing deploy repo name.

### Project-pages mode

- The existing manual deploy repo name input remains visible and editable.
- Existing project-pages guidance and access-address explanation remain intact.

### Non-goals for this wave

- No import/recovery autodetect changes
- No dark-theme contrast changes
- No auth-state contract changes
- No README/docs/release cleanup changes

## File scope

### Required
- `src/renderer/src/views/PublishBackupView.vue`
- `src/renderer/src/views/PublishBackupView.redesign.test.mjs`
- `src/renderer/src/views/PublishBackupView.facade.test.mjs`

### Read-only context
- `src/renderer/src/styles.css`

## Verification contract

This wave is complete only when all of the following are true:

1. Focused publish renderer tests prove:
   - user-pages no longer reads as a manual repo-name step
   - project-pages still keeps manual repo naming
   - readiness/copy align with derived `${login}.github.io` behavior
   - payload shape is unchanged
2. `pnpm exec node --test "src/renderer/src/views/PublishBackupView.redesign.test.mjs" "src/renderer/src/views/PublishBackupView.facade.test.mjs"` passes
3. `pnpm run build:renderer` passes

## Constraints

- Keep this wave minimal and renderer-only.
- Do not broaden into Patch B import work or later dark-theme/docs waves.
- Do not change versioning, release metadata, or git state in this wave.
