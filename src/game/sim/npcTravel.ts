import { AREAS } from "../content/areas";
import { NPCS } from "../content/npcs";
import { atWork, shouldBeOut } from "./npcSchedule";

export interface NpcLocation {
  area: string;
  room: string | null;
  x: number;
  present: boolean;
  travelNote: string;
}

function hashText(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

const AREA_IDS = Object.keys(AREAS);

export function npcLocation(npcId: string, day: number, hour: number): NpcLocation {
  const n = NPCS[npcId];
  if (!n) return { area: "town", room: null, x: 220, present: false, travelNote: "无此人" };
  if (atWork(day, hour)) {
    return { area: n.area, room: n.room || null, x: n.x, present: true, travelNote: "在岗" };
  }
  if (!shouldBeOut(npcId, day, hour)) {
    return { area: n.area, room: n.room || null, x: n.x, present: true, travelNote: "在家" };
  }
  const destIndex = hashText(`${npcId}:${day}:${Math.floor(hour / 3)}`) % AREA_IDS.length;
  const dest = AREA_IDS[destIndex];
  const width = AREAS[dest]?.width || 1200;
  const x = 100 + (hashText(`${npcId}:${dest}:${day}:${Math.floor(hour)}`) % Math.max(120, width - 240));
  return { area: dest, room: null, x, present: true, travelNote: "外出游历" };
}
