import { ARMORS, WEAPONS } from "../content/items";
import { SKILLS, skillDef } from "../content/skills";
import { SECTS } from "../content/sects";
import type { PlayerState } from "./state";

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function effectiveAttrs(p: PlayerState) {
  const cap = (v: number) => Math.max(1, Math.min(60, v));
  return {
    li: cap(p.attrs.li + Math.floor((p.skills.jibenQuan || 0) / 10)),
    wu: cap(p.attrs.wu + Math.floor((p.skills.duShu || 0) / 10)),
    min: cap(p.attrs.min + Math.floor((p.skills.jibenQingGong || 0) / 10)),
    gen: cap(p.attrs.gen + Math.floor((p.skills.jibenNeiGong || 0) / 10))
  };
}

export function ageBonus(p: PlayerState): number {
  return Math.max(0, Math.min(22, p.age) - 14) * 8;
}

export function maxHp(p: PlayerState): number {
  return Math.floor(80 + effectiveAttrs(p).gen * 3 + p.neiliStrength * 4 + ageBonus(p));
}

export function maxMp(p: PlayerState): number {
  const ng = p.neigong ? p.skills[p.neigong] || 0 : 0;
  return Math.floor(20 + p.neiliStrength * 1.2 + ng * 2);
}

export function activeNeigongLevel(p: PlayerState): number {
  return p.neigong ? p.skills[p.neigong] || 0 : 0;
}

export function weaponOf(p: PlayerState): { id: string; name: string; kind: "fist" | "sword" | "blade" | "staff" | "whip"; atk: number; weight: number } {
  if (p.forgeWeapon && p.forgeEquipped) return { id: "forge", ...p.forgeWeapon };
  const w = WEAPONS[p.weapon] || WEAPONS.fist;
  return { id: w.id, name: w.name, kind: w.kind, atk: w.atk, weight: w.weight };
}

export function armorDef(p: PlayerState): number {
  let def = 0;
  if (ARMORS[p.armor]) def += ARMORS[p.armor].def;
  if (ARMORS[p.accessory]) def += ARMORS[p.accessory].def;
  return def;
}

export function totalWeight(p: PlayerState): number {
  return weaponOf(p).weight + (ARMORS[p.armor]?.weight || 0) + (ARMORS[p.accessory]?.weight || 0);
}

export function mainCombatSkill(p: PlayerState): { id: string; level: number } {
  const w = weaponOf(p);
  const basicId = BASIC_FOR_WEAPON[w.kind];
  const candidates = Object.keys(p.skills).filter((id) => {
    const d = SKILLS[id];
    if (!d || d.base || d.hidden) return false;
    return d.weapon === w.kind;
  });
  let best = { id: basicId, level: p.skills[basicId] || 0 };
  for (const id of candidates) {
    const lv = p.skills[id] || 0;
    if (lv > best.level) best = { id, level: lv };
  }
  return best;
}

const BASIC_FOR_WEAPON: Record<string, string> = {
  fist: "jibenQuan",
  sword: "jibenJian",
  blade: "jibenDao",
  staff: "jibenZhang",
  whip: "jibenBian"
};

export function attackPower(p: PlayerState): number {
  const a = effectiveAttrs(p);
  const w = weaponOf(p);
  const skill = mainCombatSkill(p);
  const ngLv = activeNeigongLevel(p);
  // 属性/兵器仍是成长基础，但不再一家独大：QTE 操作与武功选择决定更多战局
  return Math.floor(
    14 +
    a.li * 1.15 +
    w.atk * 0.8 +
    skill.level * 0.6 +
    p.neiliStrength * 0.1 +
    ngLv * 0.18
  );
}

export function defensePower(p: PlayerState): number {
  const a = effectiveAttrs(p);
  const zhaoJia = p.skills.jibenZhaoJia || 0;
  const ngLv = activeNeigongLevel(p);
  return Math.floor(armorDef(p) + a.gen * 0.5 + zhaoJia * 0.6 + ngLv * 0.4);
}

