import mapsJson from "../../game-data/maps.json";
import tilesetsJson from "../../game-data/tilesets.json";
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
const tilesets = (
  tilesetsJson as {
    data: Array<{
      id: number;
      passages: { data: number[] };
      priorities: { data: number[] };
    }>;
  }
).data;

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
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const tileset =
    tilesets.find((item) => item.id === map.tileset_id) || tilesets[0];
  const passages = tileset.passages.data,
    priorities = tileset.priorities.data;
  const bit = (1 << (direction / 2 - 1)) & 0x0f;
  for (const layer of [2, 1, 0]) {
    const tile = tileAt(map, x, y, layer);
    const passage = passages[tile] || 0;
    if ((passage & bit) !== 0 || (passage & 0x0f) === 0x0f) return false;
    if ((priorities[tile] || 0) === 0) return true;
  }
  return true;
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
