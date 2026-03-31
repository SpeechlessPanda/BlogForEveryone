import { computed, ref, watchEffect } from "vue";

const AUTH_REQUIRED_TAB_KEYS = new Set(["publish", "import"]);
const LOGGED_OUT_ONLY_TAB_KEYS = new Set(["login"]);

const tabs = [
  {
    key: "login",
    label: "GitHub 登录",
    section: "start",
    step: "STEP 00",
    note: "先完成账号授权，再解锁发布与导入恢复能力。",
    summary: "通过设备码完成 GitHub 登录，发布、导入和仓库操作才会可用。",
  },
  {
    key: "tutorial",
    label: "教程中心",
    section: "start",
    step: "STEP 01",
    note: "先走一遍 10 分钟总流程，知道每一步会看到什么。",
    summary: "从环境、登录到创建与发布，先把新手主线看明白。",
  },
  {
    key: "workspace",
    label: "博客创建",
    section: "build",
    step: "STEP 02",
    note: "创建第一个工作区，选框架、主题和本地目录。",
    summary: "把第一个博客工程搭起来，后面的配置都会围绕这个工作区展开。",
  },
  {
    key: "theme",
    label: "主题配置",
    section: "build",
    step: "STEP 03",
    note: "先改基础外观，复杂项放到高级设置里慢慢补。",
    summary: "按先基础、后高级的顺序整理博客外观与主题能力。",
  },
  {
    key: "preview",
    label: "本地预览",
    section: "check-release",
    step: "STEP 04",
    note: "确认 localhost 能打开，再决定要不要继续调整。",
    summary: "把当前配置真实跑起来，快速确认页面有没有达到预期。",
  },
  {
    key: "content",
    label: "内容编辑",
    section: "build",
    step: "STEP 05",
    note: "先写第一篇内容，再考虑自动发布与二次编辑。",
    summary: "创建文章和页面内容，让博客从空壳变成真正可读。",
  },
  {
    key: "publish",
    label: "发布与备份",
    section: "check-release",
    step: "STEP 06",
    note: "发布上线后，顺手做一份备份，迁移会更安心。",
    summary: "把本地成果推到 GitHub Pages，并准备好恢复用的快照。",
  },
  {
    key: "import",
    label: "导入恢复",
    section: "start",
    step: "STEP 07",
    note: "把旧工程接进来，重新回到可视化流程里。",
    summary: "已有博客也能继续用这套工作流维护，而不是从头再来。",
  },
  {
    key: "rss",
    label: "RSS 阅读",
    section: "extension",
    step: "STEP 08",
    note: "把常看的站点放进来，持续获取灵感与更新。",
    summary: "在同一个应用里关注内容更新，形成持续创作的节奏。",
  },
];

const workflowSections = [
  {
    key: "start",
    label: "开始",
    summary: "先用教程了解主线，再把已有工程导入到统一流程里。",
  },
  {
    key: "build",
    label: "搭建博客",
    summary: "从工作区、主题、预览到内容，逐步把博客做完整。",
  },
  {
    key: "check-release",
    label: "检查与发布",
    summary: "先做本地检查，再完成发布与备份，确保上线链路稳定。",
  },
  {
    key: "extension",
    label: "扩展",
    summary: "通过 RSS 阅读扩展信息输入，保持持续创作节奏。",
  },
];

export function useShellNavigation(options = {}) {
  const activeTab = ref(options.initialTab || "tutorial");

  function resolveIsLoggedIn() {
    const source = options.isLoggedIn;
    if (typeof source === "function") {
      return source() === true;
    }
    if (source && typeof source === "object" && "value" in source) {
      return source.value === true;
    }
    if (source === undefined) {
      return true;
    }
    return source === true;
  }

  function isTabAllowed(tabKey) {
    if (LOGGED_OUT_ONLY_TAB_KEYS.has(tabKey)) {
      return !resolveIsLoggedIn();
    }

    if (!AUTH_REQUIRED_TAB_KEYS.has(tabKey)) {
      return true;
    }
    return resolveIsLoggedIn();
  }

  const availableTabs = computed(() => {
    return tabs.filter((tab) => isTabAllowed(tab.key));
  });

  function getFallbackTabKey() {
    return availableTabs.value[0]?.key || tabs[0].key;
  }

  watchEffect(() => {
    if (!isTabAllowed(activeTab.value)) {
      activeTab.value = getFallbackTabKey();
    }
  });

  const groupedWorkflowSections = computed(() => {
    return workflowSections.map((section) => ({
      ...section,
      tabs: availableTabs.value.filter((tab) => tab.section === section.key),
    }));
  });

  const activeTabMeta = computed(() => {
    return (
      availableTabs.value.find((item) => item.key === activeTab.value) ||
      availableTabs.value[0] ||
      tabs[0]
    );
  });

  const activeSectionMeta = computed(() => {
    return (
      workflowSections.find((item) => item.key === activeTabMeta.value.section) ||
      workflowSections[0]
    );
  });

  function setActiveTab(tabKey) {
    if (tabs.some((item) => item.key === tabKey) && isTabAllowed(tabKey)) {
      activeTab.value = tabKey;
      return;
    }

    if (tabs.some((item) => item.key === tabKey) && !isTabAllowed(tabKey)) {
      activeTab.value = getFallbackTabKey();
    }
  }

  return {
    activeTab,
    activeTabMeta,
    activeSectionMeta,
    groupedWorkflowSections,
    setActiveTab,
  };
}
