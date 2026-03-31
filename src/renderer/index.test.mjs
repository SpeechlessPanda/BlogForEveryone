import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rendererHtmlPath = new URL("./index.html", import.meta.url);

test("renderer entry html defines a restrictive Electron-safe CSP", async () => {
  const source = await readFile(rendererHtmlPath, "utf8");

  const cspMatch = source.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i);
  assert.equal(Boolean(cspMatch), true);

  const csp = cspMatch?.[1] || "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  assert.match(csp, /img-src 'self' data: https:/);
  assert.match(csp, /connect-src 'self' https: ws: wss:/);
  assert.match(csp, /font-src 'self' data:/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
});
