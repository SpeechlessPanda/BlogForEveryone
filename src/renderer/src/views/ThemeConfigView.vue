<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  workspaceState,
  refreshThemeCatalog,
  refreshWorkspaces,
  getSelectedWorkspace,
  getWorkspaceThemeConfirmation,
  confirmWorkspaceSupportedTheme,
  confirmWorkspaceUnsupportedTheme,
} from "../stores/workspaceStore";
import {
  getAvatarUploadDir,
  getHexoBackgroundConfigPath,
  getHexoFaviconConfigPath,
  getHugoDescriptionConfigPath,
  hydrateThemeOptionValues,
  normalizeAvatarConfigValue,
  readHexoBackgroundValue,
  readHexoFaviconValue,
  syncHugoOutputs,
} from "../utils/themeConfigHelpers.mjs";
import {
  resolveThemeSelection,
  isThemeSpecificMappingAllowed,
} from "../utils/themeDetectionHelpers.mjs";
import { useShellActions } from "../composables/useShellActions.mjs";
import { useThemeConfigActions } from "../composables/useThemeConfigActions.mjs";
import ThemeIdentitySection from "../components/theme-config/ThemeIdentitySection.vue";
import ThemeAssetStudioSection from "../components/theme-config/ThemeAssetStudioSection.vue";
import ThemeAdvancedConfigSection from "../components/theme-config/ThemeAdvancedConfigSection.vue";

const status = ref("");
const selectedThemeId = ref("");
const allConfigEntries = ref([]);

const basicFields = reactive({
  siteTitle: "",
  subtitle: "",
  email: "",
  github: "",
  backgroundImage: "",
  favicon: "",
  avatarImage: "",
  bodyFontFamily: "",
  bodyFontSize: "18",
  stackHomeIcon: "home",
  stackAboutIcon: "user",
  stackArchivesIcon: "archives",
  stackShowArchivesWidget: true,
  stackShowTagCloudWidget: false,
});

const giscusFields = reactive({
  enabled: true,
  repo: "",
  repoId: "",
  category: "",
  categoryId: "",
  mapping: "pathname",
  theme: "light",
});

const analyticsFields = reactive({
  busuanzi: true,
  umamiScriptUrl: "",
  umamiWebsiteId: "",
  gaMeasurementId: "",
});

const rssFields = reactive({
  generateBlogRss: true,
  autoSyncRssSubscriptions: true,
});

const backgroundTransfer = reactive({
  localFilePath: "",
  preferredDir: "",
  preferredFileName: "",
});

const avatarTransfer = reactive({
  localFilePath: "",
  preferredFileName: "",
});

const pendingSupportedThemeId = ref("");
const selectedWorkspace = computed(() => getSelectedWorkspace());
const shellActions = useShellActions();
const themeConfigActions = useThemeConfigActions();

const selectedThemeCatalog = computed(() => {
  const ws = selectedWorkspace.value;
  if (!ws || !workspaceState.themeCatalog) {
    return [];
  }
  return workspaceState.themeCatalog[ws.framework] || [];
});

const themeSelection = computed(() => {
  const ws = selectedWorkspace.value;
  if (!ws) {
    return {
      selectedThemeId: "",
      needsUserConfirmation: false,
      isSupportedTheme: false,
      isUnsupportedOrCustom: false,
    };
  }

  return resolveThemeSelection(
    ws,
    selectedThemeCatalog.value,
    getWorkspaceThemeConfirmation(ws.id),
  );
});

const canUseThemeSpecificMapping = computed(() =>
  isThemeSpecificMappingAllowed(themeSelection.value),
);

const needsThemeConfirmation = computed(
  () => themeSelection.value.needsUserConfirmation,
);

const themeConfirmationHint = computed(() => {
  if (themeSelection.value.isUnsupportedOrCustom) {
    return "当前主题已标记为不受支持/自定义，仅启用安全通用配置，不写入主题专属映射。";
  }
  if (needsThemeConfirmation.value) {
    return "导入工程的主题尚未确认。请明确选择支持主题，或标记为不受支持/自定义。";
  }
  return "已确认主题，允许主题专属配置逻辑。";
});

const selectedThemeName = computed(() => {
  if (themeSelection.value.isUnsupportedOrCustom) {
    return `${themeSelection.value.selectedThemeId || "custom"}（不受支持/自定义）`;
  }
  if (needsThemeConfirmation.value) {
    return `${themeSelection.value.selectedThemeId || "unknown"}（待确认）`;
  }
  if (!selectedThemeSchema.value) {
    return selectedThemeId.value || "未识别";
  }
  return `${selectedThemeSchema.value.name} (${selectedThemeSchema.value.id})`;
});

const selectedThemeSchema = computed(() => {
  const ws = selectedWorkspace.value;
  if (!ws || !workspaceState.themeCatalog) {
    return null;
  }
  const list = workspaceState.themeCatalog[ws.framework] || [];
  return list.find((item) => item.id === selectedThemeId.value) || null;
});

const supportsAvatarUpload = computed(() => {
  return (
    selectedWorkspace.value?.framework === "hugo" &&
    ["stack", "anatole"].includes(selectedThemeId.value)
  );
});

const supportsStackComponents = computed(() => {
  return (
    selectedWorkspace.value?.framework === "hugo" &&
    selectedThemeId.value === "stack"
  );
});

const backgroundSupportHint = computed(() => {
  const framework = selectedWorkspace.value?.framework;
  const themeId = selectedThemeId.value;
  if (framework === "hugo" && themeId === "papermod") {
    return "PaperMod 默认不提供原生背景图配置，软件会自动注入兼容样式并写入扩展 CSS。";
  }
  return "若主题不提供原生背景参数，软件会尽量写入通用兼容覆盖；若仍无效，请优先使用主题原生背景项。";
});

