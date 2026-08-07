import {
  LM_STUDIO_MODEL,
  NPC_MAX_OUTPUT_TOKENS,
  NPC_TRANSCRIPT_CHAR_BUDGET,
} from "../../game-core/lm-studio";

const LM_STUDIO_URL = "http://127.0.0.1:1234/api/v1/chat";

type ProxyPayload = {
  system?: string;
  transcript?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProxyPayload;
    const system = payload.system?.trim() || "";
    const transcript = payload.transcript?.trim() || "";
    if (!system || !transcript || system.length > 16_000 || transcript.length > NPC_TRANSCRIPT_CHAR_BUDGET)
      return Response.json({ error: "对话上下文无效" }, { status: 400 });

    const upstream = await fetch(LM_STUDIO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LM_STUDIO_MODEL,
        system_prompt: system,
        input: `${transcript}\nNPC：`,
        stream: true,
        reasoning: "off",
        store: false,
        temperature: 0.8,
        top_p: 0.9,
        max_output_tokens: NPC_MAX_OUTPUT_TOKENS,
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
