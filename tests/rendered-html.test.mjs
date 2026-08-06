import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("root route renders the complete official game directly", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>英雄坛说：云游志<\/title>/);
  assert.match(html, /正式版 · 69 MAPS/);
  assert.match(html, /下载 JSON/);
  assert.doesNotMatch(html, /初入江湖/);
  assert.doesNotMatch(html, /原版世界/);
  assert.match(html, /<canvas/);
});

test("server-renders the complete original-world runtime", async () => {
  const response = await render("/original");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /正式版 · 69 MAPS/);
  assert.match(html, /JSON/);
  assert.match(html, /<canvas/);
});

test("local saves are restored only after hydration", async () => {
  const source = await readFile(
    new URL("../app/original/original-world.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /useState<WorldSave>\(fresh\)/);
  assert.match(source, /setTimeout\(\(\) => sync\(loadLocalSave\(\)\), 0\)/);
  assert.doesNotMatch(source, /useState<WorldSave>\(loadLocalSave\)/);
  assert.match(source, /savedAt: ""/);
});
