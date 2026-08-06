import assert from "node:assert/strict";
import test from "node:test";
import {
  bagEntries,
  derivedStats,
  maxFood,
  activateBattleEntry,
  activateEntry,
} from "../app/game-core/inventory-system";
import type { SceneActorState } from "../app/game-core/scene-event";
const actor = (): SceneActorState => ({
  inventory: { "1:1": 2, "2:1": 1, "3:4": 1 },
  gold: 0,
  hp: 50,
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
});
test("battle item activation applies original consumable data", () => {
  const a = actor();
  a.inventory = { "1:8": 1 };
  a.hp = 30;
  a.maxHp = 50;
  const medicine = bagEntries(a)[0];
  const result = activateBattleEntry(a, medicine);
  assert.equal(result.ok, true);
  assert.equal(a.hp, 30);
  assert.equal(a.maxHp, 75);
  assert.equal(a.inventory["1:8"], undefined);
});
test("food follows original item effect and maximum", () => {
  const a = actor(),
    food = bagEntries(a).find((x) => x.key === "1:1")!;
  activateEntry(a, food);
  assert.equal(a.food, Math.min(maxFood(a), 260));
  assert.equal(a.inventory["1:1"], 1);
});
test("equipment slots and bonuses follow original records", () => {
  const a = actor(),
    entries = bagEntries(a);
  activateEntry(
    a,
    entries.find((x) => x.key === "2:1")!,
  );
  activateEntry(
    a,
    entries.find((x) => x.key === "3:4")!,
  );
  assert.equal(a.weaponId, 1);
  assert.deepEqual(a.armorIds, [4]);
  assert.equal(derivedStats(a).atk, 17);
  assert.equal(derivedStats(a).pdef, 5);
});
