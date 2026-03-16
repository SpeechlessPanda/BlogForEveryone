<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { workspaceState, refreshThemeCatalog, refreshWorkspaces, getSelectedWorkspace } from '../stores/workspaceStore';

const status = ref('');
const selectedThemeId = ref('');
const allConfigEntries = ref([]);

const basicFields = reactive({
    siteTitle: '',
    subtitle: '',
    email: '',
    github: '',
    backgroundImage: '',
    favicon: '',
    bodyFontFamily: '',
    bodyFontSize: '18'
});

const giscusFields = reactive({
    enabled: true,
    repo: '',
    repoId: '',
    category: '',
    categoryId: '',
    mapping: 'pathname',
    theme: 'light'
});

const analyticsFields = reactive({
    busuanzi: true,
    umamiScriptUrl: '',
    umamiWebsiteId: '',
    gaMeasurementId: ''
});

const backgroundTransfer = reactive({
    localFilePath: '',
    preferredDir: '',
    preferredFileName: ''
});

const faviconUploadPath = ref('');

const selectedWorkspace = computed(() => getSelectedWorkspace());

const selectedThemeSchema = computed(() => {
    const ws = selectedWorkspace.value;
    if (!ws || !workspaceState.themeCatalog) {
        return null;
    }
    const list = workspaceState.themeCatalog[ws.framework] || [];
    return list.find((item) => item.id === selectedThemeId.value) || null;
});

const optionValues = reactive({});

function goTutorialCenter() {
    window.dispatchEvent(new CustomEvent('bfe:open-tutorial'));
}

function getDefaultAssetDir(framework) {
    return framework === 'hexo' ? 'source/img' : 'static/img';
}

function deriveFileNameFromPath(value) {
    if (!value) {
        return '';
    }
    const cleaned = String(value).trim().split('?')[0].split('#')[0];
    const segments = cleaned.split('/').filter(Boolean);
    return segments.length ? segments[segments.length - 1] : '';
}

function setByPath(target, path, value) {
    const keys = path.split('.');
    let pointer = target;
    for (let i = 0; i < keys.length - 1; i += 1) {
        const key = keys[i];
        if (typeof pointer[key] !== 'object' || pointer[key] === null) {
            pointer[key] = {};
        }
        pointer = pointer[key];
    }
    pointer[keys[keys.length - 1]] = value;
}

function getByPath(source, path) {
    const keys = path.split('.');
    let pointer = source;
    for (const key of keys) {
        if (pointer == null || typeof pointer !== 'object') {
            return undefined;
        }
        pointer = pointer[key];
    }
    return pointer;
}