const optionValues = reactive({});

function confirmAsSupportedTheme() {
  const ws = selectedWorkspace.value;
  if (!ws || !pendingSupportedThemeId.value) {
    return;
  }
  confirmWorkspaceSupportedTheme(ws.id, pendingSupportedThemeId.value);
  status.value = `已确认支持主题：${pendingSupportedThemeId.value}`;
  applyThemeFromWorkspace();
}

function confirmAsUnsupportedTheme() {
  const ws = selectedWorkspace.value;
  if (!ws) {
    return;
  }
  confirmWorkspaceUnsupportedTheme(ws.id, ws.theme || "custom");
  status.value = "已标记为不受支持/自定义主题，已切换到安全通用模式。";
  applyThemeFromWorkspace();
}

function goTutorialCenter() {
  shellActions.openTutorial("theme-config");
}

function goPreviewPage() {
  shellActions.openTab("preview");
}

function setPendingSupportedThemeId(value) {
  pendingSupportedThemeId.value = value;
}

function getDefaultAssetDir(framework) {
  return framework === "hexo" ? "source/img" : "static/img";
}

function setThemeValueByPath(config, path, value) {
  if (path === "favicon") {
    config.favicon = value;
    return;
  }
  setByPath(config, path, value);
}

function deriveFileNameFromPath(value) {
  if (!value) {
    return "";
  }
  const cleaned = String(value).trim().split("?")[0].split("#")[0];
  const segments = cleaned.split("/").filter(Boolean);
  return segments.length ? segments[segments.length - 1] : "";
}

function setByPath(target, path, value) {
  const keys = path.split(".");
  let pointer = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (typeof pointer[key] !== "object" || pointer[key] === null) {
      pointer[key] = {};
    }
    pointer = pointer[key];
  }
  pointer[keys[keys.length - 1]] = value;
}

function removeByPath(target, path) {
  const keys = path.split(".");
  let pointer = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (pointer == null || typeof pointer !== "object") {
      return;
    }
    pointer = pointer[key];
  }

  if (pointer && typeof pointer === "object") {
    delete pointer[keys[keys.length - 1]];
  }
}

function getByPath(source, path) {
  const keys = path.split(".");
  let pointer = source;
  for (const key of keys) {
    if (pointer == null || typeof pointer !== "object") {
      return undefined;
    }
    pointer = pointer[key];
  }
  return pointer;
}

