import test from "node:test";
import assert from "node:assert/strict";
import { ref } from "vue";

test("useShellWorkspaceSummary exposes focused workspace-summary entry points for H3 extraction", async () => {
  const workspaceSummaryModule = await import("./useShellWorkspaceSummary.mjs");

  assert.equal(typeof workspaceSummaryModule.useShellWorkspaceSummary, "function");
});

test("useShellWorkspaceSummary owns workspace summary and next-step derivation", async () => {
  const { useShellWorkspaceSummary } = await import("./useShellWorkspaceSummary.mjs");

  const activeTab = ref("theme");
  const envStatus = ref({ ready: true });
  const isLoggedIn = ref(true);
  const selectedWorkspace = ref(null);

  const derived = useShellWorkspaceSummary({
    activeTab,
    envStatus,
    isLoggedIn,
    selectedWorkspace,
  });

  assert.equal(derived.workspaceSummary.value.title, "还未选择工作区");
  assert.equal(derived.nextStep.value.title, "先选一个博客工程");

  selectedWorkspace.value = {
    name: "My Blog",
    framework: "hexo",
    theme: "next",
    projectDir: "C:/blog",
  };
  activeTab.value = "workspace";

  assert.equal(derived.workspaceSummary.value.title, "My Blog");
  assert.match(derived.workspaceSummary.value.detail, /HEXO/);
  assert.equal(derived.nextStep.value.title, "去主题配置整理外观");
});
