import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sectionPath = new URL("./ThemeAssetStudioSection.vue", import.meta.url);

test("ThemeAssetStudioSection exposes asset previews and delegated upload callbacks for H4 extraction", async () => {
  const source = await readFile(sectionPath, "utf8");

  assert.match(source, /data-theme-zone="asset-studio"/);
  assert.match(source, /视觉素材台/);
  assert.match(source, /素材状态一览/);
  assert.match(source, /点击放大博客图标/);
  assert.match(source, /点击放大背景图/);
  assert.match(source, /openAssetPreview/);
  assert.match(source, /const assetPreview = reactive/);
  assert.match(source, /const faviconUploadPath = ref/);
  assert.match(source, /const faviconPreferredFileName = ref/);
  assert.match(source, /pickFaviconImageFile/);
  assert.match(source, /uploadLocalFavicon/);
  assert.match(source, /applyLocalBackgroundImage/);
  assert.match(source, /asset-preview-lightbox/);
});
