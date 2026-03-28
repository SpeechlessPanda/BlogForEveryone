import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, _electron as electron } from "@playwright/test";

import {
  createEditorialWorkbenchFixture,
  expectedWorkspaceSummary,
} from "./helpers/fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function launchEditorialWorkbenchApp({ fixtureState }) {
  if (!fixtureState?.storePath || !fs.existsSync(fixtureState.storePath)) {
    throw new Error("Fixture store is missing before Electron launch.");
  }

  const electronApp = await electron.launch({
    args: [ROOT],
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOME: fixtureState.homeDir,
      USERPROFILE: fixtureState.homeDir,
      APPDATA: fixtureState.appDataDir,
      LOCALAPPDATA: path.join(fixtureState.homeDir, "AppData", "Local"),
      XDG_CONFIG_HOME: path.join(fixtureState.homeDir, ".config"),
      XDG_DATA_HOME: path.join(fixtureState.homeDir, ".local", "share"),
      PLAYWRIGHT_DISABLE_HEADLESS_WARNING: "1",
    },
  });

  const window = await electronApp.firstWindow();
  const consoleMessages = [];
  const pageErrors = [];

  window.on("console", (message) => {
    consoleMessages.push(`[${message.type()}] ${message.text()}`);
  });

  window.on("pageerror", (error) => {
    pageErrors.push(error.stack || error.message || String(error));
  });

  try {
    await expect(window.locator('[data-tutorial-surface="sectioned-tutorial-center"]')).toBeVisible({
      timeout: 30000,
    });
  } catch (error) {
    const [url, title, bodyText] = await Promise.all([
      window.url(),
      window.title().catch(() => "<title unavailable>"),
      window.locator("body").innerText().catch(() => "<body unavailable>"),
    ]);
    const diagnostic = [
      "Electron launch did not reach editorial workbench home.",
      `URL: ${url}`,
      `Title: ${title}`,
      `Body: ${bodyText.slice(0, 2000) || "<empty body>"}`,
      `Console: ${consoleMessages.length ? consoleMessages.join("\n") : "<none>"}`,
      `Page errors: ${pageErrors.length ? pageErrors.join("\n") : "<none>"}`,
    ].join("\n\n");

    throw new Error(`${diagnostic}\n\nOriginal error: ${error.message}`);
  }

  return {
    electronApp,
    page: window,
    async close() {
      await electronApp.close();
      fs.rmSync(fixtureState.rootDir, { recursive: true, force: true });
    },
    fixtureInfo: {
      storePath: fixtureState.storePath,
      appEntry: ROOT,
    },
  };
}

