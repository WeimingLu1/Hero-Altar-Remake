import { originalTables, type OriginalRecord } from "./original-data";
import type { SceneActorState } from "./scene-event";
import { combatSkillProfile, effectiveLevel } from "./skill-system";

export type BattleSpecial = {
  id: number;
  name: string;
  description: string;
  fpCost: number;
  mpCost: number;
  hpCost: number;
  enabled: boolean;
  reason: string;
  type: number;
  useText: string;
};
const skillRecord = (id: number) =>
  (originalTables.skills[id] || {}) as OriginalRecord;
const equippedKungfus = (actor: SceneActorState) => {
  const profile = combatSkillProfile(actor);
  return [
    ...new Set([
      profile.attackId,
      actor.skillUse[2] || 9,
      actor.skillUse[3] || 1,
      actor.skillUse[5] || 8,
    ]),
  ];
};
export function specialFpCost(actor: SceneActorState, id: number) {
  const s = skillRecord(id);
  if (id === 5) return effectiveLevel(actor, 18) < 120 ? 200 : 400;
  if (id === 8) return effectiveLevel(actor, 24) < 150 ? 550 : 850;
  if (id === 23)
    return Math.min(
      250 + Math.floor((effectiveLevel(actor, 39) - 90) / 30) * 150,
      600,
    );
  if (id === 24) return effectiveLevel(actor, 41) < 90 ? 150 : 250;
  return Number(s.fp_cost || 0);
}
export function specialMpCost(actor: SceneActorState, id: number) {
  if (id < 29) return 0;
  const s = skillRecord(id),
    cost = Number(s.mp_cost || 0);
  return cost > 0
    ? cost
    : actor.fpPlus + Number((s.magic_data as number[])?.[0] || 0);
}
function matchingId(actor: SceneActorState, type: number) {
  const p = combatSkillProfile(actor),
    kfType = Number(originalTables.kungfus[type]?.type || 0);
  if (kfType === 1) return actor.skillUse[3] || 1;
  if (kfType === 2) return actor.skillUse[0] || 2;
  if (kfType >= 3 && kfType <= 7) return p.attackId;
  if (kfType === 8) return actor.skillUse[5] || 8;
  if (kfType === 9) return actor.skillUse[2] || 9;
  if (kfType === 10) return actor.skillUse[4];
  return type;
}
export function specialCheck(
  actor: SceneActorState,
  id: number,
  cooldowns: Record<string, number> = {},
) {
  const s = skillRecord(id),
    fp = specialFpCost(actor, id),
    mp = specialMpCost(actor, id),
    hp = Number(s.hp_cost || 0);
  if (cooldowns[String(id)] > 0)
    return { ok: false, reason: `尚需 ${cooldowns[String(id)]} 回合冷却` };
  for (const conflict of (s.crash_skill as number[]) || [])
    if (cooldowns[String(conflict)] > 0)
      return {
        ok: false,
        reason: `与${originalTables.skills[conflict]?.name || "当前绝招"}冲突`,
      };
  for (const row of (s.require as number[][]) || []) {
    const [type, num] = row;
    if (type > 0) {
      const active = matchingId(actor, type);
      if (active !== type)
        return {
          ok: false,
          reason: `需配合${originalTables.kungfus[type]?.name}`,
        };
      if (effectiveLevel(actor, type) < num)
        return {
          ok: false,
          reason: `${originalTables.kungfus[type]?.name}有效等级不足`,
        };
    } else if (type >= -3) {
      const attrs = [actor.str, actor.agi, actor.int, actor.bon];
      if (attrs[Math.abs(type)] < num)
        return { ok: false, reason: "先天属性不足" };
    } else if (type === -4 && actor.fp < Math.max(fp, num))
      return { ok: false, reason: "内力不足" };
    else if (type === -5 && actor.maxFp < Math.max(fp, num))
      return { ok: false, reason: "内力上限不足" };
    else if (type === -6 && actor.hp < num)
      return { ok: false, reason: "气血不足" };
    else if (type === -7 && actor.maxHp < num)
      return { ok: false, reason: "气血上限不足" };
    else if (type === -8 && actor.mp < num)
      return { ok: false, reason: "法力不足" };
    else if (type === -9 && actor.maxMp < num)
      return { ok: false, reason: "法力上限不足" };
  }
  if (actor.fp < fp) return { ok: false, reason: "内力不足" };
  if (actor.mp < mp) return { ok: false, reason: "法力不足" };
  if (actor.hp < hp) return { ok: false, reason: "气血不足" };
  return { ok: true, reason: "可施展" };
}
export function battleSpecials(
  actor: SceneActorState,
  cooldowns: Record<string, number> = {},
): BattleSpecial[] {
  const ids = equippedKungfus(actor)
    .flatMap((id) => (originalTables.kungfus[id]?.skill as number[]) || [])
    .filter((id) => id > 0);
  return [...new Set(ids)].map((id) => {
    const s = skillRecord(id),
      check = specialCheck(actor, id, cooldowns);
    return {
      id,
      name: String(s.name || id),
      description: String(s.description || ""),
      fpCost: specialFpCost(actor, id),
      mpCost: specialMpCost(actor, id),
      hpCost: Number(s.hp_cost || 0),
      enabled: check.ok,
      reason: check.reason,
      type: Number(s.type || 0),
      useText: String((s.use_text as string[])?.[0] || `${s.name}！`),
    };
  });
}
export function paySpecialCost(actor: SceneActorState, special: BattleSpecial) {
  actor.fp = Math.max(0, actor.fp - special.fpCost);
  actor.mp = Math.max(0, actor.mp - special.mpCost);
  actor.hp = Math.max(1, actor.hp - special.hpCost);
}
