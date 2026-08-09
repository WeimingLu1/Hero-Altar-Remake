import assert from "node:assert/strict";
import test from "node:test";
import type { SceneActorState } from "../app/game-core/scene-event";
import {
  addCheatInventory,
  adjustCheatSkill,
  adjustCheatStat,
  applyCheatQuick,
  cheatStatMaximum,
  cheatStats,
  maxCheatSkill,
  maxCheatStat,
  removeCheatSkill,
  reviveCheatNpc,
  setCheatIdentity,
  setCheatInventory,
  setCheatSkill,
  setCheatStat,
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
  a.age = 27;
  a.skills["1"] = { level: 100, points: 0 };
  a.skills["8"] = { level: 80, points: 0 };
  a.skillUse[3] = 1;
  a.skillUse[5] = 8;
  maxCheatStat(a, cheatStats.findIndex((stat) => stat.key === "face"));
  maxCheatSkill(a, 2);
  assert.equal(a.face, 255);
  assert.equal(a.skills["2"].level, 255);
  applyCheatQuick(a, "maxAll");
  assert.equal(a.gold, 4294967295);
  assert.equal(a.exp, 10000000);
  assert.equal(a.baseStr, 30);
  assert.equal(a.fpPlus, 63);
  assert.equal(a.mpPlus, 63);
  assert.equal(a.age, 27);
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
  a.fpPlus = 32767;
  a.mpPlus = 32767;
  applyCheatQuick(a, "master");
  assert.equal(a.baseStr, 30);
  // 一键宗师把内力/法力上限提到可达极限 65535
  assert.equal(a.maxFp, 65535);
  assert.equal(a.skills["2"].level, 255);
  assert.equal(a.fpPlus, 0);
  assert.equal(a.mpPlus, 0);
});

test("数值和技能调整遵守原版上限", () => {
  const a = actor();
  // 内力上限可通过物品堆到 65535，修改器允许直接调到
  adjustCheatStat(a, 3, 1);
  assert.equal(a.maxFp, 200);
  adjustCheatSkill(a, 2, 1);
  assert.equal(a.skills["2"].level, 15);
  a.skills["2"].level = 254;
  adjustCheatSkill(a, 2, 1);
  assert.equal(a.skills["2"].level, 255);
});

test("直接输入数值会钳制范围并同步基础四维", () => {
  const a = actor();
  const strength = 15;
  setCheatStat(a, strength, 999);
  assert.equal(a.baseStr, 30);
  assert.equal(a.str, 30);
  setCheatStat(a, 0, 99999);
  assert.equal(a.hp, a.maxHp);
});

test("修改器可添加移除物品并自动卸下装备", () => {
  const a = actor();
  assert.match(setCheatInventory(a, 1, 7, 999), /255/);
  assert.equal(a.inventory["1:7"], 255);
  setCheatInventory(a, 2, 1, 1);
  a.weaponId = 1;
  setCheatInventory(a, 2, 1, 0);
  assert.equal(a.weaponId, 0);
  assert.equal(a.inventory["2:1"], undefined);
});

test("修改器的获得数量会累加而不是覆盖现有库存", () => {
  const a = actor();
  a.inventory["1:8"] = 2;
  addCheatInventory(a, 1, 8, 1);
  assert.equal(a.inventory["1:8"], 3);
  addCheatInventory(a, 1, 8, 999);
  assert.equal(a.inventory["1:8"], 255);
});

test("修改器可习得移除武功并清理运用槽", () => {
  const a = actor();
  setCheatSkill(a, 12, 999);
  assert.equal(a.skills["12"].level, 255);
  a.skillUse[0] = 12;
  removeCheatSkill(a, 12);
  assert.equal(a.skills["12"], undefined);
  assert.equal(a.skillUse[0], 0);
});

test("修改器允许超过二十种物品和二十门武功", () => {
  const a = actor();
  for (let id = 1; id <= 25; id++) a.inventory[`1:${id}`] = 1;
  setCheatInventory(a, 3, 1, 1);
  assert.equal(a.inventory["3:1"], 1);
  a.skills = {};
  for (let id = 1; id <= 25; id++) setCheatSkill(a, id, 10);
  assert.ok(Object.keys(a.skills).length > 20);
});

test("修改器可切换门派师父并复活已杀 NPC", () => {
  const a = actor();
  setCheatIdentity(a, 5, 31);
  assert.equal(a.classId, 5);
  assert.equal(a.teacherId, 31);
  a.killList = [1, 3];
  reviveCheatNpc(a, 1);
  assert.deepEqual(a.killList, [3]);
});

test("修改器上限对齐规则可达值（内力65535、气血~16783）", () => {
  const a = actor();
  a.exp = 10_000_000;
  a.age = 29;
  a.skills["1"] = { level: 255, points: 0 };
  a.skillUse[3] = 1;
  // 玩家可通过物品堆内力到 65535，气血随之到 ~16783
  const fpMax = cheatStatMaximum(a, cheatStats.findIndex((s) => s.key === "maxFp"));
  assert.equal(fpMax, 65535);
  const hpMax = cheatStatMaximum(a, cheatStats.findIndex((s) => s.key === "maxHp"));
  assert.equal(hpMax, 100 + Math.floor(65535 / 4) + (29 - 14) * 20);
  // 一键宗师把内力/法力上限提到可达极限
  applyCheatQuick(a, "master");
  assert.equal(a.maxFp, 65535);
});
