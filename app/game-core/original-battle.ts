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
  specialFpCost,
  specialMpCost,
} from "./special-system";
import {
  npcCombatLevel,
  scaledNpcCombatRecord,
} from "./npc-combat-scaling";
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
  enemyDebuff: {
    hit: number;
    busy: number;
    turns: number;
    eagleTurns: number;
    burnTurns: number;
  };
  enemyOverride?: OriginalRecord;
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
  scaledNpcCombatRecord(
    battle.enemyOverride || originalTables.enemies[battle.enemyId] || {},
    Boolean(battle.enemyOverride),
  );

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
    fenshen: 0,
    turns: 0,
  };
  return {
    exp: actor.exp,
    hit: stats.hit + buff.hit,
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
    attackId = n(record, "weapon_id") > 0 ? uses[1] || 1 : uses[0] || 2;
  const debuff = battle?.enemyDebuff || {
    hit: 0,
    busy: 0,
    turns: 0,
    eagleTurns: 0,
    burnTurns: 0,
  };
  return {
    exp: n(record, "exp"),
    hit: n(record, "base_hit") + debuff.hit,
    eva: n(record, "base_eva"),
    attackKfLv: level(attackId),
    dodgeKfLv: level(uses[2] || 9),
    parryKfLv: level(uses[3] || 10),
    agi: n(record, "agi"),
    int: n(record, "int"),
    str: n(record, "str"),
    atk: n(record, "atk"),
    pdef: n(record, "pdef"),
    fp,
    fpPlus: n(record, "fp_plus"),
    weaponId: battle ? battle.enemyWeaponId : n(record, "weapon_id"),
    movable: debuff.busy <= 0,
    fenshen: 0,
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
function enemyAttackId(record: OriginalRecord) {
  const uses = (record.skill_use as number[]) || [];
  return n(record, "weapon_id") > 0 ? uses[1] || 1 : uses[0] || 2;
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
        random(15) + 6,
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
    ) + Math.floor((damageRate * 2 * actor.mpPlus) / 100);
  const enemyFpPlus = n(record, "fp_plus");
  const targetPower =
    Math.floor(
      (random(Math.max(1, diminishingBattleResource(battle.enemyMaxHp))) +
        diminishingBattleResource(battle.enemyFp)) /
        20,
    ) +
    Math.floor((damageRate * 2 * random(Math.max(1, enemyFpPlus))) / 100);
  const reflected = userPower < targetPower;
  const first = reflected
    ? Math.floor(((targetPower - userPower + enemyFpPlus) * damageRate) / 100)
    : Math.floor(((userPower - targetPower) * damageRate) / 100);
  const mastery = Math.min(300, effectiveLevel(actor, magicKungfuId(actor))),
    damage = Math.floor((first * (400 + mastery)) / 400);
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
  if (battle.buff.turns > 0 && --battle.buff.turns === 0)
    battle.buff = {
      hit: 0,
      str: 0,
      eva: 0,
      agi: 0,
      atk: 0,
      pdef: 0,
      fenshen: 0,
      turns: 0,
    };
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
  const enemyId = enemyAttackId(record),
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
          text: String(
            (originalTables.skills[special.id]?.use_text as string[])?.[0] ||
              `${battle.enemyName}施展${special.name}！`,
          )
            .replaceAll("user", battle.enemyName)
            .replaceAll("target", "你")
            .replaceAll(
              "weapon",
              String(originalTables.weapons[battle.enemyWeaponId]?.name || "兵刃"),
            ),
          ap: baseMove.ap + 18 + Math.floor(enemyLevel / 12),
          damage: baseMove.damage + 20,
          force: baseMove.force + 10,
        }
      : baseMove;
  const attacker = enemy(record, battle.enemyFp, em, battle),
    target = player(actor, blank, battle);
  if (special) {
    attacker.fp = Math.max(0, attacker.fp - special.fpCost);
    battle.enemyMp = Math.max(0, battle.enemyMp - special.mpCost);
    battle.log.push(`${battle.enemyName}施展绝招「${special.name}」！`);
  }
  const received = attackEffect(attacker, target, random);
  battle.log.push(em.text, resultText(received, "你"));
  battle.enemyFp = attacker.fp;
  actor.hp = Math.max(0, actor.hp - numericDamage(received));
  actor.maxHp = Math.max(actor.hp, actor.maxHp - received.hurt);
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
  const ids = [
    ...new Set(
      ((record.skill_use as number[] | undefined) || []).flatMap(
        (id) => (originalTables.kungfus[id]?.skill as number[] | undefined) || [],
      ),
    ),
  ].filter((id) => id > 0 && Number(originalTables.skills[id]?.type || 0) === 2);
  const usable = ids.flatMap((id) => {
    const skill = originalTables.skills[id] || {},
      fpCost = Number(skill.fp_cost || 0),
      rawMpCost = Number(skill.mp_cost || 0),
      mpCost = id >= 29
        ? Math.max(rawMpCost, Number((skill.magic_data as number[])?.[0] || 0))
        : rawMpCost;
    return battle.enemyFp >= fpCost && battle.enemyMp >= mpCost
      ? [{ id, name: String(skill.name || `绝招${id}`), fpCost, mpCost }]
      : [];
  });
  return usable.length ? usable[random(usable.length)] : null;
}