export function speedValue(p: PlayerState): number {
  const a = effectiveAttrs(p);
  const qg = p.skills.jibenQingGong || 0;
  const sectLight = p.sect && SECTS[p.sect] ? p.skills[SECTS[p.sect].lightness] || 0 : 0;
  return a.min + qg * 0.18 + sectLight * 0.1 - totalWeight(p) * 0.08;
}

export function hitChance(p: PlayerState): number {
  const a = effectiveAttrs(p);
  const qg = p.skills.jibenQingGong || 0;
  return clamp(0.72 + a.min * 0.004 + qg * 0.001 + speedValue(p) * 0.003, 0.55, 0.98);
}

export function dodgeChance(p: PlayerState): number {
  const a = effectiveAttrs(p);
  const qg = p.skills.jibenQingGong || 0;
  const w = weaponOf(p);
  return clamp(0.04 + a.min * 0.003 + qg * 0.0015 - w.weight * 0.0015, 0.02, 0.45);
}

export function critChance(p: PlayerState): number {
  const a = effectiveAttrs(p);
  return clamp(0.05 + a.min * 0.001, 0.05, 0.3);
}

export function learnCost(skillId: string, fromLv: number, toLv: number, p: PlayerState): number {
  const d = skillDef(skillId);
  const wu = effectiveAttrs(p).wu;
  let total = 0;
  for (let l = fromLv; l < toLv; l++) {
    // 指数 1.55：门派武功 0→100 级约 2.6 万潜能（悟性 0 时），100→150 再加约 4.6 万
    const factor = d.type === "literacy" ? 1.6 : d.base ? 0.35 : 0.5;
    total += Math.pow(l + 2, 1.55) * factor / (1 + wu * 0.012);
  }
  return Math.ceil(total);
}

export function expRequired(skillId: string, level: number): number {
  const d = skillDef(skillId);
  const f = d.base ? 2 : 5;
  return Math.ceil(level * level * f);
}

export function potentialPerStrength(p: PlayerState): number {
  const a = effectiveAttrs(p);
  const ng = activeNeigongLevel(p);
  const base = 12 / (1 + a.gen * 0.035 + (p.skills.jibenNeiGong || 0) * 0.02 + ng * 0.025);
  return Math.max(2, Math.round(base));
}

export function meditateGain(p: PlayerState): { strength: number; hp: number; mp: number } {
  return {
    strength: 1,
    hp: Math.floor(maxHp(p) * 0.01) + 1,
    mp: Math.floor(maxMp(p) * 0.02) + 1
  };
}

export function hungerCost(p: PlayerState, seconds: number): number {
  const a = effectiveAttrs(p);
  return seconds * (0.08 + a.li * 0.001);
}

export function damageCalc(
  atkPower: number,
  defPower: number,
  opts: { crit?: boolean; heavy?: boolean; mult?: number; poison?: number } = {}
): number {
  const mult = opts.mult || 1;
  // 比例减伤：dmg ∝ atk² / (atk + def×0.9)，防御收益递减且永不免疫（攻=防时减伤约 47%）
  const critMult = opts.crit ? 1.7 : 1;
  const atk = Math.max(1, atkPower);
  const base = (atk * critMult * mult * atk) / (atk + Math.max(0, defPower) * 0.9);
  const variance = 0.85 + Math.random() * 0.3;
  return Math.max(1, Math.round(base * variance));
}

export function gainExpForSkill(p: PlayerState, skillId: string, amount: number): boolean {
  const d = SKILLS[skillId];
  if (!d) return false;
  const cur = p.skills[skillId] || 0;
  if (cur >= d.max) return false;
  const chance = amount / (Math.pow(cur + 1, 1.5) * (d.base ? 0.9 : 1.8));
  // 读书识字通达武学理路：每 10 级 +2% 战斗领悟率，上限 +20%
  const duShuBonus = 1 + Math.min(0.2, Math.floor((p.skills.duShu || 0) / 10) * 0.02);
  if (Math.random() < Math.min(0.5, chance * duShuBonus)) {
    p.skills[skillId] = cur + 1;
    return true;
  }
  return false;
}