function flattenObject(obj, parent = "") {
  const entries = [];
  if (!obj || typeof obj !== "object") {
    return entries;
  }
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = parent ? `${parent}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      entries.push(...flattenObject(value, fullKey));
    } else {
      entries.push({
        key: fullKey,
        value: Array.isArray(value)
          ? JSON.stringify(value)
          : String(value ?? ""),
      });
    }
  }
  return entries;
}

function parseInputValue(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (
    (value.startsWith("[") && value.endsWith("]")) ||
    (value.startsWith("{") && value.endsWith("}"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function applyPersonalization(config, framework) {
  const allowThemeSpecificMapping = canUseThemeSpecificMapping.value;
  config.title = basicFields.siteTitle || config.title;

  if (framework === "hexo") {
    config.subtitle = basicFields.subtitle || config.subtitle;
    setByPath(
      config,
      getHexoBackgroundConfigPath(selectedThemeId.value),
      basicFields.backgroundImage ||
        readHexoBackgroundValue(config, selectedThemeId.value, getByPath) ||
        "",
    );
    setThemeValueByPath(
      config,
      getHexoFaviconConfigPath(selectedThemeId.value),
      basicFields.favicon ||
        readHexoFaviconValue(config, selectedThemeId.value, getByPath) ||
        "",
    );
    setByPath(config, "author.email", basicFields.email);
    setByPath(config, "theme_config.social.github", basicFields.github);

    setByPath(
      config,
      "theme_config.comments.use",
      giscusFields.enabled ? "giscus" : "none",
    );
    setByPath(config, "theme_config.comments.giscus.repo", giscusFields.repo);
    setByPath(
      config,
      "theme_config.comments.giscus.repoId",
      giscusFields.repoId,
    );
    setByPath(
      config,
      "theme_config.comments.giscus.category",
      giscusFields.category,
    );
    setByPath(
      config,
      "theme_config.comments.giscus.categoryId",
      giscusFields.categoryId,
    );
    setByPath(
      config,
      "theme_config.comments.giscus.mapping",
      giscusFields.mapping,
    );
    setByPath(config, "theme_config.comments.giscus.theme", giscusFields.theme);

    setByPath(
      config,
      "theme_config.post_font.family",
      basicFields.bodyFontFamily,
    );
    setByPath(
      config,
      "theme_config.post_font.size",
      `${basicFields.bodyFontSize}px`,
    );

    setByPath(
      config,
      "theme_config.analytics.busuanzi.enable",
      analyticsFields.busuanzi,
    );
    setByPath(
      config,
      "theme_config.analytics.umami.script",
      analyticsFields.umamiScriptUrl,
    );
    setByPath(
      config,
      "theme_config.analytics.umami.website_id",
      analyticsFields.umamiWebsiteId,
    );
    setByPath(
      config,
      "theme_config.analytics.ga.measurement_id",
      analyticsFields.gaMeasurementId,
    );

    setByPath(config, "feed.enable", rssFields.generateBlogRss);
    if (rssFields.generateBlogRss) {
      setByPath(
        config,
        "feed.path",
        getByPath(config, "feed.path") || "atom.xml",
      );
    }

    if (allowThemeSpecificMapping && selectedThemeId.value === "next") {
      setByPath(config, "theme_config.sidebar.display", "always");
      setByPath(
        config,
        "theme_config.favicon.small",
        basicFields.favicon || "",
      );
      setByPath(
        config,
        "theme_config.favicon.medium",
        basicFields.favicon || "",
      );
      setByPath(
        config,
        "theme_config.favicon.apple_touch_icon",
        basicFields.favicon || "",
      );
    }
  } else {
    setByPath(
      config,
      getHugoDescriptionConfigPath(selectedThemeId.value),
      basicFields.subtitle,
    );
    setByPath(config, "params.backgroundImage", basicFields.backgroundImage);
    setByPath(config, "params.favicon", basicFields.favicon);
    setByPath(config, "params.social.email", basicFields.email);
    setByPath(config, "params.social.github", basicFields.github);

    setByPath(config, "params.comments.giscus.enable", giscusFields.enabled);
    setByPath(config, "params.comments.giscus.repo", giscusFields.repo);
    setByPath(config, "params.comments.giscus.repoId", giscusFields.repoId);
    setByPath(config, "params.comments.giscus.category", giscusFields.category);
    setByPath(
      config,
      "params.comments.giscus.categoryId",
      giscusFields.categoryId,
    );
    setByPath(config, "params.comments.giscus.mapping", giscusFields.mapping);
    setByPath(config, "params.comments.giscus.theme", giscusFields.theme);

    setByPath(config, "params.postFont.family", basicFields.bodyFontFamily);
    setByPath(config, "params.postFont.size", `${basicFields.bodyFontSize}px`);

    setByPath(
      config,
      "params.analytics.busuanzi.enable",
      analyticsFields.busuanzi,
    );
    setByPath(
      config,
      "params.analytics.umami.script",
      analyticsFields.umamiScriptUrl,
    );
    setByPath(
      config,
      "params.analytics.umami.website_id",
      analyticsFields.umamiWebsiteId,
    );
    setByPath(
      config,
      "params.analytics.ga.measurement_id",
      analyticsFields.gaMeasurementId,
    );

    syncHugoOutputs(
      config,
      rssFields.generateBlogRss,
      getByPath,
      setByPath,
    );

    if (allowThemeSpecificMapping && selectedThemeId.value === "stack") {
      setByPath(config, "params.sidebar.subtitle", basicFields.subtitle || "");
      if (basicFields.avatarImage) {
        setByPath(config, "params.sidebar.avatar", basicFields.avatarImage);
      } else {
        removeByPath(config, "params.sidebar.avatar");
      }

      const homepageWidgets = [];
      if (basicFields.stackShowArchivesWidget) {
        homepageWidgets.push({ type: "archives", params: { limit: 5 } });
      }
      if (basicFields.stackShowTagCloudWidget) {
        homepageWidgets.push({ type: "tag-cloud", params: { limit: 15 } });
        setByPath(config, "taxonomies.tag", "tags");
        setByPath(config, "taxonomies.category", "categories");
      }
      setByPath(config, "params.widgets.homepage", homepageWidgets);
      setByPath(config, "params.widgets.page", [{ type: "toc" }]);

      const currentMenu = Array.isArray(getByPath(config, "menu.main"))
        ? getByPath(config, "menu.main")
        : [];
      const byId = (id) =>
        currentMenu.find((item) => String(item?.identifier || "") === id) || {};

      const buildMenuItem = (
        id,
        fallbackName,
        fallbackUrl,
        fallbackWeight,
        icon,
      ) => {
        const existing = byId(id);
        const item = {
          identifier: id,
          name: existing.name || fallbackName,
          url: existing.url || fallbackUrl,
          weight:
            typeof existing.weight === "number"
              ? existing.weight
              : fallbackWeight,
        };

        const nextIcon = String(icon || "").trim();
        if (nextIcon) {
          item.params = { ...(existing.params || {}), icon: nextIcon };
        } else if (existing.params && typeof existing.params === "object") {
          const cloned = { ...existing.params };
          delete cloned.icon;
          if (Object.keys(cloned).length) {
            item.params = cloned;
          }
        }
        return item;
      };

      setByPath(config, "menu.main", [
        buildMenuItem("home", "Home", "/", 10, basicFields.stackHomeIcon),
        buildMenuItem(
          "about",
          "About",
          "/about/",
          20,
          basicFields.stackAboutIcon,
        ),
        buildMenuItem(
          "archives",
          "Archives",
          "/archives/",
          30,
          basicFields.stackArchivesIcon,
        ),
      ]);
    }

    if (allowThemeSpecificMapping && selectedThemeId.value === "anatole") {
      if (basicFields.avatarImage) {
        setByPath(config, "params.profilePicture", basicFields.avatarImage);
      } else {
        removeByPath(config, "params.profilePicture");
      }

      const socialIcons = [];
      if (basicFields.github) {
        socialIcons.push({
          icon: "fa-brands fa-github",
          title: "GitHub",
          url: basicFields.github,
        });
      }
      if (basicFields.email) {
        socialIcons.push({
          icon: "fa-solid fa-envelope",
          title: "Email",
          url: `mailto:${basicFields.email}`,
        });
      }
      setByPath(config, "params.socialIcons", socialIcons);
    }

    if (allowThemeSpecificMapping && selectedThemeId.value === "papermod") {
      setByPath(config, "params.assets.favicon", basicFields.favicon || "");
      setByPath(
        config,
        "params.assets.favicon16x16",
        basicFields.favicon || "",
      );
      setByPath(
        config,
        "params.assets.favicon32x32",
        basicFields.favicon || "",
      );

      const socialIcons = [];
      if (basicFields.github) {
        socialIcons.push({ name: "github", url: basicFields.github });
      }
      if (basicFields.email) {
        socialIcons.push({ name: "email", url: `mailto:${basicFields.email}` });
      }
      setByPath(config, "params.socialIcons", socialIcons);

      const existingHomeInfo = getByPath(config, "params.homeInfoParams");
      if (!existingHomeInfo || typeof existingHomeInfo !== "object") {
        setByPath(config, "params.homeInfoParams", {
          Title: basicFields.siteTitle || "Hi there 👋",
          Content: basicFields.subtitle || "Welcome to my blog",
        });
      }

      const existingMenu = getByPath(config, "menu.main");
      if (!Array.isArray(existingMenu) || !existingMenu.length) {
        setByPath(config, "menu.main", [
          {
            identifier: "archives",
            name: "Archives",
            url: "/archives/",
            weight: 10,
          },
          { identifier: "tags", name: "Tags", url: "/tags/", weight: 20 },
          { identifier: "series", name: "Series", url: "/series/", weight: 30 },
        ]);
      }
    }

    if (allowThemeSpecificMapping && selectedThemeId.value === "loveit") {
      setByPath(config, "params.home.profile.enable", false);
      setByPath(config, "params.home.posts.enable", true);
      setByPath(config, "params.home.posts.paginate", 6);
      setByPath(config, "mainSections", ["posts", "post"]);
    }

    if (allowThemeSpecificMapping && selectedThemeId.value === "mainroad") {
      setByPath(config, "Params.mainSections", ["post"]);
      setByPath(config, "Params.sidebar.home", "right");
      setByPath(config, "Params.sidebar.list", "right");
      setByPath(config, "Params.sidebar.single", "right");
      setByPath(config, "Params.sidebar.widgets", [
        "search",
        "recent",
        "categories",
        "taglist",
      ]);
      setByPath(config, "Params.widgets.recent_num", 5);
      setByPath(config, "Params.widgets.tags_counter", true);
    }
  }
}

async function syncPreviewOverrides(projectDir, framework) {
  if (framework !== "hugo" || !canUseThemeSpecificMapping.value) {
    return;
  }
  await themeConfigActions.applyThemePreviewOverrides({
    projectDir,
    framework,
    themeId: selectedThemeId.value,
    backgroundImage: basicFields.backgroundImage,
    favicon: basicFields.favicon,
  });
}

async function loadConfig() {
  const ws = selectedWorkspace.value;
  if (!ws) {
    return;
  }
  const config = await themeConfigActions.getThemeConfig({
    projectDir: ws.projectDir,
    framework: ws.framework,
  });
  allConfigEntries.value = flattenObject(config);

  basicFields.siteTitle = String(config.title || "");
  basicFields.subtitle = String(
    config.subtitle ||
      getByPath(
        config,
        getHugoDescriptionConfigPath(selectedThemeId.value),
      ) ||
      getByPath(config, "params.description") ||
      "",
  );
  basicFields.email = String(
    getByPath(config, "author.email") ||
      (Array.isArray(getByPath(config, "params.socialIcons"))
        ? (
            getByPath(config, "params.socialIcons").find(
              (item) => String(item?.name || "").toLowerCase() === "email",
            )?.url || ""
          ).replace(/^mailto:/i, "")
        : "") ||
      getByPath(config, "params.social.email") ||
      "",
  );
  basicFields.github = String(
    getByPath(config, "theme_config.social.github") ||
      (Array.isArray(getByPath(config, "params.socialIcons"))
        ? getByPath(config, "params.socialIcons").find(
            (item) => String(item?.name || "").toLowerCase() === "github",
          )?.url || ""
        : "") ||
      getByPath(config, "params.social.github") ||
      "",
  );
  basicFields.backgroundImage = String(
    selectedWorkspace.value?.framework === "hexo"
      ? readHexoBackgroundValue(config, selectedThemeId.value, getByPath)
      : getByPath(config, "params.backgroundImage") || "",
  );
  basicFields.favicon = String(
    selectedWorkspace.value?.framework === "hexo"
      ? readHexoFaviconValue(config, selectedThemeId.value, getByPath)
      : config.favicon ||
        getByPath(config, "params.assets.favicon") ||
        getByPath(config, "params.favicon") ||
        "",
  );
  basicFields.avatarImage = String(
    getByPath(config, "params.sidebar.avatar") ||
      getByPath(config, "params.profilePicture") ||
      "",
  );
  basicFields.bodyFontFamily = String(
    getByPath(config, "theme_config.post_font.family") ||
      getByPath(config, "params.postFont.family") ||
      "",
  );
  basicFields.bodyFontSize = String(
    (
      getByPath(config, "theme_config.post_font.size") ||
      getByPath(config, "params.postFont.size") ||
      "18"
    )
      .toString()
      .replace("px", ""),
  );

  backgroundTransfer.preferredDir =
    backgroundTransfer.preferredDir || getDefaultAssetDir(ws.framework);
  backgroundTransfer.preferredFileName = deriveFileNameFromPath(
    basicFields.backgroundImage,
  );
  avatarTransfer.preferredFileName = deriveFileNameFromPath(
    basicFields.avatarImage,
  );

  const stackMenu = Array.isArray(getByPath(config, "menu.main"))
    ? getByPath(config, "menu.main")
    : [];
  const menuIconById = (id) =>
    String(
      stackMenu.find((item) => String(item?.identifier || "") === id)?.params
        ?.icon || "",
    );
  basicFields.stackHomeIcon = menuIconById("home");
  basicFields.stackAboutIcon = menuIconById("about");
  basicFields.stackArchivesIcon = menuIconById("archives");

  const homepageWidgets = Array.isArray(
    getByPath(config, "params.widgets.homepage"),
  )
    ? getByPath(config, "params.widgets.homepage")
    : [];
  const hasWidget = (type) =>
    homepageWidgets.some(
      (item) =>
        String(item?.type || "").toLowerCase() === String(type).toLowerCase(),
    );
  basicFields.stackShowArchivesWidget = hasWidget("archives");
  basicFields.stackShowTagCloudWidget = hasWidget("tag-cloud");

  giscusFields.enabled = Boolean(
    getByPath(config, "theme_config.comments.use") === "giscus" ||
    getByPath(config, "params.comments.giscus.enable"),
  );
  giscusFields.repo = String(
    getByPath(config, "theme_config.comments.giscus.repo") ||
      getByPath(config, "params.comments.giscus.repo") ||
      "",
  );
  giscusFields.repoId = String(
    getByPath(config, "theme_config.comments.giscus.repoId") ||
      getByPath(config, "params.comments.giscus.repoId") ||
      "",
  );
  giscusFields.category = String(
    getByPath(config, "theme_config.comments.giscus.category") ||
      getByPath(config, "params.comments.giscus.category") ||
      "",
  );
  giscusFields.categoryId = String(
    getByPath(config, "theme_config.comments.giscus.categoryId") ||
      getByPath(config, "params.comments.giscus.categoryId") ||
      "",
  );
  giscusFields.mapping = String(
    getByPath(config, "theme_config.comments.giscus.mapping") ||
      getByPath(config, "params.comments.giscus.mapping") ||
      "pathname",
  );
  giscusFields.theme = String(
    getByPath(config, "theme_config.comments.giscus.theme") ||
      getByPath(config, "params.comments.giscus.theme") ||
      "light",
  );

  analyticsFields.busuanzi = Boolean(
    getByPath(config, "theme_config.analytics.busuanzi.enable") ??
    getByPath(config, "params.analytics.busuanzi.enable") ??
    true,
  );
  analyticsFields.umamiScriptUrl = String(
    getByPath(config, "theme_config.analytics.umami.script") ||
      getByPath(config, "params.analytics.umami.script") ||
      "",
  );
  analyticsFields.umamiWebsiteId = String(
    getByPath(config, "theme_config.analytics.umami.website_id") ||
      getByPath(config, "params.analytics.umami.website_id") ||
      "",
  );
  analyticsFields.gaMeasurementId = String(
    getByPath(config, "theme_config.analytics.ga.measurement_id") ||
      getByPath(config, "params.analytics.ga.measurement_id") ||
      "",
  );

  rssFields.generateBlogRss = Boolean(
    getByPath(config, "feed.enable") ??
    (Array.isArray(getByPath(config, "outputs.home"))
      ? getByPath(config, "outputs.home").includes("RSS")
      : true),
  );

  const preferences = await themeConfigActions.getPreferences();
  rssFields.autoSyncRssSubscriptions =
    preferences.autoSyncRssSubscriptions !== false;

  const nextOptionValues = hydrateThemeOptionValues(
    config,
    selectedThemeSchema.value?.options || [],
    getByPath,
  );
  for (const key of Object.keys(optionValues)) {
    delete optionValues[key];
  }
  Object.assign(optionValues, nextOptionValues);
}

async function saveAllConfig() {
  const ws = selectedWorkspace.value;
  if (!ws) {
    return;
  }

  const validateResult = await themeConfigActions.validateThemeSettings({
    framework: ws.framework,
    themeId: canUseThemeSpecificMapping.value ? selectedThemeId.value : "",
    basicFields: {
      siteTitle: basicFields.siteTitle,
      email: basicFields.email,
      github: basicFields.github,
      backgroundImage: basicFields.backgroundImage,
      favicon: basicFields.favicon,
    },
  });

  if (!validateResult?.ok) {
    status.value = `保存失败：${(validateResult?.errors || []).join("；")}`;
    return;
  }
  const config = await themeConfigActions.getThemeConfig({
    projectDir: ws.projectDir,
    framework: ws.framework,
  });

  for (const item of allConfigEntries.value) {
    setByPath(config, item.key, parseInputValue(item.value));
  }

  if (canUseThemeSpecificMapping.value) {
    for (const option of selectedThemeSchema.value?.options || []) {
      let value = optionValues[option.key];
      if (option.type === "boolean") {
        value = value === true || value === "true";
      }
      if (option.type === "array" && typeof value === "string") {
        value = value
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      }
      if (value === undefined || value === null || value === "") {
        value = option.default;
      }
      setByPath(config, option.key, value);
    }
  }

  applyPersonalization(config, ws.framework);

  await themeConfigActions.saveThemeConfig({
    projectDir: ws.projectDir,
    framework: ws.framework,
    nextConfig: config,
  });
  await syncPreviewOverrides(ws.projectDir, ws.framework);

  await themeConfigActions.savePreferences({
    generateBlogRss: rssFields.generateBlogRss,
    autoSyncRssSubscriptions: rssFields.autoSyncRssSubscriptions,
  });

  const warningText = (validateResult?.warnings || []).join("；");
  status.value = warningText
    ? `主题配置已保存（提示：${warningText}）`
    : "主题配置已保存。";
  allConfigEntries.value = flattenObject(config);
}

async function applyLocalBackgroundImage() {
  const ws = selectedWorkspace.value;
  if (!ws) {
    status.value = "请先选择工程。";
    return;
  }
  if (!backgroundTransfer.localFilePath) {
    status.value = "请先填写背景图本地路径。";
    return;
  }

  const result = await themeConfigActions.saveThemeLocalAsset({
    projectDir: ws.projectDir,
    framework: ws.framework,
    localFilePath: backgroundTransfer.localFilePath,
    assetType: "background",
    preferredDir:
      backgroundTransfer.preferredDir || getDefaultAssetDir(ws.framework),
    preferredFileName:
      backgroundTransfer.preferredFileName ||
      deriveFileNameFromPath(basicFields.backgroundImage),
  });

  basicFields.backgroundImage = result.webPath;
  backgroundTransfer.preferredFileName = deriveFileNameFromPath(result.webPath);
  const config = await themeConfigActions.getThemeConfig({
    projectDir: ws.projectDir,
    framework: ws.framework,
  });
  if (ws.framework === "hexo") {
    setByPath(
      config,
      getHexoBackgroundConfigPath(selectedThemeId.value),
      result.webPath,
    );
  } else {
    setByPath(config, "params.backgroundImage", result.webPath);
    if (canUseThemeSpecificMapping.value && selectedThemeId.value === "papermod") {
      setByPath(config, "params.assets.disableFingerprinting", true);
    }
  }
  await themeConfigActions.saveThemeConfig({
    projectDir: ws.projectDir,
    framework: ws.framework,
    nextConfig: config,
  });
  allConfigEntries.value = flattenObject(config);
  await syncPreviewOverrides(ws.projectDir, ws.framework);
  status.value = `背景图已转存并写入配置：${result.webPath}`;
}

async function uploadLocalFavicon(localFilePath, preferredFileName) {
  const ws = selectedWorkspace.value;
  if (!ws) {
    status.value = "请先选择工程。";
    return;
  }
  const result = await themeConfigActions.saveThemeLocalAsset({
    projectDir: ws.projectDir,
    framework: ws.framework,
    localFilePath,
    assetType: "favicon",
    preferredDir:
      backgroundTransfer.preferredDir || getDefaultAssetDir(ws.framework),
    preferredFileName: preferredFileName || "favicon",
  });
  basicFields.favicon = result.webPath;
  const config = await themeConfigActions.getThemeConfig({
    projectDir: ws.projectDir,
    framework: ws.framework,
  });
  if (ws.framework === "hexo") {
    setThemeValueByPath(
      config,
      getHexoFaviconConfigPath(selectedThemeId.value),
      result.webPath,
    );
  } else {
    setByPath(config, "params.favicon", result.webPath);
    if (canUseThemeSpecificMapping.value && selectedThemeId.value === "papermod") {
      setByPath(config, "params.assets.favicon", result.webPath);
      setByPath(config, "params.assets.favicon16x16", result.webPath);
      setByPath(config, "params.assets.favicon32x32", result.webPath);
    }
  }
  await themeConfigActions.saveThemeConfig({
    projectDir: ws.projectDir,
    framework: ws.framework,
    nextConfig: config,
  });
  allConfigEntries.value = flattenObject(config);
  await syncPreviewOverrides(ws.projectDir, ws.framework);
  status.value = `图标已转存并写入配置：${result.webPath}`;
}

async function applyLocalAvatarImage() {
  const ws = selectedWorkspace.value;
  if (!ws) {
    status.value = "请先选择工程。";
    return;
  }
  if (!supportsAvatarUpload.value) {
    status.value = "当前主题不支持头像配置。";
    return;
  }
  if (!canUseThemeSpecificMapping.value) {
    status.value = "未确认受支持主题，已阻止头像主题映射写入。";
    return;
  }
  if (!avatarTransfer.localFilePath) {
    status.value = "请先填写头像本地路径。";
    return;
  }

  const result = await themeConfigActions.saveThemeLocalAsset({
    projectDir: ws.projectDir,
    framework: ws.framework,
    localFilePath: avatarTransfer.localFilePath,
    assetType: "avatar",
    preferredDir: getAvatarUploadDir(ws.framework, selectedThemeId.value),
    preferredFileName: avatarTransfer.preferredFileName || "avatar",
  });

  const avatarValue = normalizeAvatarConfigValue(
    ws.framework,
    selectedThemeId.value,
    result.webPath,
  );

  basicFields.avatarImage = avatarValue;
  avatarTransfer.preferredFileName = deriveFileNameFromPath(avatarValue);

  const config = await themeConfigActions.getThemeConfig({
    projectDir: ws.projectDir,
    framework: ws.framework,
  });

  if (canUseThemeSpecificMapping.value && selectedThemeId.value === "stack") {
    setByPath(config, "params.sidebar.avatar", avatarValue);
  }
  if (canUseThemeSpecificMapping.value && selectedThemeId.value === "anatole") {
    setByPath(config, "params.profilePicture", avatarValue);
  }

  await themeConfigActions.saveThemeConfig({
    projectDir: ws.projectDir,
    framework: ws.framework,
    nextConfig: config,
  });
  allConfigEntries.value = flattenObject(config);
  await syncPreviewOverrides(ws.projectDir, ws.framework);
  status.value = `头像已转存并写入配置：${avatarValue}`;
}

function applyThemeFromWorkspace() {
  const ws = selectedWorkspace.value;
  if (!ws) {
    selectedThemeId.value = "";
    pendingSupportedThemeId.value = "";
    return;
  }

  const resolved = themeSelection.value;
  selectedThemeId.value = resolved.selectedThemeId;

  if (
    !pendingSupportedThemeId.value ||
    !selectedThemeCatalog.value.some(
      (item) => item.id === pendingSupportedThemeId.value,
    )
  ) {
    pendingSupportedThemeId.value = selectedThemeCatalog.value[0]?.id || "";
  }
}

async function pickBackgroundImageFile() {
  const result = await themeConfigActions.pickFile({
    title: "选择背景图文件",
    defaultPath: backgroundTransfer.localFilePath || undefined,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
      },
    ],
  });
  if (!result.canceled && result.path) {
    backgroundTransfer.localFilePath = result.path;
  }
}

async function pickFaviconImageFile(currentPath) {
  const result = await themeConfigActions.pickFile({
    title: "选择博客图标文件",
    defaultPath: currentPath || undefined,
    filters: [
      { name: "Icon", extensions: ["ico", "png", "jpg", "jpeg", "svg"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  return !result.canceled && result.path ? result.path : currentPath || "";
}

async function pickAvatarImageFile() {
  const result = await themeConfigActions.pickFile({
    title: "选择头像文件",
    defaultPath: avatarTransfer.localFilePath || undefined,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
      },
    ],
  });
  if (!result.canceled && result.path) {
    avatarTransfer.localFilePath = result.path;
  }
}

onMounted(async () => {
  await refreshThemeCatalog();
  await refreshWorkspaces();
  applyThemeFromWorkspace();
  const ws = selectedWorkspace.value;
  if (ws) {
    await loadConfig();
  }
});

watch(
  () => workspaceState.selectedWorkspaceId,
  async () => {
    applyThemeFromWorkspace();
    await loadConfig();
  },
);

watch(
  () => workspaceState.themeCatalog,
  () => {
    applyThemeFromWorkspace();
  },
);

watch(
  () => workspaceState.workspaceThemeConfirmations,
  () => {
    applyThemeFromWorkspace();
  },
  { deep: true },
);
</script>

<template>
  <div
    class="page-shell page-shell--theme theme-studio"
    data-page-role="theme-config"
    data-theme-surface="editorial-studio"
  >
    <div class="page-layer" data-page-layer="primary">
      <section class="panel page-hero">
        <div>
          <p class="page-kicker">Brand workspace</p>
          <h2 class="page-title">品牌与外观工作台</h2>
          <p class="page-lead">
            主题配置页优先处理品牌、素材与阅读体验，高感知项始终排在前面；高级与原始配置留到后面，避免技术参数压过品牌工作流。
          </p>
          <div class="page-link-row">
            <a href="#" @click.prevent="goTutorialCenter"
              >打开教程中心：主题个性化完整指南</a
            >
            <button class="secondary" type="button" @click="goPreviewPage">
              前往本地预览页面
            </button>
          </div>
        </div>

        <div class="theme-studio-status-grid theme-studio-status-grid--overview">
          <div class="page-signal page-signal--accent">
            <p class="section-eyebrow">当前工作区</p>
            <strong>{{ selectedWorkspace?.name || "尚未选择工程" }}</strong>
            <p class="section-helper">
              {{
                selectedWorkspace
                  ? `${selectedWorkspace.framework.toUpperCase()} · ${selectedWorkspace.projectDir}`
                  : "先选择或创建博客工程，主题和图片配置才会落到正确目录里。"
              }}
            </p>
          </div>
          <div class="page-signal">
            <p class="section-eyebrow">当前主题</p>
            <strong>{{ selectedThemeName }}</strong>
            <p class="section-helper">
              先完成标题、背景、图标这类高感知项，再处理主题专属高级参数。
            </p>
          </div>
          <div class="page-signal page-signal--quiet">
            <p class="section-eyebrow">兼容提示</p>
            <strong>图片与头像会自动转存</strong>
            <p class="section-helper">{{ backgroundSupportHint }}</p>
          </div>
          <div class="page-signal page-signal--accent">
            <p class="section-eyebrow">建议下一步</p>
            <strong>先改品牌与阅读体验，再去预览确认真实页面。</strong>
            <p class="section-helper">
              高级与原始配置属于次级区域，等基础外观跑通后再处理。
            </p>
          </div>
          <div class="page-signal page-signal--quiet">
            <p class="section-eyebrow">品牌主叙事</p>
            <strong>先让标题、素材与阅读气质讲同一种品牌语言。</strong>
            <p class="section-helper">
              先统一首页印象，再处理主题专属参数，能让编辑节奏更稳定。
            </p>
          </div>
        </div>
      </section>

      <ThemeIdentitySection
        data-theme-zone="identity-rhythm"
        :workspace-state="workspaceState"
        :selected-theme-name="selectedThemeName"
        :theme-confirmation-hint="themeConfirmationHint"
        :needs-theme-confirmation="needsThemeConfirmation"
        :pending-supported-theme-id="pendingSupportedThemeId"
        :set-pending-supported-theme-id="setPendingSupportedThemeId"
        :selected-theme-catalog="selectedThemeCatalog"
        :confirm-as-supported-theme="confirmAsSupportedTheme"
        :confirm-as-unsupported-theme="confirmAsUnsupportedTheme"
        :basic-fields="basicFields"
        :supports-stack-components="supportsStackComponents"
      />

      <ThemeAssetStudioSection
        data-theme-zone="asset-studio"
        :basic-fields="basicFields"
        :supports-avatar-upload="supportsAvatarUpload"
        :background-support-hint="backgroundSupportHint"
        :background-transfer="backgroundTransfer"
        :avatar-transfer="avatarTransfer"
        :pick-favicon-image-file="pickFaviconImageFile"
        :pick-background-image-file="pickBackgroundImageFile"
        :pick-avatar-image-file="pickAvatarImageFile"
        :upload-local-favicon="uploadLocalFavicon"
        :apply-local-background-image="applyLocalBackgroundImage"
        :apply-local-avatar-image="applyLocalAvatarImage"
      />

      <section
        class="panel page-section theme-studio-section"
        data-theme-zone="reading-rhythm"
      >
        <div class="theme-studio-heading">
          <div class="theme-studio-heading-copy">
            <p class="section-eyebrow">Step 03 · 阅读节奏微调</p>
            <h2>只在需要时微调正文阅读感</h2>
            <p class="section-helper">
              阅读体验排在品牌和素材之后，确保页面调性先稳定，再处理正文的可读性细节。
            </p>
          </div>
        </div>

        <div class="theme-studio-note theme-studio-note--quiet">
          <p class="section-eyebrow">阅读节奏微调</p>
          <strong>建议先用默认值，只有感觉阅读吃力时再微调字体与字号。</strong>
          <p class="section-helper">
            这一区负责“读起来舒服”，不负责替代前面的品牌决策。
          </p>
        </div>

        <div class="theme-studio-reading-grid">
          <article class="priority-panel theme-studio-card">
            <p class="section-eyebrow">正文排版</p>
            <h3>阅读体验</h3>
            <div class="grid-2">
              <div>
                <label>正文字体</label>
                <input
                  v-model="basicFields.bodyFontFamily"
                  placeholder="例如 'Noto Serif SC'"
                />
              </div>
              <div>
                <label>正文字号(px)</label>
                <input v-model="basicFields.bodyFontSize" />
              </div>
            </div>
          </article>

          <article class="priority-panel priority-panel--support theme-studio-card">
            <p class="section-eyebrow">调节建议</p>
            <h3>先看内容，再动参数</h3>
            <ul class="page-guidance-list theme-studio-guidance-list">
              <li>正文太密或太挤时，再尝试调大字号。</li>
              <li>如果品牌已经偏安静，优先选择更稳定的衬线或无衬线字体。</li>
              <li>微调后立刻去预览页确认真实阅读感。</li>
            </ul>
          </article>
        </div>
      </section>
    </div>

    <div class="page-layer" data-page-layer="explanation">
      <section
        class="panel page-section theme-studio-section theme-studio-section--quiet"
        data-theme-zone="theme-quiet-controls"
      >
        <div class="theme-studio-heading">
          <div class="theme-studio-heading-copy">
            <p class="section-eyebrow">Step 04 · 主题细节（可选，后置）</p>
            <h2>博客跑通后，再补评论、统计与 RSS</h2>
            <p class="section-helper">
              下面这些属于“博客已经能跑之后再加”的能力。你可以先跳过，后面再回来补。
            </p>
          </div>
        </div>

        <div class="theme-studio-note theme-studio-note--quiet">
          <p class="section-eyebrow">后置控制</p>
          <strong>评论、统计和 RSS 很重要，但不该压过品牌与素材编辑节奏。</strong>
          <p class="section-helper">
            这一区保持安静、次级，只在前面几步已经稳定后再启用。
          </p>
        </div>

        <div class="theme-studio-quiet-grid">
          <article class="priority-panel priority-panel--subtle theme-studio-card">
            <p class="section-eyebrow">评论系统</p>
            <h3>Giscus</h3>
            <p class="muted">Giscus 需要你先按教程完成仓库 Discussion 配置。</p>
            <div class="grid-2">
              <div>
                <label>启用 Giscus</label>
                <select v-model="giscusFields.enabled">
                  <option :value="true">true</option>
                  <option :value="false">false</option>
                </select>
              </div>
              <div>
                <label>repo (owner/repo)</label><input v-model="giscusFields.repo" />
              </div>
              <div><label>repoId</label><input v-model="giscusFields.repoId" /></div>
              <div>
                <label>category</label><input v-model="giscusFields.category" />
              </div>
              <div>
                <label>categoryId</label><input v-model="giscusFields.categoryId" />
              </div>
              <div>
                <label>mapping</label><input v-model="giscusFields.mapping" />
              </div>
            </div>
          </article>

          <article class="priority-panel priority-panel--subtle theme-studio-card">
            <p class="section-eyebrow">访客统计</p>
            <h3>Analytics</h3>
            <p class="muted">
              默认方案是“不蒜子”，无需额外注册即可显示浏览量；广告拦截插件可能影响统计脚本加载。
            </p>
            <div class="grid-2">
              <div>
                <label>启用不蒜子统计</label>
                <select v-model="analyticsFields.busuanzi">
                  <option :value="true">true</option>
                  <option :value="false">false</option>
                </select>
              </div>
              <div>
                <label>Umami Script URL</label>
                <input v-model="analyticsFields.umamiScriptUrl" />
              </div>
              <div>
                <label>Umami Website ID</label>
                <input v-model="analyticsFields.umamiWebsiteId" />
              </div>
              <div>
                <label>GA Measurement ID</label>
                <input v-model="analyticsFields.gaMeasurementId" />
              </div>
            </div>
          </article>

          <article class="priority-panel priority-panel--subtle theme-studio-card">
            <p class="section-eyebrow">订阅输出</p>
            <h3>RSS 生成与自动更新</h3>
            <p class="muted">
              你可以控制是否生成博客 RSS 链接，并决定软件是否自动轮询订阅更新。
            </p>
            <div class="grid-2">
              <div>
                <label>生成博客 RSS 链接</label>
                <select v-model="rssFields.generateBlogRss">
                  <option :value="true">true</option>
                  <option :value="false">false</option>
                </select>
              </div>
              <div>
                <label>软件自动更新 RSS 订阅</label>
                <select v-model="rssFields.autoSyncRssSubscriptions">
                  <option :value="true">true</option>
                  <option :value="false">false</option>
                </select>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="priority-panel priority-panel--support theme-studio-save-panel">
        <p class="section-eyebrow">保存与确认</p>
        <strong>完成品牌与外观后，先保存，再去本地预览确认真实呈现。</strong>
        <div class="actions">
          <button class="primary" @click="saveAllConfig">保存全部配置</button>
        </div>
        <p class="page-result-note">
          {{ status || "保存后建议立刻去本地预览，确认外观变更已真实生效。" }}
        </p>
      </section>
    </div>

    <div class="page-layer" data-page-layer="detail">
      <ThemeAdvancedConfigSection
        data-theme-zone="advanced-config"
        :selected-theme-schema="selectedThemeSchema"
        :option-values="optionValues"
        :all-config-entries="allConfigEntries"
      />
    </div>
  </div>
</template>
