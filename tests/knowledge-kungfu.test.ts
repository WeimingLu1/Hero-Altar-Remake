import assert from "node:assert/strict";
import test from "node:test";
import { fullHp } from "../app/game-core/inventory-system";
import {
  effectiveFace,
  equipSkill,
  naturalSlot,
} from "../app/game-core/skill-system";
import { battleRound, beginOriginalBattle } from "../app/game-core/original-battle";
import type { SceneActorState } from "../app/game-core/scene-event";

const actor = (): SceneActorState => ({
  inventory: {},
  gold: 0,
  hp: 500,
  maxHp: 500,
  fp: 0,
  maxFp: 0,
  food: 100,
  water: 100,
  exp: 1000000,
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
  skills: { "1": { level: 120, points: 0 }, "2": { level: 120, points: 0 } },
  weaponId: 0,
  armorIds: [],
  skillUse: [0, 0, 0, 0, 0, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});

test("学识武功在学识槽(第7槽)装备，其余武功不受影响", () => {
  assert.equal(naturalSlot(22), 6); // 驻颜术
  assert.equal(naturalSlot(27), 6); // 红莲教义
  assert.equal(naturalSlot(48), 6); // 灵通心诀
  assert.equal(naturalSlot(55), 6); // 天师正道
  assert.equal(naturalSlot(56), 6); // 吸血大法
  assert.equal(naturalSlot(32), 0); // 太极拳仍为拳脚槽
  const a = actor();
  const result = equipSkill(a, 27);
  assert.equal(result.ok, true);
  assert.equal(a.skillUse[6], 27);
  equipSkill(a, 27);
  assert.equal(a.skillUse[6], 0);
});

test("红莲教义需装备学识槽才加成气血上限", () => {
  const a = actor();
  a.classId = 3;
  a.age = 22;
  a.skills["27"] = { level: 100, points: 0 };
  a.baseBon = 30;
  a.maxFp = 1000;
  const base = fullHp(a);
  a.skillUse[6] = 27;
  const boosted = fullHp(a);
  assert.ok(boosted > base, "装备红莲教义后气血上限应提升");
  assert.equal(boosted - base, Math.floor((100 * 30) / 10));
});

test("驻颜术需装备学识槽才提升有效容貌", () => {
  const a = actor();
  a.skills["22"] = { level: 50, points: 0 };
  assert.equal(effectiveFace(a), 20);
  a.skillUse[6] = 22;
  assert.equal(effectiveFace(a), 25);
});

test("吸血大法装备后普攻命中会按等级吸血", () => {
  const a = actor();
  a.hp = 100;
  a.skills["56"] = { level: 50, points: 0 };
  a.skillUse[0] = 2; // 拳脚运用基本拳脚
  a.skillUse[6] = 56;
  const before = a.hp;
  const round = battleRound(beginOriginalBattle(1, 7), a);
  const damage = round.log.find((line) => /受到 \d+ 点伤害/.test(line));
  if (damage) {
    const dealt = Number(damage.match(/(\d+) 点伤害/)?.[1] || 0);
    assert.ok(a.hp > before, "命中后应吸血回血");
    assert.ok(
      a.hp - before <= Math.floor((50 * dealt) / 100) + 1,
      `吸血量不应超过 50%伤害(${dealt})，实际 +${a.hp - before}`,
    );
  }
});

test("吸血大法未装备时不吸血", () => {
  const a = actor();
  a.hp = 100;
  a.skills["56"] = { level: 50, points: 0 };
  a.skillUse[0] = 2;
  const before = a.hp;
  battleRound(beginOriginalBattle(1, 7), a);
  assert.equal(a.hp, before, "未装备吸血大法不应回血");
});
