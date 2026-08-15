import assert from "node:assert/strict";
import test from "node:test";
import {
  LM_STUDIO_ENDPOINT,
  LM_STUDIO_MODEL,
  LLM_REQUEST_TIMEOUT_MS,
  NPC_MAX_OUTPUT_TOKENS,
  NPC_TRANSCRIPT_CHAR_BUDGET,
  NPC_TRANSCRIPT_MESSAGE_BUDGET,
  messagesWithinContext,
  lmStudioTransportUrl,
  normalizeLlmSettings,
  streamNpcReply,
} from "../app/game-core/lm-studio";

test("LM Studio defaults target the requested local model", () => {
  assert.equal(LM_STUDIO_ENDPOINT, "http://127.0.0.1:1234");
  assert.equal(LM_STUDIO_MODEL, "qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive");
  assert.equal(NPC_MAX_OUTPUT_TOKENS, 512);
  assert.equal(NPC_TRANSCRIPT_CHAR_BUDGET, 12_000);
  assert.equal(NPC_TRANSCRIPT_MESSAGE_BUDGET, 10);
  assert.equal(LLM_REQUEST_TIMEOUT_MS, 15_000);
});

test("NPC dialogue history is limited by context budget instead of message count", () => {
  const manyShortMessages = Array.from({ length: 40 }, (_, index) => ({
    role: (index % 2 ? "assistant" : "user") as "user" | "assistant",
    content: `第${index}条对话`,
  }));
  assert.equal(messagesWithinContext(manyShortMessages).length, 10);
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

test("LLM settings validate endpoint and clamp runtime limits", () => {
  assert.deepEqual(normalizeLlmSettings({
    endpoint: "https://models.example.test/custom/",
    model: " qwen-custom ",
    timeoutMs: 100_000,
    concurrency: 99,
    provider: "openai-compatible",
  }), {
    endpoint: "https://models.example.test/custom",
    model: "qwen-custom",
    timeoutMs: 60_000,
    concurrency: 3,
    provider: "openai-compatible",
  });
  assert.equal(normalizeLlmSettings({ endpoint: "javascript:alert(1)" }).endpoint, LM_STUDIO_ENDPOINT);
});
