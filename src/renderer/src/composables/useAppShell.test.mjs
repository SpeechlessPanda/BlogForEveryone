import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const useAppShellPath = new URL("./useAppShell.mjs", import.meta.url);
const useShellNavigationPath = new URL(
  "./useShellNavigation.mjs",
  import.meta.url,
);

test("useAppShell keeps shell summary and presentation state in facade", async () => {
  const source = await readFile(useAppShellPath, "utf8");

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
    "shellPopupAnchorStyle",
    "shellPopupSectionKey",
    "shellUserEntryLabel",
    "tutorialTarget",
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
  assert.match(source, /const shellPopupAnchor = ref\(/);
  assert.match(source, /const shellPopupTriggerElement = ref\(null\)/);
  assert.match(source, /const shellPopupSectionKey = ref\("account"\)/);
  assert.match(source, /const shellPopupAnchorStyle = computed\(/);
  assert.match(source, /const tutorialTarget = ref\("tutorial-home"\)/);
  assert.match(source, /const shellUserEntryLabel = computed\(/);
  assert.match(source, /function openShellPopup\(anchor\)/);
  assert.match(source, /function closeShellPopup\(\)/);
  assert.match(source, /anchor\.element/);
  assert.match(source, /getBoundingClientRect\?\.\(\)/);
  assert.match(source, /shellPopupSectionKey\.value = anchor\?\.key === "appearance" \? "appearance" : "account"/);
  assert.match(source, /isShellPopupOpen\.value = true/);
  assert.match(source, /isShellPopupOpen\.value = false/);
  assert.match(source, /shellPopupTriggerElement\.value = anchorElement/);
  assert.match(source, /shellPopupTriggerElement\.value\?\.focus\(/);
  assert.match(source, /shellPopupTriggerElement\.value = null/);
});

test("useAppShell does not reopen the shared popup from stale anchor coordinates", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  assert.match(source, /if \(!anchorRect\) \{[\s\S]*shellPopupAnchor\.value = \{[\s\S]*top: 24,[\s\S]*left: 24,[\s\S]*width: 0,[\s\S]*\}[\s\S]*return false[\s\S]*\}/);
  assert.match(source, /if \(!syncShellPopupAnchor\(anchor\)\) \{[\s\S]*isShellPopupOpen\.value = false[\s\S]*return[\s\S]*\}/);
});

test("useAppShell clamps sidebar popup placement to desktop viewport bounds", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  assert.match(source, /innerHeight/);
  assert.match(source, /Math\.min\(\s*anchorRect\.top,/);
  assert.match(source, /Math\.max\(/);
  assert.match(source, /top:\s*popupTop/);
});

test("useAppShell resets the shared scroll region and closes the popup when tabs change", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  assert.match(source, /const shellScrollRegion = ref\(null\)/);
  assert.match(source, /function setShellScrollRegion\(element\)/);
  assert.match(source, /shellScrollRegion\.value = element/);
  assert.match(source, /function resetShellScrollRegion\(\)[\s\S]*scrollTo\(\{[\s\S]*top:\s*0[\s\S]*behavior:\s*"auto"/);
  assert.match(source, /function setActiveTab\(tabKey\)[\s\S]*closeShellPopup\(\)[\s\S]*resetShellScrollRegion\(\)/);
});

test("useAppShell listens for target-aware tutorial open events", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  assert.match(
    source,
    /releaseOpenTutorialListener = shellActions\.onOpenTutorial\(\(event\) => \{[\s\S]*tutorialTarget\.value = event\?\.detail\?\.target \|\| "tutorial-home"[\s\S]*setActiveTab\("tutorial"\)/,
  );
});

test("useShellNavigation keeps approved IA workflow grouping metadata", async () => {
  const source = await readFile(useShellNavigationPath, "utf8");

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

test("useShellNavigation metadata drives runtime section derivation behavior", async () => {
  const source = await readFile(useShellNavigationPath, "utf8");

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

test("useAppShell delegates navigation metadata and active-tab behavior to useShellNavigation composable", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  assert.equal(
    source.includes('import { useShellNavigation } from "./useShellNavigation.mjs"'),
    true,
    "expected useAppShell to import useShellNavigation for H3 extraction",
  );
  assert.equal(
    source.includes("const shellNavigation = useShellNavigation("),
    true,
    "expected useAppShell to create shellNavigation via useShellNavigation",
  );
  assert.equal(
    source.includes("const tabs = ["),
    false,
    "expected navigation metadata to move from useAppShell into useShellNavigation",
  );
  assert.equal(
    source.includes("const workflowSections = ["),
    false,
    "expected workflow section metadata to move from useAppShell into useShellNavigation",
  );
  assert.equal(
    source.includes("const activeTabMeta = computed(() =>"),
    false,
    "expected activeTabMeta derivation to be owned by useShellNavigation",
  );
  assert.equal(
    source.includes("const activeSectionMeta = computed(() =>"),
    false,
    "expected activeSectionMeta derivation to be owned by useShellNavigation",
  );
});

test("useAppShell delegates workspace summary and next-step derivation to useShellWorkspaceSummary composable", async () => {
  const source = await readFile(useAppShellPath, "utf8");

  assert.equal(
    source.includes(
      'import { useShellWorkspaceSummary } from "./useShellWorkspaceSummary.mjs"',
    ),
    true,
    "expected useAppShell to import useShellWorkspaceSummary for H3 extraction",
  );
  assert.equal(
    source.includes("const shellWorkspaceSummary = useShellWorkspaceSummary("),
    true,
    "expected useAppShell to create shellWorkspaceSummary via useShellWorkspaceSummary",
  );
  assert.equal(
    source.includes("const workspaceSummary = computed(() =>"),
    false,
    "expected workspaceSummary derivation to move into useShellWorkspaceSummary",
  );
  assert.equal(
    source.includes("const nextStep = computed(() =>"),
    false,
    "expected nextStep derivation to move into useShellWorkspaceSummary",
  );
});
