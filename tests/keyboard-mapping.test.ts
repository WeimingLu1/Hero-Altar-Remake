import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/original/original-world.tsx", import.meta.url),
  "utf8",
);

test("正式版只用 E 或 Enter 进行互动和确认", () => {
  assert.match(source, /const confirm = \["e", "enter"\]\.includes\(k\)/);
  assert.doesNotMatch(source, /\["z",\s*"enter"/);
  assert.doesNotMatch(source, /"enter",\s*" "/);
});

test("正式版不绑定字母 F 或 F1-F12 功能键", () => {
  assert.doesNotMatch(source, /k === "f(?:\d+)?"/);
  assert.doesNotMatch(source, /<kbd>F\d*<\/kbd>/);
});

test("中文输入法组合输入不会被全局键盘处理抢占", () => {
  assert.match(source, /if \(e\.isComposing \|\| e\.keyCode === 229\) return/);
  assert.match(source, /target\?\.tagName === "INPUT"/);
  assert.match(source, /e\.nativeEvent\.isComposing/);
});

test("战斗结束后的按钮和确认键统一进入战果处理", () => {
  assert.match(source, /if \(battle\.finished\) leaveBattle\(\)/);
  assert.match(source, /leave=\{leaveBattle\}/);
});

test("被砍头的地图人物会变成不可重复互动的遗骸", () => {
  assert.match(source, /kind: "corpse"/);
  assert.match(source, /kind !== "corpse"/);
  assert.match(source, /drawCorpseMarker/);
});
