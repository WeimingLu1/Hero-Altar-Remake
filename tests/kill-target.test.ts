import assert from "node:assert/strict";
import test from "node:test";
import { isCurrentKillTarget } from "../app/game-core/kill-target";

test("当前坛主被标记为击杀目标", () => {
  assert.equal(isCurrentKillTarget(163, { tanId: 1, killId: 0 }), true);
  assert.equal(isCurrentKillTarget(170, { tanId: 8, killId: 0 }), true);
});

test("非当前进度的坛主不标记", () => {
  // 坛进度还没到 / 已经打过，都不需要再杀。
  assert.equal(isCurrentKillTarget(163, { tanId: 0, killId: 0 }), false);
  assert.equal(isCurrentKillTarget(163, { tanId: 2, killId: 0 }), false);
  assert.equal(isCurrentKillTarget(164, { tanId: 1, killId: 0 }), false);
  // 九坛全部完成(tanId 9)后没有任何坛主需要再杀。
  assert.equal(isCurrentKillTarget(170, { tanId: 9, killId: 0 }), false);
});

test("主任务杀人目标被标记", () => {
  assert.equal(isCurrentKillTarget(50, { tanId: 0, killId: 50 }), true);
  assert.equal(isCurrentKillTarget(51, { tanId: 0, killId: 50 }), false);
});

test("没有杀人任务时普通 NPC 不标记", () => {
  assert.equal(isCurrentKillTarget(42, { tanId: 0, killId: 0 }), false);
  // 任务已完成时 killId 为 -1，不应误标。
  assert.equal(isCurrentKillTarget(50, { tanId: 0, killId: -1 }), false);
});

test("无图形 NPC 等没有 npcId 的情况不标记", () => {
  assert.equal(isCurrentKillTarget(undefined, { tanId: 1, killId: 50 }), false);
});
