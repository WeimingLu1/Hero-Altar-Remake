import assert from "node:assert/strict";
import test from "node:test";
import type { SceneActorState } from "../app/game-core/scene-event";
import { digestActor } from "../app/game-core/survival-system";

const actor = (): SceneActorState => ({
  inventory: {},
  gold: 0,
  hp: 50,
  maxHp: 100,
  fp: 10,
  maxFp: 100,
  food: 2,
  water: 2,
  exp: 0,
  potential: 0,
  morals: 128,
  tanId: 0,
  teacherId: 0,
  classId: 0,
  gender: 0,
  face: 20,
  mp: 10,
  maxMp: 100,
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
    "1": { level: 40, points: 0 },
    "8": { level: 20, points: 0 },
    "16": { level: 30, points: 0 },
    "52": { level: 30, points: 0 },
  },
  weaponId: 0,
  armorIds: [],
  skillUse: [0, 0, 0, 16, 0, 52],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});

test("十五秒消化循环按原作恢复并消耗一点食水", () => {
  const a = actor();
  digestActor(a);
  assert.equal(a.playTime, 15);
  assert.equal(a.hp, 66);
  assert.equal(a.fp, 60);
  assert.equal(a.mp, 50);
  assert.equal(a.food, 1);
  assert.equal(a.water, 1);
});

test("没有食物时不恢复但食物饮水仍各自扣至零", () => {
  const a = actor();
  a.food = 0;
  digestActor(a);
  assert.equal(a.hp, 50);
  assert.equal(a.fp, 10);
  assert.equal(a.water, 1);
});

test("累计十二小时按原作增长一岁并保留余秒", () => {
  const a = actor();
  a.playTime = 43190;
  digestActor(a, false);
  assert.equal(a.age, 15);
  assert.equal(a.playTime, 5);
  assert.equal(a.food, 2);
});
