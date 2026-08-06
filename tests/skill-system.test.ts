import assert from "node:assert/strict";
import test from "node:test";
import {
  combatSkillProfile,
  equipSkill,
  toggleParry,
} from "../app/game-core/skill-system";
import type { SceneActorState } from "../app/game-core/scene-event";
const actor = (): SceneActorState => ({
  inventory: { "2:1": 1 },
  gold: 0,
  hp: 100,
  maxHp: 100,
  fp: 0,
  maxFp: 0,
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
    "2": { level: 40, points: 0 },
    "4": { level: 60, points: 0 },
    "10": { level: 30, points: 0 },
    "14": { level: 50, points: 0 },
  },
  weaponId: 1,
  armorIds: [],
  skillUse: [0, 0, 0, 0, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});
test("original weapon mismatch falls back to matching basic skill", () => {
  const a = actor();
  a.weaponId = 2;
  a.skills["3"] = { level: 60, points: 0 };
  equipSkill(a, 14);
  assert.equal(a.skillUse[1], 14);
  const p = combatSkillProfile(a);
  assert.equal(p.attackId, 3);
  assert.equal(p.attack, 30);
});
test("equipped attack skill may also become parry", () => {
  const a = actor();
  a.weaponId = 0;
  a.skills["12"] = { level: 50, points: 0 };
  equipSkill(a, 12);
  toggleParry(a, 12);
  const p = combatSkillProfile(a);
  assert.equal(p.attack, 70);
  assert.equal(p.parry, 65);
});
