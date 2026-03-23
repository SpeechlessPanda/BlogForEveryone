# BlogForEveryone Test Strengthening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase confidence in the highest-risk behavior paths without trying to blanket-test the entire app in one pass.

**Architecture:** Add focused Node tests around pure or extractable logic first, then validate user-critical renderer flows with build checks and the existing real-workspace fixtures. Prefer tests that lock down known regressions and mapping logic over broad but shallow coverage.

**Tech Stack:** Node built-in test runner, Electron/Vue app, fixture workspaces under `e2e-real-workspaces/`, Vite renderer build.

---

## File Structure Map

- Create: `src/main/services/themeService.test.js` or a narrower theme-asset test file.
- Create: extracted pure helper module(s) if needed for testability, likely under `src/renderer/src/utils/` or `src/shared/`.
- Modify: `src/main/services/previewService.test.js`.
- Potentially create: focused mapping tests for Theme Configuration behavior.

## Test Priorities

1. **Confirmed regressions first**
   - preview cleanup behavior
   - Landscape banner/favicon mapping
   - Stack avatar asset path behavior

2. **High-risk business flow next**
   - workspace/theme config value persistence
   - preview start/stop command selection
   - publish input validation and repo parsing

3. **Regression-prone UI logic**
   - next-step shell recommendation derivation
   - theme-specific progressive disclosure rules

## Task 1: Lock down confirmed bugs with regression tests

**Files:**
- Modify: `src/main/services/previewService.test.js`
- Create: focused tests for theme asset mapping and theme-specific key selection

- [ ] **Step 1: Preview cleanup regression**

Verify that `stopLocalPreview()` always calls `kill()` and only triggers the Windows tree-kill helper on Windows.

- [ ] **Step 2: Landscape mapping regression**

Verify that Landscape uses:
- `theme_config.banner`
- `theme_config.favicon`

and does not rely on unsupported generic keys.

- [ ] **Step 3: Stack avatar regression**

Verify that Stack avatar uploads produce a theme-compatible stored path/value pair.

## Task 2: Extract testable mapping helpers where needed

**Files:**
- Modify or create a small helper module extracted from `ThemeConfigView.vue`

- [ ] **Step 1: Identify logic worth extracting**

Only extract logic that is hard to test in-place and clearly pure, such as:
- theme-specific asset key selection
- path normalization rules
- recommended next-step derivation

- [ ] **Step 2: Add tests before using the helper in production code**

Use TDD to lock the helper API and expected output.

- [ ] **Step 3: Replace inline logic with the tested helper**

Keep the extraction minimal and scoped to verification value.

## Task 3: Strengthen publish/preview validation coverage

**Files:**
- Consider adding focused tests around parsing/validation logic in `PublishBackupView.vue` or extracted helpers
- Verify `previewService.js`

- [ ] **Step 1: Add tests for repo URL parsing edge cases**

Cover:
- HTTPS URL with `.git`
- HTTPS URL without `.git`
- SSH URL if supported by current parser
- invalid inputs

- [ ] **Step 2: Add tests for preview command/port behavior if feasible**

Cover:
- default Hexo/Hugo ports
- existing tracked-process reuse
- failure payload shape on unsupported framework

## Task 4: Keep fixture-driven validation in the loop

**Files:**
- Use `e2e-real-workspaces/`
- Use existing verification scripts/logs under `scripts/` and `.qa/`

- [ ] **Step 1: Re-run the smallest relevant fixture validation after code changes**

Prefer targeted checks for Landscape and Stack before full fixture runs.

- [ ] **Step 2: Re-run broader verification if targeted checks pass**

Use the repo’s real-workspace verification flow if practical.

## Verification Commands

- [ ] `pnpm exec node --test src/main/services/previewService.test.js`
- [ ] `pnpm exec node --test <new-theme-regression-test-file>`
- [ ] `pnpm run build:renderer`
- [ ] Run the smallest viable real-workspace validation command for affected themes

## Out of Scope

- Full renderer component test coverage across every view
- End-to-end automation rewrite
- Snapshot-testing the entire UI
- Broad refactors whose only purpose is to make every line testable
