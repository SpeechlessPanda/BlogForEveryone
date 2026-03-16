<script setup>
import { ref, onMounted } from 'vue';
import WorkspaceView from './views/WorkspaceView.vue';
import ThemeConfigView from './views/ThemeConfigView.vue';
import PublishBackupView from './views/PublishBackupView.vue';
import ImportView from './views/ImportView.vue';
import RssReaderView from './views/RssReaderView.vue';
import TutorialCenterView from './views/TutorialCenterView.vue';

const tabs = [
    { key: 'tutorial', label: '教程中心' },
    { key: 'workspace', label: '博客创建' },
    { key: 'theme', label: '主题配置' },
    { key: 'publish', label: '发布与备份' },
    { key: 'import', label: '导入恢复' },
    { key: 'rss', label: 'RSS 阅读' }
];

const activeTab = ref('workspace');
const appState = ref({ appName: 'BlogForEveryone', version: '0.1.0' });
const envStatus = ref({ nodeInstalled: true, gitInstalled: true, pnpmInstalled: true, ready: true });
const envActionLog = ref('');
const authClientId = ref('');
const authState = ref(null);
const authLog = ref('');

async function refreshEnvStatus() {
    envStatus.value = await window.bfeApi.getEnvironmentStatus();
}

async function handleOpenInstaller(tool) {
    const result = await window.bfeApi.openInstaller({ tool });
    envActionLog.value = `已打开 ${tool} 下载页：${result.url}`;
}

async function handleInstallPnpm() {
    const result = await window.bfeApi.ensurePnpm();
    envActionLog.value = JSON.stringify(result, null, 2);
    await refreshEnvStatus();
}

async function handleAutoInstall(tool) {
    const confirmed = window.confirm(`将使用 winget 静默安装 ${tool}，是否继续？`);
    if (!confirmed) {
        return;
    }

    const result = await window.bfeApi.autoInstallTool({ tool });
    envActionLog.value = JSON.stringify(result, null, 2);
    await refreshEnvStatus();
}

async function refreshAuthState() {
    authState.value = await window.bfeApi.getGithubAuthState();
}

async function handleGithubLogin() {
    if (!authClientId.value) {
        authLog.value = '请先填写 GitHub OAuth App 的 Client ID。';
        return;
    }

    authLog.value = '正在拉起 GitHub 设备码登录，请在浏览器确认授权...';
    try {
        const result = await window.bfeApi.githubLoginWithDeviceCode({
            clientId: authClientId.value,
            scope: 'repo read:user user:email'
        });
        authLog.value = JSON.stringify(result, null, 2);
        await refreshAuthState();
    } catch (error) {
        authLog.value = String(error?.message || error);
    }
}

function fillDemoClientIdGuide() {
    authLog.value = '这里要填的是你在 GitHub OAuth App 里拿到的 Client ID（形如 Iv1.xxxxx）。如果页面要求设备码，请输入应用日志中的 user code。';
}

async function handleGithubLogout() {
    await window.bfeApi.githubLogout();
    await refreshAuthState();
    authLog.value = '已退出 GitHub 登录状态。';
}

onMounted(async () => {
    if (window.bfeApi) {
        appState.value = await window.bfeApi.getAppState();
        envStatus.value = appState.value.env || envStatus.value;
        await refreshAuthState();
    }
});
</script>

<template>
    <div class="layout">
        <aside class="sidebar">
            <h1>{{ appState.appName }}</h1>
            <p class="version">v{{ appState.version }}</p>
            <button v-for="tab in tabs" :key="tab.key" :class="['tab', { active: activeTab === tab.key }]"
                @click="activeTab = tab.key">
                {{ tab.label }}
            </button>
        </aside>

        <main class="content">
            <section v-if="!envStatus.ready" class="panel env-alert">
                <h2>环境检查</h2>
                <p class="muted">检测到当前环境不完整。你只需要确认按钮，应用会引导下载安装。</p>
                <ul>
                    <li>Node.js: {{ envStatus.nodeInstalled ? '已安装' : '未安装' }}</li>
                    <li>Git: {{ envStatus.gitInstalled ? '已安装' : '未安装' }}</li>
                    <li>pnpm: {{ envStatus.pnpmInstalled ? '已安装' : '未安装' }}</li>
                </ul>
                <div class="actions">
                    <button v-if="!envStatus.nodeInstalled" class="primary" @click="handleOpenInstaller('node')">下载
                        Node.js</button>
                    <button v-if="!envStatus.nodeInstalled && envStatus.wingetInstalled" class="secondary"
                        @click="handleAutoInstall('node')">自动安装 Node.js（winget）</button>
                    <button v-if="!envStatus.gitInstalled" class="primary" @click="handleOpenInstaller('git')">下载
                        Git</button>
                    <button v-if="!envStatus.gitInstalled && envStatus.wingetInstalled" class="secondary"
                        @click="handleAutoInstall('git')">自动安装 Git（winget）</button>
                    <button v-if="envStatus.nodeInstalled && !envStatus.pnpmInstalled" class="secondary"
                        @click="handleInstallPnpm">安装 pnpm（失败自动换源重试）</button>
                    <button class="secondary" @click="refreshEnvStatus">重新检测</button>
                </div>
                <pre v-if="envActionLog">{{ envActionLog }}</pre>
            </section>

            <section class="panel">
                <h2>GitHub 登录（OAuth 设备码）</h2>
                <p class="muted">填写你的 GitHub OAuth App Client ID 后，点击登录会自动打开浏览器并进入设备码授权流程。</p>
                <label>GitHub OAuth Client ID</label>
                <input v-model="authClientId" placeholder="例如 Iv1.xxxxxxxxxxxxxxxx" />
                <div class="actions">
                    <button class="secondary" @click="fillDemoClientIdGuide">这里填什么？</button>
                    <button class="primary" @click="handleGithubLogin">设备码登录</button>
                    <button class="secondary" @click="refreshAuthState">刷新登录状态</button>
                    <button v-if="authState" class="danger" @click="handleGithubLogout">退出登录</button>
                </div>
                <div class="muted" v-if="authState">当前登录：{{ authState.user?.login }} ({{ authState.user?.name || '-' }})
                </div>
                <pre v-if="authLog">{{ authLog }}</pre>
            </section>

            <TutorialCenterView v-if="activeTab === 'tutorial'" />
            <WorkspaceView v-if="activeTab === 'workspace'" />
            <ThemeConfigView v-if="activeTab === 'theme'" />
            <PublishBackupView v-if="activeTab === 'publish'" />
            <ImportView v-if="activeTab === 'import'" />
            <RssReaderView v-if="activeTab === 'rss'" />
        </main>
    </div>
</template>
