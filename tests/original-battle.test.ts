import assert from "node:assert/strict";
import test from "node:test";
import {
  attemptEscape,
  battleItemRound,
  battleRound,
  beginOriginalBattle,
  burningDamage,
  diminishingBattleResource,
  endSpar,
} from "../app/game-core/original-battle";
import type { SceneActorState } from "../app/game-core/scene-event";
const actor = (): SceneActorState => ({
  inventory: {},
  gold: 100,
  hp: 100,
  maxHp: 100,
  fp: 0,
  maxFp: 0,
  food: 100,
  water: 100,
  exp: 0,
  potential: 100,
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
test("story battles preserve the original no-escape rule", () => {
  const a = actor(),
    result = attemptEscape(beginOriginalBattle(1, 42, undefined, "story"), a);
  assert.equal(result.escaped, false);
  assert.match(result.battle.log.at(-1) || "", /无法逃走/);
});
test("high spell resources use diminishing formula inputs instead of a damage cap", () => {
  assert.equal(diminishingBattleResource(5000), 5000);
  assert.equal(diminishingBattleResource(65000), 22320);
  assert.ok(diminishingBattleResource(65000) > diminishingBattleResource(10000));
  assert.ok(diminishingBattleResource(65000) < 65000);
});
test("burning damage applies only a level-scaled fraction of the force gap", () => {
  const low = burningDamage(65000, 0, 0, () => 0),
    master = burningDamage(65000, 0, 300, () => 0);
  assert.equal(low, 1116);
  assert.equal(master, 1785);
  assert.ok(master < diminishingBattleResource(65000) / 10);
  assert.equal(burningDamage(1000, 5000, 300, (max) => max - 1), 0);
});
test("high-level NPCs regularly spend force to perform their own offensive specials", () => {
  let specialTurns = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const a = actor();
    a.hp = a.maxHp = 100000;
    const round = battleRound(beginOriginalBattle(102, seed), a);
    if (round.log.some((line) => line.includes("施展绝招"))) specialTurns++;
  }
  assert.ok(specialTurns >= 25 && specialTurns <= 55, String(specialTurns));
});
test("original sparring round is deterministic and changes combat state", () => {
  const a = actor(),
    b = actor(),
    one = battleRound(beginOriginalBattle(1, 42), a),
    two = battleRound(beginOriginalBattle(1, 42), b);
  assert.deepEqual(one, two);
  assert.equal(a.hp, b.hp);
  assert.equal(one.turn, 1);
  assert.ok(one.log.length >= 3);
});

test("战斗中使用药品会消耗回合并触发敌方行动", () => {
  const a = actor();
  a.hp = a.maxHp = 100000;
  const round = battleItemRound(
    beginOriginalBattle(1, 42),
    a,
    "使用了金创药：气血+15。",
  );
  assert.equal(round.turn, 1);
  assert.equal(round.log.includes("使用了金创药：气血+15。"), true);
  assert.ok(round.log.length >= 2);
});

test("battle keeps the full factual history for novelized narration", () => {
  const a = actor(), battle = beginOriginalBattle(1, 42);
  battle.log = Array.from({ length: 12 }, (_, index) => `旧战报${index}`);
  const round = battleRound(battle, a);
  assert.equal(round.log[0], "旧战报0");
  assert.ok(round.log.length > 12);
});

test("weapon attack text uses the equipped weapon name", () => {
  const a = actor();
  a.weaponId = 1;
  a.skills["4"] = { level: 100, points: 0 };
  const round = battleRound(beginOriginalBattle(1, 7), a);
  assert.equal(
    round.log.some((line) => line.includes("weapon")),
    false,
  );
  assert.equal(
    round.log.some((line) => line.includes("菜刀")),
    true,
  );
});

test("铸剑挑战按原作在双方半血时判定胜负", () => {
  const a = actor(),
    battle = beginOriginalBattle(149, 1, undefined, "story");
  battle.enemyHp = Math.floor(battle.enemyMaxHp / 2);
  assert.equal(battleRound(battle, a).finished, "win");
});

test("生死战失败不会套用切磋的自动回血", () => {
  const a = actor(),
    battle = beginOriginalBattle(1, 1, undefined, "lethal");
  a.hp = 0;
  battle.finished = "lose";
  endSpar(a, battle);
  assert.equal(a.hp, 0);
});
