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
    const sidebar = page.locator('[data-shell-surface="sidebar"]');
    const workspaceSummary = page.locator('[data-summary-card="workspace"]');
    const expectedSummary = expectedWorkspaceSummary(fixtureState.workspaces[0]);

    await expect(page.locator('[data-tutorial-surface="editorial-workbench"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-zone="brand-header"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-zone="hero"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-zone="recent-work"]')).toBeVisible();
    await expect(page.locator('[data-tutorial-zone="theme-rail"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "继续上次工作" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新建博客" })).toBeVisible();
    await expect(page.getByRole("button", { name: "导入已有项目" })).toBeVisible();
    await expect(workspaceSummary).toContainText(expectedSummary.title);
    await expect(workspaceSummary).toContainText(expectedSummary.detail);

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
      await sidebar
        .locator("button.tab")
        .filter({ hasText: journey.tabLabel })
        .first()
        .click();
      await journey.assertion();
      await expect(workspaceSummary).toContainText(expectedSummary.title);
      await expect(workspaceSummary).toContainText(expectedSummary.detail);
    }
  } finally {
    await app.close();
  }
});
