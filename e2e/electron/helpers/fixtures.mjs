import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function seedStoreAtUserDataDir(userDataDir, store) {
  const dataDir = path.join(userDataDir, "bfe-data");
  const storePath = path.join(dataDir, "db.json");
  writeJson(storePath, store);
  return { userDataDir, storePath };
}

function createWorkspace() {
  return {
    id: "ws-editorial-e2e",
    name: "Editorial Demo Workspace",
    framework: "hugo",
    theme: "papermod",
    projectDir: "C:/e2e/editorial-demo-workspace",
  };
}

export function expectedWorkspaceSummary(workspace) {
  return {
    title: workspace.name,
    detail: `${String(workspace.framework || "").toUpperCase()} · ${workspace.theme || "主题待识别"} · ${workspace.projectDir}`,
  };
}

export function createEditorialWorkbenchFixture() {
  const workspace = createWorkspace();
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "bfe-electron-e2e-"));
  const homeDir = path.join(rootDir, "home");
  const appDataDir = path.join(homeDir, "AppData", "Roaming");

  const store = {
    workspaces: [workspace],
    subscriptions: [],
    notifications: [],
    preferences: {
      generateBlogRss: true,
      autoSyncRssSubscriptions: true,
      launchAtStartup: false,
    },
    githubAuth: {
      user: {
        login: "editorial-e2e",
        name: "Editorial E2E",
      },
      loggedInAt: "2026-03-24T00:00:00.000Z",
      permissionSummary: "repo, workflow",
      reauthRequired: false,
    },
    githubAuthSecure: {
      version: 1,
      ciphertext: Buffer.from("fixture-token").toString("base64"),
      updatedAt: "2026-03-24T00:00:00.000Z",
    },
  };

  const seededStores = [
    seedStoreAtUserDataDir(path.join(appDataDir, "Electron"), store),
    seedStoreAtUserDataDir(path.join(appDataDir, "BlogForEveryone"), store),
    seedStoreAtUserDataDir(path.join(appDataDir, "blog-for-everyone"), store),
  ];

  return {
    rootDir,
    homeDir,
    appDataDir,
    userDataDir: seededStores[0].userDataDir,
    storePath: seededStores[0].storePath,
    seededStores,
    workspaces: [workspace],
  };
}
