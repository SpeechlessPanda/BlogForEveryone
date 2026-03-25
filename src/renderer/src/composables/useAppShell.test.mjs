import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const useAppShellPath = new URL("./useAppShell.mjs", import.meta.url);

test("useAppShell keeps Task 5 shell tab keys and shell summary state", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  const expectedTabKeys = [
    "tutorial",
    "workspace",
    "theme",
    "preview",
    "content",
    "publish",
    "import",
    "rss",
  ];

  for (const key of expectedTabKeys) {
    assert.match(source, new RegExp(`key: "${key}"`));
  }

  const expectedShellState = [
    "workspaceSummary",
    "nextStep",
    "envStatus",
    "updateState",
    "authState",
    "deviceFlow",
    "shellAppearance",
    "shellAppearanceToggleLabel",
    "isShellPopupOpen",
    "shellUserEntryLabel",
  ];

  for (const stateName of expectedShellState) {
    assert.match(source, new RegExp(`\\b${stateName}\\b`));
  }
});

test("useAppShell consumes shell action event bridges for bfe custom events", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  assert.match(source, /shellActions\.onOpenTutorial\(/);
  assert.match(source, /shellActions\.onOpenTab\(/);
  assert.match(source, /shellActions\.onRssUpdated\(/);

  const forbiddenManualWiring = [
    'window.addEventListener("bfe:open-tutorial"',
    'window.addEventListener("bfe:open-tab"',
    'window.addEventListener("bfe:rss-updated"',
    'window.removeEventListener("bfe:open-tutorial"',
    'window.removeEventListener("bfe:open-tab"',
    'window.removeEventListener("bfe:rss-updated"',
  ];

  for (const snippet of forbiddenManualWiring) {
    assert.equal(
      source.includes(snippet),
      false,
      `expected useAppShell to stop manual shell event wiring: ${snippet}`,
    );
  }
});

test("useAppShell delegates shell-global utilities to shell actions facade", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  const requiredFacadeCalls = [
    /shellActions\.setTimeout\(/,
    /shellActions\.setInterval\(/,
    /shellActions\.clearInterval\(/,
    /shellActions\.confirm\(/,
    /shellActions\.copyToClipboard\(/,
  ];

  for (const pattern of requiredFacadeCalls) {
    assert.match(source, pattern);
  }

  const forbiddenDirectGlobals = [
    "window.setTimeout(",
    "window.setInterval(",
    "window.clearInterval(",
    "window.confirm(",
    "navigator.clipboard.writeText(",
  ];

  for (const snippet of forbiddenDirectGlobals) {
    assert.equal(
      source.includes(snippet),
      false,
      `expected useAppShell to avoid direct shell globals: ${snippet}`,
    );
  }
});

test("useAppShell owns shell appearance presentation state without changing workflow boundaries", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  assert.match(source, /const shellAppearance = ref\("light"\)/);
  assert.match(
    source,
    /const shellAppearanceToggleLabel = computed\(\(\) =>[\s\S]*切换到暗色编辑台[\s\S]*切换到亮色编辑台/,
  );
  assert.match(source, /function toggleShellAppearance\(\)/);
  assert.match(source, /shellAppearance\.value = shellAppearance\.value === "light" \? "dark" : "light"/);
});

test("useAppShell owns popup utility state for the refined shell", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  assert.match(source, /const isShellPopupOpen = ref\(false\)/);
  assert.match(source, /const shellUserEntryLabel = computed\(/);
  assert.match(source, /function toggleShellPopup\(\)/);
  assert.match(source, /function closeShellPopup\(\)/);
  assert.match(source, /isShellPopupOpen\.value = !isShellPopupOpen\.value/);
  assert.match(source, /isShellPopupOpen\.value = false/);
});

test("useAppShell matches approved IA workflow grouping metadata", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  const expectedSections = [
    { key: "start", label: "开始" },
    { key: "build", label: "搭建博客" },
    { key: "check-release", label: "检查与发布" },
    { key: "extension", label: "扩展" },
  ];

  for (const section of expectedSections) {
    assert.match(
      source,
      new RegExp(`key: "${section.key}"[\\s\\S]*?label: "${section.label}"`),
    );
  }

  const tabToSection = [
    { tab: "tutorial", section: "start" },
    { tab: "import", section: "start" },
    { tab: "workspace", section: "build" },
    { tab: "theme", section: "build" },
    { tab: "content", section: "build" },
    { tab: "preview", section: "check-release" },
    { tab: "publish", section: "check-release" },
    { tab: "rss", section: "extension" },
  ];

  for (const mapping of tabToSection) {
    assert.match(
      source,
      new RegExp(
        `key: "${mapping.tab}"[\\s\\S]*?section: "${mapping.section}"`,
      ),
    );
  }
});

test("useAppShell metadata drives runtime section derivation behavior", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  const tabsLiteral = source.match(/const tabs = \[([\s\S]*?)\n\];/);
  const sectionsLiteral = source.match(
    /const workflowSections = \[([\s\S]*?)\n\];/,
  );

  assert.ok(tabsLiteral, "expected tabs metadata literal to exist");
  assert.ok(sectionsLiteral, "expected workflowSections metadata literal to exist");

  const tabs = Function(`return [${tabsLiteral[1]}];`)();
  const workflowSections = Function(`return [${sectionsLiteral[1]}];`)();

  function deriveActiveSectionLabel(activeTabKey) {
    const activeTab = tabs.find((item) => item.key === activeTabKey) || tabs[0];
    const activeSection =
      workflowSections.find((item) => item.key === activeTab.section) ||
      workflowSections[0];
    return activeSection.label;
  }

  assert.equal(deriveActiveSectionLabel("tutorial"), "开始");
  assert.equal(deriveActiveSectionLabel("publish"), "检查与发布");
  assert.equal(deriveActiveSectionLabel("rss"), "扩展");
  assert.equal(deriveActiveSectionLabel("unknown-tab"), "开始");
});

test("useAppShell refreshUpdateState handles update API rejection locally", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  assert.match(
    source,
    /async function refreshUpdateState\(\)\s*{\s*try\s*{[\s\S]*shellActions\.getUpdateState\(\)[\s\S]*}\s*catch \(error\)\s*{[\s\S]*openErrorModal\("更新状态刷新失败", error\)/,
  );
});
