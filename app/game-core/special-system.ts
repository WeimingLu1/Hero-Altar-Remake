import { originalTables, type OriginalRecord } from "./original-data";
import type { SceneActorState } from "./scene-event";
import { derivedStats } from "./inventory-system";
import {
  effectiveLevel,
  naturalSlot,
  skillType,
  weaponBasicId,
} from "./skill-system";

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
const learnedSpecialKungfus = (actor: SceneActorState) =>
  Object.entries(actor.skills)
    .filter(([, progress]) => progress.level > 0)
    .map(([id]) => Number(id));
const learnedSpecialOwners = (actor: SceneActorState, specialId: number) =>
  learnedSpecialKungfus(actor).filter((kungfuId) =>
    ((originalTables.kungfus[kungfuId]?.skill as number[]) || []).includes(
      specialId,
    ),
  );
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
    : actor.mpPlus + Number((s.magic_data as number[])?.[0] || 0);
}
function kungfuWeaponRequirement(actor: SceneActorState, kungfuId: number) {
  const type = skillType(kungfuId), name = originalTables.kungfus[kungfuId]?.name,
    weaponName = type === 3 ? "剑类兵器" : type === 4 ? "刀类兵器" : type === 5
      ? "杖棍类兵器" : type === 6 ? "鞭索类兵器" : "对应兵器";
  if (type === 2 && actor.weaponId > 0)
    return `施展${name || "拳脚绝招"}时必须空手`;
  if (type >= 3 && type <= 6) {
    if (actor.weaponId <= 0) return `施展${name || "兵刃绝招"}需要装备${weaponName}`;
    if (weaponBasicId(actor.weaponId) !== type)
      return `施展${name || "这门武学"}需装备${weaponName}，当前兵器不匹配`;
  }
  return "";
}
function specialWeaponRequirement(actor: SceneActorState, specialId: number) {
  const owners = learnedSpecialOwners(actor, specialId).filter((kungfuId) => {
    const type = skillType(kungfuId);
    return type >= 2 && type <= 6;
  });
  if (!owners.length) return "";
  const reasons = owners.map((kungfuId) =>
    kungfuWeaponRequirement(actor, kungfuId),
  );
  return reasons.some((reason) => !reason) ? "" : reasons[0];
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
  if (id >= 29) {
    const required = Number((s.magic_data as number[])?.[1] || 0),
      magicOwners = learnedSpecialOwners(actor, id).filter(
        (kungfuId) => skillType(kungfuId) === 8,
      ),
      magicRequirements = ((s.require as number[][]) || [])
        .map(([kungfuId]) => kungfuId)
        .filter((kungfuId) => skillType(kungfuId) === 8),
      magicId = magicOwners[0] ||
        magicRequirements.find((kungfuId) => kungfuId > 11) ||
        magicRequirements[0] ||
        8;
    if (effectiveLevel(actor, magicId) < required)
      return {
        ok: false,
        reason: `${originalTables.kungfus[magicId]?.name || "法术"}有效等级不足`,
      };
  }
  for (const row of (s.require as number[][]) || []) {
    const [type, num] = row;
    if (type > 0) {
      // 流星飞掷只要已经从神龙杖法学到便可施展，不再重复卡
      // 神龙杖法、普天同济的有效等级；资源与兵器仍在下方校验。
      if (id === 8) continue;
      if ((actor.skills[String(type)]?.level || 0) <= 0)
        return {
          ok: false,
          reason: `尚未学会${originalTables.kungfus[type]?.name}`,
        };
      if (effectiveLevel(actor, type) < num)
        return {
          ok: false,
          reason: `${originalTables.kungfus[type]?.name}有效等级不足`,
        };
      // 原作"绝招需配合武功使用"(021 - Game_Battler 2.rb check_skill_require)：
      // 该功夫必须正装备在所属槽位(招架类看 skill_use[4])，只学会不够。
      const slot = type === 10 ? 4 : naturalSlot(type);
      if (slot !== null && actor.skillUse[slot] !== type)
        return {
          ok: false,
          reason: `施展需先装备${originalTables.kungfus[type]?.name || "对应武学"}`,
        };
    } else if (type >= -3) {
      // 同时取消流星飞掷的先天敏捷门槛。
      if (id === 8 && type === -1) continue;
      // 原作按 str/agi/int/bon 方法比较(含基本功夫与装备加成)，非裸基础值。
      const d = derivedStats(actor),
        attrs = [d.str, d.agi, d.int, d.bon];
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
  const weaponReason = specialWeaponRequirement(actor, id);
  if (weaponReason) return { ok: false, reason: weaponReason };
  if (actor.fp < fp) return { ok: false, reason: "内力不足" };
  // 法术绝招需满足原作储备线：法力 ≥ max(法点*2+100, 消耗)
  // (021 - Game_Battler 2.rb check_magic_require)，残蓝不放法。
  if (id >= 29 && actor.mp < Math.max(actor.mpPlus * 2 + 100, mp))
    return { ok: false, reason: "法力不足以催动法术" };
  if (actor.mp < mp) return { ok: false, reason: "法力不足" };
  if (actor.hp < hp) return { ok: false, reason: "气血不足" };
  return { ok: true, reason: "可施展" };
}
export function battleSpecials(
  actor: SceneActorState,
  cooldowns: Record<string, number> = {},
): BattleSpecial[] {
  // 以完整原始绝招表为主索引，再反查任一已学所属武学。条件不足的
  // 绝招仍然保留在菜单中并显示原因，不能因暂时不可施展而遗漏。
  const ids = originalTables.skills.flatMap((skill, id) =>
    skill && id > 0 && learnedSpecialOwners(actor, id).length ? [id] : [],
  );
  return ids.map((id) => {
    const s = skillRecord(id),
      check = specialCheck(actor, id, cooldowns),
      completedSnowflake = id === 23 && actor.xue6;
    return {
      id,
      name: String(s.name || id),
      description: completedSnowflake
        ? "雪花六出完整形态，一气连出二十二剑"
        : String(s.description || ""),
      fpCost: specialFpCost(actor, id),
      mpCost: specialMpCost(actor, id),
      hpCost: Number(s.hp_cost || 0),
      enabled: check.ok,
      reason: check.reason,
      type: Number(s.type || 0),
      useText: completedSnowflake
        ? "你长啸一声，使出雪山神技雪花六出，剑势依照雪花六角之形层叠展开，一气连出二十二剑！"
        : String((s.use_text as string[])?.[0] || `${s.name}！`),
    };
  });
}
export function paySpecialCost(actor: SceneActorState, special: BattleSpecial) {
  actor.fp = Math.max(0, actor.fp - special.fpCost);
  actor.mp = Math.max(0, actor.mp - special.mpCost);
  actor.hp = Math.max(0, actor.hp - special.hpCost);
}
