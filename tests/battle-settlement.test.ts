import assert from "node:assert/strict";
import test from "node:test";
import type { SceneActorState } from "../app/game-core/scene-event";
import { settleVictoryLoot } from "../app/game-core/battle-settlement";

const actor = () =>
  ({
    inventory: {},
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
    skills: {},
    weaponId: 0,
    armorIds: [],
    skillUse: [0, 0, 0, 0, 0, 0],
    fpPlus: 0,
    mpPlus: 0,
    xue6: false,
  }) satisfies SceneActorState;

test("战利品结算发放原作敌人金钱和全部物品", () => {
  const a = actor();
  const result = settleVictoryLoot(a, 1, false);
  assert.equal(a.gold, 1000);
  assert.equal(a.inventory["3:7"], 1);
  assert.equal(a.inventory["3:9"], 1);
  assert.equal(result.items.length, 2);
});

test("砍头会记录杀人列表并按原作道德公式结算", () => {
  const a = actor();
  settleVictoryLoot(a, 2, true);
  assert.deepEqual(a.killList, [2]);
  assert.equal(a.morals, 126);
});
