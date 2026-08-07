import assert from "node:assert/strict";
import test from "node:test";
import type { SceneActorState } from "../app/game-core/scene-event";
import {
  adjustCheatSkill,
  adjustCheatStat,
  applyCheatQuick,
  maxCheatSkill,
  maxCheatStat,
} from "../app/game-core/cheat-system";

const actor = (): SceneActorState => ({
  inventory: {},
  gold: 0,
  hp: 1,
  maxHp: 10,
  fp: 0,
  maxFp: 100,
  food: 0,
  water: 0,
  exp: 0,
  potential: 0,
  morals: 128,
  tanId: 0,
  teacherId: 0,
  classId: 0,
  gender: 0,
  face: 20,
  mp: 0,
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
  skills: { "2": { level: 10, points: 8 } },
  weaponId: 0,
  armorIds: [],
  skillUse: [0, 0, 0, 0, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});

test("每项秘技支持直接达到标注的理论上限", () => {
  const a = actor();
  maxCheatStat(a, 6);
  maxCheatSkill(a, 2);
  assert.equal(a.face, 255);
  assert.equal(a.skills["2"].level, 255);
  applyCheatQuick(a, "maxAll");
  assert.equal(a.gold, 4294967295);
  assert.equal(a.baseStr, 255);
});

test("快捷秘技补满状态并增加资源", () => {
  const a = actor();
  applyCheatQuick(a, "gold");
  applyCheatQuick(a, "recover");
  assert.equal(a.gold, 100000);
  assert.equal(a.fp, a.maxFp);
  assert.equal(a.mp, a.maxMp);
  assert.equal(a.hp, a.maxHp);
});

test("一键宗师强化资源、属性及已学功夫", () => {
  const a = actor();
  applyCheatQuick(a, "master");
  assert.equal(a.baseStr, 30);
  assert.equal(a.maxFp, 5000);
  assert.equal(a.skills["2"].level, 255);
});

test("数值和技能调整遵守原版上限", () => {
  const a = actor();
  adjustCheatStat(a, 3, 1);
  assert.equal(a.maxFp, 200);
  adjustCheatSkill(a, 2, 1);
  assert.equal(a.skills["2"].level, 15);
  a.skills["2"].level = 254;
  adjustCheatSkill(a, 2, 1);
  assert.equal(a.skills["2"].level, 255);
});
