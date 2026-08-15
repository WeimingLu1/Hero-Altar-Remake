import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanAmbientAction,
  cleanAmbientSpeech,
  parseNpcDialogue,
} from "../app/game-core/ambient-dialogue";
import { createAmbientPlayerState } from "../app/game-core/ambient-player";

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

test("ambient action uses null instead of a visible fallback sentinel", () => {
  assert.equal(cleanAmbientAction("动作：掌柜擦拭柜台", ["掌柜"]), "擦拭柜台");
  assert.equal(cleanAmbientAction("没有动作"), null);
  assert.equal(cleanAmbientAction("……"), null);
});

test("ambient player teardown always starts from an isolated empty state", () => {
  const first = createAmbientPlayerState({ npcIds: [3], llmRequested: false });
  const second = createAmbientPlayerState();
  first.npcIds.push(4);
  assert.deepEqual(second.npcIds, []);
  assert.equal(second.llmRequested, true);
});
