import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const CLIENT_ROOT = join(ROOT, "dist/client");
const CHUNK_LIMIT = 500_000;
const TITLE_GZIP_LIMIT = 125 * 1024;
const ASSET_LIMIT = 10 * 1024 * 1024;

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }))).flat();
}

const failures = [];
const chunks = (await files(CLIENT_ROOT)).filter((path) => path.endsWith(".js"));
let largestChunk = { path: "", size: 0 };
for (const path of chunks) {
  const size = (await stat(path)).size;
  if (size > largestChunk.size) largestChunk = { path, size };
  if (size > CHUNK_LIMIT)
    failures.push(`客户端分块超出 500 KB：${relative(ROOT, path)} (${size} bytes)`);
}

const viteManifest = JSON.parse(
  await readFile(join(CLIENT_ROOT, ".vite/manifest.json"), "utf8"),
);
const initialKeys = new Set();
function addStaticImports(key) {
  if (!key || initialKeys.has(key) || !viteManifest[key]) return;
  initialKeys.add(key);
  for (const imported of viteManifest[key].imports || []) addStaticImports(imported);
}
// vinext loads the app browser runtime and the route's lightweight title entry.
// Dynamic imports intentionally remain outside this initial graph.
addStaticImports("virtual:vinext-app-browser-entry");
addStaticImports("app/original/original-entry.tsx");
let titleGzipBytes = 0;
for (const key of initialKeys) {
  const file = viteManifest[key]?.file;
  if (file) titleGzipBytes += gzipSync(await readFile(join(CLIENT_ROOT, file))).byteLength;
}
if (titleGzipBytes > TITLE_GZIP_LIMIT)
  failures.push(`标题页初始 JS gzip 为 ${titleGzipBytes} bytes，超出 ${TITLE_GZIP_LIMIT} bytes。`);
for (const forbidden of ["app/original/original-world.tsx", "app/game-core/lm-studio.ts", "app/game-core/save-system.ts"]) {
  if (initialKeys.has(forbidden)) failures.push(`标题页错误地同步加载：${forbidden}`);
}

const assetRoot = join(ROOT, "public/game-assets");
const assetFiles = (await files(assetRoot)).filter((path) => !path.endsWith("manifest.json"));
const assetBytes = (await Promise.all(assetFiles.map(async (path) => (await stat(path)).size)))
  .reduce((sum, size) => sum + size, 0);
if (assetBytes > ASSET_LIMIT)
  failures.push(`game-assets 共 ${assetBytes} bytes，超出 10 MiB。`);

const assetManifest = JSON.parse(await readFile(join(assetRoot, "manifest.json"), "utf8"));
const declared = [];
function collectSources(value) {
  if (typeof value === "string" && value.startsWith("/game-assets/")) declared.push(value);
  else if (Array.isArray(value)) value.forEach(collectSources);
  else if (value && typeof value === "object") Object.values(value).forEach(collectSources);
}
collectSources(assetManifest.assets);
const duplicates = declared.filter((src, index) => declared.indexOf(src) !== index);
if (duplicates.length) failures.push(`素材 manifest 存在重复项：${[...new Set(duplicates)].join(", ")}`);
const declaredPaths = new Set(declared.map((src) => join(ROOT, "public", src)));
for (const path of declaredPaths) {
  try {
    await stat(path);
  } catch {
    failures.push(`素材 manifest 指向不存在的文件：${relative(ROOT, path)}`);
  }
}
const orphaned = assetFiles.filter((path) => !declaredPaths.has(path));
if (orphaned.length)
  failures.push(`存在未登记素材：${orphaned.map((path) => relative(ROOT, path)).join(", ")}`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Bundle budget OK: ${chunks.length} chunks; largest ${largestChunk.size} / ${CHUNK_LIMIT} bytes.`);
  console.log(`Title budget OK: ${titleGzipBytes} / ${TITLE_GZIP_LIMIT} gzip bytes.`);
  console.log(`Asset budget OK: ${assetBytes} / ${ASSET_LIMIT} bytes; ${declaredPaths.size} files registered.`);
}
