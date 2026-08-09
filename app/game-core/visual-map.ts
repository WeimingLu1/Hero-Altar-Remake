import visualMapsJson from "../../game-data/visual-maps.json";
import { getOriginalMap, originalMaps, type WorldPosition } from "./original-world";

export type AnchorKind = "npc" | "door" | "transfer" | "well" | "fishing" | "arcade" | "work" | "notice" | "challenge" | "forge" | "item" | "other";
export type MapPoint = { x: number; y: number; direction: 2 | 4 | 6 | 8 };
export type MapAnchor = {
  mapId: number; eventId: number; x: number; y: number; kind: AnchorKind; label: string;
  targetMapId?: number; sceneType?: number; blocking: boolean; locked: true;
};
export type VisualCell = { x: number; y: number; sprite: number; atlas: "environment" | "furniture"; variant?: number };
export type BlockingObject = { eventId: number; x: number; y: number; kind: string };
export type VisualMap = {
  originalMapId: number; name: string; version: number; width: number; height: number;
  theme: "town" | "indoor" | "mountain" | "snow" | "water" | "altar" | "mystic";
  baseSprite: number; defaultSpawn: MapPoint; anchors: MapAnchor[];
  layers: Record<"ground-detail" | "structures-low" | "props-low" | "foreground" | "lighting", VisualCell[]>;
  blockingObjects: BlockingObject[];
};

const visualMaps = (visualMapsJson as { maps: VisualMap[] }).maps;
const visualIndex = new Map(visualMaps.map((map) => [map.originalMapId, map]));
const anchorIndex = new Map(visualMaps.flatMap((map) => map.anchors.map((anchor) => [`${map.originalMapId}:${anchor.eventId}`, anchor] as const)));

export const allVisualMaps = visualMaps;
export const loadVisualMap = (mapId: number) => visualIndex.get(mapId);
export const originalAnchor = (mapId: number, eventId: number) => anchorIndex.get(`${mapId}:${eventId}`);
export const resolveEventVisual = originalAnchor;

export function canEnterVisualCell(mapId: number, x: number, y: number, occupied: ReadonlySet<string> = new Set()) {
  const map = loadVisualMap(mapId) || getOriginalMap(mapId);
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const visual = loadVisualMap(mapId);
  if (visual?.blockingObjects.some((object) => object.x === x && object.y === y)) return false;
  return !occupied.has(`${x},${y}`);
}

export function migrateWorldPosition(position: WorldPosition): WorldPosition {
  const original = originalMaps.find((map) => map.id === position.mapId);
  const visual = loadVisualMap(position.mapId);
  if (!original || !visual) return { mapId: 4, x: 9, y: 7, direction: 2 };
  const available = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < visual.width && y < visual.height &&
    !visual.blockingObjects.some((object) => object.x === x && object.y === y);
  if (available(position.x, position.y)) return { ...position };
  for (let distance = 1; distance < Math.max(visual.width, visual.height); distance += 1) {
    for (let dx = -distance; dx <= distance; dx += 1) {
      const dy = distance - Math.abs(dx);
      for (const y of dy === 0 ? [position.y] : [position.y - dy, position.y + dy]) {
        const x = position.x + dx;
        if (available(x, y)) return { mapId: position.mapId, x, y, direction: position.direction || 2 };
      }
    }
  }
  return { mapId: position.mapId, ...visual.defaultSpawn };
}

export function validateAnchorEnvironment(map: VisualMap) {
  const original = getOriginalMap(map.originalMapId);
  const errors: string[] = [];
  if (map.width !== original.width || map.height !== original.height) errors.push(`MAP ${map.originalMapId}: dimensions changed`);
  const seen = new Set<number>();
  for (const anchor of map.anchors) {
    const event = original.events.find((candidate) => candidate.id === anchor.eventId);
    if (!event) errors.push(`MAP ${map.originalMapId}: unknown event ${anchor.eventId}`);
    else if (event.x !== anchor.x || event.y !== anchor.y) errors.push(`MAP ${map.originalMapId}: event ${anchor.eventId} moved`);
    if (seen.has(anchor.eventId)) errors.push(`MAP ${map.originalMapId}: duplicate event ${anchor.eventId}`);
    seen.add(anchor.eventId);
    if (anchor.x < 0 || anchor.y < 0 || anchor.x >= map.width || anchor.y >= map.height) errors.push(`MAP ${map.originalMapId}: event ${anchor.eventId} out of bounds`);
  }
  for (const event of original.events) if (!seen.has(event.id)) errors.push(`MAP ${map.originalMapId}: event ${event.id} missing`);
  return errors;
}
