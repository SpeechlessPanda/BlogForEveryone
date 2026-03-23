import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rssReaderViewPath = new URL("./RssReaderView.vue", import.meta.url);

test("RssReaderView uses rss facade instead of raw window.bfeApi rss calls", async () => {
  const source = await readFile(rssReaderViewPath, "utf8");

  assert.match(source, /useRssActions/);

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
});
