import {
  LM_STUDIO_MODEL,
  NPC_MAX_OUTPUT_TOKENS,
  NPC_TRANSCRIPT_CHAR_BUDGET,
} from "../../game-core/lm-studio";

const LM_STUDIO_URL = "http://127.0.0.1:1234/api/v1/chat";
const LM_STUDIO_MODELS_URL = "http://127.0.0.1:1234/api/v1/models";

type ProxyPayload = {
  system?: string;
  transcript?: string;
  nextSpeaker?: string;
  maxOutputTokens?: number;
  model?: string;
  temperature?: number;
  topP?: number;
};

export async function GET(request: Request) {
  try {
    const response = await fetch(LM_STUDIO_MODELS_URL, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(2_500)]),
      cache: "no-store",
    });
    return Response.json({ ok: response.ok }, { status: response.ok ? 200 : 503 });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProxyPayload;
    const system = payload.system?.trim() || "";
    const transcript = payload.transcript?.trim() || "";
    const nextSpeaker = payload.nextSpeaker?.trim().slice(0, 12) || "NPC";
    const model = payload.model?.trim().slice(0, 160) || LM_STUDIO_MODEL;
    const maxOutputTokens = Math.max(64, Math.min(NPC_MAX_OUTPUT_TOKENS, Number(payload.maxOutputTokens) || NPC_MAX_OUTPUT_TOKENS));
    const requestedTemperature = Number(payload.temperature),
      requestedTopP = Number(payload.topP),
      temperature = Number.isFinite(requestedTemperature)
        ? Math.max(0, Math.min(2, requestedTemperature))
        : 0.8,
      topP = Number.isFinite(requestedTopP)
        ? Math.max(0.05, Math.min(1, requestedTopP))
        : 0.9;
    if (!system || !transcript || system.length > 16_000 || transcript.length > NPC_TRANSCRIPT_CHAR_BUDGET)
      return Response.json({ error: "对话上下文无效" }, { status: 400 });

    const upstream = await fetch(LM_STUDIO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        system_prompt: system,
        input: `${transcript}\n${nextSpeaker}：`,
        stream: true,
        reasoning: "off",
        store: false,
        temperature,
        top_p: topP,
        max_output_tokens: maxOutputTokens,
      }),
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text();
      return Response.json(
        { error: `LM Studio 返回 ${upstream.status}`, detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "无法连接本地模型";
    return Response.json({ error: detail }, { status: 502 });
  }
}
