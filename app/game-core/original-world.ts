import mapsJson from "../../game-data/maps.json";
import { executeMapCommands, type RmxpCommand } from "./rmxp-events";

export type MapPage = {
  graphic: Record<string, unknown>;
  trigger: number;
  through: boolean;
  commands: RmxpCommand[];
};
export type MapEvent = {
  id: number;
  name: string;
  x: number;
  y: number;
  pages: MapPage[];
};
export type OriginalMap = {
  id: number;
  name: string;
  width: number;
  height: number;
  tileset_id: number;
  tiles: { x: number; y: number; z: number; data: number[] };
  events: MapEvent[];
};
export type WorldPosition = {
  mapId: number;
  x: number;
  y: number;
  direction: number;
};

const maps = (mapsJson as { maps: OriginalMap[] }).maps;
const mapIndex = new Map(maps.map((map) => [map.id, map]));
export const originalMaps = maps;
export const originalStart: WorldPosition = {
  mapId: 4,
  x: 9,
  y: 7,
  direction: 2,
};
export const getOriginalMap = (id: number) => mapIndex.get(id) || maps[0];

export function friendlyEventName(name: string, transferMapId?: number) {
  const value = name.trim(),
    internal = /^(?:ev(?:ent)?\d+|\d+)$/i.test(value);
  if (!internal) return value;
  return transferMapId === undefined ? "" : getOriginalMap(transferMapId).name;
}

export function tileAt(map: OriginalMap, x: number, y: number, layer: number) {
  return (
    map.tiles.data[x + y * map.width + layer * map.width * map.height] || 0
  );
}

export function passable(
  map: OriginalMap,
  x: number,
  y: number,
  direction: 2 | 4 | 6 | 8,
) {
  // This remake intentionally treats the tilemap as a visual canvas. RMXP
  // passage flags (walls, roofs, furniture and terrain) never block movement;
  // only the rectangular map boundary remains.
  void direction;
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function canMoveBetween(
  map: OriginalMap,
  x: number,
  y: number,
  direction: 2 | 4 | 6 | 8,
) {
  const nx = x + (direction === 6 ? 1 : direction === 4 ? -1 : 0),
    ny = y + (direction === 2 ? 1 : direction === 8 ? -1 : 0);
  return nx >= 0 && ny >= 0 && nx < map.width && ny < map.height;
}

export function activePage(event: MapEvent) {
  // Page-condition evaluation is added by the save adapter; unconditional first pages
  // cover every transfer and base NPC hook in the shipped map data.
  return (
    event.pages.find((page) =>
      page.commands.some((command) => command.code !== 0),
    ) || event.pages[0]
  );
}

export function triggerEvent(map: OriginalMap, x: number, y: number) {
  const event = map.events.find((item) => item.x === x && item.y === y);
  if (!event) return null;
  const page = activePage(event);
  return { event, page, result: executeMapCommands(page.commands) };
}
