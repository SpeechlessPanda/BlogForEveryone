<script setup>
defineProps({
  selectedWorkspace: {
    type: Object,
    default: null,
  },
  workspaceNextActionLabel: {
    type: String,
    required: true,
  },
  workspaceStageLabel: {
    type: String,
    required: true,
  },
  workspaceBlockerLabel: {
    type: String,
    required: true,
  },
  jumpToZone: {
    type: Function,
    required: true,
  },
  jumpToImportView: {
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
  <section class="panel page-hero workspace-hero" data-workspace-zone="hero">
    <div class="page-hero-grid">
      <div>
        <p class="page-kicker">Workflow entry</p>
        <h2 class="page-title">博客创建工作台</h2>
        <p class="page-lead">
          这里把新建与继续工作分开处理：先挑一个更像成品的主题方向，再启动工作区；已有博客则直接回到主题、内容或预览环节继续推进。
        </p>
        <div class="actions workspace-hero-actions">
          <button class="primary" type="button" @click="jumpToZone('workspace-new-start')">
            快速创建新博客
          </button>
          <button class="secondary" type="button" @click="jumpToZone('workspace-continue')">
            继续现有工作
          </button>
          <button class="secondary" type="button" @click="jumpToImportView">
            导入已有项目
          </button>
        </div>
        <div class="page-link-row">
          <a href="#" @click.prevent="goTutorialCenter"
            >不知道怎么填？打开教程中心（新建博客保姆指南）</a
          >
        </div>
      </div>
      <div class="page-hero-aside">
        <div class="page-signal page-signal--accent">
          <p class="section-eyebrow">建议下一步</p>
          <strong>{{ workspaceNextActionLabel }}</strong>
          <p class="section-helper">
            快速创建、继续现有工作、导入已有项目都保留在这一屏，不用切换思路找入口。
          </p>
        </div>
        <div class="page-signal page-signal--quiet">
          <p class="section-eyebrow">继续工作入口</p>
          <strong>优先回到最近工作区，再决定是否调整主题与内容。</strong>
          <p class="section-helper">
            最近工作区卡片会把继续完善动作放到最前面，删除动作压到最后。
          </p>
        </div>
      </div>
    </div>

    <div class="page-status-grid">
      <div class="page-signal page-signal--accent">
        <p class="section-eyebrow">当前博客</p>
        <strong>{{ selectedWorkspace?.name || "还没有选中的工作区" }}</strong>
        <p class="section-helper">
          {{
            selectedWorkspace
              ? `${selectedWorkspace.framework} · ${selectedWorkspace.projectDir}`
              : "创建成功后，这里会成为主题配置、预览和发布的默认上下文。"
          }}
        </p>
      </div>
      <div class="page-signal">
        <p class="section-eyebrow">当前阶段</p>
        <strong>{{ workspaceStageLabel }}</strong>
        <p class="section-helper">创建页负责把博客正式接入主流程。</p>
      </div>
      <div class="page-signal">
        <p class="section-eyebrow">建议下一步</p>
        <strong>{{ workspaceNextActionLabel }}</strong>
        <p class="section-helper">优先保证工作区可运行，再继续调整视觉与内容。</p>
      </div>
      <div class="page-signal page-signal--quiet">
        <p class="section-eyebrow">当前阻塞</p>
        <strong>{{ workspaceBlockerLabel }}</strong>
        <p class="section-helper">阻塞解除后，创建按钮就是本页最强行动点。</p>
      </div>
    </div>
  </section>
</template>
