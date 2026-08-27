import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanActiveDialogue,
  cleanAmbientAction,
  cleanAmbientSpeech,
  parseNpcDialogue,
} from "../app/game-core/ambient-dialogue";
import { createAmbientPlayerState, startAmbientPlayerConversation } from "../app/game-core/ambient-player";

test("structured NPC dialogue keeps all three formal fields", () => {
  assert.deepEqual(
    parseNpcDialogue("状态：警惕\n动作：抱拳\n语言：阁下请留步。"),
    { state: "警惕", action: "抱拳", speech: "阁下请留步。" },
  );
  assert.equal(parseNpcDialogue("只是随口一问。 ").speech, "只是随口一问。");
});

test("ambient speech removes routing and stage directions", () => {
  assert.equal(
    cleanAmbientSpeech("甲：捕快 to 掌柜：今夜早些关门。", ["捕快", "掌柜"]),
    "今夜早些关门。",
  );
  assert.equal(cleanAmbientSpeech("动作：缓缓抬手"), null);
  assert.equal(cleanAmbientSpeech("……"), null);
});

test("active dialogue keeps only spoken text while preserving natural vocatives", () => {
  assert.equal(
    cleanActiveDialogue("状态：迟疑\n动作：抱拳\n语言：李兄，此事容我想想。", "潘小莲"),
    "李兄，此事容我想想。",
  );
  assert.equal(
    cleanActiveDialogue("**潘小莲说道：**（轻轻摇头）今日不便。", "潘小莲"),
    "今日不便。",
  );
});

test("ambient action uses null instead of a visible fallback sentinel", () => {
  assert.equal(cleanAmbientAction("动作：掌柜擦拭柜台", ["掌柜"]), "擦拭柜台");
  assert.equal(cleanAmbientAction("没有动作"), null);
  assert.equal(cleanAmbientAction("……"), null);
});

test("ambient player teardown always starts from an isolated empty state", () => {
  const first = createAmbientPlayerState({ npcEventId: 3, conversationContext: ["旧话"] });
  const second = createAmbientPlayerState();
  first.conversationContext.push("新话");
  assert.equal(second.npcEventId, 0);
  assert.deepEqual(second.conversationContext, []);
  assert.equal(second.llmRequested, true);
});

test("ambient player conversation starts with exactly one NPC and one speaker", () => {
  const state = startAmbientPlayerConversation(7, "player", 1200);
  assert.equal(state.npcEventId, 7);
  assert.equal(state.nextSpeaker, "player");
  assert.equal(state.visibleSpeaker, null);
  assert.equal(state.generationPending, true);
  assert.equal(state.llmRequested, false);
  assert.equal(state.queuedAt, 1200);
});
