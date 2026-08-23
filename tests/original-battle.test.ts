import assert from "node:assert/strict";
import test from "node:test";
import {
  attemptEscape,
  battleItemRound,
  battleRound,
  beginOriginalBattle,
  burningDamage,
  diminishingBattleResource,
  endSpar,
  specialRound,
} from "../app/game-core/original-battle";
import type { SceneActorState } from "../app/game-core/scene-event";
import { originalTables } from "../app/game-core/original-data";
import { battleSpecials } from "../app/game-core/special-system";
const actor = (): SceneActorState => ({
  inventory: {},
  gold: 100,
  hp: 100,
  maxHp: 100,
  fp: 0,
  maxFp: 0,
  food: 100,
  water: 100,
  exp: 0,
  potential: 100,
  morals: 128,
  tanId: 0,
  teacherId: 0,
  classId: 0,
  gender: 0,
  face: 20,
  mp: 0,
  maxMp: 0,
  age: 14,
  baseBon: 20,
  baseInt: 20,
  baseAgi: 20,
  baseStr: 20,
  bon: 20,
  int: 20,
  agi: 20,
  str: 20,
  luck: 20,
  skills: {},
  weaponId: 0,
  armorIds: [],
  skillUse: [0, 0, 0, 0, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});
test("story battles preserve the original no-escape rule", () => {
  const a = actor(),
    result = attemptEscape(beginOriginalBattle(1, 42, undefined, "story"), a);
  assert.equal(result.escaped, false);
  assert.match(result.battle.log.at(-1) || "", /无法逃走/);
});
test("生成任务切磋在战斗状态中保留精确任务上下文", () => {
  const context = { questId: "llm-7", enemyId: 13 },
    battle = beginOriginalBattle(13, 42, undefined, "spar", context);
  assert.deepEqual(battle.questContext, context);
  assert.equal(battle.mode, "spar");
});
test("high spell resources use diminishing formula inputs instead of a damage cap", () => {
  assert.equal(diminishingBattleResource(5000), 5000);
  assert.equal(diminishingBattleResource(65000), 22320);
  assert.ok(diminishingBattleResource(65000) > diminishingBattleResource(10000));
  assert.ok(diminishingBattleResource(65000) < 65000);
});
test("burning damage applies only a level-scaled fraction of the force gap", () => {
  const low = burningDamage(65000, 0, 0, () => 0),
    master = burningDamage(65000, 0, 300, () => 0);
  assert.equal(low, 1116);
  assert.equal(master, 1785);
  assert.ok(master < diminishingBattleResource(65000) / 10);
  assert.equal(burningDamage(1000, 5000, 300, (max) => max - 1), 0);
});
test("high-level NPCs regularly spend force to perform their own offensive specials", () => {
  let specialTurns = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const a = actor();
    a.hp = a.maxHp = 100000;
    const round = battleRound(beginOriginalBattle(102, seed), a);
    if (round.log.some((line) => line.includes("施展绝招"))) specialTurns++;
  }
  assert.ok(specialTurns >= 25 && specialTurns <= 55, String(specialTurns));
});
test("original sparring round is deterministic and changes combat state", () => {
  const a = actor(),
    b = actor(),
    one = battleRound(beginOriginalBattle(1, 42), a),
    two = battleRound(beginOriginalBattle(1, 42), b);
  assert.deepEqual(one, two);
  assert.equal(a.hp, b.hp);
  assert.equal(one.turn, 1);
  assert.ok(one.log.length >= 3);
});

test("战斗中使用药品会消耗回合并触发敌方行动", () => {
  const a = actor();
  a.hp = a.maxHp = 100000;
  const round = battleItemRound(
    beginOriginalBattle(1, 42),
    a,
    "使用了金创药：气血+15。",
  );
  assert.equal(round.turn, 1);
  assert.equal(round.log.includes("使用了金创药：气血+15。"), true);
  assert.ok(round.log.length >= 2);
});

test("battle keeps the full factual history for novelized narration", () => {
  const a = actor(), battle = beginOriginalBattle(1, 42);
  battle.log = Array.from({ length: 12 }, (_, index) => `旧战报${index}`);
  const round = battleRound(battle, a);
  assert.equal(round.log[0], "旧战报0");
  assert.ok(round.log.length > 12);
});

test("weapon attack text uses the equipped weapon name", () => {
  const a = actor();
  a.weaponId = 1;
  a.skills["4"] = { level: 100, points: 0 };
  const round = battleRound(beginOriginalBattle(1, 7), a);
  assert.equal(
    round.log.some((line) => line.includes("weapon")),
    false,
  );
  assert.equal(
    round.log.some((line) => line.includes("菜刀")),
    true,
  );
});

test("铸剑挑战按原作在双方半血时判定胜负", () => {
  const a = actor(),
    battle = beginOriginalBattle(149, 1, undefined, "story");
  battle.enemyHp = Math.floor(battle.enemyMaxHp / 2);
  assert.equal(battleRound(battle, a).finished, "win");
});

