import { SKILLS } from "../content/skills";
import type { GameState } from "./state";

export function observeSkillName(s: GameState, name: string): void {
  if (!name) return;
  const p = s.player;
  if (!p.observedSkills.includes(name)) p.observedSkills.push(name);
}

export function findSkillByName(name: string): string | null {
  if (!name) return null;
  const direct = Object.entries(SKILLS).find(([, def]) => def.name === name);
  if (direct) return direct[0];
  const loose = Object.entries(SKILLS).find(([, def]) => name.includes(def.name) || def.name.includes(name));
  return loose ? loose[0] : null;
}

export function masterSkill(s: GameState, skillId: string): boolean {
  const def = SKILLS[skillId];
  if (!def) return false;
  s.player.skills[skillId] = def.max;
  if (def.hidden) s.player.flags[`learned-${skillId}`] = true;
  return true;
}
