<script setup>
import { reactive, onMounted } from 'vue';
import { workspaceState, refreshWorkspaces, refreshThemeCatalog } from '../stores/workspaceStore';

const form = reactive({
    name: '',
    framework: 'hexo',
    theme: 'landscape',
    projectDir: ''
});

const logs = reactive({ output: '' });

async function handleCreateWorkspace() {
    const result = await window.bfeApi.createWorkspace({ ...form });
    logs.output = JSON.stringify(result.workspace, null, 2);
    await refreshWorkspaces();
}

async function handleInstallDeps() {
    if (!form.projectDir) {
        logs.output = '请先填写工程目录。';
        return;
    }
    const result = await window.bfeApi.installProjectDependencies({ projectDir: form.projectDir });
    logs.output = JSON.stringify(result, null, 2);
}

onMounted(async () => {
    await refreshThemeCatalog();
    await refreshWorkspaces();
});
</script>

<template>
    <section class="panel">
        <h2>新建博客工程</h2>
        <p class="muted">通过点击选择框架和主题，不需要写命令。依赖安装统一使用 pnpm，网络问题会自动换源重试。</p>

        <div class="grid-2">
            <div>
                <label>工程名称</label>
                <input v-model="form.name" placeholder="例如 my-first-blog" />
            </div>
            <div>
                <label>本地路径</label>
                <input v-model="form.projectDir" placeholder="例如 D:/blogs/my-first-blog" />
            </div>
            <div>
                <label>框架</label>
                <select v-model="form.framework">
                    <option value="hexo">Hexo</option>
                    <option value="hugo">Hugo</option>
                </select>
            </div>
            <div>
                <label>主题</label>
                <select v-model="form.theme">
                    <option v-for="item in (workspaceState.themeCatalog?.[form.framework] || [])" :key="item.id"
                        :value="item.id">
                        {{ item.name }}
                    </option>
                </select>
            </div>
        </div>

        <div class="actions">
            <button class="primary" @click="handleCreateWorkspace">创建工程</button>
            <button class="secondary" @click="handleInstallDeps">安装工程依赖（pnpm）</button>
        </div>
    </section>

    <section class="panel">
        <h2>已管理工程</h2>
        <div class="list" v-if="workspaceState.workspaces.length">
            <div class="list-item" v-for="ws in workspaceState.workspaces" :key="ws.id">
                <strong>{{ ws.name }}</strong>
                <div class="muted">{{ ws.framework }} | {{ ws.projectDir }}</div>
            </div>
        </div>
        <p class="muted" v-else>暂无工程。</p>
    </section>

    <section class="panel" v-if="logs.output">
        <h2>执行日志</h2>
        <pre>{{ logs.output }}</pre>
    </section>
</template>
