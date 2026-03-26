<script setup>
defineProps({
  contentNextStep: {
    type: String,
    required: true,
  },
  selectedWorkspace: {
    type: Object,
    default: null,
  },
  existingCount: {
    type: Number,
    required: true,
  },
  jumpToZone: {
    type: Function,
    required: true,
  },
  goTutorialCenter: {
    type: Function,
    required: true,
  },
});
</script>

<template>
  <section class="panel page-hero" data-workflow-zone="hero">
    <div class="page-hero-grid">
      <div>
        <p class="page-kicker">Writing hub</p>
        <h2 class="page-title">写作中枢</h2>
        <p class="page-lead">
          内容编辑页优先服务写作本身：先创建或进入内容工作，再理解当前结果，最后才看自动发布等次级自动化。发布相关能力必须辅助写作，而不是压过写作。
        </p>
        <div class="workflow-hero-actions" data-workflow-zone="hero-actions">
          <button
            class="primary"
            type="button"
            data-workflow-action-level="primary"
            @click="jumpToZone('content-create-zone')"
          >
            前往新建内容
          </button>
          <button
            class="secondary"
            type="button"
            data-workflow-action-level="secondary"
            @click="jumpToZone('content-existing-zone')"
          >
            继续编辑已有内容
          </button>
          <button
            class="secondary"
            type="button"
            data-workflow-action-level="tertiary"
            @click="goTutorialCenter"
          >
            查看写作教程
          </button>
        </div>
        <div class="page-link-row">
          <a href="#" @click.prevent="goTutorialCenter"
            >打开教程中心：内容编辑与自动发布完整步骤</a
          >
        </div>
      </div>
      <div class="workflow-hero-note">
        <div class="page-signal page-signal--accent">
          <p class="section-eyebrow">建议下一步</p>
          <strong>{{ contentNextStep }}</strong>
          <p class="section-helper">先把内容写出来，再决定是否要把发布动作自动化。</p>
        </div>
      </div>
    </div>

    <div class="workflow-status-grid">
      <div class="page-signal page-signal--accent">
        <p class="section-eyebrow">当前工作区</p>
        <strong>{{ selectedWorkspace?.name || "尚未选择工程" }}</strong>
        <p class="section-helper">
          {{
            selectedWorkspace
              ? `${selectedWorkspace.framework.toUpperCase()} · 主题 ${selectedWorkspace.theme || '未识别'}`
              : "先选择工作区，写出的文章和页面才会进入正确的博客目录。"
          }}
        </p>
      </div>
      <div class="page-signal">
        <p class="section-eyebrow">当前内容状态</p>
        <strong>{{ existingCount ? `已有 ${existingCount} 项内容` : "还没有已载入内容" }}</strong>
        <p class="section-helper">已存在内容也能在这里直接继续编辑。</p>
      </div>
      <div class="page-signal page-signal--quiet">
        <p class="section-eyebrow">建议下一步</p>
        <strong>{{ contentNextStep }}</strong>
        <p class="section-helper">写完后优先去预览检查真实页面，再决定是否发布。</p>
      </div>
    </div>
  </section>
</template>
