<script setup>
import { reactive, ref, onMounted } from 'vue';
import { getSelectedWorkspace, workspaceState, refreshWorkspaces } from '../stores/workspaceStore';

const publishForm = reactive({
    repoUrl: '',
    useActions: true
});

const backupForm = reactive({
    backupDir: '',
    backupRepoUrl: '',
    visibility: 'private'
});

const logs = ref('');
const pagesUrl = ref('');

async function publish() {
    const ws = getSelectedWorkspace();
    if (!ws) {
        logs.value = '请先在其他页面选择或创建工程。';
        return;
    }

    try {
        const result = await window.bfeApi.publishToGitHub({
            projectDir: ws.projectDir,
            framework: ws.framework,
            repoUrl: publishForm.repoUrl,
            useActions: publishForm.useActions
        });

        pagesUrl.value = result.pagesUrl || '';
        logs.value = JSON.stringify(result.logs || result, null, 2);
    } catch (error) {
        logs.value = `发布失败：${String(error?.message || error)}`;
    }
}

function openPagesUrl() {
    if (!pagesUrl.value) {
        return;
    }
    window.open(pagesUrl.value, '_blank');
}

async function backup() {
    const ws = getSelectedWorkspace();
    if (!ws) {
        logs.value = '请先在其他页面选择或创建工程。';
        return;
    }

    try {
        const result = await window.bfeApi.backupWorkspace({
            projectDir: ws.projectDir,
            backupDir: backupForm.backupDir,
            repoUrl: backupForm.backupRepoUrl,
            visibility: backupForm.visibility
        });

        logs.value = JSON.stringify(result, null, 2);
    } catch (error) {
        logs.value = `备份失败：${String(error?.message || error)}`;
    }
}

onMounted(async () => {
    await refreshWorkspaces();
});

function goTutorialCenter() {
    window.dispatchEvent(new CustomEvent('bfe:open-tutorial'));
}
</script>

<template>
    <section class="panel">
        <h2>发布到 GitHub Pages</h2>
        <p class="muted">默认使用 GitHub Actions 工作流部署，填写仓库地址后一键发布。</p>
        <p><a href="#" @click.prevent="goTutorialCenter">不知道仓库地址怎么填？打开教程中心（发布与访问地址）</a></p>

        <div class="grid-2">
            <div>
                <label>当前工程</label>
                <select v-model="workspaceState.selectedWorkspaceId">
                    <option value="">请选择</option>
                    <option v-for="ws in workspaceState.workspaces" :key="ws.id" :value="ws.id">{{ ws.name }}</option>
                </select>
            </div>
            <div>
                <label>GitHub 仓库地址</label>
                <input v-model="publishForm.repoUrl" placeholder="https://github.com/you/your-blog.git" />
            </div>
        </div>

        <div class="actions">
            <button class="primary" @click="publish">一键发布</button>
        </div>
        <div v-if="pagesUrl" class="panel" style="margin-top: 12px;">
            <h2>博客访问地址</h2>
            <p class="muted">{{ pagesUrl }}</p>
            <div class="actions">
                <button class="secondary" @click="openPagesUrl">打开博客地址</button>
            </div>
        </div>
    </section>

    <section class="panel">
        <h2>备份到底层仓库</h2>
        <p class="muted">将本地博客工程打包到快照目录，可选推送到另一个 GitHub 仓库用于换设备恢复。</p>

        <div class="grid-2">
            <div>
                <label>本地备份目录</label>
                <input v-model="backupForm.backupDir" placeholder="例如 D:/blog-backups" />
            </div>
            <div>
                <label>备份仓库地址（可选）</label>
                <input v-model="backupForm.backupRepoUrl" placeholder="https://github.com/you/blog-backup.git" />
            </div>
            <div>
                <label>备份仓库可见性</label>
                <select v-model="backupForm.visibility">
                    <option value="private">private</option>
                    <option value="public">public</option>
                </select>
            </div>
        </div>

        <div class="actions">
            <button class="secondary" @click="backup">生成并推送备份</button>
        </div>
    </section>

    <section class="panel" v-if="logs">
        <h2>执行结果</h2>
        <pre>{{ logs }}</pre>
    </section>
</template>
