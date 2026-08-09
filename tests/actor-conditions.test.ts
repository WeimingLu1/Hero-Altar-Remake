import assert from "node:assert/strict";
import test from "node:test";
import { canObtainCaihua } from "../app/game-core/actor-conditions";

const base = { morals: 100, age: 16, gender: 0, armorIds: [2] };

test("满足全部条件(恶人+老花镜+未成年+男性)可以拾取菜花宝典", () => {
  assert.equal(canObtainCaihua(base), true);
});

test("道德>=128 的名门正派不能拾取", () => {
  assert.equal(canObtainCaihua({ ...base, morals: 128 }), false);
  assert.equal(canObtainCaihua({ ...base, morals: 200 }), false);
});

test("未装备老花镜不能拾取", () => {
  assert.equal(canObtainCaihua({ ...base, armorIds: [1] }), false);
  assert.equal(canObtainCaihua({ ...base, armorIds: [] }), false);
});

test("已成年(>=18)不能拾取", () => {
  assert.equal(canObtainCaihua({ ...base, age: 18 }), false);
  assert.equal(canObtainCaihua({ ...base, age: 30 }), false);
});

test("女性不能拾取", () => {
  assert.equal(canObtainCaihua({ ...base, gender: 1 }), false);
});
