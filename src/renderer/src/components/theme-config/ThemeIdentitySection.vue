<script setup>
defineProps({
  workspaceState: { type: Object, required: true },
  selectedThemeName: { type: String, required: true },
  themeConfirmationHint: { type: String, required: true },
  needsThemeConfirmation: { type: Boolean, required: true },
  pendingSupportedThemeId: { type: String, required: true },
  setPendingSupportedThemeId: { type: Function, required: true },
  selectedThemeCatalog: { type: Array, required: true },
  confirmAsSupportedTheme: { type: Function, required: true },
  confirmAsUnsupportedTheme: { type: Function, required: true },
  basicFields: { type: Object, required: true },
  supportsStackComponents: { type: Boolean, required: true },
});
</script>

<template>
  <section
    class="panel page-section theme-studio-section"
    data-theme-zone="identity-rhythm"
  >
    <div class="theme-studio-heading">
      <div class="theme-studio-heading-copy">
        <p class="section-eyebrow">Step 01 · 品牌识别先行</p>
        <h2>先确认工作区，再统一品牌入口</h2>
        <p class="section-helper">
          先确认博客上下文，再处理标题、副标题与身份线索，避免把后续素材和配置写进错误工程。
        </p>
      </div>
      <aside class="theme-studio-note theme-studio-note--emphasis">
        <p class="section-eyebrow">品牌主叙事</p>
        <strong>标题、副标题、邮箱与 GitHub 需要先讲同一种品牌语言。</strong>
        <p class="section-helper">
          这样后面的图标、背景和阅读体验，都会围绕同一套首页印象展开。
        </p>
      </aside>
    </div>

    <div class="theme-studio-column-grid">
      <article class="priority-panel theme-studio-card">
        <p class="section-eyebrow">工作台上下文</p>
        <h3>确认当前博客与主题</h3>
        <p class="section-helper">
          这里先确认你正在改哪一个工作区，避免把图片和配置写到错误的博客目录里。
        </p>
        <div class="grid-2">
          <div>
            <label>选择工程</label>
            <select v-model="workspaceState.selectedWorkspaceId">
              <option value="">请选择</option>
              <option
                v-for="ws in workspaceState.workspaces"
                :key="ws.id"
                :value="ws.id"
              >
                {{ ws.name }}
              </option>
            </select>
          </div>
          <div>
            <label>主题（由工程自动确定）</label>
            <input :value="selectedThemeName" readonly />
          </div>
        </div>
        <p class="muted theme-studio-inline-note">{{ themeConfirmationHint }}</p>
        <div v-if="needsThemeConfirmation" class="grid-2 theme-studio-confirm-grid">
          <div>
            <label>确认一个受支持主题</label>
            <select
              :value="pendingSupportedThemeId"
              @change="setPendingSupportedThemeId($event.target.value)"
            >
              <option value="">请选择</option>
              <option
                v-for="theme in selectedThemeCatalog"
                :key="theme.id"
                :value="theme.id"
              >
                {{ theme.name }} ({{ theme.id }})
              </option>
            </select>
          </div>
          <div class="actions theme-studio-actions-end">
            <button class="secondary" type="button" @click="confirmAsSupportedTheme">
              确认受支持主题
            </button>
            <button class="secondary" type="button" @click="confirmAsUnsupportedTheme">
              标记为不受支持/自定义
            </button>
          </div>
        </div>
      </article>

      <article class="priority-panel theme-studio-card theme-studio-card--emphasis">
        <p class="section-eyebrow">品牌识别</p>
        <h3>博客基础信息</h3>
        <p class="section-helper">
          先改标题、副标题和主页链接。这一组最能直接改变读者看到的第一印象。
        </p>
        <div class="grid-2">
          <div>
            <label>博客标题</label><input v-model="basicFields.siteTitle" />
          </div>
          <div>
            <label>博客副标题</label><input v-model="basicFields.subtitle" />
          </div>
          <div>
            <label>邮箱</label
            ><input v-model="basicFields.email" placeholder="name@example.com" />
          </div>
          <div>
            <label>GitHub 主页链接</label
            ><input
              v-model="basicFields.github"
              placeholder="https://github.com/yourname"
            />
          </div>
          <template v-if="supportsStackComponents">
            <div>
              <label>首页菜单图标（可空，空则移除）</label>
              <input v-model="basicFields.stackHomeIcon" placeholder="例如 home" />
            </div>
            <div>
              <label>关于菜单图标（可空，空则移除）</label>
              <input v-model="basicFields.stackAboutIcon" placeholder="例如 user" />
            </div>
            <div>
              <label>归档菜单图标（可空，空则移除）</label>
              <input
                v-model="basicFields.stackArchivesIcon"
                placeholder="例如 archives"
              />
            </div>
            <div>
              <label>显示归档小组件</label>
              <select v-model="basicFields.stackShowArchivesWidget">
                <option :value="true">true</option>
                <option :value="false">false</option>
              </select>
            </div>
            <div>
              <label>显示标签云小组件</label>
              <select v-model="basicFields.stackShowTagCloudWidget">
                <option :value="true">true</option>
                <option :value="false">false</option>
              </select>
              <p class="muted">
                启用前请确保文章包含 tags，否则主题可能不显示标签云。
              </p>
            </div>
          </template>
        </div>
      </article>
    </div>
  </section>
</template>
