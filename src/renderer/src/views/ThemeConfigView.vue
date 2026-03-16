<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { workspaceState, refreshThemeCatalog, refreshWorkspaces, getSelectedWorkspace } from '../stores/workspaceStore';

const rawConfig = ref('{}');
const status = ref('');
const selectedThemeId = ref('');
const showAdvanced = ref(false);
const allConfigEntries = ref([]);

const basicFields = reactive({
    siteTitle: '',
    subtitle: '',
    backgroundImage: ''
});

const imageUpload = reactive({
    localFilePath: '',
    owner: '',
    repo: '',
    branch: 'main',
    targetDir: 'assets/images'
});

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

function applyBasicFields(config, framework) {
    if (framework === 'hexo') {
        if (basicFields.siteTitle) {
            config.title = basicFields.siteTitle;
        }
        if (basicFields.subtitle) {
            config.subtitle = basicFields.subtitle;
        }
        if (basicFields.backgroundImage) {
            setByPath(config, 'theme_config.background_image', basicFields.backgroundImage);
        }
    } else if (framework === 'hugo') {
        if (basicFields.siteTitle) {
            config.title = basicFields.siteTitle;
        }
        if (basicFields.subtitle) {
            setByPath(config, 'params.description', basicFields.subtitle);
        }
        if (basicFields.backgroundImage) {
            setByPath(config, 'params.backgroundImage', basicFields.backgroundImage);
        }
    }
}

async function loadConfig() {
    const ws = selectedWorkspace.value;
    if (!ws) {
        return;
    }
    const config = await window.bfeApi.getThemeConfig({ projectDir: ws.projectDir, framework: ws.framework });
    rawConfig.value = JSON.stringify(config, null, 2);
    allConfigEntries.value = flattenObject(config);
    basicFields.siteTitle = String(config.title || '');
    basicFields.subtitle = String(config.subtitle || getByPath(config, 'params.description') || '');
    basicFields.backgroundImage = String(
        getByPath(config, 'theme_config.background_image') || getByPath(config, 'params.backgroundImage') || ''
    );
}

async function saveConfigBySchema() {
    const ws = selectedWorkspace.value;
    const schema = selectedThemeSchema.value;
    if (!ws || !schema) {
        return;
    }

    const nextConfig = JSON.parse(rawConfig.value || '{}');
    applyBasicFields(nextConfig, ws.framework);
    for (const option of schema.options) {
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
        setByPath(nextConfig, option.key, value);
    }

    for (const item of allConfigEntries.value) {
        setByPath(nextConfig, item.key, parseInputValue(item.value));
    }

    await window.bfeApi.saveThemeConfig({
        projectDir: ws.projectDir,
        framework: ws.framework,
        nextConfig
    });

    status.value = '配置已保存。';
    rawConfig.value = JSON.stringify(nextConfig, null, 2);
    allConfigEntries.value = flattenObject(nextConfig);
}

async function uploadBackgroundToGithub() {
    const result = await window.bfeApi.uploadThemeImageToGithub({
        owner: imageUpload.owner,
        repo: imageUpload.repo,
        branch: imageUpload.branch,
        targetDir: imageUpload.targetDir,
        localFilePath: imageUpload.localFilePath
    });
    basicFields.backgroundImage = result.cdnUrl;
    status.value = `背景图已上传：${result.cdnUrl}`;
}

async function saveRawConfig() {
    const ws = selectedWorkspace.value;
    if (!ws) {
        return;
    }

    await window.bfeApi.saveThemeConfig({
        projectDir: ws.projectDir,
        framework: ws.framework,
        nextConfig: JSON.parse(rawConfig.value)
    });

    status.value = '高级配置已保存。';
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
    <section class="panel tutorial-note">
        <h2>操作教程：主题配置</h2>
        <ol>
            <li>先选择工程与主题。</li>
            <li>优先在“通用配置 + 配置项 + 全量配置项”三个可视化区域修改。</li>
            <li>需要背景图时，先上传到 GitHub 图床并自动回填 URL。</li>
            <li>高级 JSON 只在特殊场景使用。</li>
        </ol>
    </section>

    <section class="panel">
        <h2>主题配置（可视化）</h2>
        <p class="muted">你可以先选择工程，再显示该主题可配置项。未覆盖字段可在高级配置中编辑。</p>

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
                        :key="item.id" :value="item.id">
                        {{ item.name }}
                    </option>
                </select>
            </div>
        </div>

        <div class="panel" style="margin-top: 12px;">
            <h2>通用配置（推荐）</h2>
            <div class="grid-2">
                <div>
                    <label>博客标题</label>
                    <input v-model="basicFields.siteTitle" placeholder="例如 我的博客" />
                </div>
                <div>
                    <label>博客副标题</label>
                    <input v-model="basicFields.subtitle" placeholder="例如 记录学习与生活" />
                </div>
                <div>
                    <label>背景图 URL</label>
                    <input v-model="basicFields.backgroundImage" placeholder="https://..." />
                </div>
            </div>
        </div>

        <div class="panel" style="margin-top: 12px;">
            <h2>背景图上传（GitHub 图床）</h2>
            <div class="grid-2">
                <div>
                    <label>本地图片路径</label>
                    <input v-model="imageUpload.localFilePath" placeholder="例如 D:/images/bg.jpg" />
                </div>
                <div>
                    <label>GitHub Owner</label>
                    <input v-model="imageUpload.owner" placeholder="例如 SpeechlessPanda" />
                </div>
                <div>
                    <label>GitHub Repo</label>
                    <input v-model="imageUpload.repo" placeholder="例如 blog-assets" />
                </div>
                <div>
                    <label>分支</label>
                    <input v-model="imageUpload.branch" placeholder="main" />
                </div>
                <div>
                    <label>目标目录</label>
                    <input v-model="imageUpload.targetDir" placeholder="assets/images" />
                </div>
            </div>
            <div class="actions">
                <button class="secondary" @click="uploadBackgroundToGithub">上传并回填背景图 URL</button>
            </div>
        </div>

        <div v-if="selectedThemeSchema" class="panel" style="margin-top: 12px;">
            <h2>配置项</h2>
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

            <div class="actions">
                <button class="primary" @click="saveConfigBySchema">保存可视化配置</button>
            </div>
        </div>

        <div class="panel" style="margin-top: 12px;">
            <h2>全量配置项（无需 JSON）</h2>
            <p class="muted">这里会显示当前配置文件里的全部叶子字段。你修改后点击“保存可视化配置”即可写回。</p>
            <div class="grid-2">
                <div v-for="item in allConfigEntries" :key="item.key">
                    <label>{{ item.key }}</label>
                    <input v-model="item.value" />
                </div>
            </div>
        </div>
    </section>

    <section class="panel" v-if="showAdvanced">
        <h2>高级配置（完整 JSON 编辑）</h2>
        <textarea v-model="rawConfig"></textarea>
        <div class="actions">
            <button class="secondary" @click="loadConfig">重新加载</button>
            <button class="primary" @click="saveRawConfig">保存高级配置</button>
        </div>
        <p class="muted">{{ status }}</p>
    </section>

    <section class="panel">
        <div class="actions">
            <button class="secondary" @click="showAdvanced = !showAdvanced">{{ showAdvanced ? '隐藏高级 JSON 配置' : '显示高级
                JSON 配置' }}</button>
        </div>
        <p class="muted">{{ status }}</p>
    </section>
</template>
