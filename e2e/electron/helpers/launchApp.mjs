import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export async function launchEditorialWorkbenchApp({ fixtureState }) {
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
    await expect(window.locator('[data-tutorial-surface="editorial-workbench"]')).toBeVisible({
      timeout: 30000,
    });
  } catch (error) {
    const [url, title, bodyText] = await Promise.all([
      window.url(),
      window.title().catch(() => "<title unavailable>"),
      window.locator("body").innerText().catch(() => "<body unavailable>"),
    ]);
    const diagnostic = [
      `Electron launch did not reach editorial workbench home.`,
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
