import { SKILLS } from "../content/skills";
import { AREAS } from "../content/areas";
import { ITEMS } from "../content/items";
import type { GameState } from "./state";
import { clamp, maxHp, maxMp } from "./formulas";

export function cheatSetAttr(s: GameState, key: "li" | "wu" | "min" | "gen", v: number): void {
  s.player.attrs[key] = clamp(Math.round(v), 1, 99);
}

export function cheatSetMoney(s: GameState, v: number): void {
  s.player.money = Math.max(0, Math.round(v));
}

export function cheatSetPotential(s: GameState, v: number): void {
  s.player.potential = Math.max(0, Math.round(v));
}

export function cheatSetExp(s: GameState, v: number): void {
  s.player.exp = Math.max(0, Math.round(v));
}

export function cheatSetMoral(s: GameState, v: number): void {
  s.player.moral = clamp(Math.round(v), -100, 100);
}

export function cheatSetStrength(s: GameState, v: number): void {
  s.player.neiliStrength = Math.max(0, Math.min(999, Math.round(v)));
  s.player.hp = Math.min(s.player.hp, maxHp(s.player));
  s.player.effHp = Math.min(s.player.effHp, maxHp(s.player));
  s.player.mp = Math.min(s.player.mp, maxMp(s.player));
}

export function cheatSetAge(s: GameState, v: number): void {
  s.player.age = clamp(Math.round(v), 14, 99);
  const mh = maxHp(s.player);
  s.player.hp = Math.min(s.player.hp, mh);
  s.player.effHp = Math.min(s.player.effHp, mh);
}

export function cheatHeal(s: GameState): void {
  s.player.hp = s.player.effHp = maxHp(s.player);
  s.player.mp = maxMp(s.player);
  s.player.poison = 0;
  s.player.hunger = 100;
  s.player.thirst = 100;
}

export function cheatSetSkill(s: GameState, skillId: string, level: number): void {
  const def = SKILLS[skillId];
  if (!def) return;
  s.player.skills[skillId] = clamp(Math.round(level), 0, def.max);
  if (def.hidden) s.player.flags[`learned-${skillId}`] = true;
}

export function cheatAddItem(s: GameState, itemId: string, n: number): void {
  if (!ITEMS[itemId]) return;
  s.player.items[itemId] = Math.max(0, (s.player.items[itemId] || 0) + Math.round(n));
  if (s.player.items[itemId] <= 0) delete s.player.items[itemId];
}

export function cheatTeleport(s: GameState, area: string): void {
  if (!AREAS[area]) return;
  s.player.area = area;
  s.player.room = null;
  s.player.x = 220;
}

export function cheatAllSkills(s: GameState, level: number): void {
  for (const id of Object.keys(SKILLS)) {
    const def = SKILLS[id];
    s.player.skills[id] = clamp(level, 0, def.max);
    if (def.hidden) s.player.flags[`learned-${id}`] = true;
  }
}

export function cheatToggleLock(s: GameState): boolean {
  s.player.cheatLock = !s.player.cheatLock;
  if (s.player.cheatLock) cheatHeal(s);
  return s.player.cheatLock;
}

export function cheatToggleClassic(s: GameState): boolean {
  s.player.yobdc = !s.player.yobdc;
  return s.player.yobdc;
}

export function cheatCompleteQuest(s: GameState, questId: string): void {
  const qp = s.player.quests[questId] || (s.player.quests[questId] = { stage: 0, done: false, repeat: 0 });
  qp.stage = 0;
  qp.done = true;
}
