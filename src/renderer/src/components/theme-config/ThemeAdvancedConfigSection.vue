<script setup>
defineProps({
  selectedThemeSchema: { type: Object, default: null },
  optionValues: { type: Object, required: true },
  allConfigEntries: { type: Array, required: true },
});
</script>

<template>
  <div class="page-stack theme-studio-detail-stack" data-theme-zone="advanced-config">
    <section class="priority-panel priority-panel--subtle theme-studio-detail-intro">
      <p class="section-eyebrow">次级区域</p>
      <strong>高级与原始配置属于次级区域</strong>
      <p class="page-result-note">
        只有当基础品牌、素材与阅读体验已经跑通时，再回来处理下面这两组技术参数。
      </p>
    </section>

    <details v-if="selectedThemeSchema" class="advanced-panel theme-studio-detail-panel">
      <summary>主题专属高级配置（{{ selectedThemeSchema.options.length }} 项）</summary>
      <div class="advanced-panel-content">
        <p class="section-helper">
          只有当你已经跑通基础外观、预览和内容后，再建议回来调这些主题特有参数。
        </p>
        <div class="grid-2">
          <div v-for="opt in selectedThemeSchema.options" :key="opt.key">
            <label>{{ opt.label }} ({{ opt.key }})</label>
            <select v-if="opt.type === 'enum'" v-model="optionValues[opt.key]">
              <option v-for="v in opt.enumValues" :key="v" :value="v">
                {{ v }}
              </option>
            </select>
            <select v-else-if="opt.type === 'boolean'" v-model="optionValues[opt.key]">
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
            <input
              v-else-if="opt.type === 'array'"
              v-model="optionValues[opt.key]"
              :placeholder="(opt.default || []).join(',')"
            />
            <input
              v-else
              v-model="optionValues[opt.key]"
              :placeholder="String(opt.default || '')"
            />
          </div>
        </div>
      </div>
    </details>

    <details class="advanced-panel theme-studio-detail-panel">
      <summary>原始配置抽屉（全部配置项 {{ allConfigEntries.length }} 项，适合高级用户）</summary>
      <div class="advanced-panel-content">
        <p class="section-helper">
          这里会直接影响最终配置文件。只有当上面的可视化项无法覆盖你的需求时，再修改这一组原始条目。
        </p>
        <div class="grid-2">
          <div v-for="item in allConfigEntries" :key="item.key">
            <label>{{ item.key }}</label>
            <input v-model="item.value" />
          </div>
        </div>
      </div>
    </details>
  </div>
</template>
