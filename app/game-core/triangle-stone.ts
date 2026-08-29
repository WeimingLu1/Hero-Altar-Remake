import type { SceneActorState } from "./scene-event";

export const TRIANGLE_STONE_ITEM_ID = 19;
export const TRIANGLE_STONE_SOURCE_IDS = [48, 59, 81, 95, 102, 111] as const;

const sourceIds = new Set<number>(TRIANGLE_STONE_SOURCE_IDS);

export function normalizeTriangleStoneList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const normalized: number[] = [];
  for (const raw of value) {
    const id = Math.floor(Number(raw));
    if (!Number.isFinite(id) || !sourceIds.has(id) || normalized.includes(id))
      continue;
    normalized.push(id);
  }
  return normalized;
}

export function resizeTriangleStoneList(value: unknown, rawCount: unknown) {
  const numeric = Number(rawCount);
  const count = Math.max(
    0,
    Math.min(
      TRIANGLE_STONE_SOURCE_IDS.length,
      Math.floor(Number.isFinite(numeric) ? numeric : 0),
    ),
  );
  const resized = normalizeTriangleStoneList(value).slice(0, count);
  for (const id of TRIANGLE_STONE_SOURCE_IDS) {
    if (resized.length >= count) break;
    if (!resized.includes(id)) resized.push(id);
  }
  return resized;
}

export function triangleStoneCount(
  actor: Pick<SceneActorState, "stoneList">,
) {
  return normalizeTriangleStoneList(actor.stoneList).length;
}
