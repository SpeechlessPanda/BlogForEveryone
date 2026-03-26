import { test, expect } from "@playwright/test";

import {
  createEditorialWorkbenchFixture,
  expectedWorkspaceSummary,
} from "./helpers/fixtures.mjs";
import { launchEditorialWorkbenchApp } from "./helpers/launchApp.mjs";

test("editorial workbench journey keeps workspace context across core entry points", async () => {
  const fixtureState = createEditorialWorkbenchFixture();
  const app = await launchEditorialWorkbenchApp({ fixtureState });

  try {
    const { page } = app;
    const shellRoot = page.locator(".layout.layout--editorial");
    const sidebar = page.locator('[data-shell-surface="sidebar"]');
    const shellUserEntry = sidebar.locator('[data-sidebar-entry="user"]');
    const shellPopupMount = page.locator('[data-topbar-region="popup-mount"]');
    const shellUserPopup = page.locator('[data-shell-surface="user-popup"]');
    const shellSidebarPopupOverlay = page.locator('.shell-popup-overlay.shell-popup-overlay--sidebar');
    const workspaceSummary = page.locator('[data-summary-item="workspace"]');
    const tutorialSurface = page.locator('[data-tutorial-surface="editorial-workbench"]');
    const tutorialHeroSurface = page.locator('[data-tutorial-zone="hero"]');
    const workspaceSurface = page.locator('[data-workspace-surface="editorial-workbench"]');
    const workspaceCreateSurface = page.locator('[data-workspace-zone="new-start"]');
    const previewSurface = page.locator(
      '[data-page-role="preview"][data-workflow-surface="editorial-workflow"]',
    );
    const previewWorkbenchSurface = page.locator('[data-workflow-zone="preview-workbench"]');
    const expectedSummary = expectedWorkspaceSummary(fixtureState.workspaces[0]);
    const shellAppearanceBlock = shellUserPopup.locator('[data-popup-block="appearance"]');
    const openShellUserPopup = async () => {
      if (!(await shellUserPopup.isVisible())) {
        await shellUserEntry.click();
      }

      await expect(shellSidebarPopupOverlay).toBeVisible();
      await expect(shellPopupMount).toBeVisible();
      await expect(shellUserPopup).toBeVisible();
    };
    const navigateToTab = async (tabLabel) => {
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

    await expect(tutorialSurface).toBeVisible();
    await expect(page.locator('[data-tutorial-zone="brand-header"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-zone="hero"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-zone="recent-work"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-zone="theme-rail"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "继续上次工作" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新建博客" })).toBeVisible();
    await expect(page.getByRole("button", { name: "导入已有项目" })).toBeVisible();
    await expect(workspaceSummary).toContainText(expectedSummary.title);
    await expect(shellRoot).toHaveAttribute("data-shell-appearance", "light");
    const lightPalette = await expectRepresentativeSurfacesToMatchAppearance("light");

    await openShellUserPopup();
    await expect(shellAppearanceBlock).toContainText("亮色编辑台");
    await page.getByRole("button", { name: "切换到暗色编辑台" }).click();

    await expect(shellRoot).toHaveAttribute("data-shell-appearance", "dark");
    await openShellUserPopup();
    await expect(shellAppearanceBlock).toContainText("暗色编辑台");
    const darkPalette = await expectRepresentativeSurfacesToMatchAppearance("dark");
    expect(darkPalette.panelBackground).not.toBe(lightPalette.panelBackground);
    expect(darkPalette.panelBorder).not.toBe(lightPalette.panelBorder);

    await openShellUserPopup();
    await page.getByRole("button", { name: "切换到亮色编辑台" }).click();
    await expect(shellRoot).toHaveAttribute("data-shell-appearance", "light");
    await openShellUserPopup();
    await expect(shellAppearanceBlock).toContainText("亮色编辑台");
    const restoredLightPalette = await expectRepresentativeSurfacesToMatchAppearance("light");
    expect(restoredLightPalette).toEqual(lightPalette);

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
          expect(page.locator('[data-page-role="preview"][data-workflow-surface="editorial-workflow"]')).toBeVisible(),
      },
      {
        tabLabel: "内容编辑",
        assertion: () =>
          expect(page.locator('[data-page-role="content-editor"][data-workflow-surface="editorial-workflow"]')).toBeVisible(),
      },
      {
        tabLabel: "发布与备份",
        assertion: () =>
          expect(page.locator('[data-page-role="publish"][data-workflow-surface="editorial-workflow"]')).toBeVisible(),
      },
      {
        tabLabel: "导入恢复",
        assertion: () =>
          expect(page.locator('[data-page-role="import"][data-workflow-surface="editorial-workflow"]')).toBeVisible(),
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
    }
  } finally {
    await app.close();
  }
});
