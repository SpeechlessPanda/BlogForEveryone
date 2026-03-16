<script setup>
import { onMounted, reactive, ref } from 'vue';

const form = reactive({
    url: '',
    title: '',
    exportProjectDir: ''
});

const list = ref([]);
const message = ref('');

async function refresh() {
    list.value = await window.bfeApi.listSubscriptions();
}

async function add() {
    await window.bfeApi.addSubscription({ url: form.url, title: form.title });
    form.url = '';
    form.title = '';
    await refresh();
}

async function remove(id) {
    await window.bfeApi.removeSubscription({ id });
    await refresh();
}

async function syncNow() {
    list.value = await window.bfeApi.syncSubscriptions();
    message.value = '已完成同步，若有新内容会触发桌面通知。';
}

async function exportBundle() {
    const filePath = await window.bfeApi.exportSubscriptions({ projectDir: form.exportProjectDir });
    message.value = `已导出订阅文件：${filePath}`;
}

onMounted(refresh);
</script>

<template>
    <section class="panel">
        <h2>RSS 订阅与阅读</h2>
        <p class="muted">支持订阅、同步、通知与导出订阅文件，便于换设备自动恢复。</p>

        <div class="grid-2">
            <div>
                <label>RSS 地址</label>
                <input v-model="form.url" placeholder="https://example.com/rss.xml" />
            </div>
            <div>
                <label>名称（可选）</label>
                <input v-model="form.title" placeholder="例如 技术周刊" />
            </div>
        </div>

        <div class="actions">
            <button class="primary" @click="add">添加订阅</button>
            <button class="secondary" @click="syncNow">立即同步</button>
        </div>

        <div class="panel" style="margin-top: 12px;">
            <h2>导出订阅快照</h2>
            <label>博客工程目录</label>
            <input v-model="form.exportProjectDir" placeholder="例如 D:/blogs/my-blog" />
            <div class="actions">
                <button class="secondary" @click="exportBundle">导出 subscriptions.bundle.json</button>
            </div>
        </div>
    </section>

    <section class="panel">
        <h2>订阅列表</h2>
        <div class="list" v-if="list.length">
            <div class="list-item" v-for="item in list" :key="item.id">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
                    <div>
                        <strong>{{ item.title }}</strong>
                        <div class="muted">{{ item.url }}</div>
                        <div class="muted">未读：{{ item.unreadCount || 0 }}</div>
                    </div>
                    <button class="danger" @click="remove(item.id)">取消订阅</button>
                </div>

                <div v-if="item.latestItems?.length" style="margin-top:8px;">
                    <div class="muted">最新文章</div>
                    <ul>
                        <li v-for="post in item.latestItems.slice(0, 3)" :key="post.link">
                            <a :href="post.link" target="_blank">{{ post.title }}</a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <p class="muted" v-else>暂无订阅。</p>
        <p class="muted">{{ message }}</p>
    </section>
</template>
