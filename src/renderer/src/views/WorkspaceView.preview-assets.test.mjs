import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const expectedAssets = [
  { filename: "hexo-landscape.png", themeId: "hexo:landscape" },
  { filename: "hexo-next.png", themeId: "hexo:next" },
  { filename: "hexo-butterfly.png", themeId: "hexo:butterfly" },
  { filename: "hexo-fluid.png", themeId: "hexo:fluid" },
  { filename: "hexo-volantis.png", themeId: "hexo:volantis" },
  { filename: "hugo-papermod.png", themeId: "hugo:papermod" },
  { filename: "hugo-loveit.png", themeId: "hugo:loveit" },
  { filename: "hugo-stack.png", themeId: "hugo:stack" },
  { filename: "hugo-mainroad.png", themeId: "hugo:mainroad" },
  { filename: "hugo-anatole.png", themeId: "hugo:anatole" },
];

const previewDir = new URL("../../public/theme-previews/", import.meta.url);
const manifestPath = new URL(
  "../../../../docs/design-assets/theme-preview-manifest.md",
  import.meta.url,
);
const workspaceViewPath = new URL("./WorkspaceView.vue", import.meta.url);

test("theme preview manifest covers all 10 shipped preview assets", async () => {
  const shippedAssets = (await readdir(previewDir))
    .filter((entry) => entry.endsWith(".png"))
    .sort();

  assert.deepEqual(
    shippedAssets,
    expectedAssets.map((item) => item.filename).sort(),
  );

  const manifest = await readFile(manifestPath, "utf8");

  for (const asset of expectedAssets) {
    const rowPattern = new RegExp(
      `\\|\\s*${asset.filename.replace('.', '\\.')}\\s*\\|\\s*${asset.themeId.replace(':', '\\:')}\\s*\\|\\s*.+\\|\\s*live capture\\s*\\|\\s*.+\\|\\s*.+\\|`,
      "i",
    );

    assert.match(
      manifest,
      rowPattern,
      `expected manifest to include provenance row for ${asset.filename}`,
    );
  }
});

test("WorkspaceView keeps the shipped 10-preview asset mapping unchanged", async () => {
  const source = await readFile(workspaceViewPath, "utf8");
  const previewReferences = [...source.matchAll(/theme-previews\/[\w-]+\.png/g)].map(
    (match) => match[0],
  );

  assert.equal(previewReferences.length, expectedAssets.length);
  assert.deepEqual(
    [...new Set(previewReferences)].sort(),
    expectedAssets.map((item) => `theme-previews/${item.filename}`).sort(),
  );
});
