import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBattlePlayback,
  type BattlePresentation,
} from "../app/game-core/battle-playback";

const base: BattlePresentation = {
  playerHp: 900,
  playerMaxHp: 1000,
  playerFp: 800,
  playerMaxFp: 1000,
  playerMp: 200,
  playerMaxMp: 300,
  enemyHp: 1000,
  enemyMaxHp: 1000,
  enemyFp: 1000,
  enemyMp: 0,
};

test("伤害事实出现时才扣除对应一方气血并显示飘字", () => {
  const frames = buildBattlePlayback(
    ["少侠一剑刺向墨邪。", "墨邪受到 240 点伤害。", "你受到 90 点伤害。"],
    base,
    { ...base, playerHp: 810, playerMaxHp: 970, enemyHp: 760, enemyMaxHp: 880 },
    "墨邪",
  );
  assert.equal(frames[0].presentation.enemyHp, 1000);
  assert.equal(frames[1].presentation.enemyHp, 760);
  assert.deepEqual(frames[1].popup, { side: "enemy", kind: "damage", text: "−240" });
  assert.equal(frames[2].presentation.playerHp, 810);
  assert.deepEqual(frames[2].popup, { side: "player", kind: "damage", text: "−90" });
  assert.deepEqual(frames.at(-1)?.presentation, {
    ...base,
    playerHp: 810,
    playerMaxHp: 970,
    enemyHp: 760,
    enemyMaxHp: 880,
  });
});

test("NPC 吸气与疗伤按战报顺序回血、恢复伤势上限并扣内力", () => {
  const frames = buildBattlePlayback(
    [
      "墨邪提气归元，恢复 180 点气血，消耗 220 点内力。",
      "墨邪运转内功疗伤，伤势上限恢复 40 点，消耗 50 点内力。",
    ],
    { ...base, enemyHp: 500, enemyMaxHp: 800 },
    { ...base, enemyHp: 680, enemyMaxHp: 840, enemyFp: 730 },
    "墨邪",
  );
  assert.equal(frames[0].presentation.enemyHp, 680);
  assert.equal(frames[0].presentation.enemyFp, 780);
  assert.deepEqual(frames[0].popup, { side: "enemy", kind: "heal", text: "+180" });
  assert.equal(frames[1].presentation.enemyMaxHp, 840);
  assert.equal(frames[1].presentation.enemyFp, 730);
  assert.deepEqual(frames[1].popup, { side: "enemy", kind: "wound", text: "上限 +40" });
});

test("战斗药品的气血与上限增长在使用事实帧生效", () => {
  const frames = buildBattlePlayback(
    ["使用了生肌膏：气血+120，伤势上限+80。", "你侧身避开。"],
    { ...base, playerHp: 500, playerMaxHp: 700 },
    { ...base, playerHp: 620, playerMaxHp: 780 },
    "墨邪",
  );
  assert.equal(frames[0].presentation.playerHp, 620);
  assert.equal(frames[0].presentation.playerMaxHp, 780);
  assert.deepEqual(frames[0].popup, { side: "player", kind: "wound", text: "上限 +80" });
});

test("超长连击自动压缩节拍且最后一帧严格对齐引擎状态", () => {
  const facts = Array.from({ length: 22 }, (_, index) =>
    `第 ${index + 1} 击：墨邪受到 10 点伤害。`,
  );
  const after = { ...base, enemyHp: 780, enemyMaxHp: 890, playerFp: 777 };
  const frames = buildBattlePlayback(facts, base, after, "墨邪");
  assert.ok(frames.every((frame) => frame.durationMs <= 330));
  assert.deepEqual(frames.at(-1)?.presentation, after);
});
