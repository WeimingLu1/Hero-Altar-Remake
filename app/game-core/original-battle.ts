import {
  attackEffect,
  kfPower,
  type Combatant,
  type RandomInt,
} from "./combat";
import { originalTables, type OriginalRecord } from "./original-data";
import type { SceneActorState } from "./scene-event";
import { derivedStats, fullHp } from "./inventory-system";
import { combatSkillProfile, effectiveLevel, skillLevel } from "./skill-system";
import {
  battleSpecials,
  paySpecialCost,
  specialCheck,
  specialCooldownTurns,
  specialFpCost,
  specialMpCost,
  spellGuardStats,
} from "./special-system";
import { npcCombatLevel } from "./npc-combat-scaling";
import { MAX_PLAYER_EXP } from "./progression-limits";

export type OriginalBattle = {
  enemyId: number;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyFp: number;
  enemyMp: number;
  enemyWeaponId: number;
  playerBusy: number;
  turn: number;
  seed: number;
  log: string[];
  finished: "win" | "lose" | null;
  cooldowns: Record<string, number>;
  enemyCooldowns: Record<string, number>;
  buff: {
    hit: number;
    str: number;
    eva: number;
    agi: number;
    atk: number;
    pdef: number;
    fenshen: number;
    turns: number;
  };
  enemyBuff: {
    hit: number;
    str: number;
    eva: number;
    agi: number;
    atk: number;
    pdef: number;
    fenshen: number;
    turns: number;
  };
  playerDebuff: {
    hit: number;
    turns: number;
    burnTurns: number;
  };
  enemyDebuff: {
    hit: number;
    busy: number;
    turns: number;
    eagleTurns: number;
    burnTurns: number;
  };
  enemyOverride?: OriginalRecord;
  questContext?: { questId: string; enemyId: number };
  mode: "spar" | "lethal" | "story";
  escapeFactor: number;
};
type Move = {
  text: string;
  hitType: number;
  ap: number;
  dp: number;
  pp: number;
  damage: number;
  force: number;
};
const n = (record: OriginalRecord, key: string, fallback = 0) =>
  Number(record[key] ?? fallback);
const lcg =
  (battle: OriginalBattle): RandomInt =>
  (max) => {
    battle.seed = (Math.imul(battle.seed >>> 0, 1664525) + 1013904223) >>> 0;
    return Math.floor((battle.seed / 4294967296) * Math.max(1, max));
  };
const battleEnemyRecord = (battle: OriginalBattle) =>
  battle.enemyOverride || originalTables.enemies[battle.enemyId] || {};
// 原作剧情战(墨邪铸剑)的胜利线按固定 full_hp/2 判定(096 - Scene_Battle 1.rb judge)，
// 不随战斗中被 hurt 逐回合削低的当前上限漂移。
const storyVictoryAt = (battle: OriginalBattle) =>
  battle.mode === "story" && battle.enemyId === 149
    ? Math.floor(n(battleEnemyRecord(battle), "maxhp", 1) / 2)
    : 0;