function flattenObject(obj, parent = '') {
    const entries = [];
    if (!obj || typeof obj !== 'object') {
        return entries;
    }
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = parent ? `${parent}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            entries.push(...flattenObject(value, fullKey));
        } else {
            entries.push({
                key: fullKey,
                value: Array.isArray(value) ? JSON.stringify(value) : String(value ?? '')
            });
        }
    }
    return entries;
}

function parseInputValue(value) {
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    if (/^\d+(\.\d+)?$/.test(value)) {
        return Number(value);
    }
    if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
}

function applyPersonalization(config, framework) {
    config.title = basicFields.siteTitle || config.title;

    if (framework === 'hexo') {
        config.subtitle = basicFields.subtitle || config.subtitle;
        setByPath(config, 'theme_config.background_image', basicFields.backgroundImage || getByPath(config, 'theme_config.background_image') || '');
        config.favicon = basicFields.favicon || config.favicon;
        setByPath(config, 'author.email', basicFields.email);
        setByPath(config, 'theme_config.social.github', basicFields.github);

        setByPath(config, 'theme_config.comments.use', giscusFields.enabled ? 'giscus' : 'none');
        setByPath(config, 'theme_config.comments.giscus.repo', giscusFields.repo);
        setByPath(config, 'theme_config.comments.giscus.repoId', giscusFields.repoId);
        setByPath(config, 'theme_config.comments.giscus.category', giscusFields.category);
        setByPath(config, 'theme_config.comments.giscus.categoryId', giscusFields.categoryId);
        setByPath(config, 'theme_config.comments.giscus.mapping', giscusFields.mapping);
        setByPath(config, 'theme_config.comments.giscus.theme', giscusFields.theme);

        setByPath(config, 'theme_config.post_font.family', basicFields.bodyFontFamily);
        setByPath(config, 'theme_config.post_font.size', `${basicFields.bodyFontSize}px`);

        setByPath(config, 'theme_config.analytics.busuanzi.enable', analyticsFields.busuanzi);
        setByPath(config, 'theme_config.analytics.umami.script', analyticsFields.umamiScriptUrl);
        setByPath(config, 'theme_config.analytics.umami.website_id', analyticsFields.umamiWebsiteId);
        setByPath(config, 'theme_config.analytics.ga.measurement_id', analyticsFields.gaMeasurementId);
    } else {
        setByPath(config, 'params.description', basicFields.subtitle);
        setByPath(config, 'params.backgroundImage', basicFields.backgroundImage);
        setByPath(config, 'params.favicon', basicFields.favicon);
        setByPath(config, 'params.social.email', basicFields.email);
        setByPath(config, 'params.social.github', basicFields.github);

        setByPath(config, 'params.comments.giscus.enable', giscusFields.enabled);
        setByPath(config, 'params.comments.giscus.repo', giscusFields.repo);
        setByPath(config, 'params.comments.giscus.repoId', giscusFields.repoId);
        setByPath(config, 'params.comments.giscus.category', giscusFields.category);
        setByPath(config, 'params.comments.giscus.categoryId', giscusFields.categoryId);
        setByPath(config, 'params.comments.giscus.mapping', giscusFields.mapping);
        setByPath(config, 'params.comments.giscus.theme', giscusFields.theme);

        setByPath(config, 'params.postFont.family', basicFields.bodyFontFamily);
        setByPath(config, 'params.postFont.size', `${basicFields.bodyFontSize}px`);

        setByPath(config, 'params.analytics.busuanzi.enable', analyticsFields.busuanzi);
        setByPath(config, 'params.analytics.umami.script', analyticsFields.umamiScriptUrl);
        setByPath(config, 'params.analytics.umami.website_id', analyticsFields.umamiWebsiteId);
        setByPath(config, 'params.analytics.ga.measurement_id', analyticsFields.gaMeasurementId);
    }
}

async function loadConfig() {
    const ws = selectedWorkspace.value;
    if (!ws) {
        return;
    }
    const config = await window.bfeApi.getThemeConfig({ projectDir: ws.projectDir, framework: ws.framework });
    allConfigEntries.value = flattenObject(config);

    basicFields.siteTitle = String(config.title || '');
    basicFields.subtitle = String(config.subtitle || getByPath(config, 'params.description') || '');
    basicFields.email = String(getByPath(config, 'author.email') || getByPath(config, 'params.social.email') || '');
    basicFields.github = String(getByPath(config, 'theme_config.social.github') || getByPath(config, 'params.social.github') || '');
    basicFields.backgroundImage = String(getByPath(config, 'theme_config.background_image') || getByPath(config, 'params.backgroundImage') || '');
    basicFields.favicon = String(config.favicon || getByPath(config, 'params.favicon') || '');
    basicFields.bodyFontFamily = String(getByPath(config, 'theme_config.post_font.family') || getByPath(config, 'params.postFont.family') || '');
    basicFields.bodyFontSize = String(
        (getByPath(config, 'theme_config.post_font.size') || getByPath(config, 'params.postFont.size') || '18').toString().replace('px', '')
    );

    backgroundTransfer.preferredDir = backgroundTransfer.preferredDir || getDefaultAssetDir(ws.framework);
    backgroundTransfer.preferredFileName = deriveFileNameFromPath(basicFields.backgroundImage);

    giscusFields.enabled = Boolean(getByPath(config, 'theme_config.comments.use') === 'giscus' || getByPath(config, 'params.comments.giscus.enable'));
    giscusFields.repo = String(getByPath(config, 'theme_config.comments.giscus.repo') || getByPath(config, 'params.comments.giscus.repo') || '');
    giscusFields.repoId = String(getByPath(config, 'theme_config.comments.giscus.repoId') || getByPath(config, 'params.comments.giscus.repoId') || '');
    giscusFields.category = String(getByPath(config, 'theme_config.comments.giscus.category') || getByPath(config, 'params.comments.giscus.category') || '');
    giscusFields.categoryId = String(getByPath(config, 'theme_config.comments.giscus.categoryId') || getByPath(config, 'params.comments.giscus.categoryId') || '');
    giscusFields.mapping = String(getByPath(config, 'theme_config.comments.giscus.mapping') || getByPath(config, 'params.comments.giscus.mapping') || 'pathname');
    giscusFields.theme = String(getByPath(config, 'theme_config.comments.giscus.theme') || getByPath(config, 'params.comments.giscus.theme') || 'light');

    analyticsFields.busuanzi = Boolean(getByPath(config, 'theme_config.analytics.busuanzi.enable') ?? getByPath(config, 'params.analytics.busuanzi.enable') ?? true);
    analyticsFields.umamiScriptUrl = String(getByPath(config, 'theme_config.analytics.umami.script') || getByPath(config, 'params.analytics.umami.script') || '');
    analyticsFields.umamiWebsiteId = String(getByPath(config, 'theme_config.analytics.umami.website_id') || getByPath(config, 'params.analytics.umami.website_id') || '');
    analyticsFields.gaMeasurementId = String(getByPath(config, 'theme_config.analytics.ga.measurement_id') || getByPath(config, 'params.analytics.ga.measurement_id') || '');
}

async function saveAllConfig() {
    const ws = selectedWorkspace.value;
    if (!ws) {
        return;
    }
    const config = await window.bfeApi.getThemeConfig({ projectDir: ws.projectDir, framework: ws.framework });

    for (const option of selectedThemeSchema.value?.options || []) {
        let value = optionValues[option.key];
        if (option.type === 'boolean') {
            value = value === true || value === 'true';
        }
        if (option.type === 'array' && typeof value === 'string') {
            value = value.split(',').map((x) => x.trim()).filter(Boolean);
        }
        if (value === undefined || value === null || value === '') {
            value = option.default;
        }
        setByPath(config, option.key, value);
    }

    applyPersonalization(config, ws.framework);

    for (const item of allConfigEntries.value) {
        setByPath(config, item.key, parseInputValue(item.value));
    }

    await window.bfeApi.saveThemeConfig({
        projectDir: ws.projectDir,
        framework: ws.framework,
        nextConfig: config
    });

    status.value = '主题配置已保存。';
    allConfigEntries.value = flattenObject(config);
}

async function applyLocalBackgroundImage() {
    const ws = selectedWorkspace.value;
    if (!ws) {
        status.value = '请先选择工程。';
        return;
    }
    if (!backgroundTransfer.localFilePath) {
        status.value = '请先填写背景图本地路径。';
        return;
    }

    const result = await window.bfeApi.saveThemeLocalAsset({
        projectDir: ws.projectDir,
        framework: ws.framework,
        localFilePath: backgroundTransfer.localFilePath,
        assetType: 'background',
        preferredDir: backgroundTransfer.preferredDir || getDefaultAssetDir(ws.framework),
        preferredFileName: backgroundTransfer.preferredFileName || deriveFileNameFromPath(basicFields.backgroundImage)
    });

    basicFields.backgroundImage = result.webPath;
    backgroundTransfer.preferredFileName = deriveFileNameFromPath(result.webPath);
    status.value = `背景图已转存并应用：${result.webPath}`;
}

async function uploadLocalFavicon() {
    const ws = selectedWorkspace.value;
    if (!ws) {
        status.value = '请先选择工程。';
        return;
    }
    const result = await window.bfeApi.saveThemeLocalAsset({
        projectDir: ws.projectDir,
        framework: ws.framework,
        localFilePath: faviconUploadPath.value,
        assetType: 'favicon',
        preferredDir: backgroundTransfer.preferredDir || getDefaultAssetDir(ws.framework),
        preferredFileName: 'favicon'
    });
    basicFields.favicon = result.webPath;
    status.value = `图标已保存到博客目录：${result.webPath}`;
}

onMounted(async () => {
    await refreshThemeCatalog();
    await refreshWorkspaces();
    const ws = selectedWorkspace.value;
    if (ws) {
        selectedThemeId.value = ws.theme || '';
        await loadConfig();
    }
});
</script>

<template>
    <section class="panel">
        <h2>主题配置（全可视化）</h2>
        <p class="muted">不需要编辑 JSON。若不确定参数，请先阅读教程中心。</p>
        <p><a href="#" @click.prevent="goTutorialCenter">打开教程中心：主题个性化完整指南</a></p>

        <div class="grid-2">
            <div>
                <label>选择工程</label>
                <select v-model="workspaceState.selectedWorkspaceId" @change="loadConfig">
                    <option value="">请选择</option>
                    <option v-for="ws in workspaceState.workspaces" :key="ws.id" :value="ws.id">{{ ws.name }}</option>
                </select>
            </div>
            <div>
                <label>主题</label>
                <select v-model="selectedThemeId">
                    <option value="">请选择</option>
                    <option v-for="item in (workspaceState.themeCatalog?.[selectedWorkspace?.framework] || [])"
                        :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
            </div>
        </div>

        <div class="panel" style="margin-top:12px;">
            <h2>基础信息</h2>
            <div class="grid-2">
                <div><label>博客标题</label><input v-model="basicFields.siteTitle" /></div>
                <div><label>博客副标题</label><input v-model="basicFields.subtitle" /></div>
                <div><label>邮箱</label><input v-model="basicFields.email" placeholder="name@example.com" /></div>
                <div><label>GitHub 主页链接</label><input v-model="basicFields.github"
                        placeholder="https://github.com/yourname" /></div>
            </div>
        </div>

        <div class="panel" style="margin-top:12px;">
            <h2>背景与图标</h2>
            <p class="muted">不走图床。填写本地图片路径后，软件会自动复制到工程的图片目录（默认 `img`）并回填 URL。</p>
            <div class="grid-2">
                <div><label>背景图 URL</label><input v-model="basicFields.backgroundImage" /></div>
                <div><label>博客图标 URL (favicon)</label><input v-model="basicFields.favicon" /></div>
                <div><label>本地图标路径（自动保存到博客文件夹）</label><input v-model="faviconUploadPath"
                        placeholder="例如 D:/images/favicon.png" /></div>
                <div class="actions"><button class="secondary" @click="uploadLocalFavicon">上传并应用博客图标</button></div>
            </div>
            <div class="grid-2" style="margin-top:8px;">
                <div><label>本地背景图路径</label><input v-model="backgroundTransfer.localFilePath"
                        placeholder="例如 D:/images/hero.jpg" /></div>
                <div><label>工程内图片目录</label><input v-model="backgroundTransfer.preferredDir"
                        placeholder="默认 source/img 或 static/img" /></div>
                <div><label>背景图文件名（可选）</label><input v-model="backgroundTransfer.preferredFileName"
                        placeholder="例如 home-bg.jpg" /></div>
            </div>
            <div class="actions"><button class="secondary" @click="applyLocalBackgroundImage">转存并应用背景图</button></div>
        </div>

        <div class="panel" style="margin-top:12px;">
            <h2>正文排版（仅正文区域）</h2>
            <div class="grid-2">
                <div><label>正文字体</label><input v-model="basicFields.bodyFontFamily" placeholder="例如 'Noto Serif SC'" />
                </div>
                <div><label>正文字号(px)</label><input v-model="basicFields.bodyFontSize" /></div>
            </div>
        </div>

        <div class="panel" style="margin-top:12px;">
            <h2>评论系统（Giscus）</h2>
            <p class="muted">Giscus 需要你先按教程完成仓库 Discussion 配置。</p>
            <div class="grid-2">
                <div><label>启用 Giscus</label><select v-model="giscusFields.enabled">
                        <option :value="true">true</option>
                        <option :value="false">false</option>
                    </select></div>
                <div><label>repo (owner/repo)</label><input v-model="giscusFields.repo" /></div>
                <div><label>repoId</label><input v-model="giscusFields.repoId" /></div>
                <div><label>category</label><input v-model="giscusFields.category" /></div>
                <div><label>categoryId</label><input v-model="giscusFields.categoryId" /></div>
                <div><label>mapping</label><input v-model="giscusFields.mapping" /></div>
            </div>
        </div>

        <div class="panel" style="margin-top:12px;">
            <h2>访客统计</h2>
            <p class="muted">默认方案是“不蒜子”，无需额外注册即可显示浏览量；广告拦截插件可能影响统计脚本加载。</p>
            <div class="grid-2">
                <div><label>启用不蒜子统计</label><select v-model="analyticsFields.busuanzi">
                        <option :value="true">true</option>
                        <option :value="false">false</option>
                    </select></div>
                <div><label>Umami Script URL</label><input v-model="analyticsFields.umamiScriptUrl" /></div>
                <div><label>Umami Website ID</label><input v-model="analyticsFields.umamiWebsiteId" /></div>
                <div><label>GA Measurement ID</label><input v-model="analyticsFields.gaMeasurementId" /></div>
            </div>
        </div>

        <div v-if="selectedThemeSchema" class="panel" style="margin-top:12px;">
            <h2>主题专属配置项</h2>
            <div class="grid-2">
                <div v-for="opt in selectedThemeSchema.options" :key="opt.key">
                    <label>{{ opt.label }} ({{ opt.key }})</label>
                    <select v-if="opt.type === 'enum'" v-model="optionValues[opt.key]">
                        <option v-for="v in opt.enumValues" :key="v" :value="v">{{ v }}</option>
                    </select>
                    <select v-else-if="opt.type === 'boolean'" v-model="optionValues[opt.key]">
                        <option value="true">true</option>
                        <option value="false">false</option>
                    </select>
                    <input v-else-if="opt.type === 'array'" v-model="optionValues[opt.key]"
                        :placeholder="(opt.default || []).join(',')" />
                    <input v-else v-model="optionValues[opt.key]" :placeholder="String(opt.default || '')" />
                </div>
            </div>
        </div>

        <div class="panel" style="margin-top:12px;">
            <h2>全部配置项（自动展开）</h2>
            <div class="grid-2">
                <div v-for="item in allConfigEntries" :key="item.key">
                    <label>{{ item.key }}</label>
                    <input v-model="item.value" />
                </div>
            </div>
        </div>

        <div class="actions">
            <button class="primary" @click="saveAllConfig">保存全部配置</button>
        </div>
        <p class="muted">{{ status }}</p>
    </section>
</template>
