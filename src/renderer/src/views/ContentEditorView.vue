<script setup>
import { onMounted, reactive, ref } from 'vue';
import { getSelectedWorkspace, workspaceState, refreshWorkspaces } from '../stores/workspaceStore';

const form = reactive({
    type: 'post',
    title: '',
    slug: '',
    autoPublish: true,
    repoUrl: ''
});

const state = reactive({
    filePath: '',
    jobId: '',
    jobStatus: '',
    message: ''
});

function goTutorialCenter() {
    window.dispatchEvent(new CustomEvent('bfe:open-tutorial'));
}

async function createAndEdit() {
    const ws = getSelectedWorkspace();
    if (!ws) {
        state.message = '请先选择工程。';
        return;
    }

    try {
        const result = await window.bfeApi.createAndOpenContent({
            projectDir: ws.projectDir,
            framework: ws.framework,
            type: form.type,
            title: form.title,
            slug: form.slug
        });

        state.filePath = result.filePath;
        state.message = '已打开默认编辑器，请保存文件。';

        if (form.autoPublish && form.repoUrl) {
            const job = await window.bfeApi.watchAndAutoPublish({
                filePath: result.filePath,
                projectDir: ws.projectDir,
                framework: ws.framework,
                repoUrl: form.repoUrl
            });
            state.jobId = job.jobId;
            state.jobStatus = job.status;
        }
    } catch (error) {
        state.message = `创建内容失败：${String(error?.message || error)}`;
    }
}

async function refreshPublishJob() {
    if (!state.jobId) {
        return;
    }
    try {
        const job = await window.bfeApi.getPublishJobStatus({ jobId: state.jobId });
        if (!job) {
            state.message = '没有找到自动发布任务。';
            return;
        }
        state.jobStatus = job.status;
        state.message = job.message;
    } catch (error) {
        state.message = `刷新发布状态失败：${String(error?.message || error)}`;
    }
}

onMounted(async () => {
    await refreshWorkspaces();
});
</script>

<template>
    <section class="panel">
        <h2>内容编辑</h2>
        <p class="muted">新建博客/关于/友链/公告时，软件会自动创建 Markdown 并打开系统默认编辑器。</p>
        <p><a href="#" @click.prevent="goTutorialCenter">打开教程中心：内容编辑与自动发布完整步骤</a></p>

        <div class="grid-2">
            <div>
                <label>当前工程</label>
                <select v-model="workspaceState.selectedWorkspaceId">
                    <option value="">请选择</option>
                    <option v-for="ws in workspaceState.workspaces" :key="ws.id" :value="ws.id">{{ ws.name }}</option>
                </select>
            </div>
            <div>
                <label>内容类型</label>
                <select v-model="form.type">
                    <option value="post">新博客文章</option>
                    <option value="about">关于页</option>
                    <option value="links">友链页</option>
                    <option value="announcement">公告页</option>
                </select>
            </div>
            <div>
                <label>标题</label>
                <input v-model="form.title" placeholder="例如 这是我的第一篇博客" />
            </div>
            <div>
                <label>slug（可选）</label>
                <input v-model="form.slug" placeholder="例如 first-post" />
            </div>
            <div>
                <label>保存后自动发布（需要仓库地址）</label>
                <select v-model="form.autoPublish">
                    <option :value="true">true</option>
                    <option :value="false">false</option>
                </select>
            </div>
            <div>
                <label>发布仓库地址</label>
                <input v-model="form.repoUrl" placeholder="https://github.com/you/your-blog.git" />
            </div>
        </div>

        <div class="actions">
            <button class="primary" @click="createAndEdit">创建并打开编辑器</button>
            <button class="secondary" @click="refreshPublishJob">刷新自动发布状态</button>
        </div>

        <div class="panel" style="margin-top: 12px;">
            <h2>执行状态</h2>
            <p class="muted">文件路径：{{ state.filePath || '-' }}</p>
            <p class="muted">任务状态：{{ state.jobStatus || '-' }}</p>
            <p class="muted">消息：{{ state.message || '-' }}</p>
        </div>
    </section>
</template>