function moveFor(
  record: OriginalRecord,
  kfId: number,
  level: number,
  random: RandomInt,
  user: string,
  target: string,
  weaponName = "",
): Move {
  const kungfu =
    originalTables.kungfus[kfId] || originalTables.kungfus[2] || {};
  const pool = ((kungfu.atk_word as unknown[][]) || []).filter(
    (row) => Number(row[0] || 0) <= level,
  );
  const row = pool.length
    ? pool[random(pool.length)]
    : [0, "user挥拳攻向target", 0, 0, 0, 0, 0, 0];
  return {
    text: String(row[1] || "user挥拳攻向target")
      .replaceAll("user", user)
      .replaceAll("target", target)
      .replaceAll("position", "要害")
      .replaceAll("weapon", weaponName),
    hitType: Number(row[2] || 0),
    ap: Number(row[3] || 0),
    dp: Number(row[4] || 0),
    pp: Number(row[5] || 0),
    damage: Number(row[6] || 0),
    force: Number(row[7] || 0),
  };
}
function player(
  actor: SceneActorState,
  move: Move,
  battle?: OriginalBattle,
): Combatant {
  const stats = derivedStats(actor),
    skills = combatSkillProfile(actor);
  // Old modifier saves could contain the raw integer ceiling (32767), although
  // the original force menu only permits half of the equipped inner skill's
  // effective level. Clamp at the combat boundary so those saves cannot spend
  // half their entire force pool in one attack.
  actor.fpPlus = Math.max(
    0,
    Math.min(
      actor.fpPlus,
      Math.floor(effectiveLevel(actor, actor.skillUse[3] || 1) / 2),
    ),
  );
  actor.exp = Math.min(actor.exp, MAX_PLAYER_EXP);
  const buff = battle?.buff || {
    hit: 0,
    str: 0,
    eva: 0,
    agi: 0,
    atk: 0,
    pdef: 0,
    // 原作缺省 -1(021 - Game_Battler 2.rb)：无影分身时永不触发残影格挡。
    fenshen: -1,
    turns: 0,
  };
  return {
    exp: actor.exp,
    hit: stats.hit + buff.hit + (battle?.playerDebuff.hit || 0),
    eva: stats.eva + buff.eva,
    attackKfLv: skills.attack,
    dodgeKfLv: skills.dodge,
    parryKfLv: skills.parry,
    agi: stats.agi + buff.agi,
    int: stats.int,
    str: stats.str + buff.str,
    atk: stats.atk + buff.atk,
    pdef: stats.pdef + buff.pdef,
    fp: actor.fp,
    fpPlus: actor.fpPlus,
    weaponId: actor.weaponId,
    movable: actor.hp > 0 && (!battle || battle.playerBusy <= 0),
    fenshen: buff.fenshen,
    kfAp: move.ap,
    kfDp: move.dp,
    kfPp: move.pp,
    kfDamage: move.damage,
    kfForce: move.force,
    hitType: move.hitType,
  };
}
function enemy(
  record: OriginalRecord,
  fp: number,
  move: Move,
  battle?: OriginalBattle,
): Combatant {
  const skills = (record.skill_list as number[][]) || [],
    level = (id: number) => skills.find((row) => row[0] === id)?.[1] || 0,
    uses = (record.skill_use as number[]) || [],
    // 兵刃武功按战斗中的实时武器选(被落英缤纷缴械后回落拳脚)，
    // 原作 weapon_kf_id 在 weapon_id<=0 时走空手分支(020 - Game_Battler 1.rb)。
    armed = battle ? battle.enemyWeaponId : n(record, "weapon_id"),
    attackId = armed > 0 ? uses[1] || 1 : uses[0] || 2;
  const debuff = battle?.enemyDebuff || {
    hit: 0,
    busy: 0,
    turns: 0,
    eagleTurns: 0,
    burnTurns: 0,
  };
  const buff = battle?.enemyBuff || {
    hit: 0,
    str: 0,
    eva: 0,
    agi: 0,
    atk: 0,
    pdef: 0,
    fenshen: -1,
    turns: 0,
  };
  return {
    exp: n(record, "exp"),
    hit: n(record, "base_hit") + debuff.hit + buff.hit,
    eva: n(record, "base_eva") + buff.eva,
    attackKfLv: level(attackId),
    dodgeKfLv: level(uses[2] || 9),
    // 原作招架取招架槽 skill_use[4](026 - Game_Enemy.rb parry_kf_lv)，非内功槽。
    parryKfLv: level(uses[4] || 10),
    agi: n(record, "agi") + buff.agi,
    int: n(record, "int"),
    str: n(record, "str") + buff.str,
    atk: n(record, "atk") + buff.atk,
    pdef: n(record, "pdef") + buff.pdef,
    fp,
    fpPlus: n(record, "fp_plus"),
    weaponId: battle ? battle.enemyWeaponId : n(record, "weapon_id"),
    movable: debuff.busy <= 0,
    // 原作缺省 -1(021 - Game_Battler 2.rb)：无影分身时永不触发残影格挡。
    fenshen: buff.fenshen,
    kfAp: move.ap,
    kfDp: move.dp,
    kfPp: move.pp,
    kfDamage: move.damage,
    kfForce: move.force,
    hitType: move.hitType,
  };
}
function resultText(result: ReturnType<typeof attackEffect>, target: string) {
  if (result.damage === "Miss.1") return `${target}侧身避开。`;
  if (result.damage === "Miss.2") return `${target}架开了这一招。`;
  if (result.damage === "Miss.3") return `击中的竟是一道残影。`;
  return typeof result.damage === "number" && result.damage > 0
    ? `${target}受到 ${result.damage} 点伤害。`
    : `招式虽中，却未伤到${target}。`;
}
function numericDamage(result: ReturnType<typeof attackEffect>) {
  return typeof result.damage === "number" ? Math.max(0, result.damage) : 0;
}
// 吸血大法(56)：需在学识槽装备，普通攻击命中后按等级吸血(等级/100 × 伤害)。
function applyVampiric(actor: SceneActorState, battle: OriginalBattle, damage: number) {
  if (actor.skillUse[6] !== 56) return;
  const xiLv = skillLevel(actor, 56),
    heal = Math.floor((xiLv * damage) / 100);
  if (heal <= 0) return;
  const before = actor.hp;
  actor.hp = Math.min(actor.maxHp, actor.hp + heal);
  if (actor.hp > before)
    battle.log.push(`吸血大法吸回 ${actor.hp - before} 点气血。`);
}
function enemyAttackId(record: OriginalRecord, battle?: OriginalBattle) {
  const uses = (record.skill_use as number[]) || [],
    armed = battle ? battle.enemyWeaponId : n(record, "weapon_id");
  return armed > 0 ? uses[1] || 1 : uses[0] || 2;
}
const magicLevelFactors = [
  0, 1, 10, 13, 16, 20, 22, 24, 26, 28, 30, 31, 33, 35, 37, 38, 39, 41, 43, 46,
  47, 48, 49, 51, 53, 55,
];
function magicKungfuId(actor: SceneActorState) {
  return actor.skillUse[5] || 8;
}
function magicThreshold(
  actor: SceneActorState,
  target: OriginalRecord,
  magicHit: number,
) {
  const level = effectiveLevel(actor, magicKungfuId(actor));
  const userBase =
    (Math.floor(actor.exp / 500000) + 1) * level ** 3 + actor.exp;
  const user = Math.floor(
    (userBase * Math.min(500, Math.max(20, magicHit))) / 100,
  );
  const targetPower = Math.floor((n(target, "exp") * 4) / 3);
  return Math.floor((targetPower * 100) / Math.max(1, user + targetPower));
}
function addMagicState(
  battle: OriginalBattle,
  actor: SceneActorState,
  type: number,
  buffHit: number,
  buffEffect: number,
  buffTurns: number,
  random: RandomInt,
) {
  const rawLevel = skillLevel(actor, magicKungfuId(actor));
  const factor =
    magicLevelFactors[
      Math.min(magicLevelFactors.length - 1, Math.floor(rawLevel / 10))
    ] || 0;
  const chance = buffHit === 0 ? 100 : factor - buffEffect;
  if (random(100) >= chance) return;
  if (type === 1) {
    const reduction = Math.floor(rawLevel / Math.max(1, buffTurns));
    battle.enemyDebuff.hit -= reduction;
    battle.enemyDebuff.turns = Math.max(
      battle.enemyDebuff.turns,
      (buffHit === 0 ? 1 : Math.floor(rawLevel / 20)) + 1,
    );
    battle.log.push(`${battle.enemyName}被雷光灼目，命中下降 ${reduction}。`);
  } else if (type === 2) {
    battle.enemyDebuff.burnTurns = Math.max(
      battle.enemyDebuff.burnTurns,
      Math.floor((random(Math.max(1, rawLevel)) + rawLevel) / 6) + 2,
    );
    battle.log.push(`${battle.enemyName}身上燃起法火。`);
  } else if (type === 3) {
    battle.enemyDebuff.busy = Math.max(
      battle.enemyDebuff.busy,
      random(Math.max(1, Math.floor(rawLevel / Math.max(1, buffTurns)))) + 2,
    );
    battle.log.push(`${battle.enemyName}被寒气冻住，动弹不得。`);
  }
}
function castSpell(
  battle: OriginalBattle,
  actor: SceneActorState,
  spellId: number,
  record: OriginalRecord,
  random: RandomInt,
) {
  const skill = originalTables.skills[spellId] || {};
  if (spellId === 35) {
    if (
      random(100) >=
      magicThreshold(
        actor,
        record,
        Number((skill.magic_data as number[])?.[2] || 0),
      )
    ) {
      const damage = effectiveLevel(actor, magicKungfuId(actor));
      battle.enemyHp = Math.max(0, battle.enemyHp - damage);
      battle.playerBusy = Math.max(battle.playerBusy, 3);
      if (random(100) < 25)
        battle.enemyDebuff.burnTurns = Math.max(
          battle.enemyDebuff.burnTurns,
          3,
        );
      battle.log.push(`三昧真火命中，造成 ${damage} 点伤害。`);
    } else {
      battle.playerBusy = Math.max(battle.playerBusy, 6);
      battle.log.push("三昧真火反噬，施法失败。 ");
    }
    return;
  }
  if (spellId === 39) {
    const level = effectiveLevel(actor, magicKungfuId(actor));
    const success =
      random(Math.max(1, level ** 3 + actor.exp + n(record, "exp"))) >=
        n(record, "exp") &&
      random(Math.max(1, actor.maxMp + n(record, "maxfp"))) >=
        n(record, "maxfp") &&
      random(Math.max(1, actor.mp + battle.enemyFp)) >= battle.enemyFp;
    if (success) {
      battle.enemyDebuff.busy = Math.max(
        battle.enemyDebuff.busy,
        // 原作 turns=rand(15)+5(add_state 存+1、行动前递减，实际冻 N 回合)。
        random(15) + 5,
      );
      battle.log.push(`${battle.enemyName}被暴风雪彻底冰封。`);
    } else {
      battle.playerBusy = Math.max(battle.playerBusy, random(2) + 2);
      battle.log.push("暴风雪未能凝聚，你被寒气反噬。 ");
    }
    return;
  }
  const data = (skill.magic_data as number[]) || [];
  if (spellId === 31) battle.playerBusy = Math.max(battle.playerBusy, 2);
  const hit =
    random(100) >= magicThreshold(actor, record, Number(data[2] || 0));
  if (!hit) {
    battle.log.push(`${String(skill.name || "法术")}未能命中。`);
    if ([29, 31, 33].includes(spellId))
      addMagicState(battle, actor, data[6], data[7], data[8], data[9], random);
    return;
  }
  const damageRate = Math.min(200, Math.max(20, Number(data[3] || 0)));
  const userPower =
    Math.floor(
      (random(Math.max(1, diminishingBattleResource(actor.maxHp))) +
        diminishingBattleResource(Math.min(actor.mp, actor.maxMp * 2))) /
        20,
    ) +
    // 原作先整除后乘：m_damage*2/100 得整数档位再乘加力。
    Math.floor((damageRate * 2) / 100) * actor.mpPlus;
  // 原作以内力/加力抗法；术士同时拥有法力/法点时取较强的一套。动态
  // 通缉犯的加力按玩家上限生成，spellGuardStats 会单独限幅，避免必反弹。
  const guard = spellGuardStats(
    battle.enemyFp,
    battle.enemyMp,
    n(record, "fp_plus"),
    n(record, "mp_plus"),
    battle.enemyId === 198,
  );
  const targetPower =
    Math.floor(
      (random(Math.max(1, diminishingBattleResource(battle.enemyMaxHp))) +
        diminishingBattleResource(guard.resource)) /
        20,
    ) +
    Math.floor((damageRate * 2) / 100) * random(Math.max(1, guard.plus));
  const reflected = userPower < targetPower;
  const first = reflected
    ? Math.floor(((targetPower - userPower + guard.plus) * damageRate) / 100)
    : Math.floor(((userPower - targetPower) * damageRate) / 100);
  // 原作(022 - Game_Battler 3.rb)：damage2 = first*mp_kf_lv/200；
  // self.damage = (first+damage2)*2，等效倍率 ×(200+精通)/100。
  const mastery = Math.min(300, effectiveLevel(actor, magicKungfuId(actor))),
    damage = (first + Math.floor((first * mastery) / 200)) * 2;
  if (reflected) {
    actor.hp = Math.max(0, actor.hp - damage);
    battle.log.push(`法力遭到反弹，你受到 ${damage} 点伤害。`);
  } else {
    battle.enemyHp = Math.max(0, battle.enemyHp - damage);
    battle.log.push(`${battle.enemyName}受到 ${damage} 点法术伤害。`);
    addMagicState(battle, actor, data[6], data[7], data[8], data[9], random);
  }
}
export function diminishingBattleResource(value: number) {
  const safe = Math.max(0, Math.floor(value));
  return safe <= 5000
    ? safe
    : 5000 + Math.floor(Math.sqrt((safe - 5000) * 5000));
}
function tick(battle: OriginalBattle, actor: SceneActorState) {
  for (const id of Object.keys(battle.cooldowns)) {
    battle.cooldowns[id]--;
    if (battle.cooldowns[id] <= 0) delete battle.cooldowns[id];
  }
  for (const id of Object.keys(battle.enemyCooldowns)) {
    battle.enemyCooldowns[id]--;
    if (battle.enemyCooldowns[id] <= 0) delete battle.enemyCooldowns[id];
  }
  if (battle.buff.turns > 0 && --battle.buff.turns === 0)
    battle.buff = {
      hit: 0,
      str: 0,
      eva: 0,
      agi: 0,
      atk: 0,
      pdef: 0,
      // 原作缺省 -1(021 - Game_Battler 2.rb)：无影分身时永不触发残影格挡。
      fenshen: -1,
      turns: 0,
    };
  if (battle.enemyBuff.turns > 0 && --battle.enemyBuff.turns === 0)
    battle.enemyBuff = {
      hit: 0,
      str: 0,
      eva: 0,
      agi: 0,
      atk: 0,
      pdef: 0,
      fenshen: -1,
      turns: 0,
    };
  if (battle.playerDebuff.turns > 0 && --battle.playerDebuff.turns === 0)
    battle.playerDebuff.hit = 0;
  if (battle.enemyDebuff.busy > 0) battle.enemyDebuff.busy--;
  if (battle.playerBusy > 0) battle.playerBusy--;
  if (battle.enemyDebuff.turns > 0 && --battle.enemyDebuff.turns === 0)
    battle.enemyDebuff.hit = 0;
  if (battle.enemyDebuff.eagleTurns > 0) {
    if (lcg(battle)(100) < 60) {
      battle.enemyHp = Math.max(0, battle.enemyHp - 50);
      battle.log.push(`铁爪苍鹰俯冲抓伤${battle.enemyName}，造成 50 点伤害。`);
    }
    battle.enemyDebuff.eagleTurns--;
  }
  if (battle.enemyDebuff.burnTurns > 0) {
    const damage = burningDamage(
      actor.mp,
      battle.enemyFp,
      effectiveLevel(actor, magicKungfuId(actor)),
      lcg(battle),
    );
    battle.enemyHp = Math.max(0, battle.enemyHp - damage);
    battle.enemyDebuff.burnTurns--;
    if (damage > 0)
      battle.log.push(`${battle.enemyName}受到 ${damage} 点灼烧伤害。`);
  }
  if (battle.playerDebuff.burnTurns > 0) {
    const record = battleEnemyRecord(battle),
      uses = (record.skill_use as number[] | undefined) || [],
      magicId = uses[5] || 8,
      level = ((record.skill_list as number[][] | undefined) || []).find(
        ([id]) => id === magicId,
      )?.[1] || 0,
      damage = burningDamage(
        battle.enemyMp,
        actor.fp,
        level,
        lcg(battle),
      );
    actor.hp = Math.max(0, actor.hp - damage);
    battle.playerDebuff.burnTurns--;
    if (damage > 0) battle.log.push(`你受到 ${damage} 点灼烧伤害。`);
    if (actor.hp <= 0) {
      battle.finished = "lose";
      battle.log.push(
        battle.mode === "spar"
          ? "你眼前一黑，已无力再战。切磋到此为止。"
          : "你已无力再战。",
      );
    }
  }
}

