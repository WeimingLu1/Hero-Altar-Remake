import {
  readJsonStorage,
  writeJsonStorage,
  type StorageBackend,
  type StorageResult,
} from "./safe-storage";

export const LM_STUDIO_ENDPOINT = "http://127.0.0.1:1234";
export const LM_STUDIO_MODEL = "qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive";
export const NPC_MAX_OUTPUT_TOKENS = 512;
export const NPC_TRANSCRIPT_CHAR_BUDGET = 12_000;
export const NPC_TRANSCRIPT_MESSAGE_BUDGET = 10;
export const LLM_REQUEST_TIMEOUT_MS = 15_000;
export const LLM_SETTINGS_KEY = "rmxp-hero-llm-settings-v1";

export type LlmSettings = {
  endpoint: string;
  model: string;
  timeoutMs: number;
  concurrency: number;
};

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  endpoint: LM_STUDIO_ENDPOINT,
  model: LM_STUDIO_MODEL,
  timeoutMs: LLM_REQUEST_TIMEOUT_MS,
  concurrency: 3,
};

export function normalizeLlmSettings(value: unknown): LlmSettings {
  const source = value && typeof value === "object" ? value as Partial<LlmSettings> : {};
  const requestedConcurrency = Number(source.concurrency);
  let endpoint = typeof source.endpoint === "string" ? source.endpoint.trim() : "";
  try {
    const url = new URL(endpoint || LM_STUDIO_ENDPOINT);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    endpoint = url.origin + url.pathname.replace(/\/$/, "");
  } catch {
    endpoint = LM_STUDIO_ENDPOINT;
  }
  return {
    endpoint,
    model: typeof source.model === "string" && source.model.trim()
      ? source.model.trim().slice(0, 160)
      : LM_STUDIO_MODEL,
    timeoutMs: Math.max(3_000, Math.min(60_000, Number(source.timeoutMs) || LLM_REQUEST_TIMEOUT_MS)),
    concurrency: Number.isFinite(requestedConcurrency)
      ? Math.max(1, Math.min(3, Math.trunc(requestedConcurrency)))
      : 3,
  };
}

export function loadLlmSettingsResult(
  storage?: StorageBackend | null,
): StorageResult<LlmSettings> {
  const stored = readJsonStorage(LLM_SETTINGS_KEY, storage);
  return stored.ok
    ? { ok: true, value: normalizeLlmSettings(stored.value) }
    : stored;
}

export function loadLlmSettings(storage?: StorageBackend | null): LlmSettings {
  const stored = loadLlmSettingsResult(storage);
  return stored.ok ? stored.value : DEFAULT_LLM_SETTINGS;
}

export function saveLlmSettings(
  value: unknown,
  storage?: StorageBackend | null,
): StorageResult<LlmSettings> {
  const settings = normalizeLlmSettings(value);
  const written = writeJsonStorage(LLM_SETTINGS_KEY, settings, storage);
  return written.ok ? { ok: true, value: settings } : written;
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** Human-readable speaker/source label retained across multi-NPC and narration contexts. */
  speaker?: string;
};

