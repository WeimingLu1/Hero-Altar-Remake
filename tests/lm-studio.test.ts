import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_LLM_SETTINGS,
  LM_STUDIO_ENDPOINT,
  LM_STUDIO_MODEL,
  LLM_SETTINGS_KEY,
  LLM_REQUEST_TIMEOUT_MS,
  NPC_MAX_OUTPUT_TOKENS,
  NPC_TRANSCRIPT_CHAR_BUDGET,
  NPC_TRANSCRIPT_MESSAGE_BUDGET,
  loadLlmSettings,
  loadLlmSettingsResult,
  messagesWithinContext,
  lmStudioTransportUrl,
  normalizeLlmSettings,
  probeLlmHealth,
  saveLlmSettings,
  streamNpcReply,
} from "../app/game-core/lm-studio";
import type { StorageBackend } from "../app/game-core/safe-storage";

function memoryStorage(): StorageBackend {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

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
  });
  assert.equal(normalizeLlmSettings({ endpoint: "javascript:alert(1)" }).endpoint, LM_STUDIO_ENDPOINT);
  assert.equal(normalizeLlmSettings({ concurrency: 0 }).concurrency, 1);
});

test("legacy provider settings are ignored and settings storage failures stay typed", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadLlmSettingsResult(storage), { ok: false, reason: "missing" });
  assert.deepEqual(loadLlmSettings(storage), DEFAULT_LLM_SETTINGS);

  const saved = saveLlmSettings({
    provider: "openai-compatible",
    endpoint: "https://models.example.test/",
    model: "local-model",
    timeoutMs: 9_000,
    concurrency: 2,
  }, storage);
  assert.equal(saved.ok, true);
  if (saved.ok) {
    assert.equal("provider" in saved.value, false);
    assert.equal(saved.value.concurrency, 2);
  }
  const serialized = storage.getItem(LLM_SETTINGS_KEY);
  assert.ok(serialized);
  assert.equal("provider" in JSON.parse(serialized), false);
  assert.deepEqual(loadLlmSettingsResult(storage), saved);

  storage.setItem(LLM_SETTINGS_KEY, "not-json");
  const invalid = loadLlmSettingsResult(storage);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.reason, "invalid");

  const full: StorageBackend = {
    getItem: () => null,
    setItem: () => { throw new DOMException("full", "QuotaExceededError"); },
    removeItem: () => undefined,
  };
  const quota = saveLlmSettings(DEFAULT_LLM_SETTINGS, full);
  assert.equal(quota.ok, false);
  if (!quota.ok) assert.equal(quota.reason, "quota");
});

test("streaming transport accepts LM Studio and OpenAI-compatible SSE deltas", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const encoder = new TextEncoder();
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("data: {\"type\":\"message.delta\",\"content\":\"江\"}\n"));
        controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{\"content\":\"湖\"}}]}\n\ndata: [DONE]\n"));
        controller.close();
      },
    });
    return new Response(body, { status: 200 });
  };

  const tokens: string[] = [];
  const answer = await streamNpcReply({
    system: "只说正文",
    messages: [{ role: "user", content: "请回应" }],
    nextSpeaker: "店小二",
    transportUrl: "https://models.example.test/api/v1/chat",
    onToken: (token) => tokens.push(token),
  });
  assert.equal(answer, "江湖");
  assert.deepEqual(tokens, ["江", "湖"]);
  assert.equal(requestBody?.reasoning, "off");
  assert.match(String(requestBody?.input), /店小二：$/);
});

test("streaming transport forwards an already-aborted caller signal", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = (_input, init) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) reject(signal.reason);
    else signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const controller = new AbortController();
  controller.abort(new Error("caller stopped"));
  await assert.rejects(streamNpcReply({
    system: "system",
    messages: [{ role: "user", content: "hello" }],
    transportUrl: "/api/lm-studio",
    signal: controller.signal,
    onToken: () => undefined,
  }), /caller stopped/);
});

test("streaming transport aborts stalled requests at the configured timeout", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = (_input, init) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) reject(signal.reason);
    else signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  await assert.rejects(streamNpcReply({
    system: "system",
    messages: [{ role: "user", content: "hello" }],
    transportUrl: "/api/lm-studio",
    timeoutMs: 5,
    onToken: () => undefined,
  }), /LM Studio 请求超时/);
});

test("health checks are explicit and honor cancellation", async (context) => {
  const source = readFileSync(new URL("../app/original/original-entry.tsx", import.meta.url), "utf8");
  const effects = [...source.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n {2}\}, \[\]\);/g)];
  assert.ok(effects.length >= 1);
  assert.equal(effects.some((effect) => effect[1].includes("lm-studio")), false);
  assert.match(source, /本地模型尚未检测/);

  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = (_input, init) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) reject(signal.reason);
      else signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  };
  const controller = new AbortController();
  const checking = probeLlmHealth(controller.signal, DEFAULT_LLM_SETTINGS);
  controller.abort();
  assert.equal(await checking, false);
  assert.equal(calls, 1);
});