export function burningDamage(
  casterMp: number,
  targetFp: number,
  magicLevel: number,
  random: RandomInt,
) {
  const pressure = Math.max(
      0,
      diminishingBattleResource(casterMp) -
        random(Math.max(1, diminishingBattleResource(targetFp))),
    ),
    rateBasisPoints = 500 + Math.min(300, Math.max(0, magicLevel));
  return pressure > 0
    ? Math.max(1, Math.floor((pressure * rateBasisPoints) / 10000))
    : 0;
}
type EnemySpecial = {
  id: number;
  name: string;
  type: number;
  ownerId: number;
  level: number;
  fpCost: number;
  mpCost: number;
};

function enemySpecialText(battle: OriginalBattle, special: EnemySpecial) {
  return String(
    (originalTables.skills[special.id]?.use_text as string[])?.[0] ||
      `${battle.enemyName}施展${special.name}！`,
  )
    .replaceAll("user", battle.enemyName)
    .replaceAll("target", "你")
    .replaceAll(
      "weapon",
      String(originalTables.weapons[battle.enemyWeaponId]?.name || "兵刃"),
    );
}

function enemyAttackOnce(
  battle: OriginalBattle,
  actor: SceneActorState,
  record: OriginalRecord,
  random: RandomInt,
  blank: Move,
  move: Move,
) {
  const attacker = enemy(record, battle.enemyFp, move, battle),
    target = player(actor, blank, battle),
    received = attackEffect(attacker, target, random);
  battle.log.push(move.text, resultText(received, "你"));
  battle.enemyFp = attacker.fp;
  actor.hp = Math.max(0, actor.hp - numericDamage(received));
  actor.maxHp = Math.max(actor.hp, actor.maxHp - received.hurt);
}

