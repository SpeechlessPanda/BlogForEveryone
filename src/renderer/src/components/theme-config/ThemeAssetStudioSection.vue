<script setup>
import { reactive, ref } from "vue";

const props = defineProps({
  basicFields: { type: Object, required: true },
  supportsAvatarUpload: { type: Boolean, required: true },
  backgroundSupportHint: { type: String, required: true },
  backgroundTransfer: { type: Object, required: true },
  avatarTransfer: { type: Object, required: true },
  pickFaviconImageFile: { type: Function, required: true },
  pickBackgroundImageFile: { type: Function, required: true },
  pickAvatarImageFile: { type: Function, required: true },
  uploadLocalFavicon: { type: Function, required: true },
  applyLocalBackgroundImage: { type: Function, required: true },
  applyLocalAvatarImage: { type: Function, required: true },
});

const assetPreview = reactive({
  visible: false,
  title: "",
  src: "",
});
const faviconUploadPath = ref("");
const faviconPreferredFileName = ref("");

function openAssetPreview(title, src) {
  if (!src) {
    return;
  }
  assetPreview.visible = true;
  assetPreview.title = title;
  assetPreview.src = src;
}

function closeAssetPreview() {
  assetPreview.visible = false;
  assetPreview.title = "";
  assetPreview.src = "";
}

async function handlePickFaviconImageFile() {
  faviconUploadPath.value = await props.pickFaviconImageFile(faviconUploadPath.value);
}

async function handleUploadLocalFavicon() {
  await props.uploadLocalFavicon(faviconUploadPath.value, faviconPreferredFileName.value);
}
</script>

<template>
  <section
    class="panel page-section theme-studio-section"
    data-theme-zone="asset-studio"
  >
    <div class="theme-studio-heading">
      <div class="theme-studio-heading-copy">
        <p class="section-eyebrow">Step 02 · 视觉素材台</p>
        <h2>把图标、背景与头像收进同一张素材桌</h2>
        <p class="section-helper">
          当前素材状态和上传动作放在同一块区域里，方便先看现状，再决定要替换哪一项。
        </p>
      </div>
    </div>

    <div class="theme-studio-note">
      <p class="section-eyebrow">素材状态一览</p>
      <strong>先看当前已生效路径，再决定是否替换素材。</strong>
      <p class="section-helper">{{ backgroundSupportHint }}</p>
    </div>

    <div
      v-if="basicFields.favicon || basicFields.backgroundImage || basicFields.avatarImage"
      class="theme-asset-preview-grid"
    >
      <button
        v-if="basicFields.favicon"
        class="theme-asset-preview-card"
        type="button"
        @click="openAssetPreview('博客图标预览', basicFields.favicon)"
      >
        <img :src="basicFields.favicon" alt="博客图标预览" loading="lazy" />
        <span>点击放大博客图标</span>
      </button>
      <button
        v-if="basicFields.backgroundImage"
        class="theme-asset-preview-card"
        type="button"
        @click="openAssetPreview('背景图预览', basicFields.backgroundImage)"
      >
        <img :src="basicFields.backgroundImage" alt="背景图预览" loading="lazy" />
        <span>点击放大背景图</span>
      </button>
      <button
        v-if="basicFields.avatarImage"
        class="theme-asset-preview-card"
        type="button"
        @click="openAssetPreview('头像预览', basicFields.avatarImage)"
      >
        <img :src="basicFields.avatarImage" alt="头像预览" loading="lazy" />
        <span>点击放大头像</span>
      </button>
    </div>

    <div class="theme-studio-status-grid">
      <article class="theme-studio-status-card">
        <p class="status-label">当前图标路径</p>
        <strong>{{ basicFields.favicon || "尚未配置图标" }}</strong>
        <p class="status-detail">品牌入口通常最先被看见，替换前先确认目标路径。</p>
      </article>
      <article class="theme-studio-status-card">
        <p class="status-label">当前背景图路径</p>
        <strong>{{ basicFields.backgroundImage || "尚未配置背景图" }}</strong>
        <p class="status-detail">背景会直接影响首页氛围，适合在标题确定后统一替换。</p>
      </article>
      <article v-if="supportsAvatarUpload" class="theme-studio-status-card">
        <p class="status-label">当前头像路径</p>
        <strong>{{ basicFields.avatarImage || "尚未配置头像" }}</strong>
        <p class="status-detail">支持头像的主题会在资料侧栏强化作者身份感。</p>
      </article>
    </div>

    <div class="theme-asset-grid">
      <article class="priority-panel theme-studio-card">
        <p class="section-eyebrow">博客图标</p>
        <h3>上传与命名</h3>
        <div>
          <label>本地图标路径（自动保存到博客文件夹）</label>
          <div class="path-input-row">
            <input
              :value="faviconUploadPath"
              placeholder="例如 D:/images/favicon.png"
              @input="faviconUploadPath = $event.target.value"
            />
            <button class="secondary" type="button" @click="handlePickFaviconImageFile">
              选择文件
            </button>
          </div>
        </div>
        <div>
          <label>图标文件名（可选）</label>
          <input
            :value="faviconPreferredFileName"
            placeholder="例如 favicon-brand"
            @input="faviconPreferredFileName = $event.target.value"
          />
        </div>
        <div class="actions">
          <button class="secondary" @click="handleUploadLocalFavicon">
            转存并应用博客图标
          </button>
        </div>
      </article>

      <article class="priority-panel theme-studio-card">
        <p class="section-eyebrow">背景画面</p>
        <h3>背景图上传</h3>
        <div>
          <label>本地背景图路径</label>
          <div class="path-input-row">
            <input
              v-model="backgroundTransfer.localFilePath"
              placeholder="例如 D:/images/hero.jpg"
            />
            <button class="secondary" type="button" @click="pickBackgroundImageFile">
              选择文件
            </button>
          </div>
        </div>
        <div>
          <label>背景图文件名（可选）</label>
          <input
            v-model="backgroundTransfer.preferredFileName"
            placeholder="例如 home-bg.jpg"
          />
        </div>
        <div class="actions">
          <button class="secondary" @click="applyLocalBackgroundImage">
            转存并应用背景图（自动写入配置）
          </button>
        </div>
      </article>

      <article v-if="supportsAvatarUpload" class="priority-panel theme-studio-card">
        <p class="section-eyebrow">头像素材</p>
        <h3>头像上传</h3>
        <div>
          <label>本地头像路径</label>
          <div class="path-input-row">
            <input
              v-model="avatarTransfer.localFilePath"
              placeholder="例如 D:/images/avatar.png"
            />
            <button class="secondary" type="button" @click="pickAvatarImageFile">
              选择文件
            </button>
          </div>
        </div>
        <div>
          <label>头像文件名（可选）</label>
          <input
            v-model="avatarTransfer.preferredFileName"
            placeholder="例如 profile-avatar"
          />
        </div>
        <div class="actions">
          <button class="secondary" @click="applyLocalAvatarImage">
            转存并应用头像（自动写入配置）
          </button>
        </div>
      </article>
    </div>

    <dialog
      v-if="assetPreview.visible"
      open
      class="asset-preview-lightbox"
      @click.self="closeAssetPreview"
    >
      <div class="asset-preview-dialog">
        <p class="section-eyebrow">素材预览</p>
        <h3>{{ assetPreview.title }}</h3>
        <img :src="assetPreview.src" :alt="assetPreview.title" />
        <div class="actions">
          <button class="secondary" type="button" @click="closeAssetPreview">
            关闭预览
          </button>
        </div>
      </div>
    </dialog>
  </section>
</template>
