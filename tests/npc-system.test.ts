import assert from "node:assert/strict";
import test from "node:test";
import {
  attemptJoin,
  bookStudyOptions,
  buyGood,
  canReadBook,
  canStudyWithNpc,
  npcOptions,
  npcOptionLabel,
  shopGoods,
  studyOnce,
  npcStatus,
  resolveSpecialNpcTalk,
} from "../app/game-core/npc-system";
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
  exp: 1000,
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
test("merchant menu and stock come from enemy database", () => {
  const a = actor();
  assert.deepEqual(npcOptions(1, a), [
    "talk",
    "chat",
    "status",
    "battle",
    "trade",
  ]);
  const goods = shopGoods(1);
  assert.equal(goods.length, 2);
  assert.equal(goods[0].name, "白玉豆腐");
  assert.equal(npcOptionLabel.battle, "战斗");
});
test("NPC 状态完整展示原作描述、装备、携带物品与武功", () => {
  const status = npcStatus(3).join("\n");
  assert.match(status, /人物描述：六扇门里的捕快/);
  assert.match(status, /装备：武器/);
  assert.match(status, /携带物品：/);
  assert.match(status, /武功：/);
  assert.doesNotMatch(status, /身上没有可见物品/);
});
test("buy uses original price and item indexing", () => {
  const a = actor(),
    good = shopGoods(1)[0];
  a.gold = good.price;
  assert.equal(buyGood(a, good).ok, true);
  assert.equal(a.inventory[`1:${good.id}`], 1);
  assert.equal(a.gold, 0);
});
test("unconditional teacher accepts disciple and study consumes potential", () => {
  const a = actor(),
    join = attemptJoin(39, a);
  assert.equal(join.ok, true);
  assert.equal(a.teacherId, 39);
  const before = a.potential;
  const learned = studyOnce(a, 1, 20, 0.5);
  assert.equal(learned.ok, true);
  assert.equal(a.potential, before - 1);
});

test("白瑞德拜师按实时实战根骨计算基本内功加成", () => {
  const a = actor();
  a.maxFp = 1200;
  a.skills["1"] = { level: 120, points: 0 };
  // 存档缓存仍是 20，但原版 getter 与状态栏的实时实战根骨已是 32。
  assert.equal(a.bon, 20);
  const join = attemptJoin(111, a);
  assert.equal(join.ok, true);
  assert.equal(a.teacherId, 111);
  assert.equal(a.classId, 6);
});

test("已有门派或自立门户时不能绕过原作规则改投别派", () => {
  const sameSchool = actor();
  sameSchool.classId = 1;
  assert.equal(attemptJoin(39, sameSchool).ok, true);

  const otherSchool = actor();
  otherSchool.classId = 6;
  assert.equal(attemptJoin(39, otherSchool).ok, false);
  assert.equal(otherSchool.classId, 6);
  assert.equal(otherSchool.teacherId, 0);

  const selfFounded = actor();
  selfFounded.classId = 9;
  assert.equal(attemptJoin(39, selfFounded).ok, false);
  assert.equal(selfFounded.classId, 9);
});

test("独行大侠请教保留原版二十万经验门槛", () => {
  const a = actor();
  a.exp = 199999;
  assert.equal(canStudyWithNpc(7, a).ok, false);
  a.exp = 200000;
  assert.equal(canStudyWithNpc(7, a).ok, true);
  assert.equal(canStudyWithNpc(31, actor()).ok, true);
});

test("白瑞德第六剑与华岳捐赠保留原版特殊交谈效果", () => {
  const disciple = actor();
  disciple.teacherId = 111;
  disciple.skills["39"] = { level: 150, points: 0 };
  disciple.inventory["1:30"] = 1;
  assert.equal(resolveSpecialNpcTalk(111, disciple).handled, true);
  assert.equal(disciple.xue6, true);
  assert.equal(disciple.inventory["1:30"], undefined);
  assert.equal(resolveSpecialNpcTalk(111, disciple).handled, false);

  const donor = actor();
  donor.gold = 500000;
  const oldLuck = donor.luck;
  assert.equal(resolveSpecialNpcTalk(139, donor).handled, true);
  assert.equal(donor.gold, 0);
  assert.equal(donor.donateTimes, 1);
  assert.equal(donor.luck, oldLuck + 1);
});

test("秘籍沿用原作技能表并要求读书识字与自创门派", () => {
  const a = actor();
  assert.equal(canReadBook(a, 11).ok, false);
  a.skills["11"] = { level: 1, points: 0 };
  assert.equal(canReadBook(a, 11).ok, true);
  assert.equal(a.classId, 9);
  assert.deepEqual(
    bookStudyOptions(11).map((entry) => [entry.id, entry.maxLevel]),
    [
      [2, 250],
      [43, 200],
    ],
  );
});