function applyEnemySupportSpecial(
  battle: OriginalBattle,
  special: EnemySpecial,
) {
  const power = Math.max(8, Math.floor(special.level / 8)),
    turns = Math.min(9, 3 + Math.floor(special.level / 60));
  if ([1, 2, 9, 10].includes(special.id)) {
    battle.enemyBuff.atk += power * 2;
    battle.enemyBuff.str += power;
    battle.enemyBuff.hit += Math.floor(power / 2);
  } else if (special.id === 7) {
    battle.enemyBuff.agi += power;
    battle.enemyBuff.eva += power * 2;
  } else if (special.id === 13) {
    battle.playerDebuff.hit -= power;
    battle.playerDebuff.turns = Math.max(battle.playerDebuff.turns, turns);
  } else if (special.id === 14) {
    battle.enemyBuff.fenshen = Math.min(70, 30 + Math.floor(special.level / 5));
    battle.enemyBuff.eva += power;
  } else if ([20, 24].includes(special.id)) {
    battle.enemyBuff.pdef += power * 3;
    battle.enemyBuff.eva += power;
  } else if (special.id === 27) {
    battle.enemyBuff.agi += power * 2;
    battle.enemyBuff.atk += power;
  } else if (special.id === 28) {
    battle.enemyBuff.str += power * 2;
    battle.enemyBuff.pdef += power * 3;
  } else {
    battle.enemyBuff.hit += power;
    battle.enemyBuff.atk += power;
  }
  battle.enemyBuff.turns = Math.max(battle.enemyBuff.turns, turns);
  battle.log.push(`${battle.enemyName}的战斗气势陡然攀升。`);
}

function castEnemySpell(
  battle: OriginalBattle,
  actor: SceneActorState,
  record: OriginalRecord,
  special: EnemySpecial,
  random: RandomInt,
) {
  const guard = spellGuardStats(
      actor.fp,
      actor.mp,
      actor.fpPlus,
      actor.mpPlus,
    ),
    enemyPower =
      diminishingBattleResource(battle.enemyMp) +
      special.level * 20 +
      n(record, "mp_plus") * 30,
    stats = derivedStats(actor),
    playerGuard =
      diminishingBattleResource(guard.resource) +
      guard.plus * 20 +
      stats.int * 50,
    baseDamage = Math.max(
      Math.floor(special.level / 2),
      Math.floor((enemyPower - Math.floor(playerGuard * 0.45)) / 20),
    ),
    strikes = [32, 36, 40].includes(special.id) ? 3 : 1;
  let total = 0;
  for (let strike = 0; strike < strikes; strike++) {
    const variance = 85 + random(31),
      damage = Math.max(1, Math.floor((baseDamage * variance) / 100 / strikes));
    total += damage;
    actor.hp = Math.max(0, actor.hp - damage);
    if (actor.hp <= 0) break;
  }
  battle.log.push(`${special.name}命中，共造成 ${total} 点法术伤害。`);
  if ([29, 31, 32].includes(special.id)) {
    battle.playerDebuff.hit -= Math.max(6, Math.floor(special.level / 15));
    battle.playerDebuff.turns = Math.max(battle.playerDebuff.turns, 3);
  }
  if ([30, 33, 34, 35, 36].includes(special.id))
    battle.playerDebuff.burnTurns = Math.max(
      battle.playerDebuff.burnTurns,
      2 + Math.floor(special.level / 80),
    );
  if ([37, 38, 39, 40].includes(special.id))
    battle.playerBusy = Math.max(
      battle.playerBusy,
      1 + Math.floor(special.level / 90),
    );
}

function enemyTurn(
  battle: OriginalBattle,
  actor: SceneActorState,
  record: OriginalRecord,
  random: RandomInt,
  blank: Move,
) {
  if (battle.enemyDebuff.busy > 0) {
    battle.log.push(`${battle.enemyName}受制于招式，无法还手。`);
    return;
  }
  const enemyId = enemyAttackId(record, battle),
    enemyLevel =
      ((record.skill_list as number[][]) || []).find(
        (row) => row[0] === enemyId,
      )?.[1] || 0,
    baseMove = moveFor(
      record,
      enemyId,
      enemyLevel,
      random,
      battle.enemyName,
      "你",
      String(originalTables.weapons[battle.enemyWeaponId]?.name || ""),
    ),
    special = chooseEnemySpecial(record, battle, random),
    em = special
      ? {
          ...baseMove,
          text: enemySpecialText(battle, special),
          ap: baseMove.ap + 18 + Math.floor(enemyLevel / 12),
          damage: baseMove.damage + 20,
          force: baseMove.force + 10,
        }
      : baseMove;
  if (special) {
    battle.enemyFp = Math.max(0, battle.enemyFp - special.fpCost);
    battle.enemyMp = Math.max(0, battle.enemyMp - special.mpCost);
    battle.enemyCooldowns[String(special.id)] = Math.min(
      9,
      2 + Math.floor((special.fpCost + special.mpCost) / 180),
    );
    battle.log.push(`${battle.enemyName}施展绝招「${special.name}」！`);
    if (special.id >= 29 || special.type === 0) battle.log.push(em.text);
  }
  if (!special) enemyAttackOnce(battle, actor, record, random, blank, em);
  else if (special.id >= 29)
    castEnemySpell(battle, actor, record, special, random);
  else if (special.type === 0)
    applyEnemySupportSpecial(battle, special);
  else {
    const strikes = [11, 21, 23].includes(special.id) ? 3 : 1;
    for (let strike = 0; strike < strikes && actor.hp > 0; strike++)
      enemyAttackOnce(battle, actor, record, random, blank, em);
    if ([6, 17, 18, 19, 22, 25].includes(special.id) && random(100) < 60)
      battle.playerBusy = Math.max(
        battle.playerBusy,
        1 + Math.floor(special.level / 90),
      );
    if (special.id === 6 && actor.weaponId > 0 && random(100) < 55) {
      actor.weaponId = 0;
      battle.log.push("你手中兵刃被鞭圈带得脱手飞出！");
    }
    if (special.id === 16) {
      const drained = Math.min(actor.fp, Math.max(50, Math.floor(special.level * 1.5)));
      actor.fp -= drained;
      battle.log.push(`你的内力被太极劲卸去 ${drained} 点。`);
    }
    if (special.id === 8) battle.enemyWeaponId = 0;
  }
  const defeatAt =
    battle.mode === "story" && battle.enemyId === 149
      ? Math.floor(fullHp(actor) / 2)
      : 0;
  if (actor.hp <= defeatAt) {
    battle.finished = "lose";
    battle.log.push(
      battle.mode === "spar"
        ? "你眼前一黑，已无力再战。切磋到此为止。"
        : "你已无力再战。",
    );
  }
}

