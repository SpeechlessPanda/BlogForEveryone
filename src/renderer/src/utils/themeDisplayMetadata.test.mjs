import test from "node:test";
import assert from "node:assert/strict";

import {
  getThemeDisplayMetadata,
  themeDisplayMetadata,
} from "./themeDisplayMetadata.mjs";

const expectedThemeKeys = [
  "hexo:landscape",
  "hexo:next",
  "hexo:butterfly",
  "hexo:fluid",
  "hexo:volantis",
  "hugo:papermod",
  "hugo:loveit",
  "hugo:stack",
  "hugo:mainroad",
  "hugo:anatole",
];

test("themeDisplayMetadata covers the 10 shipped themes with curated tags and one-line positioning copy", () => {
  assert.deepEqual(Object.keys(themeDisplayMetadata).sort(), [...expectedThemeKeys].sort());

  for (const themeKey of expectedThemeKeys) {
    const metadata = themeDisplayMetadata[themeKey];

    assert.equal(Array.isArray(metadata.tags), true, `${themeKey} should expose tags`);
    assert.equal(metadata.tags.length >= 2, true, `${themeKey} should expose at least two tags`);
    assert.equal(typeof metadata.positioningCopy, "string");
    assert.equal(metadata.positioningCopy.includes("\n"), false);

    for (const tag of metadata.tags) {
      assert.equal(typeof tag, "string");
      assert.equal(tag.length > 0, true);
    }
  }
});

test("getThemeDisplayMetadata returns exact display copy for supported themes and null for unknown themes", () => {
  assert.deepEqual(getThemeDisplayMetadata("hexo", "fluid"), {
    tags: ["编辑感首页", "长文友好", "品牌留白"],
    positioningCopy: "如果你想先把封面气质和长文阅读感做稳，Fluid 是最顺手的起点。",
  });

  assert.deepEqual(getThemeDisplayMetadata("hugo", "papermod"), {
    tags: ["极简专注", "加载轻快", "文档型博客"],
    positioningCopy: "PaperMod 适合把内容本身放到最前面，尤其适合说明文、教程和周报。",
  });

  assert.equal(getThemeDisplayMetadata("hexo", "unknown"), null);
  assert.equal(getThemeDisplayMetadata("astro", "fluid"), null);
});
