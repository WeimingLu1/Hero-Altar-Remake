import assert from "node:assert/strict";
import test from "node:test";
import type { SceneActorState } from "../app/game-core/scene-event";
import {
  actorStatusProfile,
  levelTier,
  levelTitle,
} from "../app/game-core/status-system";

const actor = (): SceneActorState => ({
  name: "少侠",
  inventory: {},
  gold: 100,
  hp: 100,
  maxHp: 100,
  fp: 100,
  maxFp: 100,
  food: 100,
  water: 100,
  exp: 0,
  potential: 0,
  morals: 128,
  tanId: 0,
  teacherId: 0,
  classId: 3,
  gender: 0,
  face: 30,
  mp: 0,
  maxMp: 0,
  age: 18,
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
    "2": { level: 65, points: 0 },
    "9": { level: 65, points: 0 },
    "10": { level: 65, points: 0 },
  },
  weaponId: 0,
  armorIds: [],
  skillUse: [2, 0, 9, 0, 2, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});

test("功夫等级称号严格沿用原版每五级一档", () => {
  assert.equal(levelTitle(65), "登堂入室");
  assert.equal(levelTitle(255), "返璞归真");
  assert.equal(levelTier(255), 50);
});

test("全套满级战斗功夫达到原版综合武境第五十阶返璞归真", () => {
  const a = actor();
  for (const id of [2, 9, 10, 12, 15])
    a.skills[String(id)] = { level: 255, points: 0 };
  a.skillUse = [12, 0, 15, 0, 12, 0];
  const profile = actorStatusProfile(a);
  assert.equal(profile.realm, "返璞归真");
  assert.equal(profile.realmTier, 50);
});

test("人物状态档案包含门派、外貌和综合武艺评价", () => {
  const profile = actorStatusProfile(actor());
  assert.equal(profile.school, "红莲教");
  assert.ok(profile.appearance.length > 0);
  assert.ok(profile.realm.length > 0);
});
