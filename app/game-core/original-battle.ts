import {
  attackEffect,
  kfPower,
  type Combatant,
  type RandomInt,
} from "./combat";
import { originalTables, type OriginalRecord } from "./original-data";
import type { SceneActorState } from "./scene-event";
import { derivedStats } from "./inventory-system";
import { combatSkillProfile, effectiveLevel, skillLevel } from "./skill-system";
import { battleSpecials, paySpecialCost } from "./special-system";

export type OriginalBattle = {
  enemyId: number;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyFp: number;
  enemyWeaponId: number;
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
    fenshen: number;
    turns: number;
  };
  enemyDebuff: { hit: number; busy: number; turns: number };
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

function moveFor(
  record: OriginalRecord,
  kfId: number,
  level: number,
  random: RandomInt,
  user: string,
  target: string,
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
      .replaceAll("position", "要害"),
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
  const buff = battle?.buff || {
    hit: 0,
    str: 0,
    eva: 0,
    agi: 0,
    atk: 0,
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
    pdef: stats.pdef,
    fp: actor.fp,
    fpPlus: actor.fpPlus,
    weaponId: actor.weaponId,
    movable: actor.hp > 0,
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
  const debuff = battle?.enemyDebuff || { hit: 0, busy: 0, turns: 0 };
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
  return result.hurt > 0
    ? `${target}受到 ${result.hurt} 点伤害。`
    : `招式虽中，却未伤到${target}。`;
}
function enemyAttackId(record: OriginalRecord) {
  const uses = (record.skill_use as number[]) || [];
  return n(record, "weapon_id") > 0 ? uses[1] || 1 : uses[0] || 2;
}
function tick(battle: OriginalBattle) {
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
      fenshen: 0,
      turns: 0,
    };
  if (battle.enemyDebuff.busy > 0) battle.enemyDebuff.busy--;
  if (battle.enemyDebuff.turns > 0 && --battle.enemyDebuff.turns === 0)
    battle.enemyDebuff.hit = 0;
}

export function beginOriginalBattle(
  enemyId: number,
  seed = 9527,
): OriginalBattle {
  const e = originalTables.enemies[enemyId] || {};
  return {
    enemyId,
    enemyName: String(e.name || "江湖中人"),
    enemyHp: n(e, "hp", n(e, "maxhp", 1)),
    enemyMaxHp: n(e, "maxhp", 1),
    enemyFp: n(e, "fp"),
    enemyWeaponId: n(e, "weapon_id"),
    turn: 0,
    seed,
    log: [`${String(e.name || "江湖中人")}抱拳道：“请赐教！”`],
    finished: null,
    cooldowns: {},
    buff: { hit: 0, str: 0, eva: 0, agi: 0, atk: 0, fenshen: 0, turns: 0 },
    enemyDebuff: { hit: 0, busy: 0, turns: 0 },
  };
}
export function battleRound(source: OriginalBattle, actor: SceneActorState) {
  const battle = structuredClone(source);
  if (battle.finished) return battle;
  tick(battle);
  const record = originalTables.enemies[battle.enemyId] || {},
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
  battle.turn++;
  battle.log.push(pm.text);
  const dealt = attackEffect(pc, ec, random);
  actor.fp = pc.fp;
  battle.enemyHp = Math.max(0, battle.enemyHp - dealt.hurt);
  battle.log.push(resultText(dealt, battle.enemyName));
  if (battle.enemyHp <= 0) {
    battle.finished = "win";
    battle.log.push(`${battle.enemyName}收招认输。`);
    return battle;
  }
  if (battle.enemyDebuff.busy > 0) {
    battle.log.push(`受制于招式，无法还手。`);
    battle.log = battle.log.slice(-8);
    return battle;
  }
  const enemyId = enemyAttackId(record),
    enemyLevel =
      ((record.skill_list as number[][]) || []).find(
        (row) => row[0] === enemyId,
      )?.[1] || 0,
    em = moveFor(record, enemyId, enemyLevel, random, battle.enemyName, "你"),
    attacker = enemy(record, battle.enemyFp, em, battle),
    target = player(actor, blank, battle);
  battle.log.push(em.text);
  const received = attackEffect(attacker, target, random);
  battle.enemyFp = attacker.fp;
  actor.hp = Math.max(0, actor.hp - received.hurt);
  battle.log.push(resultText(received, "你"));
  if (actor.hp <= 0) {
    battle.finished = "lose";
    battle.log.push("你眼前一黑，已无力再战。切磋到此为止。");
  }
  battle.log = battle.log.slice(-8);
  return battle;
}
export function endSpar(actor: SceneActorState, battle: OriginalBattle) {
  if (battle.finished === "lose")
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
  const special = battleSpecials(actor, battle.cooldowns).find(
    (item) => item.id === specialId,
  );
  if (!special || !special.enabled) {
    battle.log.push(special?.reason || "无法施展这项绝招。");
    return battle;
  }
  tick(battle);
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
  const record = originalTables.enemies[battle.enemyId] || {},
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
  if (specialId === 6) {
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
  }
  const attacks =
      specialId === 3
        ? 2
        : specialId === 4 || specialId === 5 || specialId === 11
          ? 3
          : [6, 7, 8, 9, 10, 13, 14].includes(specialId)
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
    battle.enemyHp = Math.max(0, battle.enemyHp - result.hurt);
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
  if (battle.enemyHp <= 0) {
    battle.finished = "win";
    battle.log.push(`${battle.enemyName}收招认输。`);
    return battle;
  }
  if (battle.enemyDebuff.busy > 0) {
    battle.log.push(`受制于招式，无法还手。`);
    battle.log = battle.log.slice(-8);
    return battle;
  }
  const enemyId = enemyAttackId(record),
    enemyLevel =
      ((record.skill_list as number[][]) || []).find(
        (row) => row[0] === enemyId,
      )?.[1] || 0,
    em = moveFor(record, enemyId, enemyLevel, random, battle.enemyName, "你"),
    attacker = enemy(record, battle.enemyFp, em, battle),
    target = player(actor, blank, battle),
    received = attackEffect(attacker, target, random);
  battle.log.push(em.text, resultText(received, "你"));
  battle.enemyFp = attacker.fp;
  actor.hp = Math.max(0, actor.hp - received.hurt);
  if (actor.hp <= 0) {
    battle.finished = "lose";
    battle.log.push("你眼前一黑，已无力再战。");
  }
  battle.log = battle.log.slice(-8);
  return battle;
}
