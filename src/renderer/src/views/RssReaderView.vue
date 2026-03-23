<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import AsyncActionButton from "../components/AsyncActionButton.vue";
import { useAsyncAction } from "../composables/useAsyncAction";
import { useRssActions } from "../composables/useRssActions.mjs";

const form = reactive({
  url: "",
  title: "",
  exportProjectDir: "",
});

const { run, isBusy } = useAsyncAction();
const {
  listSubscriptions,
  addSubscription,
  removeSubscription,
  syncSubscriptions,
  markSubscriptionItemRead,
  pickDirectory,
  exportSubscriptions,
} = useRssActions();

const list = ref([]);
const message = ref("");
const totalUnread = computed(() => {
  return list.value.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0);
});

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
    setSubscriptions(await listSubscriptions());
  } catch (error) {
    message.value = `加载订阅失败：${String(error?.message || error)}`;
  }
}

async function add() {
  await run("add", async () => {
    try {
      const next = await addSubscription({
        url: form.url,
        title: form.title,
      });
      setSubscriptions(next);
      form.url = "";
      form.title = "";
      message.value = "订阅添加成功，并已自动完成首次同步。";
    } catch (error) {
      message.value = `添加订阅失败：${String(error?.message || error)}`;
    }
  });
}

async function remove(id) {
  try {
    setSubscriptions(await removeSubscription({ id }));
    message.value = "已取消订阅。";
  } catch (error) {
    message.value = `取消订阅失败：${String(error?.message || error)}`;
  }
}

async function syncNow() {
  await run("refresh", async () => {
    try {
      setSubscriptions(await syncSubscriptions());
      message.value = "已完成同步，若有新内容会触发桌面通知。";
    } catch (error) {
      message.value = `同步失败：${String(error?.message || error)}`;
    }
  });
}

async function markPostAsRead(subscription, post) {
  const itemKey = getItemKey(post);
  if (!itemKey || !subscription?.id) {
    return;
  }

  try {
    setSubscriptions(
      await markSubscriptionItemRead({
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
    const result = await pickDirectory({
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
  await run("export", async () => {
    try {
      const filePath = await exportSubscriptions({
        projectDir: form.exportProjectDir,
      });
      message.value = `已导出订阅文件：${filePath}`;
    } catch (error) {
      message.value = `导出失败：${String(error?.message || error)}`;
    }
  });
}

function goTutorialCenter() {
  window.dispatchEvent(new CustomEvent("bfe:open-tutorial"));
}

onMounted(refresh);
</script>

<template>
  <div class="page-shell page-shell--rss" data-page-role="rss">
    <div class="page-layer" data-page-layer="primary">
      <section class="panel page-hero">
        <div class="page-hero-grid">
          <div>
            <p class="page-kicker">Extension zone</p>
            <h2 class="page-title">RSS 订阅与阅读</h2>
            <p class="page-lead">
              这是更安静的扩展区：它能提供灵感和订阅管理，但不会和博客创建、预览、发布争抢优先级。主流程跑通后，再慢慢补齐这里即可。
            </p>
            <div class="page-link-row">
              <a href="#" @click.prevent="goTutorialCenter"
                >打开教程中心（RSS 配置指南）</a
              >
            </div>
          </div>
          <div class="page-hero-aside">
            <div class="page-signal page-signal--quiet">
              <p class="section-eyebrow">当前未读</p>
              <strong>{{ totalUnread }}</strong>
              <p class="section-helper">新增订阅会自动首次同步，后台每小时继续轮询更新。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>新增订阅</h2>
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
          <AsyncActionButton
            kind="primary"
            label="添加订阅"
            busy-label="添加中..."
            :busy="isBusy('add')"
            @click="add"
          />
        </div>
      </section>
    </div>

    <div class="page-layer" data-page-layer="explanation">
      <section class="panel">
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
          <AsyncActionButton
            kind="secondary"
            label="导出 subscriptions.bundle.json"
            busy-label="导出中..."
            :busy="isBusy('export')"
            @click="exportBundle"
          />
        </div>
      </section>
    </div>

    <div class="page-layer" data-page-layer="detail">
      <section class="panel">
        <div class="page-hero-grid">
          <h2>订阅列表</h2>
          <div class="actions actions-tight">
            <AsyncActionButton
              kind="secondary"
              label="刷新订阅列表"
              busy-label="刷新中..."
              :busy="isBusy('refresh')"
              @click="syncNow"
            />
          </div>
        </div>
        <div class="list" v-if="list.length">
          <div class="list-item" v-for="item in list" :key="item.id">
            <div class="page-hero-grid">
              <div>
                <strong>{{ item.title }}</strong>
                <div class="muted">{{ item.url }}</div>
                <div class="muted">未读：{{ item.unreadCount || 0 }}</div>
              </div>
              <div class="actions actions-tight">
                <button class="danger" @click="remove(item.id)">取消订阅</button>
              </div>
            </div>

            <div v-if="item.latestItems?.length" class="stack-top">
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
    </div>
  </div>
</template>