export function beginOriginalBattle(
  enemyId: number,
  seed = 9527,
  enemyOverride?: OriginalRecord,
  mode: "spar" | "lethal" | "story" = "spar",
): OriginalBattle {
  const e = scaledNpcCombatRecord(
    enemyOverride || originalTables.enemies[enemyId] || {},
    Boolean(enemyOverride),
  );
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
    buff: {
      hit: 0,
      str: 0,
      eva: 0,
      agi: 0,
      atk: 0,
      pdef: 0,
      fenshen: 0,
      turns: 0,
    },
    enemyDebuff: { hit: 0, busy: 0, turns: 0, eagleTurns: 0, burnTurns: 0 },
    enemyOverride,
    mode,
    escapeFactor: 0,
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
  const blank: Move = {
    text: "",
    hitType: 0,
    ap: 0,
    dp: 0,
    pp: 0,
    damage: 0,
    force: 0,
  };
  enemyTurn(battle, actor, record, random, blank);
  return { escaped: false, battle };
}
export function battleRound(source: OriginalBattle, actor: SceneActorState) {
  const battle = structuredClone(source);
  if (battle.finished) return battle;
  tick(battle, actor);
  const victoryAt =
    battle.mode === "story" && battle.enemyId === 149
      ? Math.floor(battle.enemyMaxHp / 2)
      : 0;
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
      playerId >= 12
        ? effectiveLevel(actor, playerId)
        : skillLevel(actor, playerId),
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
  const victoryAt =
    battle.mode === "story" && battle.enemyId === 149
      ? Math.floor(battle.enemyMaxHp / 2)
      : 0;
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
  else if (specialId === 2)
    battle.buff = {
      ...battle.buff,
      hit: battle.buff.hit + Math.floor(level / 15),
      str: battle.buff.str + Math.floor((level * 2) / 15),
      turns: Math.floor(level / 20) + 1,
    };
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
        battle.enemyDebuff.busy = 3;
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
    const chaos = effectiveLevel(actor, 24),
      pc = player(actor, blank, battle);
    pc.hit += 15;
    const hitPower = kfPower(pc, 0),
      evadePower = kfPower(enemyCombatant, 1);
    if (random(Math.max(1, hitPower + evadePower)) >= evadePower) {
      const damage = (pc.str + chaos) * 2,
        wound = pc.hit + chaos;
      battle.enemyHp = Math.max(0, battle.enemyHp - damage);
      battle.enemyMaxHp = Math.max(0, battle.enemyMaxHp - wound);
      battle.enemyDebuff.busy = 4;
      battle.log.push(`${battle.enemyName}被兵刃贯穿，受到 ${damage} 点伤害。`);
    } else battle.log.push(`${battle.enemyName}凌空跃开，兵刃从身旁飞过。`);
    const key = `2:${actor.weaponId}`;
    if (actor.inventory[key]) {
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
    } else battle.log.push(`${battle.enemyName}以内力震散烟幕。`);
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
      const turns = Math.floor(hit / 30) + 3;
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
        const turns = Math.floor(hit / 25) + 3;
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
        random(Math.max(1, Math.floor(taiChiSword / 20))) + 2,
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
        Math.floor(snow / 35) + 4,
      );
      battle.log.push(`${battle.enemyName}被摔倒，受到 ${damage} 点伤害。`);
    } else {
      battle.playerBusy = 3;
      battle.log.push(`${battle.enemyName}以内力格挡连环三招。`);
    }
    battle.cooldowns["22"] = 6;
  } else if (specialId === 23) {
    const snow = effectiveLevel(actor, 39),
      maximum = actor.xue6 ? 6 : 5;
    forcedAttacks = Math.min(Math.floor((snow - 90) / 30) + 2, maximum);
    forcedAttacks = Math.max(1, forcedAttacks);
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
        Math.floor(dragon / 30) + 2,
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
      knowledge = skillLevel(actor, 48),
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
    battle.log.push(`第 ${i + 1} 击：${resultText(result, battle.enemyName)}`);
  }
  const fixedCooldown: Record<number, number> = {
    3: 8,
    4: 8,
    5: 8,
    6: 7,
    8: 10,
    11: 6,
    12: 8,
  };
  const dynamicCooldown =
    specialId === 7
      ? Math.min(Math.floor(effectiveLevel(actor, 21) / 20), 8) + 1
      : specialId === 9 || specialId === 10
        ? Math.floor(effectiveLevel(actor, 26) / 20) + 1
        : specialId === 14
          ? Math.floor(effectiveLevel(actor, 31) / 20) + 1
          : 0;
  const cooldown =
    fixedCooldown[specialId] ||
    dynamicCooldown ||
    ([1, 2].includes(specialId)
      ? [0, Math.floor(level / 25) + 1, Math.floor(level / 20) + 1][specialId]
      : 0);
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