test("生死战失败不会套用切磋的自动回血", () => {
  const a = actor(),
    battle = beginOriginalBattle(1, 1, undefined, "lethal");
  a.hp = 0;
  battle.finished = "lose";
  endSpar(a, battle);
  assert.equal(a.hp, 0);
});

const weaponForKungfuType: Record<number, number> = {
  3: 15,
  4: 8,
  5: 25,
  6: 21,
};

function specialActor(specialId: number) {
  const a = actor();
  a.hp = a.maxHp = 1_000_000;
  a.fp = a.maxFp = 100_000;
  a.mp = a.maxMp = 100_000;
  a.exp = 10_000_000;
  a.str = a.agi = a.int = a.bon = 100;
  a.baseStr = a.baseAgi = a.baseInt = a.baseBon = 100;
  a.fpPlus = 100;
  a.mpPlus = 100;
  a.skillUse = [0, 0, 0, 0, 0, 0, 0];
  for (let id = 1; id <= 60; id++)
    a.skills[String(id)] = { level: 255, points: 0 };

  const owner = originalTables.kungfus.findIndex((record) =>
    ((record?.skill as number[]) || []).includes(specialId),
  );
  assert.ok(owner > 0, `special ${specialId} should have a kungfu owner`);
  const requirements =
    (originalTables.skills[specialId]?.require as number[][] | undefined) || [];
  const equip = (id: number) => {
    const type = Number(originalTables.kungfus[id]?.type || 0);
    if (type === 1) a.skillUse[3] = id;
    else if (type === 2) a.skillUse[0] = id;
    else if (type >= 3 && type <= 7) a.skillUse[1] = id;
    else if (type === 8) a.skillUse[5] = id;
    else if (type === 9) a.skillUse[2] = id;
    else if (type === 10) a.skillUse[4] = id;
  };
  equip(owner);
  for (const [id] of requirements) if (id > 0) equip(id);

  const weaponSkill = a.skillUse[1];
  if (weaponSkill > 0) {
    const type = Number(originalTables.kungfus[weaponSkill]?.type || 0);
    a.weaponId = weaponForKungfuType[type] || 15;
    a.inventory[`2:${a.weaponId}`] = 1;
  }
  return a;
}

const sturdyEnemy = {
  ...originalTables.enemies[1],
  name: "试招木桩",
  hp: 1_000_000,
  maxhp: 1_000_000,
  fp: 3000,
  maxfp: 3000,
  mp: 3000,
  maxmp: 3000,
  exp: 100_000,
  fp_plus: 20,
  base_hit: 0,
  base_eva: 0,
  atk: 0,
  pdef: 0,
  agi: 20,
  int: 20,
  str: 20,
};

test("四十项绝招都能通过真实装备条件进入对应战斗状态转换", () => {
  for (let specialId = 1; specialId <= 40; specialId++) {
    const a = specialActor(specialId);
    const available = battleSpecials(a).find((item) => item.id === specialId);
    assert.equal(available?.enabled, true, `${specialId}: ${available?.reason}`);
    const beforeFp = a.fp, beforeMp = a.mp, beforeHp = a.hp;
    const battle = specialRound(
      beginOriginalBattle(1, 1000 + specialId, sturdyEnemy),
      a,
      specialId,
    );
    assert.equal(battle.turn, 1, `special ${specialId}`);
    assert.ok(battle.log.length >= 3, `special ${specialId}`);
    assert.ok(a.fp <= beforeFp, `special ${specialId} force cost`);
    assert.ok(a.mp <= beforeMp, `special ${specialId} magic cost`);
    assert.ok(a.hp <= beforeHp, `special ${specialId} health cost`);
  }
});

test("雪花六出未圆满至多五剑，第六出解锁后固定连出二十二剑", () => {
  const countStrikes = (xue6: boolean) => {
    const a = specialActor(23);
    a.xue6 = xue6;
    const special = battleSpecials(a).find((item) => item.id === 23);
    assert.ok(special?.enabled);
    const battle = specialRound(
      beginOriginalBattle(1, xue6 ? 2322 : 2305, {
        ...sturdyEnemy,
        hp: 1_000_000_000,
        maxhp: 1_000_000_000,
      }),
      a,
      23,
    );
    return {
      count: battle.log.filter((line) => /^第 \d+ 击：/.test(line)).length,
      description: special.description,
      useText: special.useText,
    };
  };

  assert.equal(countStrikes(false).count, 5);
  const completed = countStrikes(true);
  assert.equal(completed.count, 22);
  assert.match(completed.description, /二十二剑/);
  assert.match(completed.useText, /一气连出二十二剑/);
});

