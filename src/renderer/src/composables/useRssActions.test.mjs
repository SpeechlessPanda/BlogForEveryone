import test from "node:test";
import assert from "node:assert/strict";

import { createRssActions } from "./useRssActions.mjs";

test("rss actions preserve subscription and export contracts", async () => {
  const calls = [];
  const api = {
    listSubscriptions: async () => {
      calls.push(["listSubscriptions"]);
      return [];
    },
    addSubscription: async (payload) => {
      calls.push(["addSubscription", payload]);
      return [];
    },
    removeSubscription: async (payload) => {
      calls.push(["removeSubscription", payload]);
      return [];
    },
    syncSubscriptions: async () => {
      calls.push(["syncSubscriptions"]);
      return [];
    },
    markSubscriptionItemRead: async (payload) => {
      calls.push(["markSubscriptionItemRead", payload]);
      return [];
    },
    pickDirectory: async (payload) => {
      calls.push(["pickDirectory", payload]);
      return { canceled: false, path: "D:/blogs/demo" };
    },
    exportSubscriptions: async (payload) => {
      calls.push(["exportSubscriptions", payload]);
      return "D:/blogs/demo/subscriptions.bundle.json";
    },
    getRssUnreadSummary: async () => {
      calls.push(["getRssUnreadSummary"]);
      return { totalUnread: 12 };
    },
  };

  const actions = createRssActions(api);

  await actions.listSubscriptions();
  await actions.addSubscription({ url: "https://example.com/rss.xml", title: "Example" });
  await actions.removeSubscription({ id: "sub-1" });
  await actions.syncSubscriptions();
  await actions.markSubscriptionItemRead({ subscriptionId: "sub-1", itemKey: "post-1" });
  await actions.pickDirectory({ title: "选择导出目录", defaultPath: "D:/blogs/demo" });
  await actions.exportSubscriptions({ workspaceId: "ws-1", projectDir: "D:/blogs/demo" });
  await actions.getRssUnreadSummary();

  assert.deepEqual(calls, [
    ["listSubscriptions"],
    ["addSubscription", { url: "https://example.com/rss.xml", title: "Example" }],
    ["removeSubscription", { id: "sub-1" }],
    ["syncSubscriptions"],
    ["markSubscriptionItemRead", { subscriptionId: "sub-1", itemKey: "post-1" }],
    ["pickDirectory", { title: "选择导出目录", defaultPath: "D:/blogs/demo" }],
    ["exportSubscriptions", { workspaceId: "ws-1", projectDir: "D:/blogs/demo" }],
    ["getRssUnreadSummary"],
  ]);
});

test("rss actions reject missing ids for targeted operations", async () => {
  const actions = createRssActions({
    listSubscriptions: async () => [],
    addSubscription: async () => [],
    removeSubscription: async () => [],
    syncSubscriptions: async () => [],
    markSubscriptionItemRead: async () => [],
    pickDirectory: async () => ({}),
    exportSubscriptions: async () => "",
    getRssUnreadSummary: async () => ({}),
  });

  await assert.rejects(() => actions.removeSubscription({}), /id/);
  await assert.rejects(() => actions.addSubscription({ title: "Example" }), /url/);
  await assert.rejects(
    () => actions.markSubscriptionItemRead({ subscriptionId: "sub-1" }),
    /itemKey/,
  );
  await assert.rejects(
    () => actions.exportSubscriptions({}),
    /projectDir/,
  );
  await assert.rejects(
    () => actions.exportSubscriptions({ projectDir: "D:/blogs/demo" }),
    /workspaceId/,
  );
});
