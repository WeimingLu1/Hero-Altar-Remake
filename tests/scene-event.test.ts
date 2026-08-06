import assert from "node:assert/strict";
import test from "node:test";
import {
  applySceneResolution,
  resolveSceneEvent,
  type SceneActorState,
} from "../app/game-core/scene-event";
const actor = (): SceneActorState => ({
  inventory: {},
  gold: 0,
  hp: 50,
  maxHp: 100,
  fp: 50,
  maxFp: 100,
  food: 0,
  water: 0,
  exp: 0,
  potential: 0,
  morals: 0,
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
test("NPC event resolves original named dialogue", () => {
  const r = resolveSceneEvent({ type: 0, id: 1 }, actor(), 0);
  assert.match(r.lines[0], /豆腐|客官/);
  assert.equal(r.tag, "npc:1");
});
test("find-item event uses original indexed database and mutates inventory", () => {
  const a = actor(),
    r = resolveSceneEvent({ type: 1, id: 8, extra: 2 }, a);
  assert.match(r.lines[0], /金创药/);
  applySceneResolution(a, r);
  assert.equal(a.inventory["1:8"], 2);
});

test("钓鱼严格执行钓竿、体力、鱼篓与鲜鱼奖励规则", () => {
  const a = actor();
  a.hp = a.maxHp = 100;
  a.armorIds = [31];
  a.inventory["1:18"] = 1;
  const result = resolveSceneEvent({ type: 4 }, a, 1);
  applySceneResolution(a, result);
  assert.equal(result.tag, "fish:catch");
  assert.equal(a.hp, 60);
  assert.equal(a.inventory["1:17"], 1);
});

test("井水按原作只增加二十点且不超过饮水上限", () => {
  const a = actor();
  a.water = 350;
  const result = resolveSceneEvent({ type: 5 }, a);
  applySceneResolution(a, result);
  assert.equal(a.water, 360);
  assert.equal(resolveSceneEvent({ type: 5 }, a).tag, "drink-water:full");
});

test("女儿红消耗一坛并推进原作三小时游戏时间", () => {
  const a = actor();
  a.inventory["1:16"] = 2;
  const result = resolveSceneEvent({ type: 11 }, a);
  applySceneResolution(a, result);
  assert.equal(a.inventory["1:16"], 1);
  assert.equal(a.playTime, 10800);
});

test("BOSS 入口按道德选择原作 195 至 197 号敌人", () => {
  const a = actor();
  a.morals = 160;
  assert.equal(resolveSceneEvent({ type: 8 }, a).battleEnemyId, 196);
  a.morals = 90;
  a.killList = [125];
  assert.equal(resolveSceneEvent({ type: 8 }, a).battleEnemyId, 197);
});

test("坛入口按事件第三参数选择原作坐标分支", () => {
  const result = resolveSceneEvent({ type: 13, id: 62, extra: 2 }, actor());
  assert.deepEqual(result.transfer, { mapId: 62, x: 17, y: 12 });
});

test("桃花源房间入口按房屋等级进入对应原作地图", () => {
  const a = actor();
  a.roomLevel = 2;
  assert.deepEqual(resolveSceneEvent({ type: 16 }, a).transfer, {
    mapId: 68,
    x: 10,
    y: 12,
  });
});
