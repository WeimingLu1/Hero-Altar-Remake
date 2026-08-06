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
test("equipped kungfu exposes its original special and requirements", () => {
  const list = battleSpecials(actor());
  assert.equal(list[0].id, 1);
  assert.equal(list[0].enabled, true);
  assert.equal(list[0].fpCost, 200);
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
  const battle = specialRound(beginOriginalBattle(1, 29), a, 28);
  assert.equal(battle.buff.str, 39);
  assert.equal(battle.buff.pdef, 240);
  assert.equal(battle.cooldowns["28"], 21);
  assert.equal(
    battleSpecials(a, { "27": 2 }).find((x) => x.id === 28)?.enabled,
    false,
  );
});
test("法术消耗包含原作的法力加成值", () => {
  const a = mage();
  a.mpPlus = 17;
  assert.equal(specialMpCost(a, 29), 47);
});
test("闪光弹走独立法术链且不会附带普通攻击", () => {
  const a = mage();
  const beforeHp = a.hp;
  const battle = specialRound(beginOriginalBattle(1, 7), a, 29);
  assert.equal(a.mp, 2970);
  assert.equal(a.hp, beforeHp - 50);
  assert.equal(battle.turn, 1);
  assert.equal(
    battle.log.some((line) => /第 1 击/.test(line)),
    false,
  );
  assert.ok(battle.enemyHp < battle.enemyMaxHp || a.hp < beforeHp - 50);
});
test("连珠雷支付组合术与三个子法术的原始消耗", () => {
  const a = mage();
  const source = beginOriginalBattle(1, 17);
  source.enemyHp = 1_000_000;
  source.enemyMaxHp = 1;
  const battle = specialRound(source, a, 32);
  assert.equal(a.mp, 2570);
  assert.equal(a.hp, 1800);
  assert.equal(battle.turn, 1);
  assert.equal(
    battle.log.some((line) => /第 1 击/.test(line)),
    false,
  );
});
