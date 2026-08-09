import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const original = JSON.parse(fs.readFileSync(path.join(repo, "game-data/maps.json"), "utf8"));
const visual = JSON.parse(fs.readFileSync(path.join(repo, "game-data/visual-maps.json"), "utf8"));
const expectedLayers = ["ground", "ground-detail", "structures-low", "props-low", "original-anchors", "blocking-objects", "foreground", "lighting"];
const errors = [];
const visualIndex = new Map(visual.maps.map((map) => [map.originalMapId, map]));

for (const map of original.maps) {
  const generated = visualIndex.get(map.id);
  if (!generated) { errors.push(`MAP ${map.id}: missing runtime map`); continue; }
  if (generated.width !== map.width || generated.height !== map.height) errors.push(`MAP ${map.id}: dimensions changed`);
  const sourcePath = path.join(repo, `map-src/visual/maps/map-${String(map.id).padStart(3, "0")}.json`);
  if (!fs.existsSync(sourcePath)) { errors.push(`MAP ${map.id}: missing Tiled source`); continue; }
  const tiled = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const names = tiled.layers.map((layer) => layer.name);
  if (JSON.stringify(names) !== JSON.stringify(expectedLayers)) errors.push(`MAP ${map.id}: invalid layer contract`);
  const anchorLayer = tiled.layers.find((layer) => layer.name === "original-anchors");
  if (!anchorLayer?.locked) errors.push(`MAP ${map.id}: anchor layer is not locked`);
  const anchors = new Map(generated.anchors.map((anchor) => [anchor.eventId, anchor]));
  for (const event of map.events) {
    const anchor = anchors.get(event.id);
    if (!anchor) errors.push(`MAP ${map.id}: missing event ${event.id}`);
    else if (anchor.x !== event.x || anchor.y !== event.y) errors.push(`MAP ${map.id}: event ${event.id} moved`);
  }
  if (anchors.size !== map.events.length) errors.push(`MAP ${map.id}: duplicate or unknown anchors`);
  for (const anchor of generated.anchors) {
    if (anchor.targetMapId && !original.maps.some((candidate) => candidate.id === anchor.targetMapId))
      errors.push(`MAP ${map.id}: event ${anchor.eventId} targets missing map ${anchor.targetMapId}`);
    if (anchor.kind !== "npc") {
      const neighbor = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => {
        const x = anchor.x + dx, y = anchor.y + dy;
        return x >= 0 && y >= 0 && x < map.width && y < map.height;
      });
      if (!neighbor) errors.push(`MAP ${map.id}: event ${anchor.eventId} has no approach cell`);
    }
  }
}
if (visual.maps.length !== 69) errors.push(`Expected 69 maps, found ${visual.maps.length}`);
const anchorCount = visual.maps.reduce((sum, map) => sum + map.anchors.length, 0);
if (anchorCount !== 400) errors.push(`Expected 400 anchors, found ${anchorCount}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${visual.maps.length} maps, ${anchorCount} immutable anchors and ${expectedLayers.length} Tiled layers.`);
