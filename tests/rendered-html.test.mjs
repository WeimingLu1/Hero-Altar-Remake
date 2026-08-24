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

test("root route renders the original title and new-game entry", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>英雄坛说<\/title>/);
  assert.match(html, /开始游戏/);
  assert.match(html, /开始新游戏/);
  assert.match(html, /读取 JSON 存档/);
  assert.doesNotMatch(html, /初入江湖/);
  assert.doesNotMatch(html, /原版世界/);
});

test("original route renders the same official title runtime", async () => {
  const response = await render("/original");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /英雄坛说/);
  assert.match(html, /开始新游戏/);
  assert.match(html, /操作说明/);
});

test("local saves are restored only after hydration", async () => {
  const source = await readFile(
    new URL("../app/original/original-world.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /useState<WorldSave>\(\(\) => initialSave \|\| fresh\(\)\)/);
  assert.match(source, /setTimeout\(\(\) => \{/);
  assert.match(source, /const stored = readJsonStorage\(LOCAL_SAVE_KEY\)/);
  assert.match(source, /const parsed = parseSave\(stored\.value\)/);
  assert.match(source, /sync\(parsed\.value\)/);
  assert.doesNotMatch(source, /useState<WorldSave>\(loadLocalSave\)/);
  const saveSource = await readFile(
    new URL("../app/game-core/save-system.ts", import.meta.url),
    "utf8",
  );
  assert.match(saveSource, /savedAt: ""/);
});
