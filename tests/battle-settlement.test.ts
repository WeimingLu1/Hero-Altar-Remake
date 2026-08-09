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

test("超过二十种物品后仍能取得新的战利品", () => {
  const a = actor();
  for (let id = 1; id <= 25; id++) a.inventory[`1:${id}`] = 1;
  settleVictoryLoot(a, 1, false);
  assert.equal(a.inventory["3:7"], 1);
  assert.equal(a.inventory["3:9"], 1);
});

test("砍头会记录杀人列表并按原作道德公式结算", () => {
  const a = actor();
  const result = settleVictoryLoot(a, 2, true);
  assert.deepEqual(a.killList, [2]);
  assert.equal(a.morals, 126);
  assert.match(result.text, /斩首/);
});

test("砍通缉犯只累计追杀数，不写普通NPC击杀名单", () => {
  const a = actor();
  settleVictoryLoot(a, 198, true);
  assert.equal(a.badmanKill, 1);
  assert.deepEqual(a.killList, undefined);
  assert.equal(a.morals, 128);
});

test("砍坛主写入击杀名单但不按普通NPC扣除道德", () => {
  const a = actor();
  settleVictoryLoot(a, 163, true);
  assert.deepEqual(a.killList, [163]);
  assert.equal(a.morals, 128);
});

test("当前坛主击杀掉落机械顺序的下一坛地图", () => {
  const a = actor();
  a.tanId = 1;
  settleVictoryLoot(a, 163, true); // 青龙坛主 → 白虎坛地图(28)
  assert.equal(a.inventory["1:28"], 1);

  const b = actor();
  b.tanId = 2;
  settleVictoryLoot(b, 164, true); // 总瓢把子 → 朱雀坛地图(23)
  assert.equal(b.inventory["1:23"], 1);
});

test("手下留情当前坛主不掉落坛地图", () => {
  const a = actor();
  a.tanId = 1;
  settleVictoryLoot(a, 163, false); // 手下留情
  assert.equal(a.inventory["1:28"], undefined, "不留情不掉下一坛地图");
  assert.equal(a.inventory["1:22"], undefined);
  assert.equal(a.killList, undefined, "手下留情不记击杀");
  assert.equal(a.inventory["2:8"], 1, "一般战利品(钢刀)仍按原版规则获得");
});

test("全部坛主按机械顺序掉落正确的下一坛地图", () => {
  const expected = {
    163: 28, // 青龙坛主 → 白虎坛地图
    164: 23, // 总瓢把子 → 朱雀坛地图
    165: 25, // 朱雀坛主 → 玄武坛地图
    166: 27, // 玄武坛主 → 天徽坛地图
    167: 26, // 天徽坛主 → 紫煞坛地图
    168: 24, // 紫煞坛主 → 山岚坛地图
    169: 22, // 山岚坛主 → 地罡坛地图
  };
  for (const [enemyId, mapId] of Object.entries(expected)) {
    const a = actor();
    a.tanId = Number(enemyId) - 162;
    settleVictoryLoot(a, Number(enemyId), true);
    assert.equal(a.inventory[`1:${mapId}`], 1, `敌 ${enemyId} 应掉落地图 ${mapId}`);
  }
});

test("重复击杀旧坛主不再掉落坛地图", () => {
  const a = actor();
  a.tanId = 2; // 已推进到第二坛，青龙坛主已是旧目标
  settleVictoryLoot(a, 163, true);
  assert.equal(a.inventory["1:28"], undefined);
  assert.equal(a.inventory["1:22"], undefined);
});

test("最后一坛(170)不掉落坛地图", () => {
  const a = actor();
  a.tanId = 8;
  settleVictoryLoot(a, 170, true);
  assert.equal(a.inventory["1:22"], undefined);
  assert.equal(a.inventory["1:23"], undefined);
});

test("清虚道长首次掉落三角石板并在战果中明确提示", () => {
  const a = actor();
  const first = settleVictoryLoot(a, 102, true);
  assert.deepEqual(a.stoneList, [102]);
  assert.equal(first.items.includes("三角石板"), true);
  assert.match(first.text, /战利品：.*三角石板/);
  const repeated = settleVictoryLoot(a, 102, true);
  assert.deepEqual(a.stoneList, [102]);
  assert.doesNotMatch(repeated.text, /三角石板/);
});
