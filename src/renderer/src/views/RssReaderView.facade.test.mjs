import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rssReaderViewPath = new URL("./RssReaderView.vue", import.meta.url);

test("RssReaderView uses rss facade instead of raw window.bfeApi rss calls", async () => {
  const source = await readFile(rssReaderViewPath, "utf8");

  assert.match(
    source,
    /import\s*\{\s*useRssActions\s*\}\s*from\s*["']\.\.\/composables\/useRssActions\.mjs["']/,
  );
  assert.match(
    source,
    /const\s*\{[\s\S]*listSubscriptions\s*,[\s\S]*addSubscription\s*,[\s\S]*removeSubscription\s*,[\s\S]*syncSubscriptions\s*,[\s\S]*markSubscriptionItemRead\s*,[\s\S]*pickDirectory\s*,[\s\S]*exportSubscriptions\s*,?[\s\S]*\}\s*=\s*useRssActions\(\)/,
  );

  const requiredFacadeCalls = [
    "listSubscriptions(",
    "addSubscription(",
    "removeSubscription(",
    "syncSubscriptions(",
    "markSubscriptionItemRead(",
    "pickDirectory(",
    "exportSubscriptions(",
  ];

  for (const call of requiredFacadeCalls) {
    assert.equal(
      source.includes(call),
      true,
      `expected RssReaderView.vue to call facade method ${call}`,
    );
  }

  assert.match(source, /setSubscriptions\(await\s+listSubscriptions\(\)\)/);
  assert.match(
    source,
    /addSubscription\(\s*\{[\s\S]*url:\s*form\.url,[\s\S]*title:\s*form\.title,[\s\S]*\}\s*\)/,
  );
  assert.match(source, /setSubscriptions\(await\s+removeSubscription\(\s*\{\s*id\s*\}\s*\)\)/);
  assert.match(source, /setSubscriptions\(await\s+syncSubscriptions\(\)\)/);
  assert.match(
    source,
    /markSubscriptionItemRead\(\s*\{[\s\S]*subscriptionId:\s*subscription\.id,[\s\S]*itemKey,[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /pickDirectory\(\s*\{[\s\S]*title:\s*["']选择导出订阅所对应的博客目录["'],[\s\S]*defaultPath:\s*form\.exportProjectDir\s*\|\|\s*undefined,[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /exportSubscriptions\(\s*\{[\s\S]*projectDir:\s*form\.exportProjectDir,[\s\S]*\}\s*\)/,
  );

  const forbiddenCalls = [
    "listSubscriptions",
    "addSubscription",
    "removeSubscription",
    "syncSubscriptions",
    "markSubscriptionItemRead",
    "pickDirectory",
    "exportSubscriptions",
  ];

  for (const method of forbiddenCalls) {
    assert.equal(
      source.includes(`window.bfeApi.${method}`),
      false,
      `expected RssReaderView.vue to stop calling window.bfeApi.${method}`,
    );
  }

  assert.match(source, /useShellActions/);
  assert.doesNotMatch(source, /new CustomEvent\("bfe:open-tutorial"\)/);
  assert.match(source, /shellActions\.openTutorial\("rss-reading"\)/);
});
