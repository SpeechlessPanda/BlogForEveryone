import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appPath = new URL("./App.vue", import.meta.url);
const stylesPath = new URL("./styles.css", import.meta.url);

test("App uses shell composable and thin shell components instead of raw window.bfeApi shell calls", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /useAppShell/);
  assert.match(source, /ShellTopBar/);
  assert.match(source, /WorkflowSidebar/);
  assert.match(source, /WorkflowSummary/);
  assert.match(source, /SystemStatusPanel/);
  assert.match(source, /ShellModalLayer/);
  assert.match(source, /:data-shell-appearance="shellAppearance"/);
  assert.match(source, /:is-shell-popup-open="isShellPopupOpen"/);
  assert.match(source, /:shell-appearance="shellAppearance"/);
  assert.match(source, /:shell-popup-anchor-style="shellPopupAnchorStyle"/);
  assert.match(source, /:active-popup-section="shellPopupSectionKey"/);
  assert.match(source, /:shell-user-entry-label="shellUserEntryLabel"/);
  assert.match(source, /:tutorial-target="tutorialTarget"/);
  assert.match(source, /@open-shell-popup="openShellPopup"/);
  assert.match(source, /@close-shell-popup="closeShellPopup"/);
  assert.match(source, /@toggle-shell-appearance="toggleShellAppearance"/);

  const forbiddenInlineShellPresentation = [
    "GitHub 登录（OAuth 设备码）",
    "modal-backdrop",
    "device-code-card",
    "当前设备码",
    "切换到暗色编辑台",
    'data-sidebar-block="current-stage"',
    'data-status-block="overview"',
    'data-summary-card="lead"',
  ];

  for (const snippet of forbiddenInlineShellPresentation) {
    assert.equal(
      source.includes(snippet),
      false,
      `expected App.vue to avoid inline shell presentation: ${snippet}`,
    );
  }

  const forbiddenCalls = [
    "getAppState",
    "getEnvironmentStatus",
    "getUpdateState",
    "getPreferences",
    "savePreferences",
    "getRssUnreadSummary",
    "checkUpdatesNow",
    "installUpdateNow",
    "openInstaller",
    "ensurePnpm",
    "autoInstallTool",
    "getGithubAuthState",
    "beginGithubDeviceLogin",
    "completeGithubDeviceLogin",
    "githubLogout",
    "onUpdateStatus",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected App.vue to stop calling window.bfeApi.${method}`,
    );
  }
});

test("App marks the active workflow area as a shell-owned workspace region with an inner view scroller", async () => {
  const appSource = await readFile(appPath, "utf8");

  assert.match(
    appSource,
    /<main class="content" data-shell-region="workspace">/,
    "expected App.vue to mark the main content frame as a shell-owned workspace region",
  );
  assert.match(
    appSource,
    /<div :ref="setShellScrollRegion" class="content-view-scroll" data-shell-scroll-region="workflow-view">/,
    "expected App.vue to render active workflow views inside an explicit shell-owned scroll container",
  );
});

test("App shell styles keep document scroll outside the workflow view container", async () => {
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    stylesSource,
    /\.content\s*\{[\s\S]*overflow:\s*hidden;/,
    "expected styles.css to keep the shell content frame from delegating scrolling to the document",
  );
  assert.match(
    stylesSource,
    /\.content-view-scroll\s*\{[\s\S]*overflow-y:\s*auto;/,
    "expected styles.css to define the inner workflow-view scroller used by App.vue",
  );
  assert.match(
    stylesSource,
    /\.shell-popup-panel-wrap\s*\{[\s\S]*max-height:\s*calc\(100dvh - var\(--shell-popup-top, 24px\) - 24px\);/,
    "expected styles.css to cap popup height from the computed shell popup top so footer-triggered popups stay inside the viewport",
  );
  assert.match(
    stylesSource,
    /\.shell-popup-panel-wrap\s*\{[\s\S]*position:\s*fixed;[\s\S]*top:\s*var\(--shell-popup-top[\s\S]*left:\s*calc\(var\(--shell-popup-left[\s\S]*var\(--shell-popup-width/,
    "expected styles.css to position the shell popup from sidebar anchor CSS variables instead of fixed sidebar padding",
  );
  assert.match(
    stylesSource,
    /\.shell-popup-theme\s*\{[\s\S]*--shell-bg:[\s\S]*--shell-panel:[\s\S]*--shell-ink:/,
    "expected styles.css to define teleport-safe shell popup theme tokens outside layout ancestry",
  );
  assert.match(
    stylesSource,
    /\.shell-popup-block\[data-popup-active="true"\]\s*\{[\s\S]*border-color:[\s\S]*background:/,
    "expected styles.css to style the requested popup block with an explicit active-state marker",
  );
  assert.equal(
    stylesSource.includes("padding-left: 234px;"),
    false,
    "expected styles.css to stop using hardcoded sidebar padding for popup anchoring",
  );
});

test("App shell styles make dark editorial helper copy, links, and modal text follow shell contrast tokens", async () => {
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.page-lead,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.section-helper,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.status-detail,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.action-note,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.page-result-note,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.muted,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.checklist,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.page-guidance-list,[\s\S]*color:\s*var\(--shell-muted\);/,
    "expected dark editorial utility copy to resolve to the shell muted token instead of the default muted palette",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.modal-panel\s*\{[\s\S]*background:[\s\S]*var\(--shell-panel\);[\s\S]*color:\s*var\(--shell-ink\);[\s\S]*border-color:\s*var\(--shell-line-strong\);/,
    "expected dark editorial modals to use shell panel and ink tokens for readable body copy",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.modal-panel p,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.modal-panel \.muted[\s\S]*color:\s*var\(--shell-muted\);/,
    "expected dark editorial modal body text to move to the shell muted token",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.page-link-row a,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.workflow-compact-block a,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.theme-studio \.page-link-row a\s*\{[\s\S]*color:\s*var\(--shell-highlight\);/,
    "expected dark editorial links on workflow shell surfaces to use the shell highlight token",
  );
});

test("App shell styles recalibrate the dark editorial text palette to the approved warmer low-light values", async () => {
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\]\s*\{[\s\S]*--shell-ink:\s*#f3f5f7;[\s\S]*--shell-muted:\s*#c8d0da;[\s\S]*--shell-highlight:\s*#e7edf5;/,
    "expected the active dark editorial shell block to use the approved neutral high-contrast ink, muted, and highlight palette",
  );
});

test("App shell styles route dark editorial titles and primary text through the shell ink token", async () => {
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.page-title,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.advanced-panel summary,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.workflow-section-heading h2,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.workspace-section-heading h2,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.theme-preview-dialog-copy h3,[\s\S]*color:\s*var\(--shell-ink\);/,
    "expected dark editorial page titles, workflow/workspace section titles, and preview dialog titles to use the shell ink token",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.page-signal strong,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.workflow-compact-block strong,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.workspace-theme-header h4,[\s\S]*color:\s*var\(--shell-ink\);/,
    "expected dark editorial primary emphasis text, compact block titles, and workspace theme card titles to use the shell ink token",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.shell-overview h2,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.system-status-panel h2,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.system-status-panel h3,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.shell-summary-chip strong,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.sidebar-entry strong,[\s\S]*color:\s*var\(--shell-ink\);/,
    "expected dark shell summary, sidebar, and system-status titles to use the shell ink token",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.tutorial-brand-title,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.tutorial-theme-card h4,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.priority-panel h3,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.priority-panel strong \{[\s\S]*color:\s*var\(--shell-ink\);/,
    "expected dark tutorial titles and key strong text to use the shell ink token",
  );
  assert.match(
    stylesSource,
    /\.shell-popup-theme\[data-shell-appearance="dark"\]\s*\{[\s\S]*--shell-ink:\s*#f3f5f7;[\s\S]*--shell-muted:\s*#c8d0da;[\s\S]*--shell-highlight:\s*#e7edf5;/,
    "expected dark popup theme tokens to match the approved neutral shell palette",
  );
});

test("App shell styles keep dark metadata labels and mixed card surfaces readable across the workflow shell", async () => {
  const stylesSource = await readFile(stylesPath, "utf8");

  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.page-kicker,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.section-eyebrow,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.status-label,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] label,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.sidebar-entry-label[\s\S]*color:\s*var\(--shell-highlight\);/,
    "expected dark workflow labels, eyebrows, and field labels to use a brighter shell highlight token",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.context-card,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.advanced-panel,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.info-card,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.tutorial-directory-card,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.tutorial-flow-card,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.tutorial-action-panel,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.theme-studio-card,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.theme-asset-preview-card[\s\S]*background:[\s\S]*var\(--shell-panel-alt\);[\s\S]*(border-color:\s*var\(--shell-line\);|border:\s*1px solid var\(--shell-line\);)[\s\S]*color:\s*var\(--shell-ink\);/,
    "expected mixed workflow cards to switch fully onto dark shell surfaces instead of keeping light-card backgrounds in dark mode",
  );
  assert.match(
    stylesSource,
    /\.shell-popup-theme\[data-shell-appearance="dark"\] \.status-label[\s\S]*color:\s*var\(--shell-highlight\);/,
    "expected popup section labels to use the brighter shell highlight token in dark mode",
  );
  assert.match(
    stylesSource,
    /\.shell-popup-theme\[data-shell-appearance="dark"\] \.shell-popup-block[\s\S]*background:[\s\S]*var\(--shell-panel-alt\);[\s\S]*(border-color:\s*var\(--shell-line\);|border:\s*1px solid var\(--shell-line\);)[\s\S]*color:\s*var\(--shell-ink\);/,
    "expected popup blocks to use dark shell card surfaces instead of inheriting lighter mixed backgrounds",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] \.shell-topbar \.page-kicker,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.shell-summary \.status-label,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.shell-popup-panel \.status-label,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] \.sidebar-entry-label[\s\S]*color:\s*var\(--shell-highlight\);/,
    "expected shell-specific metadata labels to keep the brighter highlight token instead of falling back to muted dark-shell copy",
  );
  assert.match(
    stylesSource,
    /\.layout--editorial\[data-shell-appearance="dark"\] input,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] textarea,[\s\S]*\.layout--editorial\[data-shell-appearance="dark"\] select \{[\s\S]*background:\s*var\(--shell-panel-alt\);[\s\S]*color:\s*var\(--shell-ink\);[\s\S]*border-color:\s*var\(--shell-line-strong\);/,
    "expected dark editorial form controls to move onto shell panel and line tokens instead of reusing light form surfaces",
  );
});
