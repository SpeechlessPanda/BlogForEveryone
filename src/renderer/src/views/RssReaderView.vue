<script setup>
import { onMounted, reactive, ref } from "vue";

const form = reactive({
  url: "",
  title: "",
  exportProjectDir: "",
});

const list = ref([]);
const message = ref("");

function getItemKey(post) {
  return post?.key || post?.guid || post?.id || post?.link || post?.title || "";
}

function emitRssUpdated() {
  const totalUnread = list.value.reduce(
    (sum, item) => sum + Number(item.unreadCount || 0),
    0,
  );
  window.dispatchEvent(
    new CustomEvent("bfe:rss-updated", {
      detail: { totalUnread },
    }),
  );
}

function setSubscriptions(nextList) {
  list.value = nextList || [];
  emitRssUpdated();
}

async function refresh() {
  try {
    setSubscriptions(await window.bfeApi.listSubscriptions());
  } catch (error) {
    message.value = `加载订阅失败：${String(error?.message || error)}`;
  }
}

async function add() {
  try {
    await window.bfeApi.addSubscription({ url: form.url, title: form.title });
    form.url = "";
    form.title = "";
    message.value = "订阅添加成功。";
    await refresh();
  } catch (error) {
    message.value = `添加订阅失败：${String(error?.message || error)}`;
  }
}

async function remove(id) {
  try {
    setSubscriptions(await window.bfeApi.removeSubscription({ id }));
    message.value = "已取消订阅。";
  } catch (error) {
    message.value = `取消订阅失败：${String(error?.message || error)}`;
  }
}

async function syncNow() {
  try {
    setSubscriptions(await window.bfeApi.syncSubscriptions());
    message.value = "已完成同步，若有新内容会触发桌面通知。";
  } catch (error) {
    message.value = `同步失败：${String(error?.message || error)}`;
  }
}

async function markPostAsRead(subscription, post) {
  const itemKey = getItemKey(post);
  if (!itemKey || !subscription?.id) {
    return;
  }

  try {
    setSubscriptions(
      await window.bfeApi.markSubscriptionItemRead({
        subscriptionId: subscription.id,
        itemKey,
      }),
    );
  } catch {
    // Clicking article should remain non-blocking even when marking read fails.
  }
}

async function openPost(subscription, post) {
  await markPostAsRead(subscription, post);
  if (post?.link) {
    window.open(post.link, "_blank");
  }
}

async function pickExportDirectory() {
  try {
    const result = await window.bfeApi.pickDirectory({
      title: "选择导出订阅所对应的博客目录",
      defaultPath: form.exportProjectDir || undefined,
    });
    if (!result.canceled && result.path) {
      form.exportProjectDir = result.path;
    }
  } catch (error) {
    message.value = `选择目录失败：${String(error?.message || error)}`;
  }
}

async function exportBundle() {
  try {
    const filePath = await window.bfeApi.exportSubscriptions({
      projectDir: form.exportProjectDir,
    });
    message.value = `已导出订阅文件：${filePath}`;
  } catch (error) {
    message.value = `导出失败：${String(error?.message || error)}`;
  }
}

function goTutorialCenter() {
  window.dispatchEvent(new CustomEvent("bfe:open-tutorial"));
}

onMounted(refresh);
</script>

<template>
  <section class="panel">
    <h2>RSS 订阅与阅读</h2>
    <p class="muted">
      支持订阅、同步、通知与导出订阅文件，便于换设备自动恢复。
    </p>
    <p>
      <a href="#" @click.prevent="goTutorialCenter"
        >打开教程中心（RSS 配置指南）</a
      >
    </p>

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

    <div class="panel" style="margin-top: 12px">
      <h2>导出订阅快照</h2>
      <label>博客工程目录</label>
      <div class="path-input-row">
        <input
          v-model="form.exportProjectDir"
          placeholder="例如 D:/blogs/my-blog"
        />
        <button class="secondary" type="button" @click="pickExportDirectory">
          选择目录
        </button>
      </div>
      <div class="actions">
        <button class="secondary" @click="exportBundle">
          导出 subscriptions.bundle.json
        </button>
      </div>
    </div>
  </section>

  <section class="panel">
    <h2>订阅列表</h2>
    <div class="list" v-if="list.length">
      <div class="list-item" v-for="item in list" :key="item.id">
        <div
          style="
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: center;
          "
        >
          <div>
            <strong>{{ item.title }}</strong>
            <div class="muted">{{ item.url }}</div>
            <div class="muted">未读：{{ item.unreadCount || 0 }}</div>
          </div>
          <button class="danger" @click="remove(item.id)">取消订阅</button>
        </div>

        <div v-if="item.latestItems?.length" style="margin-top: 8px">
          <div class="muted">最新文章</div>
          <ul>
            <li
              v-for="post in item.latestItems.slice(0, 3)"
              :key="post.link || post.title"
            >
              <a href="#" @click.prevent="openPost(item, post)">{{
                post.title
              }}</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <p class="muted" v-else>暂无订阅。</p>
    <p class="muted">{{ message }}</p>
  </section>
</template>
