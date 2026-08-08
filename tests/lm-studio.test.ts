import assert from "node:assert/strict";
import test from "node:test";
import {
  LM_STUDIO_ENDPOINT,
  LM_STUDIO_MODEL,
  NPC_MAX_OUTPUT_TOKENS,
  NPC_TRANSCRIPT_CHAR_BUDGET,
  messagesWithinContext,
  lmStudioTransportUrl,
  streamNpcReply,
} from "../app/game-core/lm-studio";

test("LM Studio defaults target the requested local model", () => {
  assert.equal(LM_STUDIO_ENDPOINT, "http://127.0.0.1:1234");
  assert.equal(LM_STUDIO_MODEL, "qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive");
  assert.equal(NPC_MAX_OUTPUT_TOKENS, 2048);
});

test("NPC dialogue history is limited by context budget instead of message count", () => {
  const manyShortMessages = Array.from({ length: 40 }, (_, index) => ({
    role: (index % 2 ? "assistant" : "user") as "user" | "assistant",
    content: `第${index}条对话`,
  }));
  assert.equal(messagesWithinContext(manyShortMessages).length, 40);
  const oversized = [
    { role: "user" as const, content: "旧".repeat(NPC_TRANSCRIPT_CHAR_BUDGET) },
    { role: "assistant" as const, content: "最新回复" },
  ];
  assert.deepEqual(messagesWithinContext(oversized), [oversized[1]]);
});

test("local game pages use the same-origin LM Studio proxy", () => {
  assert.equal(lmStudioTransportUrl("localhost"), "/api/lm-studio");
  assert.equal(lmStudioTransportUrl("127.0.0.1"), "/api/lm-studio");
  assert.equal(
    lmStudioTransportUrl("rmxp.example.com"),
    "http://127.0.0.1:1234/api/v1/chat",
  );
});

test("dialogue transport can request the next named speaker", () => {
  assert.match(streamNpcReply.toString(), /nextSpeaker/);
});
