# Wave 1A Theme Upload Hardening Design

## Goal

Bring `theme:uploadImageToGithub` under the same managed-workspace boundary as the other theme write flows so renderer-supplied payloads can no longer drive arbitrary local file uploads through the main process.

## Why This Wave Exists

Current `main` already hardens these theme IPC handlers through managed-workspace resolution:

- `theme:getConfig`
- `theme:saveConfig`
- `theme:saveLocalAsset`
- `theme:applyPreviewOverrides`

But `theme:uploadImageToGithub` still directly forwards raw renderer payload into `uploadImageToRepo(payload)`. That leaves one privileged file-path write/upload path outside the policy boundary.

This is a blocker because the renderer/main trust boundary should be consistent across all theme write operations before any new release workflow proceeds.

---

## Grounded Current State

### `src/main/ipc/themeIpc.js`

- already has `resolveWorkspace(payload)` and `withCanonicalWorkspace(payload)`
- already rewrites `projectDir/framework` for `saveLocalAsset` and `applyPreviewOverrides`
- still does:

```js
ipcMain.handle('theme:uploadImageToGithub', async (_event, payload) => {
  return uploadImageToRepo(payload);
});
```

### `src/main/policies/workspacePathPolicy.js`

Available primitives already exist:

- `getManagedWorkspace(workspaceId)`
- `listManagedWorkspaces()`
- `assertPathWithinWorkspace(workspaceId, candidatePath, action)`

### `src/main/services/githubRepoService.js`

`uploadImageToRepo(payload)` currently requires:

- `owner`
- `repo`
- `localFilePath`

and uploads the file via the GitHub contents API after reading the local file from disk.

### `src/renderer/src/composables/useThemeConfigActions.mjs`

There is currently no renderer call site for `uploadThemeImageToGithub`; the preload surface exists, but the composable only uses:

- `getThemeConfig`
- `validateThemeSettings`
- `saveThemeConfig`
- `saveThemeLocalAsset`
- `applyThemePreviewOverrides`

That means Wave 1A can stay minimal and boundary-focused without a renderer refactor.

---

## Approved Direction

### 1. Managed-workspace enforcement becomes mandatory for `theme:uploadImageToGithub`

`theme:uploadImageToGithub` must use the same workspace resolution path as the other theme handlers:

- prefer `workspaceId`
- otherwise allow the current fallback match on renderer-supplied `projectDir/framework`
- reject missing or unmanaged context

### 2. Local file path must be canonicalized against the managed workspace

Before calling `uploadImageToRepo(...)`, the main process must rewrite and validate:

- `projectDir`
- `framework`
- `localFilePath`

`localFilePath` must resolve inside the canonical managed workspace root. If it is outside the workspace, the IPC handler must reject it.

The canonicalized path returned by `workspacePathPolicy.assertPathWithinWorkspace(...)` must replace the raw renderer-supplied `localFilePath` before the payload is forwarded to `uploadImageToRepo(...)`.

### 3. Upload target semantics stay unchanged in this wave

This wave does **not** redesign `owner/repo/branch/targetDir` semantics. It only closes the file-path / workspace-boundary gap. Future hardening of repo-target selection can be handled separately if product requirements require it.

### 4. Renderer/preload API shape stays unchanged

No renderer changes are required for this wave. Existing or future renderer calls can keep using the current preload method name and payload shape; enforcement happens in the privileged boundary.

---

## Required Behavior

1. `theme:uploadImageToGithub` rejects unmanaged or missing workspace context.
2. `theme:uploadImageToGithub` rewrites `projectDir` and `framework` to canonical managed workspace values before downstream use.
3. `theme:uploadImageToGithub` rejects `localFilePath` values outside the managed workspace root.
4. `theme:uploadImageToGithub` forwards the canonicalized `localFilePath` returned by the workspace policy, never the original raw renderer string.
5. Existing hardened theme handlers (`getConfig`, `saveConfig`, `saveLocalAsset`, `applyPreviewOverrides`) must keep their current behavior.
6. No preload or renderer API contract changes in this wave.

---

## File Scope

### Required

- `src/main/ipc/themeIpc.js`
- `src/main/ipc/themeIpc.test.js`
- `src/main/ipc/payloadGuards.test.js`

### Read-only context

- `src/main/policies/workspacePathPolicy.js`
- `src/main/services/githubRepoService.js`
- `src/main/services/themeService.js`
- `src/main/ipc.js`
- `src/main/preload.js`
- `src/renderer/src/composables/useThemeConfigActions.mjs`

### Explicit non-goals

- do not redesign theme upload product flow
- do not refactor `themeService.js`
- do not change renderer composables or Vue pages
- do not change `owner/repo/branch/targetDir` selection semantics in this wave

---

## Verification Contract

Wave 1A is complete only when:

1. Focused IPC tests prove:
   - upload rejects missing/unmanaged workspace context
   - upload rewrites to canonical workspace context
   - upload rejects `localFilePath` outside the managed workspace root
2. Existing theme IPC tests still pass.
3. Targeted test command is green.
4. Renderer build still passes.

Recommended exact verification commands:

```bash
pnpm exec node --test "src/main/ipc/themeIpc.test.js" "src/main/ipc/payloadGuards.test.js"
pnpm run build:renderer
```

---

## Ship Gate For Moving To Wave 1B

Do not start the publish-UX cleanup wave until this boundary hardening is green. This is the remaining privileged-path blocker identified in the audit and should be cleared first.
