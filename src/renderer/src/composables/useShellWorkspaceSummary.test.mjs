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

test("nextStep prioritizes environment and auth gates before tab-specific hints", async () => {
  const { useShellWorkspaceSummary } = await import("./useShellWorkspaceSummary.mjs");

  const activeTab = ref("publish");
  const envStatus = ref({ ready: false });
  const isLoggedIn = ref(false);
  const selectedWorkspace = ref({
    name: "Blog",
    framework: "hugo",
    theme: "stack",
    projectDir: "D:/blog",
  });

  const derived = useShellWorkspaceSummary({
    activeTab,
    envStatus,
    isLoggedIn,
    selectedWorkspace,
  });

  assert.equal(derived.nextStep.value.title, "先补齐运行环境");

  envStatus.value = { ready: true };
  assert.equal(derived.nextStep.value.title, "完成 GitHub 登录");
});

test("nextStep covers tutorial and workspace/no-workspace branches", async () => {
  const { useShellWorkspaceSummary } = await import("./useShellWorkspaceSummary.mjs");

  const activeTab = ref("tutorial");
  const envStatus = ref({ ready: true });
  const isLoggedIn = ref(false);
  const selectedWorkspace = ref(null);

  const derived = useShellWorkspaceSummary({
    activeTab,
    envStatus,
    isLoggedIn,
    selectedWorkspace,
  });

  assert.equal(derived.nextStep.value.title, "先创建、预览并写第一篇内容");
  isLoggedIn.value = true;
  assert.equal(derived.nextStep.value.title, "开始创建第一个博客工程");

  activeTab.value = "workspace";
  assert.equal(derived.nextStep.value.title, "创建第一个工作区");

  selectedWorkspace.value = {
    name: "Demo",
    framework: "hexo",
    theme: "next",
    projectDir: "D:/demo",
  };
  assert.equal(derived.nextStep.value.title, "去主题配置整理外观");
});

test("nextStep covers all remaining tab branches and fallback", async () => {
  const { useShellWorkspaceSummary } = await import("./useShellWorkspaceSummary.mjs");

  const activeTab = ref("theme");
  const envStatus = ref({ ready: true });
  const isLoggedIn = ref(true);
  const selectedWorkspace = ref({
    name: "Demo",
    framework: "hexo",
    theme: "next",
    projectDir: "D:/demo",
  });

  const derived = useShellWorkspaceSummary({
    activeTab,
    envStatus,
    isLoggedIn,
    selectedWorkspace,
  });

  assert.equal(derived.nextStep.value.title, "保存后去本地预览");
  activeTab.value = "preview";
  assert.equal(derived.nextStep.value.title, "确认能打开后开始写内容");

  activeTab.value = "content";
  assert.equal(derived.nextStep.value.title, "写完第一篇后去发布");

  activeTab.value = "publish";
  assert.equal(derived.nextStep.value.title, "发布成功后顺手做备份");

  activeTab.value = "import";
  assert.equal(derived.nextStep.value.title, "导入完成后回到主题或预览");

  activeTab.value = "rss";
  assert.equal(derived.nextStep.value.title, "添加订阅并定期同步");
});
