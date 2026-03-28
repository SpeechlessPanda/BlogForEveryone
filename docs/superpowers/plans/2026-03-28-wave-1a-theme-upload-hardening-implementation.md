# Wave 1A Theme Upload Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden `theme:uploadImageToGithub` so it enforces managed-workspace context and rejects out-of-workspace local file paths before uploading.

**Architecture:** Keep this wave strictly at the IPC boundary. Reuse the existing managed-workspace policy and canonical workspace resolution already used by the other theme handlers. Do not redesign renderer or upload target semantics in this wave.

**Tech Stack:** Electron main-process IPC, node:test, existing workspace path policy, existing GitHub upload service.

---

## File Structure

### Modify
- `src/main/ipc/themeIpc.js` — add canonical workspace + local-file-path enforcement for `theme:uploadImageToGithub`
- `src/main/ipc/themeIpc.test.js` — add upload-specific managed-workspace/canonicalization regression tests
- `src/main/ipc/payloadGuards.test.js` — extend theme payload-guard coverage for upload handler rejection paths

### Read-only references
- `src/main/policies/workspacePathPolicy.js`
- `src/main/services/githubRepoService.js`
- `src/main/services/themeService.js`
- `src/main/preload.js`
- `src/renderer/src/composables/useThemeConfigActions.mjs`

### Must stay unchanged in this wave
- `src/main/services/githubRepoService.js`
- `src/main/preload.js`
- all renderer files
- `src/main/ipc.js` unless implementation proves a missing dependency in production wiring

---

### Task 1: Upload handler boundary hardening

**Files:**
- Modify: `src/main/ipc/themeIpc.js`
- Test: `src/main/ipc/themeIpc.test.js`
- Test: `src/main/ipc/payloadGuards.test.js`
- Modify if needed: `src/main/ipc.js`

- [ ] **Step 1: Write the failing tests**

Add failing tests that prove all of these:
- `theme:uploadImageToGithub` rejects missing/unmanaged workspace context.
- `theme:uploadImageToGithub` rewrites `workspaceId/projectDir/framework` to the canonical managed workspace values before calling `uploadImageToRepo`.
- `theme:uploadImageToGithub` rejects `localFilePath` values outside the managed workspace root.
- `theme:uploadImageToGithub` forwards the canonicalized `localFilePath` returned by `assertPathWithinWorkspace(...)`, not the raw renderer-supplied path.
- Existing hardened theme handlers keep their current behavior.
- Both IPC test harnesses expose the policy methods the implementation will actually call (`assertPathWithinWorkspace`, and `normalizePath` only if the implementation uses it).

- [ ] **Step 2: Run the RED slice**

Run:

```bash
pnpm exec node --test "src/main/ipc/themeIpc.test.js" "src/main/ipc/payloadGuards.test.js"
```

Expected: FAIL because upload handler still forwards raw payload and does not validate `localFilePath` against the managed workspace.

- [ ] **Step 3: Implement the minimal IPC-only fix**

Implementation constraints:
- Reuse `resolveWorkspace(...)` / `withCanonicalWorkspace(...)` style logic in `themeIpc.js`.
- Use the managed workspace policy to validate `localFilePath` within the canonical workspace root before calling `uploadImageToRepo(...)`.
- Replace the outgoing `localFilePath` with the canonicalized path returned by `assertPathWithinWorkspace(...)`.
- Keep the handler rejecting missing/unmanaged context.
- Do **not** touch renderer/preload/API names.
- Do **not** redesign repo target semantics in this wave.
- Keep `src/main/ipc.js` unchanged unless implementation proves the current production wiring is insufficient.

- [ ] **Step 4: Run the GREEN slice**

Run again:

```bash
pnpm exec node --test "src/main/ipc/themeIpc.test.js" "src/main/ipc/payloadGuards.test.js"
```

Expected: PASS.

- [ ] **Step 5: Build verification**

Run:

```bash
pnpm run build:renderer
```

Expected: PASS. No renderer behavior should be affected by this IPC-only hardening.

- [ ] **Step 6: Stop after Wave 1A**

Do not continue into publish UX or dark-mode fixes from inside this task. Wave 1A is complete when the targeted IPC tests and renderer build are green.

---

## Completion Checklist

- [ ] Upload handler now enforces managed workspace resolution.
- [ ] Upload handler rejects out-of-workspace `localFilePath`.
- [ ] Upload handler forwards canonicalized `localFilePath`, not raw renderer input.
- [ ] Existing theme IPC behavior remains green.
- [ ] Targeted node tests pass.
- [ ] Renderer build passes.
- [ ] Scope stayed IPC-only.
