import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mapsDir = path.join(repo, "map-src/visual/maps");
const output = path.join(repo, "game-data/visual-maps.json");
const property = (owner, name, fallback) => owner.properties?.find((item) => item.name === name)?.value ?? fallback;

function cellsFromTileLayer(layer, width) {
  return (layer?.data || []).flatMap((gid, index) => {
    const clean = Number(gid) & 0x1fffffff;
    if (!clean) return [];
    return [{ x: index % width, y: Math.floor(index / width), sprite: clean >= 65 ? clean - 65 : clean - 1, atlas: clean >= 65 ? "furniture" : "environment" }];
  });
}

const files = fs.readdirSync(mapsDir).filter((file) => /^map-\d{3}\.json$/.test(file)).sort();
const maps = files.map((file) => {
  const tiled = JSON.parse(fs.readFileSync(path.join(mapsDir, file), "utf8"));
  const layer = (name) => tiled.layers.find((candidate) => candidate.name === name);
  const anchorObjects = layer("original-anchors")?.objects || [];
  const anchors = anchorObjects.map((object) => ({
    mapId: Number(property(object, "mapId", property(tiled, "originalMapId", 0))),
    eventId: Number(property(object, "eventId", 0)),
    x: Math.round(object.x / 32), y: Math.round(object.y / 32),
    kind: String(object.class || object.type || "other"), label: String(object.name || ""),
    ...(property(object, "targetMapId", 0) ? { targetMapId: Number(property(object, "targetMapId", 0)) } : {}),
    ...(property(object, "sceneType", undefined) === undefined ? {} : { sceneType: Number(property(object, "sceneType", 0)) }),
    blocking: Boolean(property(object, "blocking", false)), locked: true,
  }));
  const originalMapId = Number(property(tiled, "originalMapId", 0));
  const baseSprite = Math.max(0, Number(layer("ground")?.data?.[0] || 1) - 1);
  return {
    originalMapId, name: String(property(tiled, "mapName", `MAP ${originalMapId}`)),
    version: Number(property(tiled, "visualMapVersion", 1)), width: tiled.width, height: tiled.height,
    theme: String(property(tiled, "theme", "town")), baseSprite,
    defaultSpawn: {
      x: Number(property(tiled, "defaultSpawnX", 9)), y: Number(property(tiled, "defaultSpawnY", 7)),
      direction: Number(property(tiled, "defaultSpawnDirection", 2)),
    },
    anchors,
    layers: Object.fromEntries(["ground-detail", "structures-low", "props-low", "foreground", "lighting"].map((name) => [name, cellsFromTileLayer(layer(name), tiled.width)])),
    blockingObjects: (layer("blocking-objects")?.objects || []).map((object) => ({
      eventId: Number(property(object, "eventId", 0)), x: Math.round(object.x / 32), y: Math.round(object.y / 32), kind: String(object.name || object.type || "object"),
    })),
  };
});

fs.writeFileSync(output, `${JSON.stringify({ format: "rmxp-anchor-visual-maps", version: 1, maps })}\n`);
console.log(`Imported ${maps.length} Tiled maps into ${path.relative(repo, output)}.`);
