import { clamp } from "./formulas";
import { getRelation, type GameState, type NpcRelationState } from "./state";

export interface RelationDelta {
  friendliness?: number;
  respect?: number;
  love?: number;
  trust?: number;
}

export function mutateRelation(
  s: GameState,
  a: string,
  b: string,
  delta: RelationDelta,
  event = ""
): NpcRelationState {
  const rel = getRelation(s.world, a, b);
  rel.friendliness = clamp(Math.round(rel.friendliness + (delta.friendliness || 0)), -100, 100);
  rel.respect = clamp(Math.round(rel.respect + (delta.respect || 0)), -100, 100);
  rel.love = clamp(Math.round(rel.love + (delta.love || 0)), 0, 100);
  rel.trust = clamp(Math.round(rel.trust + (delta.trust || 0)), 0, 100);
  rel.meetings += 1;
  if (event) rel.lastEvent = event;
  rel.lastDay = s.player.time.day;
  for (const id of [a, b]) {
    const log = (s.world.npcLogs[id] ||= []);
    log.push(`${s.player.time.day}日 ${event || "互动"}：${a} ↔ ${b}`);
    if (log.length > 24) log.shift();
  }
  return rel;
}

export function relationLabel(rel: NpcRelationState): string {
  const friend = rel.friendliness >= 60 ? "莫逆" : rel.friendliness >= 25 ? "亲近" : rel.friendliness >= -20 ? "平平" : rel.friendliness >= -60 ? "冷淡" : "仇视";
  const respect = rel.respect >= 60 ? "敬畏" : rel.respect >= 20 ? "敬重" : rel.respect >= -20 ? "寻常" : rel.respect >= -60 ? "轻视" : "鄙夷";
  const love = rel.love >= 80 ? "情深" : rel.love >= 50 ? "心动" : rel.love >= 20 ? "有意" : "无情";
  return `${friend}·${respect}·${love}`;
}
