<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { workspaceState, refreshThemeCatalog, refreshWorkspaces, getSelectedWorkspace } from '../stores/workspaceStore';

const rawConfig = ref('{}');
const status = ref('');
const selectedThemeId = ref('');

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

async function loadConfig() {
    const ws = selectedWorkspace.value;
    if (!ws) {
        return;
    }
    const config = await window.bfeApi.getThemeConfig({ projectDir: ws.projectDir, framework: ws.framework });
    rawConfig.value = JSON.stringify(config, null, 2);
}

async function saveConfigBySchema() {
    const ws = selectedWorkspace.value;
    const schema = selectedThemeSchema.value;
    if (!ws || !schema) {
        return;
    }

    const nextConfig = JSON.parse(rawConfig.value || '{}');
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

    await window.bfeApi.saveThemeConfig({
        projectDir: ws.projectDir,
        framework: ws.framework,
        nextConfig
    });

    status.value = '配置已保存。';
    rawConfig.value = JSON.stringify(nextConfig, null, 2);
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
    </section>

    <section class="panel">
        <h2>高级配置（完整 JSON 编辑）</h2>
        <textarea v-model="rawConfig"></textarea>
        <div class="actions">
            <button class="secondary" @click="loadConfig">重新加载</button>
            <button class="primary" @click="saveRawConfig">保存高级配置</button>
        </div>
        <p class="muted">{{ status }}</p>
    </section>
</template>
