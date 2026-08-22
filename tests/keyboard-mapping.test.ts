import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isCancelKey,
  isConfirmKey,
  isMainMenuKey,
  isMenuTabKey,
  KEYBOARD_HELP,
  menuTabFromKey,
} from "../app/original/keybindings";
import { resolveGameKey } from "../app/game-core/game-input";

const worldSource = readFileSync(
  new URL("../app/original/original-world.tsx", import.meta.url),
  "utf8",
);
const uiSource = readFileSync(
  new URL("../app/original/world-ui.tsx", import.meta.url),
  "utf8",
);
const source = `${worldSource}\n${uiSource}`;
const rendererSource = readFileSync(
  new URL("../app/original/world-renderer.tsx", import.meta.url),
  "utf8",
);

test("正式版只用 E 或 Enter 进行互动和确认", () => {
  assert.equal(isConfirmKey("e"), true);
  assert.equal(isConfirmKey("enter"), true);
  assert.equal(isConfirmKey("z"), false);
  assert.equal(isConfirmKey(" "), false);
  assert.equal(isCancelKey("x"), true);
  assert.equal(isCancelKey("escape"), true);
});

test("主菜单和四页签使用唯一键位配置", () => {
  assert.equal(isMainMenuKey("c"), true);
  assert.equal(isMainMenuKey("m"), true);
  assert.equal(isMenuTabKey("4"), true);
  assert.equal(isMenuTabKey("k"), false);
  assert.equal(menuTabFromKey("4"), 3);
  assert.match(KEYBOARD_HELP.join("\n"), /秘技 4/);
  assert.doesNotMatch(KEYBOARD_HELP.join("\n"), /秘技.*K/);
});

test("正式版不绑定字母 F 或 F1-F12 功能键", () => {
  assert.doesNotMatch(source, /k === "f(?:\d+)?"/);
  assert.doesNotMatch(source, /<kbd>F\d*<\/kbd>/);
});

test("中文输入法组合输入不会被全局键盘处理抢占", () => {
  const context = { screen: "play" } as const;
  assert.equal(resolveGameKey({ key: "e", isComposing: true }, context).layer, "composition");
  assert.equal(resolveGameKey({ key: "e", keyCode: 229 }, context).command, null);
  assert.deepEqual(
    resolveGameKey({ key: "Escape", target: { tagName: "INPUT" } }, context).command,
    { type: "blur-editor" },
  );
  assert.match(source, /e\.nativeEvent\.isComposing/);
});

test("战斗结束后的按钮和确认键统一进入战果处理", () => {
  assert.match(source, /if \(battle\.finished\) leaveBattle\(\)/);
  assert.match(source, /leave=\{leaveBattle\}/);
});

test("所有行囊操作都先确认，剧情说明的鼠标和键盘推进共用入口", () => {
  assert.match(
    worldSource,
    /const openBagEntry = useCallback\([\s\S]*setItemConfirm\(\{ entry, index: 0, source: "menu" \}\)/,
  );
  assert.match(worldSource, /setItemConfirm\(\{ entry, index: 0, source: "battle" \}\)/);
  assert.doesNotMatch(worldSource, /entry\.kind === 2 \|\| entry\.kind === 3/);
  assert.match(worldSource, /const advanceEventText = useCallback/);
  assert.match(
    worldSource,
    /resolved\.layer === "dialogue"[\s\S]*advanceEventText\(\)/,
  );
  assert.match(worldSource, /onClick=\{advanceEventText\}/);
});

test("被砍头的地图人物会变成不可重复互动的遗骸", () => {
  assert.match(rendererSource, /kind: "corpse"/);
  assert.match(source, /kind !== "corpse"/);
  assert.match(rendererSource, /drawCorpseMarker/);
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

test("底部交谈是唯一主动对话界面，普通闲聊仍不持久化", () => {
  assert.doesNotMatch(source, /rmxp-npc-chat-v1/);
  assert.match(source, /questTranscriptMessages/);
  assert.match(source, /requestNpcReply\([\s\S]*npcChat\.messages/);
  assert.doesNotMatch(source, /messages: messages\.slice\(-10\)/);
  assert.match(source, /if \(npcChat\) \{[\s\S]*setNpcChat\(null\)/);
  assert.match(source, /closeNpcChat\(\)/);
  assert.doesNotMatch(source, /NpcFreeChat|npcFreeChat|自由对话/);
  assert.match(source, /playerGender=\{state\.actor\.gender\}/);
  assert.match(source, /自由发展/);
  assert.doesNotMatch(source, /<em>状态 · \{latest\.state\}<\/em>/);
  assert.doesNotMatch(source, /<small>动作 · \{latest\.action\}<\/small>/);
  assert.doesNotMatch(source, /entry\.state && <em>状态/);
  assert.doesNotMatch(source, /entry\.action && <i>动作/);
  assert.match(source, /completedNpcReplies: chat\.replyCount/);
});

test("任务提议与任务簿都可完全使用键盘操作", () => {
  assert.deepEqual(
    resolveGameKey(
      { key: "ArrowDown" },
      { screen: "play", dialogue: "npc-talk" },
    ).command,
    { type: "navigate", direction: "down" },
  );
  assert.deepEqual(
    resolveGameKey(
      { key: " " },
      { screen: "play", dialogue: "npc-talk" },
    ).command,
    { type: "dialogue-auto-toggle" },
  );
  assert.equal(resolveGameKey({ key: " " }, { screen: "play" }).blocked, true);
  assert.deepEqual(
    resolveGameKey(
      { key: "E" },
      { screen: "play", modal: { kind: "task-journal" } },
    ).command,
    { type: "confirm" },
  );
  assert.match(worldSource, /npcChat\.pendingQuest[\s\S]*npcChat\.questChoice/);
  assert.match(worldSource, /interaction === "battle-ready"[\s\S]*startGeneratedQuestBattle\(\)/);
  assert.match(worldSource, /interaction === "report"[\s\S]*claimNpcQuestReward\(\)/);
  assert.match(worldSource, /confirmAbandonGeneratedQuest/);
});
