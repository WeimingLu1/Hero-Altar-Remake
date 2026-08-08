export const LM_STUDIO_ENDPOINT = "http://127.0.0.1:1234";
export const LM_STUDIO_MODEL = "qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive";
export const NPC_MAX_OUTPUT_TOKENS = 2048;
export const NPC_TRANSCRIPT_CHAR_BUDGET = 72_000;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function messagesWithinContext(messages: ChatMessage[]) {
  let remaining = NPC_TRANSCRIPT_CHAR_BUDGET;
  const kept: ChatMessage[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
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

export async function streamNpcReply(options: {
  system: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onToken: (token: string) => void;
  endpoint?: string;
  transportUrl?: string;
  model?: string;
  nextSpeaker?: string;
}) {
  const endpoint = (options.endpoint || LM_STUDIO_ENDPOINT).replace(/\/$/, "");
  const transcript = messagesWithinContext(options.messages).map((message) =>
    `${message.role === "user" ? "玩家" : "NPC"}：${message.content}`,
  ).join("\n");
  const transportUrl = options.transportUrl ||
    (options.endpoint ? `${endpoint}/api/v1/chat` : lmStudioTransportUrl());
  const proxy = transportUrl.startsWith("/");
  const nextSpeaker = options.nextSpeaker?.trim() || "NPC";
  const response = await fetch(transportUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proxy ? {
      system: options.system,
      transcript,
      nextSpeaker,
    } : {
        model: options.model || LM_STUDIO_MODEL,
        system_prompt: options.system,
        input: `${transcript}\n${nextSpeaker}：`,
        stream: true,
        reasoning: "off",
        store: false,
        temperature: 0.8,
        top_p: 0.9,
        max_output_tokens: NPC_MAX_OUTPUT_TOKENS,
      }),
    signal: options.signal,
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
  while (true) {
    const { value, done } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    const lines = pending.split("\n");
    pending = lines.pop() || "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:") || line === "data: [DONE]") continue;
      try {
        const json = JSON.parse(line.slice(5)) as { type?: string; content?: string };
        const token = json.type === "message.delta" ? json.content || "" : "";
        if (token) { answer += token; options.onToken(token); }
      } catch { /* tolerate split/non-JSON keepalive lines */ }
    }
    if (done) break;
  }
  if (!answer.trim()) throw new Error("模型没有返回正文");
  return answer.trim();
}
