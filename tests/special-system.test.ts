import assert from "node:assert/strict";
import test from "node:test";
import {
  battleSpecials,
  specialFpCost,
  specialMpCost,
} from "../app/game-core/special-system";
import type { SceneActorState } from "../app/game-core/scene-event";
import {
  beginOriginalBattle,
  specialRound,
} from "../app/game-core/original-battle";
import { originalTables } from "../app/game-core/original-data";
const actor = (): SceneActorState => ({
  inventory: {},
  gold: 0,
  hp: 500,
  maxHp: 500,
  fp: 500,
  maxFp: 500,
  food: 100,
  water: 100,
  exp: 0,
  potential: 0,
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
  skills: {
    "1": { level: 120, points: 0 },
    "2": { level: 120, points: 0 },
    "12": { level: 120, points: 0 },
    "16": { level: 120, points: 0 },
  },
  weaponId: 0,
  armorIds: [],
  skillUse: [12, 0, 0, 16, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});
const mage = (): SceneActorState => {
  const a = actor();
  a.hp = a.maxHp = 2000;
  a.mp = a.maxMp = 3000;
  a.exp = 1_000_000;
  a.skills["8"] = { level: 200, points: 0 };
  a.skills["52"] = { level: 200, points: 0 };
  a.skillUse[5] = 52;
  return a;
};
// 固定敌人核心数值：反激判定 targetPower 依赖敌人 exp/maxhp/fp/fp_plus，
// 全部钉死为低值，使法术不反激、只测消耗，与 NPC 重平衡数据完全解耦
const dummyEnemy = {
  ...originalTables.enemies[1],
  exp: 100_000,
  maxhp: 500,
  hp: 500,
  maxfp: 300,
  fp: 300,
  fp_plus: 30,
  mp: 0,
  maxmp: 0,
  int: 20,
  base_int: 20,
  atk: 0,
  pdef: 0,
  base_hit: 0,
  base_eva: 0,
  str: 20,
  agi: 20,
  bon: 20,
};
test("绝招需配合已装备武功：只学会但未装备则禁用", () => {
  const a = actor();
  a.skills["13"] = { level: 120, points: 0 };
  assert.notEqual(a.skillUse[0], 13);
  const unequipped = battleSpecials(a).find((special) => special.id === 2);
  assert.equal(unequipped?.enabled, false);
  assert.match(unequipped?.reason || "", /装备八阵八卦掌/);
  // 装备到拳脚槽后即可施展。
  a.skillUse[0] = 13;
  const equipped = battleSpecials(a).find((special) => special.id === 2);
  assert.equal(equipped?.enabled, true);
  const list = battleSpecials(actor());
  assert.equal(list[0].id, 1);
  assert.equal(list[0].enabled, true);
  assert.equal(list[0].fpCost, 200);
});
test("全部已学武学的四十项绝招都列出，条件不足只禁用不隐藏", () => {
  const a = actor();
  for (let id = 1; id < originalTables.kungfus.length; id++)
    if (originalTables.kungfus[id]) a.skills[String(id)] = { level: 1, points: 0 };
  const list = battleSpecials(a);
  assert.equal(list.length, 40);
  assert.deepEqual(list.map((special) => special.id), Array.from({ length: 40 }, (_, index) => index + 1));
  assert.ok(list.some((special) => !special.enabled && special.reason !== ""));
});
test("拳脚和兵刃绝招仍校验当前武器", () => {
  const hand = actor();
  hand.weaponId = 2;
  assert.match(battleSpecials(hand)[0].reason, /必须空手/);

  const sword = actor();
  sword.skills["3"] = { level: 120, points: 0 };
  sword.skills["33"] = { level: 180, points: 0 };
  sword.skills["36"] = { level: 180, points: 0 };
  // 缠字诀要求太极神功/太极剑正装备在对应槽位，先满足再单测武器校验。
  sword.skillUse[3] = 36;
  sword.skillUse[1] = 33;
  assert.match(
    battleSpecials(sword).find((special) => special.id === 19)?.reason || "",
    /需要装备剑类兵器/,
  );
  sword.weaponId = 2;
  assert.equal(
    battleSpecials(sword).find((special) => special.id === 19)?.enabled,
    true,
  );
});
test("流星飞掷学会后不再要求武学等级和先天敏捷，仍保留内力和杖棍条件", () => {
  const a = actor();
  a.skills["24"] = { level: 1, points: 0 };
  a.fp = a.maxFp = 1000;
  a.agi = 20;
  a.weaponId = 25;
  const special = battleSpecials(a).find((entry) => entry.id === 8);
  assert.equal(special?.enabled, true);
  a.weaponId = 0;
  assert.match(battleSpecials(a).find((entry) => entry.id === 8)?.reason || "", /杖棍类兵器/);
});
test("special cooldown disables otherwise valid move", () => {
  const list = battleSpecials(actor(), { "1": 3 });
  assert.equal(list[0].enabled, false);
  assert.match(list[0].reason, /3 回合/);
  assert.equal(specialFpCost(actor(), 1), 200);
});
test("special round pays original cost and starts cooldown", () => {
  const a = actor(),
    battle = specialRound(beginOriginalBattle(1, 7), a, 1);
  assert.equal(a.fp, 300);
  assert.equal(battle.turn, 1);
  assert.ok(battle.cooldowns["1"] > 0);
  assert.ok(battle.buff.hit > 0);
});
test("雷动九天 applies the original strength buff and dynamic duration", () => {
  const a = actor();
  a.skills["26"] = { level: 120, points: 0 };
  a.skillUse[0] = 0;
  a.skillUse[3] = 26;
  const battle = specialRound(beginOriginalBattle(1, 11), a, 9);
  assert.equal(battle.buff.str, 30);
  assert.equal(battle.cooldowns["9"], 10);
});
test("忍法影分身 adds the original clone dodge chance", () => {
  const a = actor();
  a.maxFp = a.fp = 600;
  a.skills["31"] = { level: 120, points: 0 };
  a.skillUse[0] = 0;
  a.skillUse[3] = 31;
  const battle = specialRound(beginOriginalBattle(1, 13), a, 14);
  assert.equal(battle.buff.fenshen, 36);
  assert.equal(battle.cooldowns["14"], 10);
});
test("连字诀 applies exact Tai Chi sword hit and dodge bonuses", () => {
  const a = actor();
  a.maxFp = a.fp = 600;
  a.weaponId = 2;
  a.skills["3"] = { level: 120, points: 0 };
  a.skills["33"] = { level: 180, points: 0 };
  a.skills["36"] = { level: 180, points: 0 };
  a.skillUse[1] = 33;
  a.skillUse[3] = 36;
  const battle = specialRound(beginOriginalBattle(1, 17), a, 20);
  assert.equal(battle.buff.hit, 10);
  assert.equal(battle.buff.eva, 16);
  assert.equal(battle.cooldowns["20"], 12);
});
test("神倒鬼跌 always enters its original six-turn cooldown", () => {
  const a = actor();
  a.maxFp = a.fp = 600;
  a.skills["37"] = { level: 180, points: 0 };
  a.skillUse[0] = 37;
  const battle = specialRound(beginOriginalBattle(1, 19), a, 22);
  assert.equal(battle.cooldowns["22"], 6);
  assert.equal(battle.turn, 1);
});
test("冰心诀 raises defense with the original cap and duration", () => {
  const a = actor();
  a.maxFp = a.fp = 600;
  a.skills["41"] = { level: 180, points: 0 };
  a.skillUse[0] = 0;
  a.skillUse[3] = 41;
  const battle = specialRound(beginOriginalBattle(1, 23), a, 24);
  assert.equal(battle.buff.pdef, 60);
  assert.equal(battle.cooldowns["24"], 11);
});
test("变熊术 combines inner power and knowledge bonuses", () => {
  const a = actor();
  a.maxFp = a.fp = 600;
  a.skills["47"] = { level: 180, points: 0 };
  a.skills["48"] = { level: 120, points: 0 };
  a.skillUse[0] = 0;
  a.skillUse[3] = 47;
  a.skillUse[6] = 48; // 学识槽装备灵通心诀
  const battle = specialRound(beginOriginalBattle(1, 29), a, 28);
  assert.equal(battle.buff.str, 39);
  assert.equal(battle.buff.pdef, 240);
  assert.equal(battle.cooldowns["28"], 21);
  assert.equal(
    battleSpecials(a, { "27": 2 }).find((x) => x.id === 28)?.enabled,
    false,
  );
});

test("变熊术未装备灵通心诀时不享受学识加成", () => {
  const a = actor();
  a.maxFp = a.fp = 600;
  a.skills["47"] = { level: 180, points: 0 };
  a.skills["48"] = { level: 120, points: 0 };
  a.skillUse[3] = 47; // 学识槽为空
  const battle = specialRound(beginOriginalBattle(1, 29), a, 28);
  assert.equal(battle.buff.str, 24); // 龙象240/10 + 灵通0
  assert.equal(battle.buff.pdef, 120); // 龙象240/2 + 灵通0
  assert.equal(battle.cooldowns["28"], 13); // 龙象240/20 + 0 + 1
});
test("法术消耗包含原作的法力加成值", () => {
  const a = mage();
  a.mpPlus = 17;
  assert.equal(specialMpCost(a, 29), 47);
});
test("闪光弹走独立法术链且不会附带普通攻击", () => {
  const a = mage();
  const beforeHp = a.hp;
  const battle = specialRound(beginOriginalBattle(1, 7, dummyEnemy), a, 29);
  assert.equal(a.mp, 2970);
  assert.ok(a.hp < beforeHp, "闪光弹应消耗气血");
  assert.equal(battle.turn, 1);
  assert.equal(
    battle.log.some((line) => /第 1 击/.test(line)),
    false,
  );
  assert.ok(battle.enemyHp < battle.enemyMaxHp || a.hp < beforeHp - 50);
});
test("连珠雷支付组合术与三个子法术的原始消耗", () => {
  const a = mage();
  const beforeHp = a.hp;
  const source = beginOriginalBattle(1, 17, dummyEnemy);
  source.enemyHp = 1_000_000;
  source.enemyMaxHp = 1;
  const battle = specialRound(source, a, 32);
  assert.equal(a.mp, 2570);
  assert.ok(a.hp < beforeHp, "连珠雷应消耗气血");
  assert.equal(battle.turn, 1);
  assert.equal(
    battle.log.some((line) => /第 1 击/.test(line)),
    false,
  );
});
