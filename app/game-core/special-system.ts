import { originalTables, type OriginalRecord } from "./original-data";
import type { SceneActorState } from "./scene-event";
import { derivedStats } from "./inventory-system";
import {
  effectiveLevel,
  naturalSlot,
  skillCategoryName,
  skillLevel,
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
  /** 直接可施展=false 且换装后可施展=true：菜单据此标注“施展时自动换装”。 */
  needsAutoEquip: boolean;
  type: number;
  useText: string;
  /** 按当前人物换算的效果说明：威力、增益幅度、控制回合与冷却。 */
  effect: string;
  /** 所属武学的类目（拳脚/剑术/刀法/杖法/鞭法/棍法/术法/内功…）。 */
  category: string;
  /** 所属武学名，如“雪山剑法”。 */
  owner: string;
  /** 类目排序键（原作武学 type），仅内部用于分组排序。 */
  categoryType: number;
  /** 按当前配置换算的伤害/威力说明（每击、连击或直接伤害）。 */
  damage: string;
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
// 临阵自动换装：绝招要求的功夫只要玩家已经学会，就直接切换到对应槽位，
// 省去"退出战斗→装备→再施展"的来回操作；未学会或兵器类别不匹配等仍由
// specialCheck 给出原因。返回是否有槽位被改变。
export function autoEquipSpecialRequirements(actor: SceneActorState, id: number) {
  // 流星飞掷在 specialCheck 中跳过武学行，这里同样不动装备。
  if (id === 8) return false;
  let switched = false;
  for (const [type] of (skillRecord(id).require as number[][]) || []) {
    if (type <= 0) continue;
    if ((actor.skills[String(type)]?.level || 0) <= 0) continue;
    const slot = type === 10 ? 4 : naturalSlot(type);
    if (slot === null || actor.skillUse[slot] === type) continue;
    const previous = actor.skillUse[slot];
    actor.skillUse[slot] = type;
    // 与 equipSkill 同一约定：原占用者正用于招架时一并解除。
    if (previous && actor.skillUse[4] === previous)
      actor.skillUse[4] = 0;
    switched = true;
  }
  return switched;
}

// 菜单可用性口径：先按"会就自动换装"评估——只有换装后仍不满足的条件
// (内力不足、冷却、兵器不符、根本没学过)才判为不可施展。
export function specialEnabledWithAutoEquip(
  actor: SceneActorState,
  id: number,
  cooldowns: Record<string, number> = {},
) {
  const direct = specialCheck(actor, id, cooldowns);
  if (direct.ok) return direct;
  const draft = structuredClone(actor);
  autoEquipSpecialRequirements(draft, id);
  return specialCheck(draft, id, cooldowns);
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
  const rows = ids.map((id) => {
    const s = skillRecord(id),
      direct = specialCheck(actor, id, cooldowns),
      check = specialEnabledWithAutoEquip(actor, id, cooldowns),
      completedSnowflake = id === 23 && actor.xue6,
      // 每个绝招只由一门武学传授(原作 kungfu.skill)，用它推导类目与出处。
      ownerId = learnedSpecialOwners(actor, id).find(
        (kungfuId) => skillType(kungfuId) >= 1 && skillType(kungfuId) <= 11,
      ),
      categoryType = ownerId ? skillType(ownerId) : 0;
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
      needsAutoEquip: !direct.ok && check.ok,
      type: Number(s.type || 0),
      useText: completedSnowflake
        ? "你长啸一声，使出雪山神技雪花六出，剑势依照雪花六角之形层叠展开，一气连出二十二剑！"
        : String((s.use_text as string[])?.[0] || `${s.name}！`),
      effect: specialEffectSummary(actor, id),
      damage: specialDamageSummary(actor, id),
      category: skillCategoryName(categoryType),
      owner: ownerId ? String(originalTables.kungfus[ownerId]?.name || ownerId) : "",
      categoryType,
    };
  });
  return rows.sort(
    (a, b) => a.categoryType - b.categoryType || a.id - b.id,
  );
}
// 绝招冷却回合数：从 original-battle 的结算公式中抽出供菜单说明共用，
// 数值必须与 specialRound 保持一致。
export function specialCooldownTurns(actor: SceneActorState, id: number) {
  const dynamic =
    id === 7
      ? Math.min(Math.floor(effectiveLevel(actor, 21) / 20), 8) + 1
      : id === 9 || id === 10
        ? Math.floor(effectiveLevel(actor, 26) / 20) + 1
        : id === 14
          ? Math.floor(effectiveLevel(actor, 31) / 20) + 1
          : 0;
  const fixed: Record<number, number> = {
    3: 8,
    4: 8,
    5: 8,
    6: 7,
    8: 10,
    11: 6,
    12: 8,
  };
  if (fixed[id]) return fixed[id];
  if (dynamic) return dynamic;
  if (id === 1 || id === 2) {
    const level = effectiveLevel(actor, id === 1 ? 12 : 13);
    return id === 1 ? Math.floor(level / 25) + 1 : Math.floor(level / 20) + 1;
  }
  return 0;
}
const spellStateText = (spellId: number) => {
  const data = (originalTables.skills[spellId]?.magic_data as number[]) || [];
  return Number(data[6] || 0) === 1
    ? "命中可灼目，降低对手命中"
    : Number(data[6] || 0) === 2
      ? "命中可点燃法火持续灼烧"
      : Number(data[6] || 0) === 3
        ? "命中可寒气冻住对手"
        : "";
};
// 绝招菜单的效果说明：按 specialRound 的真实公式换算成当前人物可达数值，
// 只描述不结算；依赖对手数值的伤害用“约”表述。
export function specialEffectSummary(actor: SceneActorState, id: number) {
  const parts: string[] = [];
  switch (id) {
    case 1: {
      const lv = effectiveLevel(actor, 12);
      parts.push(
        `命中+${Math.floor(lv / 15)}，持续${Math.floor(lv / 25) + 1}回合，随后接一击`,
      );
      break;
    }
    case 2: {
      const lv = effectiveLevel(actor, 13);
      parts.push(
        `命中+${Math.floor(lv / 15)}·膂力+${Math.floor((lv * 2) / 15)}，持续${Math.floor(lv / 20) + 1}回合，随后接一击`,
        "施展后自缚3回合",
      );
      break;
    }
    case 3:
      parts.push("连出两招", "施展后硬直4回合");
      break;
    case 4:
      parts.push("连出三招，每招附加15点伤害", "施展后硬直4回合");
      break;
    case 5:
      parts.push("连出三招，每招劲道+10", "施展后硬直4回合");
      break;
    case 6:
      parts.push(
        "卷走对手兵刃；对手空手时卷入鞭圈并禁足2回合",
      );
      break;
    case 7: {
      const flower = effectiveLevel(actor, 21);
      parts.push(
        `敏捷+${Math.floor(flower / 20)}·闪避+${Math.floor(flower / 5) - 6}，持续${Math.min(Math.floor(flower / 20), 8) + 1}回合`,
      );
      break;
    }
    case 8:
      parts.push(
        "掷出当前兵刃贯穿对手",
        "无论掷中掷空都硬直4–5回合",
        "普通杖掷出即损耗，自制杖自动收回",
      );
      break;
    case 9: {
      const lotus = effectiveLevel(actor, 26);
      parts.push(`膂力+${Math.floor(lotus / 6)}，持续${Math.floor(lotus / 20) + 1}回合`);
      break;
    }
    case 10: {
      const lotus = effectiveLevel(actor, 26);
      parts.push(
        `命中+${Math.floor(lotus / 9)}，持续${Math.floor(lotus / 20) + 1}回合`,
        "施展后硬直2回合",
      );
      break;
    }
    case 11:
      parts.push("连出三招", "施展后硬直2回合");
      break;
    case 12: {
      const blade = effectiveLevel(actor, 29);
      parts.push(
        `命中+15·攻击+${Math.floor(blade / 3) + 20}，强化接下来的一击`,
        "施展后硬直2回合",
      );
      break;
    }
    case 13: {
      const ninja = effectiveLevel(actor, 31);
      parts.push(
        `烟幕使对手命中下降至多${Math.min(Math.floor(ninja / 8), 20)}点，持续${Math.floor(ninja / 20) + 1}回合`,
        "被震散则自缚3回合",
      );
      break;
    }
    case 14: {
      const ninja = effectiveLevel(actor, 31);
      parts.push(
        `残影格挡至少${Math.max(Math.floor(ninja / 5), 30)}，持续${Math.floor(ninja / 20) + 1}回合`,
      );
      break;
    }
    case 15:
      parts.push("以内力刚劲攻击对手", "落空可能自踉跄数回合");
      break;
    case 16:
      parts.push("抽取对手内力，削弱其攻势");
      break;
    case 17: {
      const taiChi = effectiveLevel(actor, 32);
      parts.push(
        `将对手困入乱环2–${Math.floor(taiChi / 30) + 2}回合`,
        "被挣脱则自缚3回合",
      );
      break;
    }
    case 18: {
      const taiChi = effectiveLevel(actor, 32);
      parts.push(
        `对手受制时强化自身并追击一击（命中+15·膂力+${Math.floor(taiChi / 5)}）`,
        "否则尝试困住对手",
      );
      break;
    }
    case 19:
      parts.push(`缠住对手1–${Math.floor(effectiveLevel(actor, 33) / 20) + 1}回合`);
      break;
    case 20: {
      const sword = effectiveLevel(actor, 33);
      parts.push(
        `命中+10·闪避+${Math.floor(sword / 15)}，持续${Math.floor(sword / 30) + 4}回合`,
      );
      break;
    }
    case 21:
      parts.push(
        `攻击+${Math.floor(effectiveLevel(actor, 33) / 5)}并连出三剑`,
        "施展后硬直4回合",
      );
      break;
    case 22: {
      const snow = effectiveLevel(actor, 37);
      parts.push(
        `将对手摔倒并禁足${Math.floor(snow / 35) + 3}回合`,
      );
      break;
    }
    case 23:
      if (actor.xue6)
        parts.push("一气连出二十二剑，命中+10", "施展后硬直4回合");
      else {
        const snow = effectiveLevel(actor, 39),
          strikes = Math.max(1, Math.min(Math.floor((snow - 90) / 30) + 2, 5));
        parts.push(
          `连出${strikes}剑，命中+10`,
          "施展后硬直4回合",
          "获白瑞德传授第六出后连出二十二剑",
        );
      }
      break;
    case 24: {
      const ice = effectiveLevel(actor, 41);
      parts.push(
        `防御+${Math.min(Math.floor(ice / 4), 100)}，持续${Math.min(Math.floor(ice / 20), 10) + 1}回合`,
      );
      break;
    }
    case 25: {
      const dragon = effectiveLevel(actor, 47);
      parts.push(
        `虎啸震慑对手${Math.floor(dragon / 30) + 1}回合`,
      );
      break;
    }
    case 26: {
      const eagle = effectiveLevel(actor, 44);
      parts.push(
        `召唤苍鹰盘旋${Math.floor(eagle / 10) + 1}回合，逐回合追击`,
      );
      break;
    }
    case 27: {
      const eagle = effectiveLevel(actor, 44);
      parts.push(
        `闪避+${Math.floor(eagle / 2)}至${eagle}，持续${Math.floor(eagle / 20) + 1}回合`,
      );
      break;
    }
    case 28: {
      const dragon = effectiveLevel(actor, 47),
        knowledge = actor.skillUse[6] === 48 ? skillLevel(actor, 48) : 0;
      parts.push(
        `膂力+${Math.floor(dragon / 10) + Math.floor(knowledge / 8)}·防御+${Math.floor(dragon / 2) + knowledge}，持续${Math.floor(dragon / 20) + Math.floor(knowledge / 15) + 1}回合${knowledge ? "（含灵通心诀加成）" : ""}`,
      );
      break;
    }
    case 31:
      parts.push("法术伤害随法力与法术精通提升", "施展后硬直2回合");
      break;
    case 32:
    case 36:
    case 40: {
      const chain = ((originalTables.skills[id]?.magic_data as number[]) ||
        []).slice(2, 5) as number[],
        counts = new Map<string, number>();
      for (const spellId of chain) {
        const name = String(originalTables.skills[spellId]?.name || spellId);
        counts.set(name, (counts.get(name) || 0) + 1);
      }
      parts.push(
        `连环施放${[...counts].map(([name, count]) => (count > 1 ? `${name}×${count}` : name)).join("、")}`,
      );
      break;
    }
    case 35:
      parts.push(
        "命中造成真火伤害，四分之一概率点燃法火",
        "施法失败硬直6回合",
      );
      break;
    case 39:
      parts.push("成功时冰封对手5–19回合", "失败被寒气反噬硬直");
      break;
    default: {
      if (id >= 29 && id <= 40) {
        const stateText = spellStateText(id);
        parts.push(
          `法术伤害随法力与法术精通提升${stateText ? `，${stateText}` : ""}`,
        );
      } else parts.push("无附加效果");
    }
  }
  const cooldown = specialCooldownTurns(actor, id);
  if (cooldown > 0) parts.push(`冷却${cooldown}回合`);
  return parts.join("；");
}
const idiv = (value: number, divisor: number) => Math.floor(value / divisor);
// 平均随机值：randomInt(max) 的期望为 floor((max-1)/2)。
const avgRoll = (max: number) =>
  idiv(Math.max(1, Math.floor(max)) - 1, 2);
