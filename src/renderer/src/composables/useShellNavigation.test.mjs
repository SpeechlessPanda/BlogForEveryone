import test from "node:test";
import assert from "node:assert/strict";
import { nextTick, ref } from "vue";

test("useShellNavigation exposes focused navigation entry points for H3 extraction", async () => {
  const navigation = await import("./useShellNavigation.mjs");

  assert.equal(typeof navigation.useShellNavigation, "function");
});

test("useShellNavigation owns tab metadata and active-tab transitions", async () => {
  const { useShellNavigation } = await import("./useShellNavigation.mjs");

  const shellNavigation = useShellNavigation({ initialTab: "tutorial" });

  assert.equal(shellNavigation.activeTab.value, "tutorial");
  assert.equal(shellNavigation.activeTabMeta.value.key, "tutorial");

  shellNavigation.setActiveTab("publish");
  assert.equal(shellNavigation.activeTab.value, "publish");
  assert.equal(shellNavigation.activeTabMeta.value.key, "publish");
  assert.equal(shellNavigation.activeSectionMeta.value.key, "check-release");

  shellNavigation.setActiveTab("unknown-tab");
  assert.equal(shellNavigation.activeTab.value, "publish");
});

test("useShellNavigation hides publish/import entries and blocks restricted navigation when logged out", async () => {
  const { useShellNavigation } = await import("./useShellNavigation.mjs");

  const isLoggedIn = ref(false);
  const shellNavigation = useShellNavigation({
    initialTab: "tutorial",
    isLoggedIn,
  });

  const visibleTabKeys = shellNavigation.groupedWorkflowSections.value.flatMap((section) =>
    section.tabs.map((tab) => tab.key),
  );

  assert.equal(visibleTabKeys.includes("publish"), false);
  assert.equal(visibleTabKeys.includes("import"), false);

  shellNavigation.setActiveTab("publish");
  assert.equal(shellNavigation.activeTab.value, "tutorial");
  assert.equal(shellNavigation.activeTabMeta.value.key, "tutorial");
});

test("useShellNavigation falls back from restricted tab when auth state becomes logged out", async () => {
  const { useShellNavigation } = await import("./useShellNavigation.mjs");

  const isLoggedIn = ref(true);
  const shellNavigation = useShellNavigation({
    initialTab: "publish",
    isLoggedIn,
  });

  assert.equal(shellNavigation.activeTab.value, "publish");

  isLoggedIn.value = false;
  await nextTick();

  assert.equal(shellNavigation.activeTab.value, "tutorial");
  assert.equal(shellNavigation.activeTabMeta.value.key, "tutorial");
});