function chooseEnemySpecial(
  record: OriginalRecord,
  battle: OriginalBattle,
  random: RandomInt,
) {
  const level = npcCombatLevel(record),
    chance =
      level < 80 ? 0 : level < 120 ? 12 : level < 160 ? 20 : level < 200 ? 28 : 38;
  if (chance === 0) return null;
  if (random(100) >= chance) return null;
  const learned = new Map(
      ((record.skill_list as number[][] | undefined) || []).map(([id, skillLevel]) => [
        Number(id),
        Number(skillLevel || 0),
      ]),
    ),
    weaponType = Number(
      originalTables.weapons[battle.enemyWeaponId]?.type ?? -1,
    ),
    candidates = [...learned.entries()].flatMap(([ownerId, ownerLevel]) =>
      ((originalTables.kungfus[ownerId]?.skill as number[] | undefined) || [])
        .filter((id) => id > 0)
        .map((id) => ({ id, ownerId, ownerLevel })),
    ),
    unique = [
      ...new Map(candidates.map((candidate) => [candidate.id, candidate])).values(),
    ];
  const usable = unique.flatMap(({ id, ownerId, ownerLevel }) => {
    const skill = originalTables.skills[id] || {},
      ownerType = Number(originalTables.kungfus[ownerId]?.type || 0),
      weaponOk =
        ownerType === 1 ||
        ownerType === 8 ||
        ownerType === 11 ||
        (ownerType === 2
          ? battle.enemyWeaponId <= 0
          : ownerType >= 3 && ownerType <= 6
            ? weaponType === ownerType - 3
            : true),
      requirementsOk = ((skill.require as number[][] | undefined) || []).every(
        ([requiredId, requiredLevel]) =>
          requiredId <= 0 || (learned.get(requiredId) || 0) >= requiredLevel,
      ),
      fpCost = Number(skill.fp_cost || 0),
      rawMpCost = Number(skill.mp_cost || 0),
      // 与玩家同一口径(023 - Game_Battler 4.rb get_mp_cost)：显式 mp_cost 优先，
      // 否则敌方法点+magic_data[0]；法术还需满足储备线(check_magic_require)。
      mpCost = id >= 29
        ? rawMpCost > 0
          ? rawMpCost
          : n(record, "mp_plus") +
            Number((skill.magic_data as number[])?.[0] || 0)
        : rawMpCost,
      mpGate =
        id >= 29 ? Math.max(n(record, "mp_plus") * 2 + 100, mpCost) : mpCost;
    return weaponOk &&
      requirementsOk &&
      !battle.enemyCooldowns[String(id)] &&
      battle.enemyFp >= fpCost &&
      battle.enemyMp >= mpGate &&
      !(Number(skill.type || 0) === 0 && battle.enemyBuff.turns > 0)
      ? [{
          id,
          name: String(skill.name || `绝招${id}`),
          type: Number(skill.type || 0),
          ownerId,
          level: ownerLevel,
          fpCost,
          mpCost,
        }]
      : [];
  });
  return usable.length ? usable[random(usable.length)] : null;
}

export function beginOriginalBattle(
  enemyId: number,
  seed = 9527,
  enemyOverride?: OriginalRecord,
  mode: "spar" | "lethal" | "story" = "spar",
  questContext?: { questId: string; enemyId: number },
): OriginalBattle {
  const e = enemyOverride || originalTables.enemies[enemyId] || {};
  return {
    enemyId,
    enemyName: String(e.name || "江湖中人"),
    enemyHp: n(e, "hp", n(e, "maxhp", 1)),
    enemyMaxHp: n(e, "maxhp", 1),
    enemyFp: n(e, "fp"),
    enemyMp: n(e, "mp"),
    enemyWeaponId: n(e, "weapon_id"),
    playerBusy: 0,
    turn: 0,
    seed,
    log: [`${String(e.name || "江湖中人")}抱拳道：“请赐教！”`],
    finished: null,
    cooldowns: {},
    enemyCooldowns: {},
    buff: {
      hit: 0,
      str: 0,
      eva: 0,
      agi: 0,
      atk: 0,
      pdef: 0,
      // 原作缺省 -1(021 - Game_Battler 2.rb)：无影分身时永不触发残影格挡。
      fenshen: -1,
      turns: 0,
    },
    enemyBuff: {
      hit: 0,
      str: 0,
      eva: 0,
      agi: 0,
      atk: 0,
      pdef: 0,
      fenshen: -1,
      turns: 0,
    },
    playerDebuff: { hit: 0, turns: 0, burnTurns: 0 },
    enemyDebuff: { hit: 0, busy: 0, turns: 0, eagleTurns: 0, burnTurns: 0 },
    enemyOverride,
    questContext,
    mode,
    // 原作初始逃跑系数 20(096 - Scene_Battle 1.rb)，失败每次 +10。
    escapeFactor: 20,
  };
}