/** Keep imported/editable save text inside one prompt data field. */
export function promptData(value: unknown, maxLength = 320) {
  return Array.from(String(value ?? ""), (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeSpeakerLabel(value: string | undefined, fallback: string) {
  const cleaned = promptData(value, 24)
    .replace(/[：:]/g, " ")
    .slice(0, 24);
  return cleaned || fallback;
}

export function formatChatTranscript(messages: ChatMessage[]) {
  return messagesWithinContext(messages).map((message) =>
    `${safeSpeakerLabel(message.speaker, message.role === "user" ? "玩家" : "NPC")}：${message.content}`,
  ).join("\n");
}

export function messagesWithinContext(messages: ChatMessage[]) {
  let remaining = NPC_TRANSCRIPT_CHAR_BUDGET;
  const kept: ChatMessage[] = [];
  for (
    let index = messages.length - 1;
    index >= 0 && kept.length < NPC_TRANSCRIPT_MESSAGE_BUDGET;
    index -= 1
  ) {
    const message = messages[index];
    const cost = message.content.length + 8;
    if (cost > remaining && kept.length) break;
    kept.unshift(cost > remaining
      ? { ...message, content: message.content.slice(-remaining) }
      : message);
    remaining -= Math.min(cost, remaining);
  }
  return kept;
}

export function lmStudioTransportUrl(hostname?: string) {
  const host = hostname ?? (typeof location === "undefined" ? "" : location.hostname);
  return host === "localhost" || host === "127.0.0.1"
    ? "/api/lm-studio"
    : `${LM_STUDIO_ENDPOINT}/api/v1/chat`;
}

function forwardAbortSignal(signal: AbortSignal | undefined, controller: AbortController) {
  const forward = () => controller.abort(signal?.reason);
  if (signal?.aborted) forward();
  else signal?.addEventListener("abort", forward, { once: true });
  return () => signal?.removeEventListener("abort", forward);
}

export async function probeLlmHealth(signal?: AbortSignal, supplied?: LlmSettings) {
  const settings = supplied || loadLlmSettings();
  const localPage = typeof location !== "undefined" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1");
  const useProxy = localPage && settings.endpoint === LM_STUDIO_ENDPOINT;
  const url = useProxy ? "/api/lm-studio" : `${settings.endpoint}/api/v1/models`;
  const controller = new AbortController();
  const stopForwardingAbort = forwardAbortSignal(signal, controller);
  const timeout = globalThis.setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(timeout);
    stopForwardingAbort();
  }
}

export async function streamNpcReply(options: {
  system: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onToken: (token: string) => void;
  endpoint?: string;
  transportUrl?: string;
  model?: string;
  nextSpeaker?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  temperature?: number;
  topP?: number;
}) {
  const settings = loadLlmSettings();
  const endpoint = (options.endpoint || settings.endpoint).replace(/\/$/, "");
  const transcript = formatChatTranscript(options.messages) ||
    "现场情境：玩家来到对方面前准备交谈，请对方结合此地情境自然开口。";
  const transportUrl = options.transportUrl ||
    (options.endpoint || settings.endpoint !== LM_STUDIO_ENDPOINT
      ? `${endpoint}/api/v1/chat`
      : lmStudioTransportUrl());
  const proxy = transportUrl.startsWith("/");
  const nextSpeaker = options.nextSpeaker?.trim() || "NPC";
  const controller = new AbortController();
  const stopForwardingAbort = forwardAbortSignal(options.signal, controller);
  const timeout = globalThis.setTimeout(
    () => controller.abort(new Error("LM Studio 请求超时")),
    options.timeoutMs ?? settings.timeoutMs,
  );
  try {
    const response = await fetch(transportUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proxy ? {
        system: options.system,
        transcript,
        nextSpeaker,
        maxOutputTokens: options.maxOutputTokens,
        temperature: options.temperature,
        topP: options.topP,
        model: options.model || settings.model,
      } : {
          model: options.model || settings.model,
          system_prompt: options.system,
          input: `${transcript}\n${nextSpeaker}：`,
          stream: true,
          reasoning: "off",
          store: false,
          temperature: Math.max(0, Math.min(2, options.temperature ?? 0.8)),
          top_p: Math.max(0.05, Math.min(1, options.topP ?? 0.9)),
          max_output_tokens: options.maxOutputTokens || NPC_MAX_OUTPUT_TOKENS,
        }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.json() as { error?: string };
        detail = body.error ? `：${body.error}` : "";
      } catch { /* non-JSON upstream error */ }
      throw new Error(`LM Studio 返回 ${response.status}${detail}`);
    }
    if (!response.body) throw new Error("浏览器没有收到流式响应");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let pending = "", answer = "";
    const acceptLine = (raw: string) => {
      const line = raw.trim();
      if (!line.startsWith("data:") || line === "data: [DONE]") return;
      try {
        const json = JSON.parse(line.slice(5)) as {
          type?: string;
          content?: string;
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = json.type === "message.delta"
          ? json.content || ""
          : json.choices?.[0]?.delta?.content || "";
        if (token) {
          answer += token;
          options.onToken(token);
        }
      } catch { /* tolerate split/non-JSON keepalive lines */ }
    };
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      lines.forEach(acceptLine);
      if (done) break;
    }
    if (pending) acceptLine(pending);
    if (!answer.trim()) throw new Error("模型没有返回正文");
    return answer.trim();
  } finally {
    globalThis.clearTimeout(timeout);
    stopForwardingAbort();
  }
}