test("editorial workbench journey keeps workspace context across core entry points", async () => {
  const fixtureState = createEditorialWorkbenchFixture();
  const app = await launchEditorialWorkbenchApp({ fixtureState });

  try {
    const { page } = app;
    const shellRoot = page.locator(".layout.layout--editorial");
    const sidebar = page.locator('[data-shell-surface="sidebar"]');
    const shellAppearanceEntry = sidebar.locator('[data-sidebar-entry="appearance"]');
    const shellAccountEntry = sidebar.locator('[data-sidebar-entry="account"]');
    const shellPopupMount = page.locator('[data-topbar-region="popup-mount"]');
    const shellUserPopup = page.locator('[data-shell-surface="user-popup"]');
    const shellSidebarPopupOverlay = page.locator('.shell-popup-overlay.shell-popup-overlay--sidebar');
    const workspaceSummary = page.locator('[data-summary-item="workspace"]');
    const workspaceSummaryDetail = page.locator('[data-summary-detail="workspace"]');
    const tutorialSurface = page.locator('[data-tutorial-surface="sectioned-tutorial-center"]');
    const tutorialHeroSurface = page.locator("#tutorial-home");
    const tutorialPreviewSection = page.locator('[data-tutorial-zone="tutorial-preview-check"]');
    const workspaceSurface = page.locator('[data-workspace-surface="editorial-workbench"]');
    const workspaceHeroPrimaryCta = workspaceSurface.getByRole("button", {
      name: "快速创建新博客",
    });
    const workspaceCreateSurface = page.locator('[data-workspace-zone="new-start"]');
    const workspaceThemePreviewTrigger = workspaceSurface
      .locator(".workspace-theme-preview-trigger")
      .first();
    const workspaceThemePreviewOverlay = page.locator("dialog.theme-preview-lightbox");
    const workspaceThemePreviewImage = workspaceThemePreviewOverlay.locator(".theme-preview-image");
    const workspaceThemePreviewStage = workspaceThemePreviewOverlay.locator(".theme-preview-stage");
    const previewSurface = page.locator(
      '[data-page-role="preview"][data-workflow-surface="editorial-workflow"]',
    );
    const previewWorkbenchSurface = page.locator('[data-workflow-zone="preview-workbench"]');
    const previewRecentResult = page.locator('[data-page-role="preview"] [data-workflow-zone="recent-result"]');
    const previewTutorialCta = previewSurface.getByRole("button", {
      name: "打开教程中心",
    });
    const contentSurface = page.locator(
      '[data-page-role="content-editor"][data-workflow-surface="editorial-workflow"]',
    );
    const contentCreateSurface = contentSurface.locator('[data-workflow-zone="create-content"]');
    const contentCreateResult = contentCreateSurface.locator('.workflow-result-block');
    const contentExistingSurface = contentSurface.locator('[data-workflow-zone="existing-content"]');
    const publishSurface = page.locator(
      '[data-page-role="publish"][data-workflow-surface="editorial-workflow"]',
    );
    const publishWorkbenchSurface = publishSurface.locator('[data-workflow-zone="publish-workbench"]');
    const publishWorkbenchSupport = publishWorkbenchSurface.locator(
      '.workflow-compact-block--support',
    );
    const publishRecentResult = publishSurface.locator('[data-workflow-zone="recent-result"]');
    const publishAccessAddress = publishSurface.locator('[data-workflow-surface="access-address"]');
    const importSurface = page.locator(
      '[data-page-role="import"][data-workflow-surface="editorial-workflow"]',
    );
    const importGithubWorkbench = importSurface.locator('[data-workflow-zone="github-import-workbench"]');
    const shellScrollRegion = page.locator('[data-shell-scroll-region="workflow-view"]');
    const expectedSummary = expectedWorkspaceSummary(fixtureState.workspaces[0]);
    const shellAccountBlock = shellUserPopup.locator('[data-popup-block="account"]');
    const shellAppearanceBlock = shellUserPopup.locator('[data-popup-block="appearance"]');
    const shellUpdatesBlock = shellUserPopup.locator('[data-popup-block="updates"]');
    const shellEnvironmentBlock = shellUserPopup.locator('[data-popup-block="environment"]');
    const shellPopupDismiss = page.getByRole("button", { name: "关闭" });
    const shellRefreshAuthButton = shellAccountBlock.getByRole("button", {
      name: "刷新登录状态",
    });
    const shellAppearanceToggleButton = shellAppearanceBlock.getByRole("button", {
      name: /切换到.*编辑台/,
    });
    const shellLogoutButton = shellUserPopup.getByRole("button", { name: "退出登录" });
    const openShellPopupFromEntry = async ({ entry, activeBlock }) => {
      if (await shellSidebarPopupOverlay.isVisible()) {
        await shellPopupDismiss.click();
        await expect(shellSidebarPopupOverlay).toBeHidden();
      }

      await entry.click();
      await expect(shellSidebarPopupOverlay).toBeVisible();
      await expect(shellPopupMount).toBeVisible();
      await expect(shellUserPopup).toBeVisible();
      await expect(activeBlock).toHaveAttribute("data-popup-active", "true");
    };
    const navigateToTab = async (tabLabel) => {
      if (await shellSidebarPopupOverlay.isVisible()) {
        await shellPopupDismiss.click();
        await expect(shellSidebarPopupOverlay).toBeHidden();
      }

      const targetTab = sidebar.locator("button.tab").filter({ hasText: tabLabel });
      await expect(targetTab).toHaveCount(1);
      await targetTab.click();
    };
    const resolveCssValue = (value, property) =>
      page.evaluate(
        ({ value, property }) => {
          const probe = document.createElement("div");
          probe.style[property] = value;
          document.body.appendChild(probe);
          const resolved = getComputedStyle(probe)[property];
          probe.remove();
          return resolved;
        },
        { value, property },
      );
    const readShellPalette = async () => {
      const { panelVar, lineVar } = await shellRoot.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          panelVar: styles.getPropertyValue("--shell-panel").trim(),
          lineVar: styles.getPropertyValue("--shell-line").trim(),
        };
      });

      return {
        panelBackground: await resolveCssValue(panelVar, "backgroundColor"),
        panelBorder: await resolveCssValue(lineVar, "borderTopColor"),
      };
    };
    const expectSurfacePalette = async (surface, palette) => {
      await expect(surface).toBeVisible();
      await expect(surface).toHaveCSS("background-color", palette.panelBackground);
      await expect(surface).toHaveCSS("border-top-color", palette.panelBorder);
    };
    const expectRepresentativeSurfacesToMatchAppearance = async (appearance) => {
      await expect(shellRoot).toHaveAttribute("data-shell-appearance", appearance);
      const palette = await readShellPalette();

      await navigateToTab("教程中心");
      await expect(tutorialSurface).toBeVisible();
      await expectSurfacePalette(tutorialHeroSurface, palette);

      await navigateToTab("博客创建");
      await expect(workspaceSurface).toBeVisible();
      await expectSurfacePalette(workspaceCreateSurface, palette);

      await navigateToTab("本地预览");
      await expect(previewSurface).toBeVisible();
      await expectSurfacePalette(previewWorkbenchSurface, palette);

      return palette;
    };
    const readScrollTop = () =>
      shellScrollRegion.evaluate((element) => Math.round(element.scrollTop));
    const setScrollTop = async (top) => {
      await shellScrollRegion.evaluate(
        (element, nextTop) => {
          element.scrollTo({ top: nextTop, behavior: "auto" });
        },
        top,
      );
    };
    const readInteractionStyles = (locator) =>
      locator.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          transform: styles.transform,
          boxShadow: styles.boxShadow,
          color: styles.color,
          borderColor: styles.borderColor,
        };
      });
    const expectHoverAndFocusBehavior = async (locator, probeName) => {
      await locator.scrollIntoViewIfNeeded();
      await expect(locator, `${probeName} should be visible`).toBeVisible();
      const restStyles = await readInteractionStyles(locator);

      await locator.hover();
      await expect
        .poll(
          async () => JSON.stringify(await readInteractionStyles(locator)),
          {
            message: `${probeName} should respond to hover`,
          },
        )
        .not.toBe(JSON.stringify(restStyles));

      await page.mouse.move(0, 0);
      await locator.focus();
      await expect(locator, `${probeName} should accept keyboard focus`).toBeFocused();
    };
    const readElementRect = (locator) =>
      locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      });
    const expectCompactWorkflowBlock = async (locator, label) => {
      await expect(locator, `${label} should stay visible as a subordinate block`).toBeVisible();
      const { isPanel, isAdvancedPanel } = await locator.evaluate((element) => ({
        isPanel: element.classList.contains("panel"),
        isAdvancedPanel: element.classList.contains("advanced-panel"),
      }));

      expect(isPanel, `${label} should not be promoted into a primary panel`).toBe(false);
      expect(isAdvancedPanel, `${label} should not use the oversized advanced-panel shell`).toBe(
        false,
      );
    };
    const expectSubordinateBlockToStayCompact = async ({ block, panel, label }) => {
      await expectCompactWorkflowBlock(block, label);
      const [blockRect, panelRect] = await Promise.all([
        readElementRect(block),
        readElementRect(panel),
      ]);

      expect(
        blockRect.height,
        `${label} should remain shorter than the page's primary workflow panel`,
      ).toBeLessThan(panelRect.height);
    };
    const expectNoNestedPrimaryPanels = async (surface, label) => {
      const nestedPanelCount = await surface.evaluate((element) =>
        element.querySelectorAll(
          ".panel .panel, .panel .advanced-panel, .advanced-panel .panel, .advanced-panel .advanced-panel",
        ).length,
      );

      expect(
        nestedPanelCount,
        `${label} should not render oversized same-weight inner panels`,
      ).toBe(0);
    };

    await expect(tutorialSurface).toBeVisible();
    await expect(page.locator("#tutorial-home")).toBeVisible();
    await expect(page.locator('[data-tutorial-zone="tutorial-workspace-create"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-zone="tutorial-publish-release"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "打开新建博客页" })).toBeVisible();
    await expect(page.getByRole("button", { name: "打开发布与备份页" })).toBeVisible();
    await expect(page.getByRole("button", { name: "查看本节教程" }).first()).toBeVisible();
    await expect(workspaceSummary).toContainText(expectedSummary.title);
    await expect(workspaceSummaryDetail).toContainText(expectedSummary.detail);
    await expect(shellRoot).toHaveAttribute("data-shell-appearance", "light");
    const lightPalette = await expectRepresentativeSurfacesToMatchAppearance("light");

    await openShellPopupFromEntry({
      entry: shellAppearanceEntry,
      activeBlock: shellAppearanceBlock,
    });
    await expect(shellAppearanceToggleButton).toBeFocused();
    await expect(shellUpdatesBlock).toBeVisible();
    await expect(shellEnvironmentBlock).toBeVisible();
    await expect(shellAppearanceBlock).toContainText("亮色编辑台");
    await page.getByRole("button", { name: "切换到暗色编辑台" }).click();

    await expect(shellRoot).toHaveAttribute("data-shell-appearance", "dark");
    await openShellPopupFromEntry({
      entry: shellAppearanceEntry,
      activeBlock: shellAppearanceBlock,
    });
    await expect(shellAppearanceToggleButton).toBeFocused();
    await expect(shellAppearanceBlock).toContainText("暗色编辑台");
    const darkPalette = await expectRepresentativeSurfacesToMatchAppearance("dark");
    expect(darkPalette.panelBackground).not.toBe(lightPalette.panelBackground);
    expect(darkPalette.panelBorder).not.toBe(lightPalette.panelBorder);

    await openShellPopupFromEntry({
      entry: shellAppearanceEntry,
      activeBlock: shellAppearanceBlock,
    });
    await page.getByRole("button", { name: "切换到亮色编辑台" }).click();
    await expect(shellRoot).toHaveAttribute("data-shell-appearance", "light");
    await openShellPopupFromEntry({
      entry: shellAppearanceEntry,
      activeBlock: shellAppearanceBlock,
    });
    await expect(shellAppearanceToggleButton).toBeFocused();
    await expect(shellAppearanceBlock).toContainText("亮色编辑台");
    const restoredLightPalette = await expectRepresentativeSurfacesToMatchAppearance("light");
    expect(restoredLightPalette).toEqual(lightPalette);

    await openShellPopupFromEntry({
      entry: shellAccountEntry,
      activeBlock: shellAccountBlock,
    });
    await expect(shellRefreshAuthButton).toBeFocused();
    await expect(shellUpdatesBlock).toBeVisible();
    await expect(shellEnvironmentBlock).toBeVisible();
    await shellPopupDismiss.click();
    await expect(shellSidebarPopupOverlay).toBeHidden();

    await navigateToTab("博客创建");
    await expect(workspaceSurface).toBeVisible();
    await setScrollTop(0);
    await openShellPopupFromEntry({
      entry: shellAppearanceEntry,
      activeBlock: shellAppearanceBlock,
    });
    const popupBeforeScroll = await shellUserPopup.boundingBox();
    const userEntryBeforeScroll = await shellAppearanceEntry.boundingBox();
    expect(popupBeforeScroll).not.toBeNull();
    expect(userEntryBeforeScroll).not.toBeNull();

    await setScrollTop(900);
    await expect.poll(readScrollTop).toBeGreaterThan(400);
    const popupAfterScroll = await shellUserPopup.boundingBox();
    const userEntryAfterScroll = await shellAppearanceEntry.boundingBox();
    expect(popupAfterScroll).not.toBeNull();
    expect(userEntryAfterScroll).not.toBeNull();
    expect(Math.abs(popupAfterScroll.x - popupBeforeScroll.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(popupAfterScroll.y - popupBeforeScroll.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(userEntryAfterScroll.x - userEntryBeforeScroll.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(userEntryAfterScroll.y - userEntryBeforeScroll.y)).toBeLessThanOrEqual(1);
    await expectHoverAndFocusBehavior(shellLogoutButton, "shell logout danger action");
    await shellPopupDismiss.click();
    await expect(shellSidebarPopupOverlay).toBeHidden();

    await setScrollTop(0);
    await expectHoverAndFocusBehavior(
      workspaceHeroPrimaryCta,
      "workspace hero primary workflow CTA",
    );

    await setScrollTop(900);
    await expect.poll(readScrollTop).toBeGreaterThan(400);
    await navigateToTab("本地预览");
    await expect(previewSurface).toBeVisible();
    await expect.poll(readScrollTop).toBe(0);
    await expectHoverAndFocusBehavior(
      previewTutorialCta,
      "preview tutorial secondary CTA",
    );
    await previewTutorialCta.click();
    await expect(tutorialSurface).toBeVisible();
    await expect(tutorialPreviewSection).toBeVisible();
    await expect.poll(readScrollTop).toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const box = await tutorialPreviewSection.boundingBox();
        return box ? Math.round(box.y) : null;
      })
      .toBeLessThanOrEqual(220);

    await navigateToTab("博客创建");
    await expect(workspaceSurface).toBeVisible();
    await workspaceThemePreviewTrigger.click();
    await expect(workspaceThemePreviewOverlay).toBeVisible();
    await expect(workspaceThemePreviewOverlay.getByText("100%")).toBeVisible();
    await workspaceThemePreviewOverlay.getByRole("button", { name: "放大" }).click();
    await expect
      .poll(async () => workspaceThemePreviewImage.evaluate((element) => element.style.transform))
      .toContain("scale(1.2)");
    await workspaceThemePreviewStage.hover();
    await page.mouse.wheel(0, -240);
    await expect
      .poll(async () => workspaceThemePreviewImage.evaluate((element) => element.style.transform))
      .toContain("scale(1.4)");
    await workspaceThemePreviewOverlay.getByRole("button", { name: "重置" }).click();
    await expect
      .poll(async () => workspaceThemePreviewImage.evaluate((element) => element.style.transform))
      .toBe("translate(0px, 0px) scale(1)");
    await workspaceThemePreviewOverlay.getByRole("button", { name: "关闭预览" }).click();
    await expect(workspaceThemePreviewOverlay).toBeHidden();
    await workspaceThemePreviewTrigger.click();
    await expect(workspaceThemePreviewOverlay).toBeVisible();
    await expect
      .poll(async () => workspaceThemePreviewImage.evaluate((element) => element.style.transform))
      .toBe("translate(0px, 0px) scale(1)");
    await page.keyboard.press("Escape");
    await expect(workspaceThemePreviewOverlay).toBeHidden();

    await navigateToTab("内容编辑");
    await expect(contentSurface).toBeVisible();
    await expectNoNestedPrimaryPanels(contentSurface, "content editor journey");
    await expectSubordinateBlockToStayCompact({
      block: contentCreateResult,
      panel: contentCreateSurface,
      label: "content editor result summary",
    });
    await expect(contentExistingSurface).toBeVisible();

    await navigateToTab("本地预览");
    await expect(previewSurface).toBeVisible();
    await expectNoNestedPrimaryPanels(previewSurface, "preview journey");
    await expectSubordinateBlockToStayCompact({
      block: previewRecentResult,
      panel: previewWorkbenchSurface,
      label: "preview recent-result block",
    });

    await navigateToTab("发布与备份");
    await expect(publishSurface).toBeVisible();
    await expectNoNestedPrimaryPanels(publishSurface, "publish journey");
    await expectSubordinateBlockToStayCompact({
      block: publishWorkbenchSupport,
      panel: publishWorkbenchSurface,
      label: "publish preflight support block",
    });
    await expectSubordinateBlockToStayCompact({
      block: publishRecentResult,
      panel: publishWorkbenchSurface,
      label: "publish recent-result block",
    });
    await expect(publishWorkbenchSurface).toContainText("统一发布与备份");
    await expect(publishAccessAddress).toBeVisible();

    const journeys = [
      {
        tabLabel: "博客创建",
        assertion: () =>
          expect(page.locator('[data-workspace-surface="editorial-workbench"]')).toBeVisible(),
      },
      {
        tabLabel: "主题配置",
        assertion: () =>
          expect(page.locator('[data-theme-surface="editorial-studio"]')).toBeVisible(),
      },
      {
        tabLabel: "本地预览",
        assertion: () =>
          expect(previewSurface).toBeVisible(),
      },
      {
        tabLabel: "内容编辑",
        assertion: () =>
          expect(contentSurface).toBeVisible(),
      },
      {
        tabLabel: "发布与备份",
        assertion: () =>
          expect(publishSurface).toBeVisible(),
      },
      {
        tabLabel: "导入恢复",
        assertion: () =>
          expect(importGithubWorkbench).toBeVisible(),
      },
      {
        tabLabel: "RSS 阅读",
        assertion: () =>
          expect(page.locator('[data-page-role="rss"][data-workflow-surface="editorial-workflow"]')).toBeVisible(),
      },
    ];

    for (const journey of journeys) {
      await navigateToTab(journey.tabLabel);
      await journey.assertion();
      await expect(workspaceSummary).toContainText(expectedSummary.title);
      await expect(workspaceSummaryDetail).toContainText(expectedSummary.detail);
    }
  } finally {
    await app.close();
  }
});