// 以“自镜像”为基准，用平均随机值估算当前配置下普通攻击单次伤害。
// 口径与战斗日志一致：显示的是出招伤害（blow damage），随当前武学、
// 兵器、内力与加力实时变化，纯估算不结算。
export function expectedStrikeDamage(
  actor: SceneActorState,
  kfDamage = 0,
  kfForce = 0,
) {
  const stats = derivedStats(actor),
    fpPlus = Math.min(
      actor.fpPlus,
      Math.floor(effectiveLevel(actor, actor.skillUse[3] || 1) / 2),
    ),
    atk = stats.atk,
    str = stats.str,
    fp = actor.fp;
  let damage1 = idiv(avgRoll(atk) + atk, 2);
  damage1 += idiv(damage1 * kfDamage, 100);
  let fpAdd = Math.min(fp, fpPlus);
  if (actor.weaponId > 0) fpAdd = idiv(fpAdd, 6);
  // 镜像对手使用相同加力，与原战斗公式的 target.fpPlus 对应。
  fpAdd += idiv(Math.min(fp, 3000), 20) - idiv(fpPlus, 25);
  let damage2 = fpAdd <= 0 ? str : str + fpAdd;
  if (fpAdd > 0) damage2 += idiv(damage2 * kfForce, 100);
  const damage = damage1 + idiv(avgRoll(damage2) + damage2, 2);
  return Math.max(1, damage);
}
// 每个绝招的伤害/威力说明：直接伤害型给公式数值，连击型给每击×次数，
// 辅助/控制型如实注明无直接伤害并附基础攻击参考。
export function specialDamageSummary(actor: SceneActorState, id: number) {
  const strike = (kd = 0, fo = 0) => expectedStrikeDamage(actor, kd, fo);
  const snowflake = () =>
    actor.xue6
      ? 22
      : Math.max(
          1,
          Math.min(Math.floor((effectiveLevel(actor, 39) - 90) / 30) + 2, 5),
        );
  switch (id) {
    case 1:
    case 2:
      return `伤害 约${strike()}（一击后强化）`;
    // 法术类在 default 分支统一按 castSpell 公式估算。case 35/39 已在上方处理。
    case 29:
    case 30:
    case 31:
    case 32:
    case 33:
    case 34:
    case 36:
    case 37:
    case 38:
    case 40: {
      let damage = 0,
        reflected = false;
      if (id === 32 || id === 36 || id === 40) {
        for (const spellId of ((originalTables.skills[id]?.magic_data as number[]) ||
          []).slice(2, 5) as number[]) {
          const estimate = expectedSpellDamage(actor, spellId);
          damage += estimate.damage;
          reflected = reflected || estimate.reflected;
        }
      } else {
        const estimate = expectedSpellDamage(actor, id);
        damage = estimate.damage;
        reflected = estimate.reflected;
      }
      return reflected
        ? "伤害：法力对抗不足时可能反噬"
        : `对普通敌人约${Math.max(1, damage)}`;
    }
    case 3:
      return `伤害 约${strike()} ×2`;
    case 4:
      return `伤害 约${strike(15)} ×3（每击含15%附加）`;
    case 5:
      return `伤害 约${strike(0, 10)} ×3`;
    case 6:
      return `伤害 约${effectiveLevel(actor, 19)}（卷中时）`;
    case 8:
      return `伤害 约${(derivedStats(actor).str + effectiveLevel(actor, 24)) * 2}（贯穿一击）`;
    case 11:
      return `伤害 约${strike()} ×3`;
    case 15:
      return `伤害 约${Math.floor(actor.fp / 10) + actor.fpPlus}（再扣对手内力/30）`;
    case 16:
      return `吸内力 约${Math.floor(actor.fp / 10) + 350 + actor.fpPlus}`;
    case 21:
      return `伤害 约${strike()} ×3`;
    case 22:
      return `伤害 约${Math.floor(effectiveLevel(actor, 37) / 3)}（摔投）`;
    case 23:
      return `伤害 约${strike()} ×${snowflake()}`;
    case 25:
      return `伤害 约${effectiveLevel(actor, 47) + 5}（随对手内力上限衰减）`;
    case 26:
      return `伤害 50/回合（六成概率）`;
    case 35:
      return `伤害 约${effectiveLevel(actor, actor.skillUse[5] || 8)}`;
    case 39:
      return "无直接伤害（冰封）";
    default:
      return `无直接伤害（强化/控制） · 基础攻击约${strike()}`;
  }
}
// “普通敌人”参考基准：用于把 castSpell 的法术伤害公式换算成可读的估算值，
// 只作菜单展示，不参与结算。
const REFERENCE_ENEMY = { maxhp: 3000, fp: 2000, fp_plus: 40 };
const diminishingResource = (value: number) => {
  const safe = Math.max(0, Math.floor(value));
  return safe <= 5000
    ? safe
    : 5000 + Math.floor(Math.sqrt((safe - 5000) * 5000));
};
// 按 castSpell 的真实公式，用平均随机值估算单个法术对普通敌人的期望伤害；
// 法力对抗不足时与原战斗一致判为反噬（可能伤及自身）。
function expectedSpellDamage(actor: SceneActorState, spellId: number) {
  const data = (originalTables.skills[spellId]?.magic_data as number[]) || [],
    rate = Number(data[3] || 0);
  const avg = (max: number) =>
    Math.floor((Math.max(1, Math.floor(max)) - 1) / 2);
  const userPower =
    Math.floor(
      (avg(diminishingResource(actor.maxHp)) +
        diminishingResource(Math.min(actor.mp, actor.maxMp * 2))) /
        20,
    ) +
    Math.floor((rate * 2) / 100) * actor.mpPlus;
  const targetPower =
    Math.floor(
      (avg(diminishingResource(REFERENCE_ENEMY.maxhp)) +
        diminishingResource(REFERENCE_ENEMY.fp)) /
        20,
    ) +
    Math.floor((rate * 2) / 100) * REFERENCE_ENEMY.fp_plus;
  const reflected = userPower < targetPower,
    mastery = Math.min(300, effectiveLevel(actor, actor.skillUse[5] || 8)),
    first = reflected
      ? Math.floor(
          ((targetPower - userPower + REFERENCE_ENEMY.fp_plus) * rate) / 100,
        )
      : Math.floor(((userPower - targetPower) * rate) / 100),
    damage = (first + Math.floor((first * mastery) / 200)) * 2;
  return { reflected, damage: Math.max(0, damage) };
}
export function paySpecialCost(actor: SceneActorState, special: BattleSpecial) {
  actor.fp = Math.max(0, actor.fp - special.fpCost);
  actor.mp = Math.max(0, actor.mp - special.mpCost);
  actor.hp = Math.max(0, actor.hp - special.hpCost);
}
