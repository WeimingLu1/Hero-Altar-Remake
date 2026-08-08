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

test("连续请教和修炼时仍可用 W/S 停止并切换项目", () => {
  assert.match(
    source,
    /if \(studyActive\)[\s\S]*setStudyActive\(false\)[\s\S]*setStudy\(/,
  );
  assert.match(
    source,
    /if \(cultivationActive\)[\s\S]*setCultivationActive\(false\)[\s\S]*setCultivation\(/,
  );
  assert.match(source, /progress=\{studyProgress\}/);
  assert.match(source, /progress=\{cultivationProgress\}/);
  assert.match(source, /message=\{notice\}/);
  assert.match(source, /wide/);
});

test("外部资源数值使用紧凑格式并保留完整提示", () => {
  assert.match(source, /notation: "compact"/);
  assert.match(source, /title=\{`银两：/);
});

test("自由对话仅保留当前相遇并在移动时清空", () => {
  assert.doesNotMatch(source, /rmxp-npc-chat-v1/);
  assert.match(source, /messages: \[\]/);
  assert.match(source, /requestNpcReply\(npcChat\.id, \[\.\.\.npcChat\.messages/);
  assert.doesNotMatch(source, /messages: messages\.slice\(-10\)/);
  assert.match(source, /if \(npcChat\) \{[\s\S]*setNpcChat\(null\)/);
  assert.match(source, /closeNpcChat\(\)/);
  assert.match(source, /placeholder="例如：抱拳行礼/);
  assert.match(source, /状态 · \{message\.state\}/);
});
