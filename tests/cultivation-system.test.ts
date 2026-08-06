import assert from "node:assert/strict";
import test from "node:test";
import type { SceneActorState } from "../app/game-core/scene-event";
import {
  fullFp,
  healWounds,
  meditateForce,
  recoverHp,
  setForcePower,
} from "../app/game-core/cultivation-system";

const actor = (): SceneActorState => ({
  inventory: {},
  gold: 0,
  hp: 50,
  maxHp: 100,
  fp: 0,
  maxFp: 100,
  food: 100,
  water: 100,
  exp: 100000,
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
    "1": { level: 100, points: 0 },
    "16": { level: 100, points: 0 },
  },
  weaponId: 0,
  armorIds: [],
  skillUse: [0, 0, 0, 16, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});

test("打坐速度、双倍内力阈值与上限增长保持原作整数公式", () => {
  const a = actor();
  assert.equal(fullFp(a), 1600);
  a.fp = 200;
  const result = meditateForce(a);
  assert.deepEqual(result, { ok: true, increased: true, capped: false });
  assert.equal(a.maxFp, 101);
  assert.equal(a.fp, 0);
});

test("加力被限制为内功有效等级的一半", () => {
  const a = actor();
  assert.equal(setForcePower(a, 999), 75);
});

test("吸气按缺失气血和内功等级计算内力消耗", () => {
  const a = actor();
  a.fp = 200;
  assert.equal(recoverHp(a), true);
  assert.equal(a.hp, 100);
  assert.equal(a.fp, 149);
});

test("疗伤恢复伤势上限并固定消耗五十内力", () => {
  const a = actor();
  a.maxFp = a.fp = 200;
  a.maxHp = 120;
  a.hp = 120;
  assert.equal(healWounds(a), true);
  assert.equal(a.maxHp, 150);
  assert.equal(a.fp, 150);
});
