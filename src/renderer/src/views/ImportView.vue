<script setup>
import { reactive, ref } from 'vue';
import { refreshWorkspaces } from '../stores/workspaceStore';

const form = reactive({
    name: '',
    projectDir: ''
});

const result = ref('');

async function doImport() {
    const data = await window.bfeApi.importWorkspace({ ...form });
    result.value = JSON.stringify(data, null, 2);
    await refreshWorkspaces();
}

async function restoreRssFromProject() {
    const data = await window.bfeApi.importSubscriptions({
        projectDir: form.projectDir,
        strategy: 'merge'
    });
    result.value = JSON.stringify(data, null, 2);
}
</script>

<template>
    <section class="panel tutorial-note">
        <h2>操作教程：导入与恢复</h2>
        <ol>
            <li>填写已有博客目录，点击“导入工程”。</li>
            <li>若目录内有 .bfe 订阅文件，可点“恢复 RSS 订阅”。</li>
        </ol>
    </section>

    <section class="panel">
        <h2>导入已有博客工程</h2>
        <p class="muted">支持导入已有目录后继续可视化编辑与发布。</p>

        <div class="grid-2">
            <div>
                <label>显示名称</label>
                <input v-model="form.name" placeholder="例如 我的旧博客" />
            </div>
            <div>
                <label>工程目录</label>
                <input v-model="form.projectDir" placeholder="例如 D:/old-blog" />
            </div>
        </div>

        <div class="actions">
            <button class="primary" @click="doImport">导入工程</button>
            <button class="secondary" @click="restoreRssFromProject">恢复 RSS 订阅</button>
        </div>
    </section>

    <section class="panel" v-if="result">
        <h2>导入结果</h2>
        <pre>{{ result }}</pre>
    </section>
</template>
