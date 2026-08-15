import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const CHUNK_LIMIT = 500_000;
const ASSET_LIMIT = 10 * 1024 * 1024;

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }))).flat();
}

const chunks = (await files(join(ROOT, "dist/client"))).filter((path) => path.endsWith(".js"));
const oversized = [];
for (const path of chunks) {
  const size = (await stat(path)).size;
  if (size > CHUNK_LIMIT) oversized.push(`${relative(ROOT, path)} (${size} bytes)`);
}

const assets = await files(join(ROOT, "public/game-assets"));
let assetBytes = 0;
for (const path of assets) assetBytes += (await stat(path)).size;

if (oversized.length || assetBytes > ASSET_LIMIT) {
  if (oversized.length) console.error(`超出 500 KB 的客户端分块：\n${oversized.join("\n")}`);
  if (assetBytes > ASSET_LIMIT) console.error(`game-assets 共 ${assetBytes} bytes，超出 10 MiB。`);
  process.exitCode = 1;
} else {
  console.log(`Bundle budget OK: ${chunks.length} chunks, largest <= ${CHUNK_LIMIT} bytes.`);
  console.log(`Asset budget OK: ${assetBytes} / ${ASSET_LIMIT} bytes.`);
}
