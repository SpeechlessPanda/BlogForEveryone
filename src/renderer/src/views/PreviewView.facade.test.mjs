import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previewViewPath = new URL("./PreviewView.vue", import.meta.url);

test("PreviewView uses preview facade instead of raw window.bfeApi preview calls", async () => {
  const source = await readFile(previewViewPath, "utf8");

  assert.match(
    source,
    /import\s*\{\s*usePreviewActions\s*\}\s*from\s*["']\.\.\/composables\/usePreviewActions\.mjs["']/,
  );
  assert.match(
    source,
    /const\s*\{\s*startLocalPreview\s*,\s*openLocalPreview\s*,\s*stopLocalPreview\s*\}\s*=\s*usePreviewActions\(\)/,
  );

  const requiredFacadeCalls = [
    "startLocalPreview(",
    "openLocalPreview(",
    "stopLocalPreview(",
  ];

  for (const call of requiredFacadeCalls) {
    assert.equal(
      source.includes(call),
      true,
      `expected PreviewView.vue to call facade method ${call}`,
    );
  }

  assert.match(
    source,
    /startLocalPreview\(\s*\{[\s\S]*projectDir:\s*ws\.projectDir,[\s\S]*framework:\s*ws\.framework,[\s\S]*port,[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /openLocalPreview\(\s*\{[\s\S]*framework:\s*ws\.framework,[\s\S]*projectDir:\s*ws\.projectDir,[\s\S]*(url:\s*result\.url|port),[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /stopLocalPreview\(\s*\{[\s\S]*projectDir:\s*ws\.projectDir,[\s\S]*framework:\s*ws\.framework,[\s\S]*\}\s*\)/,
  );

  assert.match(source, /if\s*\(!Number\.isInteger\(port\)\s*\|\|\s*port\s*<\s*1\s*\|\|\s*port\s*>\s*65535\)\s*\{/);
  assert.match(source, /status\.value\s*=\s*["']预览端口无效，请输入 1-65535 的整数。["']/);
  assert.match(source, /const\s+port\s*=\s*Number\(preview\.port\s*\|\|\s*getDefaultPort\(ws\.framework\)\)/);

  const forbiddenCalls = [
    "startLocalPreview",
    "openLocalPreview",
    "stopLocalPreview",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected PreviewView.vue to stop calling window.bfeApi.${method}`,
    );
  }
});

test("PreviewView reads as a checkpoint with state and result above technical logs", async () => {
  const source = await readFile(previewViewPath, "utf8");

  assert.match(source, /data-page-role="preview"/);
  assert.match(source, /发布前检查点/);
  assert.match(
    source,
    /data-page-layer="primary"[\s\S]*data-page-layer="explanation"[\s\S]*data-page-layer="detail"/,
  );
  assert.match(source, /最近结果/);
  assert.match(source, /data-page-layer="detail"[\s\S]*查看详细日志与链路事件/);
});