test("流星飞掷只卸下自制杖，不删除武器实体或行囊入口", () => {
  const a = specialActor(8);
  a.weaponId = 33;
  a.inventory["2:33"] = 1;
  a.swords = [
    { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
    { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
    { forged: true, name: "流云杖", atk: 55, mid: 304, suf: 210, times: 2 },
    { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
  ];
  const battle = specialRound(beginOriginalBattle(1, 1008, sturdyEnemy), a, 8);
  assert.equal(a.weaponId, 0);
  assert.equal(a.inventory["2:33"], 1);
  assert.equal(a.swords[2].name, "流云杖");
  assert.equal(a.swords[2].times, 2);
  assert.ok(battle.log.some((line) => /收回掷出的自制兵器/.test(line)));
});

test("流星飞掷仍按原作消耗普通杖", () => {
  const a = specialActor(8), weaponId = a.weaponId;
  assert.ok(weaponId > 0 && weaponId < 31);
  specialRound(beginOriginalBattle(1, 1008, sturdyEnemy), a, 8);
  assert.equal(a.weaponId, 0);
  assert.equal(a.inventory[`2:${weaponId}`], undefined);
});

test("战斗动作在已结束、忙乱和不可用绝招状态下保持安全", () => {
  const a = actor();
  const finished = beginOriginalBattle(1, 3);
  finished.finished = "win";
  assert.deepEqual(battleRound(finished, a), finished);
  assert.deepEqual(battleItemRound(finished, a, "不应使用"), finished);
  assert.deepEqual(specialRound(finished, a, 1), finished);

  const unavailable = specialRound(beginOriginalBattle(1, 3), a, 40);
  assert.match(unavailable.log.at(-1) || "", /无法施展/);
  assert.equal(unavailable.turn, 0);

  const busyActor = specialActor(1), busy = beginOriginalBattle(1, 4, sturdyEnemy);
  busy.playerBusy = 2;
  const delegated = specialRound(busy, busyActor, 1);
  assert.equal(delegated.turn, 1);
  assert.ok(delegated.log.some((line) => line.includes("无法出手")));
});

test("逃跑成功与失败都遵循敏捷和逐次补偿并在失败后还手", () => {
  const swift = actor();
  swift.baseAgi = swift.agi = 100;
  const successEnemy = { ...sturdyEnemy, agi: 0, base_agi: 0 };
  const escaped = attemptEscape(
    beginOriginalBattle(1, 7, successEnemy, "lethal"),
    swift,
  );
  assert.equal(escaped.escaped, true);

  const slow = actor();
  slow.hp = slow.maxHp = 100_000;
  slow.baseAgi = slow.agi = 1;
  const failureEnemy = { ...sturdyEnemy, agi: 9999, base_agi: 9999 };
  const failed = attemptEscape(
    beginOriginalBattle(1, 7, failureEnemy, "lethal"),
    slow,
  );
  assert.equal(failed.escaped, false);
  assert.equal(failed.battle.escapeFactor, 10);
  assert.ok(failed.battle.log.some((line) => line.includes("想跑")));
});

test("回合结算统一推进冷却、增益、控制、苍鹰和灼烧状态", () => {
  const a = specialActor(29);
  const battle = beginOriginalBattle(1, 1, sturdyEnemy);
  battle.cooldowns["1"] = 1;
  battle.buff = {
    hit: 10,
    str: 10,
    eva: 10,
    agi: 10,
    atk: 10,
    pdef: 10,
    fenshen: 10,
    turns: 1,
  };
  battle.playerBusy = 2;
  battle.enemyDebuff = {
    hit: -10,
    busy: 2,
    turns: 1,
    eagleTurns: 1,
    burnTurns: 1,
  };
  const result = battleItemRound(battle, a, "运功调息。");
  assert.equal(result.cooldowns["1"], undefined);
  assert.deepEqual(result.buff, {
    hit: 0,
    str: 0,
    eva: 0,
    agi: 0,
    atk: 0,
    pdef: 0,
    fenshen: 0,
    turns: 0,
  });
  assert.equal(result.playerBusy, 1);
  assert.equal(result.enemyDebuff.hit, 0);
  assert.equal(result.enemyDebuff.busy, 1);
  assert.equal(result.enemyDebuff.eagleTurns, 0);
  assert.equal(result.enemyDebuff.burnTurns, 0);
  assert.ok(result.log.some((line) => /苍鹰|灼烧/.test(line)));
});

test("吸血大法仅在普通攻击造成伤害后恢复实际缺失气血", () => {
  let observed = false;
  for (let seed = 1; seed <= 100 && !observed; seed++) {
    const a = specialActor(1);
    a.skillUse[6] = 56;
    a.skills["56"].level = 100;
    a.hp = a.maxHp - 1000;
    const result = battleRound(beginOriginalBattle(1, seed, sturdyEnemy), a);
    observed = result.log.some((line) => line.includes("吸血大法吸回"));
  }
  assert.equal(observed, true);
});

test("切磋落败按原作恢复最低气血", () => {
  const a = actor(), battle = beginOriginalBattle(1, 1);
  a.hp = 0;
  a.maxHp = 95;
  battle.finished = "lose";
  endSpar(a, battle);
  assert.equal(a.hp, 9);
});
