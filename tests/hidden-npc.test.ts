import assert from "node:assert/strict";
import test from "node:test";
import {
  TOKEN_GATED_NPC,
  npcVisibleWithInventory,
  tokenGateState,
} from "../app/game-core/hidden-npc";

test("无令牌时娜可露(132)与茅盈(144)不显示，与原版 Game_Map.rb 一致", () => {
  assert.equal(npcVisibleWithInventory(132, {}), false);
  assert.equal(npcVisibleWithInventory(144, {}), false);
});

test("持有对应令牌后两位隐藏 NPC 显示", () => {
  assert.equal(npcVisibleWithInventory(132, { "1:31": 1 }), true);
  assert.equal(npcVisibleWithInventory(144, { "1:32": 1 }), true);
});

test("令牌不通用：兽王令牌不能让茅盈出现，茅山令牌不能让娜可露出现", () => {
  assert.equal(npcVisibleWithInventory(132, { "1:32": 1 }), false);
  assert.equal(npcVisibleWithInventory(144, { "1:31": 1 }), false);
});

test("普通 NPC 不受令牌影响", () => {
  assert.equal(npcVisibleWithInventory(163, {}), true);
  assert.equal(npcVisibleWithInventory(0, {}), true);
});

test("令牌映射与原版源码一致：132→31 兽王令牌，144→32 茅山令牌", () => {
  assert.deepEqual(TOKEN_GATED_NPC, { 132: 31, 144: 32 });
});

test("tokenGateState 摘要随令牌持有变化，用于环境人口刷新", () => {
  assert.equal(tokenGateState({}), "00");
  assert.equal(tokenGateState({ "1:31": 1 }), "10");
  assert.equal(tokenGateState({ "1:32": 1 }), "01");
  assert.equal(tokenGateState({ "1:31": 1, "1:32": 1 }), "11");
});
