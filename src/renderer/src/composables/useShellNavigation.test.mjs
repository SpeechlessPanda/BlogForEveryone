import test from "node:test";
import assert from "node:assert/strict";

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