export function attemptEscape(source: OriginalBattle, actor: SceneActorState) {
  const battle = structuredClone(source),
    record = battleEnemyRecord(battle),
    random = lcg(battle),
    actorAgi = derivedStats(actor).agi,
    enemyAgi = n(record, "agi", n(record, "base_agi"));
  if (battle.mode === "story") {
    battle.log.push(`${battle.enemyName}封住去路，这一战无法逃走。`);
    return { escaped: false, battle };
  }
  if (random(Math.max(1, actorAgi + battle.escapeFactor)) >= enemyAgi) {
    battle.log.push("你虚晃一招，脱离了战斗。 ");
    return { escaped: true, battle };
  }
  battle.escapeFactor += 10;
  battle.log.push(`${battle.enemyName}一把拦住：想跑，没门！`);
  // 原作逃跑失败等同空过一回合(096 escape → start_phase2)：状态、冷却、
  // 苍鹰和灼烧照常推进，不能靠反复点逃跑让时间静止。
  const blank: Move = {
    text: "",
    hitType: 0,
    ap: 0,
    dp: 0,
    pp: 0,
    damage: 0,
    force: 0,
  };
  tick(battle, actor);
  battle.turn++;
  if (battle.finished) return { escaped: false, battle };
  const victoryAt = storyVictoryAt(battle);
  if (battle.enemyHp <= victoryAt) {
    battle.finished = "win";
    battle.log.push(`${battle.enemyName}倒在苍鹰利爪之下。`);
    return { escaped: false, battle };
  }
  enemyTurn(battle, actor, record, random, blank);
  return { escaped: false, battle };
}
export function battleItemRound(
  source: OriginalBattle,
  actor: SceneActorState,
  itemText: string,
) {
  const battle = structuredClone(source);
  if (battle.finished) return battle;
  tick(battle, actor);
  battle.turn++;
  if (battle.finished) return battle;
  battle.log.push(itemText);
  const blank: Move = {
      text: "",
      hitType: 0,
      ap: 0,
      dp: 0,
      pp: 0,
      damage: 0,
      force: 0,
    },
    record = battleEnemyRecord(battle),
    random = lcg(battle);
  enemyTurn(battle, actor, record, random, blank);
  return battle;
}
export function battleRound(source: OriginalBattle, actor: SceneActorState) {
  const battle = structuredClone(source);
  if (battle.finished) return battle;
  tick(battle, actor);
  if (battle.finished) return battle;
  const victoryAt = storyVictoryAt(battle);
  if (battle.enemyHp <= victoryAt) {
    battle.finished = "win";
    battle.log.push(`${battle.enemyName}倒在苍鹰利爪之下。`);
    return battle;
  }
  const record = battleEnemyRecord(battle),
    random = lcg(battle),
    playerId = combatSkillProfile(actor).attackId,
    pm = moveFor(
      record,
      playerId,
      // 原作招式解锁按原始等级过滤 atk_word(021 - Game_Battler 2.rb get_kf_action)，
      // 不用含基本功夫加成的有效等级。
      skillLevel(actor, playerId),
      random,
      "你",
      battle.enemyName,
      String(originalTables.weapons[actor.weaponId]?.name || ""),
    ),
    pc = player(actor, pm, battle),
    blank: Move = {
      text: "",
      hitType: 0,
      ap: 0,
      dp: 0,
      pp: 0,
      damage: 0,
      force: 0,
    },
    ec = enemy(record, battle.enemyFp, blank, battle);
  if (battle.playerBusy > 0) {
    battle.turn++;
    battle.log.push("你受制于招式，本回合无法出手。");
    enemyTurn(battle, actor, record, random, blank);
    return battle;
  }
  battle.turn++;
  battle.log.push(pm.text);
  const dealt = attackEffect(pc, ec, random);
  actor.fp = pc.fp;
  battle.enemyHp = Math.max(0, battle.enemyHp - numericDamage(dealt));
  battle.enemyMaxHp = Math.max(battle.enemyHp, battle.enemyMaxHp - dealt.hurt);
  applyVampiric(actor, battle, numericDamage(dealt));
  battle.log.push(resultText(dealt, battle.enemyName));
  if (battle.enemyHp <= victoryAt) {
    battle.finished = "win";
    battle.log.push(`${battle.enemyName}收招认输。`);
    return battle;
  }
  enemyTurn(battle, actor, record, random, blank);
  return battle;
}
export function endSpar(actor: SceneActorState, battle: OriginalBattle) {
  if (battle.mode === "spar" && battle.finished === "lose")
    actor.hp = Math.max(1, Math.floor(actor.maxHp / 10));
  return actor;
}
export function specialRound(
  source: OriginalBattle,
  actor: SceneActorState,
  specialId: number,
) {
  const battle = structuredClone(source);
  if (battle.finished) return battle;
  if (battle.playerBusy > 0) return battleRound(source, actor);
  const special = battleSpecials(actor, battle.cooldowns).find(
    (item) => item.id === specialId,
  );
  if (!special || !special.enabled) {
    battle.log.push(special?.reason || "无法施展这项绝招。");
    return battle;
  }
  tick(battle, actor);
  if (battle.finished) return battle;
  const victoryAt = storyVictoryAt(battle);
  if (battle.enemyHp <= victoryAt) {
    battle.finished = "win";
    battle.log.push(`${battle.enemyName}倒在苍鹰利爪之下。`);
    return battle;
  }
  paySpecialCost(actor, special);
  battle.turn++;
  battle.log.push(
    special.useText
      .replaceAll("user", "你")
      .replaceAll("target", battle.enemyName)
      .replaceAll(
        "weapon",
        String(originalTables.weapons[actor.weaponId]?.name || "兵刃"),
      ),
  );
  const level =
    specialId === 1
      ? effectiveLevel(actor, 12)
      : specialId === 2 || specialId === 4
        ? effectiveLevel(actor, 13)
        : 0;
  if (specialId === 1)
    battle.buff = {
      ...battle.buff,
      hit: battle.buff.hit + Math.floor(level / 15),
      turns: Math.floor(level / 25) + 1,
    };
  else if (specialId === 2) {
    battle.buff = {
      ...battle.buff,
      hit: battle.buff.hit + Math.floor(level / 15),
      str: battle.buff.str + Math.floor((level * 2) / 15),
      turns: Math.floor(level / 20) + 1,
    };
    // 化掌为刀施放后自缚(原作 add_state(0,2) 存 3)。
    battle.playerBusy = Math.max(battle.playerBusy, 3);
  }
  const record = battleEnemyRecord(battle),
    random = lcg(battle),
    blank: Move = {
      text: "",
      hitType: 0,
      ap: 0,
      dp: 0,
      pp: 0,
      damage: 0,
      force: 0,
    },
    enemyCombatant = enemy(record, battle.enemyFp, blank, battle);
  let forcedAttacks = 0;
  if (specialId >= 29) {
    const combo = ([32, 36, 40] as number[]).includes(specialId)
      ? ((
          (originalTables.skills[specialId]?.magic_data as number[]) || []
        ).slice(2, 5) as number[])
      : [specialId];
    for (const spellId of combo) {
      if (spellId !== specialId) {
        const check = specialCheck(actor, spellId, battle.cooldowns);
        if (!check.ok) {
          battle.log.push(`连锁施法中断：${check.reason}。`);
          break;
        }
        actor.fp = Math.max(0, actor.fp - specialFpCost(actor, spellId));
        actor.mp = Math.max(0, actor.mp - specialMpCost(actor, spellId));
        actor.hp = Math.max(
          0,
          actor.hp - Number(originalTables.skills[spellId]?.hp_cost || 0),
        );
        battle.log.push(
          String(
            (originalTables.skills[spellId]?.use_text as string[])?.[0] ||
              originalTables.skills[spellId]?.name ||
              "法术",
          )
            .replaceAll("user", "你")
            .replaceAll("target", battle.enemyName),
        );
      }
      castSpell(battle, actor, spellId, record, random);
      if (actor.hp <= 0 || battle.enemyHp <= 0) break;
    }
  } else if (specialId === 6) {
    const flower = effectiveLevel(actor, 19);
    if (battle.enemyWeaponId > 0) {
      if (
        random(Math.max(1, derivedStats(actor).agi)) >=
        enemyCombatant.agi / 3
      ) {
        battle.enemyWeaponId = 0;
        battle.log.push(`${battle.enemyName}手中兵刃脱手飞出！`);
      } else battle.log.push(`${battle.enemyName}运力抽身，避过夺械。`);
    } else {
      const hit = random(Math.max(1, flower));
      if (hit >= enemyCombatant.dodgeKfLv / 3) {
        battle.enemyHp = Math.max(0, battle.enemyHp - hit);
        battle.enemyMaxHp = Math.max(0, battle.enemyMaxHp - hit);
        battle.enemyDebuff.busy = Math.max(battle.enemyDebuff.busy, 2);
        battle.log.push(`${battle.enemyName}被卷入鞭圈，受到 ${hit} 点伤害。`);
      } else battle.log.push(`${battle.enemyName}滚出鞭影，避开了这一招。`);
    }
  } else if (specialId === 7) {
    const flower = effectiveLevel(actor, 21),
      turns = Math.min(Math.floor(flower / 20), 8) + 1;
    battle.buff = {
      ...battle.buff,
      agi: battle.buff.agi + Math.floor(flower / 20),
      eva: battle.buff.eva + Math.floor(flower / 5) - 6,
      turns: Math.max(battle.buff.turns, turns),
    };
  } else if (specialId === 8) {
    const thrownWeaponId = actor.weaponId,
      chaos = effectiveLevel(actor, 24),
      pc = player(actor, blank, battle);
    pc.hit += 15;
    const hitPower = kfPower(pc, 0),
      evadePower = kfPower(enemyCombatant, 1);
    if (random(Math.max(1, hitPower + evadePower)) >= evadePower) {
      const damage = (pc.str + chaos) * 2,
        wound = pc.hit + chaos;
      battle.enemyHp = Math.max(0, battle.enemyHp - damage);
      battle.enemyMaxHp = Math.max(0, battle.enemyMaxHp - wound);
      // 原作掷出兵刃后自身硬直(022 add_state(0,3) 存 4)，并非冻结敌人。
      battle.playerBusy = Math.max(battle.playerBusy, 4);
      battle.log.push(`${battle.enemyName}被兵刃贯穿，受到 ${damage} 点伤害。`);
    } else {
      // 掷空硬直更久(原作 add_state(0,4) 存 5)。
      battle.playerBusy = Math.max(battle.playerBusy, 5);
      battle.log.push(`${battle.enemyName}凌空跃开，兵刃从身旁飞过。`);
    }
    const key = `2:${thrownWeaponId}`,
      customType = thrownWeaponId - 31,
      isForgedWeapon = customType >= 0 && customType < 4 &&
        Boolean(actor.swords?.[customType]?.forged);
    if (isForgedWeapon) {
      actor.inventory[key] = Math.max(1, actor.inventory[key] || 0);
      battle.log.push("你收回掷出的自制兵器，将它放回行囊。");
    } else if (actor.inventory[key]) {
      actor.inventory[key]--;
      if (actor.inventory[key] <= 0) delete actor.inventory[key];
    }
    actor.weaponId = 0;
  } else if (specialId === 9) {
    const lotus = effectiveLevel(actor, 26),
      turns = Math.floor(lotus / 20) + 1;
    battle.buff = {
      ...battle.buff,
      str: battle.buff.str + Math.floor(lotus / 6),
      turns: Math.max(battle.buff.turns, turns),
    };
  } else if (specialId === 10) {
    const lotus = effectiveLevel(actor, 26),
      turns = Math.floor(lotus / 20) + 1;
    battle.buff = {
      ...battle.buff,
      hit: battle.buff.hit + Math.floor(lotus / 9),
      turns: Math.max(battle.buff.turns, turns),
    };
  } else if (specialId === 12) {
    const blade = effectiveLevel(actor, 29);
    battle.buff = {
      ...battle.buff,
      hit: battle.buff.hit + 15,
      atk: battle.buff.atk + Math.floor(blade / 3) + 20,
      turns: Math.max(battle.buff.turns, 1),
    };
  } else if (specialId === 13) {
    const ninja = effectiveLevel(actor, 31);
    if (random(Math.max(1, actor.fp)) >= battle.enemyFp / 3) {
      battle.enemyDebuff.hit -= Math.min(Math.floor(ninja / 8), 20);
      battle.enemyDebuff.turns = Math.floor(ninja / 20) + 1;
      battle.log.push(`${battle.enemyName}陷入烟幕，命中大幅下降。`);
    } else {
      // 烟幕被震散则自缚一回合(原作 add_state(0,2) 存 3)。
      battle.playerBusy = Math.max(battle.playerBusy, 3);
      battle.log.push(`${battle.enemyName}以内力震散烟幕。`);
    }
  } else if (specialId === 14) {
    const ninja = effectiveLevel(actor, 31),
      turns = Math.floor(ninja / 20) + 1;
    battle.buff = {
      ...battle.buff,
      fenshen: Math.max(Math.floor(ninja / 5), 30),
      turns: Math.max(battle.buff.turns, turns),
    };
  } else if (specialId === 15) {
    const hit = random(Math.max(1, actor.fp));
    if (hit >= battle.enemyFp / 3) {
      const damage = Math.max(
        0,
        Math.floor(actor.fp / 10) +
          actor.fpPlus -
          Math.floor(battle.enemyFp / 30),
      );
      battle.enemyHp = Math.max(0, battle.enemyHp - damage);
      battle.enemyMaxHp = Math.max(
        0,
        battle.enemyMaxHp - Math.floor(damage / 2),
      );
      battle.cooldowns["15"] = 3;
      battle.log.push(`太极刚劲造成 ${damage} 点伤害。`);
    } else if (hit < battle.enemyFp / 4) {
      battle.playerBusy = random(3) + 3;
      battle.log.push("内力反震，你踉跄倒退。");
    } else {
      battle.enemyFp = Math.max(
        0,
        battle.enemyFp - (battle.enemyFp < 200 ? battle.enemyFp : 100),
      );
      battle.log.push("双方内力相拼，各自退开。");
    }
  } else if (specialId === 16) {
    const hit = random(Math.max(1, actor.fp));
    if (hit >= battle.enemyFp / 3) {
      const drain = Math.floor(actor.fp / 10) + 350 + actor.fpPlus;
      battle.enemyFp = Math.max(0, battle.enemyFp - drain);
      battle.cooldowns["16"] = 3;
      battle.log.push(`${battle.enemyName}损失 ${drain} 点内力。`);
    } else if (hit < battle.enemyFp / 5) {
      battle.playerBusy = random(3) + 2;
      battle.log.push("你的劲力落空，身形失衡。");
    } else {
      battle.enemyFp = Math.max(0, battle.enemyFp - 350);
      battle.log.push(`${battle.enemyName}损失 350 点内力。`);
    }
  } else if (specialId === 17) {
    const hit = random(Math.max(1, effectiveLevel(actor, 32)));
    if (hit >= enemyCombatant.parryKfLv / 3) {
      const turns = Math.floor(hit / 30) + 2;
      battle.enemyDebuff.busy = Math.max(battle.enemyDebuff.busy, turns);
      battle.cooldowns["17"] = turns + 4;
      battle.log.push(`${battle.enemyName}身陷乱环阵。`);
    } else {
      battle.playerBusy = 3;
      battle.log.push(`${battle.enemyName}奋力挣脱乱环。`);
    }
  } else if (specialId === 18) {
    const taiChi = effectiveLevel(actor, 32);
    if (battle.enemyDebuff.busy > 0 || random(5) === 0) {
      battle.buff = {
        ...battle.buff,
        hit: battle.buff.hit + 15,
        str: battle.buff.str + Math.floor(taiChi / 5),
        turns: Math.max(battle.buff.turns, 1),
      };
      battle.playerBusy = 4;
      battle.cooldowns["18"] = 8;
      forcedAttacks = 1;
    } else {
      const hit = random(Math.max(1, taiChi));
      if (hit >= enemyCombatant.parryKfLv / 3) {
        const turns = Math.floor(hit / 25) + 2;
        battle.enemyDebuff.busy = Math.max(battle.enemyDebuff.busy, turns);
        battle.cooldowns["18"] = 6;
        battle.log.push(`${battle.enemyName}被太极柔劲困住。`);
      } else {
        battle.playerBusy = 3;
        battle.log.push(`${battle.enemyName}挣脱了太极柔劲。`);
      }
    }
  } else if (specialId === 19) {
    const hit = random(Math.max(1, actor.exp)),
      taiChiSword = effectiveLevel(actor, 33);
    if (hit >= n(record, "exp") / 3) {
      battle.enemyDebuff.busy = Math.max(
        battle.enemyDebuff.busy,
        random(Math.max(1, Math.floor(taiChiSword / 20))) + 1,
      );
      battle.log.push(`${battle.enemyName}被剑意丝棉紧紧裹住。`);
    } else {
      battle.playerBusy = 4;
      battle.log.push(`${battle.enemyName}跃出缠字诀。`);
    }
    battle.cooldowns["19"] = 7;
  } else if (specialId === 20) {
    const sword = effectiveLevel(actor, 33),
      turns = Math.floor(sword / 30) + 4;
    battle.buff = {
      ...battle.buff,
      hit: battle.buff.hit + 10,
      eva: battle.buff.eva + Math.floor(sword / 15),
      turns: Math.max(battle.buff.turns, turns),
    };
    battle.cooldowns["20"] = turns;
  } else if (specialId === 21) {
    const sword = effectiveLevel(actor, 33);
    battle.buff = {
      ...battle.buff,
      atk: battle.buff.atk + Math.floor(sword / 5),
      turns: Math.max(battle.buff.turns, 1),
    };
    battle.playerBusy = 4;
    battle.cooldowns["21"] = 7;
    forcedAttacks = 3;
  } else if (specialId === 22) {
    const hit = random(Math.max(1, actor.fp)),
      snow = effectiveLevel(actor, 37);
    if (hit >= battle.enemyFp / 2) {
      const damage = Math.floor(snow / 3);
      battle.enemyHp = Math.max(0, battle.enemyHp - damage);
      battle.enemyDebuff.busy = Math.max(
        battle.enemyDebuff.busy,
        Math.floor(snow / 35) + 3,
      );
      battle.log.push(`${battle.enemyName}被摔倒，受到 ${damage} 点伤害。`);
    } else {
      battle.playerBusy = 3;
      battle.log.push(`${battle.enemyName}以内力格挡连环三招。`);
    }
    battle.cooldowns["22"] = 6;
  } else if (specialId === 23) {
    const snow = effectiveLevel(actor, 39);
    // 白瑞德传授“第六出”后，雪花六出直接进入完整二十二剑形态；
    // 未解锁时仍保留原本随等级成长、至多五剑的阶段。
    forcedAttacks = actor.xue6
      ? 22
      : Math.max(1, Math.min(Math.floor((snow - 90) / 30) + 2, 5));
    battle.buff = {
      ...battle.buff,
      hit: battle.buff.hit + 10,
      turns: Math.max(battle.buff.turns, 1),
    };
    battle.playerBusy = 4;
    battle.cooldowns["23"] = 11;
  } else if (specialId === 24) {
    const ice = effectiveLevel(actor, 41),
      turns = Math.min(Math.floor(ice / 20), 10) + 1;
    battle.buff = {
      ...battle.buff,
      pdef: battle.buff.pdef + Math.min(Math.floor(ice / 4), 100),
      turns: Math.max(battle.buff.turns, turns),
    };
    battle.cooldowns["24"] = turns;
  } else if (specialId === 25) {
    const dragon = effectiveLevel(actor, 47),
      power = dragon + 5 - Math.floor(n(record, "maxfp") / 10);
    if (power >= 0) {
      battle.enemyHp = Math.max(0, battle.enemyHp - power);
      battle.enemyDebuff.busy = Math.max(
        battle.enemyDebuff.busy,
        Math.floor(dragon / 30) + 1,
      );
      battle.log.push(`虎啸震伤${battle.enemyName}，造成 ${power} 点伤害。`);
    } else battle.log.push(`${battle.enemyName}内力深厚，不为虎啸所动。`);
    battle.cooldowns["25"] = 6;
  } else if (specialId === 26) {
    const eagle = effectiveLevel(actor, 44);
    battle.enemyDebuff.eagleTurns = Math.floor(eagle / 10) + 1;
    battle.cooldowns["26"] = 12;
    battle.log.push("金眼铁爪苍鹰开始在战场上盘旋。");
  } else if (specialId === 27) {
    const eagle = effectiveLevel(actor, 44),
      addition = Math.floor((eagle * (5 + random(6))) / 10),
      turns = Math.floor(eagle / 20) + 1;
    battle.buff = {
      ...battle.buff,
      eva: battle.buff.eva + addition,
      turns: Math.max(battle.buff.turns, turns),
    };
    battle.cooldowns["27"] = turns;
  } else if (specialId === 28) {
    const dragon = effectiveLevel(actor, 47),
      // 灵通心诀需在学识槽装备(第7槽)才强化变熊术。
      knowledge = actor.skillUse[6] === 48 ? skillLevel(actor, 48) : 0,
      turns = Math.floor(dragon / 20) + Math.floor(knowledge / 15) + 1,
      additionStr = Math.floor(dragon / 10) + Math.floor(knowledge / 8),
      additionDef = Math.floor(dragon / 2) + knowledge;
    battle.buff = {
      ...battle.buff,
      str: battle.buff.str + additionStr,
      pdef: battle.buff.pdef + additionDef,
      turns: Math.max(battle.buff.turns, turns),
    };
    battle.cooldowns["28"] = turns;
  }
  // 原作以下绝招施放后自带硬直后摇(022 各分支 add_state(0,N)，存 N+1)：
  // 化掌为刀 3；八卦刀影掌/八阵刀影掌/柳浪闻莺 4；
  // 红莲出世/旋风三连斩/迎风一刀斩 2。
  if (specialId === 2 || specialId === 3 || specialId === 4 || specialId === 5)
    battle.playerBusy = Math.max(
      battle.playerBusy,
      specialId === 2 ? 3 : 4,
    );
  if (specialId === 10 || specialId === 11 || specialId === 12)
    battle.playerBusy = Math.max(battle.playerBusy, 2);
  const attacks =
      forcedAttacks > 0
        ? forcedAttacks
        : specialId === 3
          ? 2
          : specialId === 4 || specialId === 5 || specialId === 11
            ? 3
            : [
                  6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 19, 20, 22, 24, 25, 26,
                  27, 28, 27, 28,
                ].includes(specialId) || specialId >= 29
              ? 0
              : special.type === 2
                ? 1
                : 0,
    attackDamage = specialId === 4 ? 15 : 0;
  for (let i = 0; i < attacks && battle.enemyHp > 0; i++) {
    const pc = player(
        actor,
        {
          ...blank,
          damage: attackDamage,
          force: specialId === 5 ? 10 : 0,
        },
        battle,
      ),
      ec = enemy(record, battle.enemyFp, blank, battle),
      result = attackEffect(pc, ec, random);
    actor.fp = pc.fp;
    battle.enemyHp = Math.max(0, battle.enemyHp - numericDamage(result));
    battle.enemyMaxHp = Math.max(battle.enemyHp, battle.enemyMaxHp - result.hurt);
    // 原作连招每击都走 common_attack，吸血大法逐击结算(099 - Scene_Battle 4.rb)。
    applyVampiric(actor, battle, numericDamage(result));
    battle.log.push(`第 ${i + 1} 击：${resultText(result, battle.enemyName)}`);
  }
  // 冷却公式抽到 special-system 的 specialCooldownTurns，与绝招菜单说明共用。
  const cooldown = specialCooldownTurns(actor, specialId);
  if (cooldown > 0) battle.cooldowns[String(specialId)] = cooldown;
  if (battle.enemyHp <= victoryAt) {
    battle.finished = "win";
    battle.log.push(`${battle.enemyName}收招认输。`);
    return battle;
  }
  const defeatAt =
    battle.mode === "story" && battle.enemyId === 149
      ? Math.floor(fullHp(actor) / 2)
      : 0;
  if (actor.hp <= defeatAt) {
    battle.finished = "lose";
    battle.log.push("法术反噬耗损气血，你已无力再战。 ");
    return battle;
  }
  enemyTurn(battle, actor, record, random, blank);
  return battle;
}
