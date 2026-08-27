export type AmbientPlayerSpeaker = "npc" | "player";

export type AmbientPlayerState = {
  /** 精确绑定一个地图事件；环境会话永远只有主角和这一名 NPC。 */
  npcEventId: number;
  /** 下一句唯一允许开口的人。 */
  nextSpeaker: AmbientPlayerSpeaker;
  /** 当前可见发言者；有值时禁止生成或展示下一句。 */
  visibleSpeaker: AmbientPlayerSpeaker | null;
  /** 主角台词单独存在这里；NPC 台词仍写在对应 AmbientNpc 上。 */
  bubble: string;
  bubbleUntil: number;
  bubbleShownAt: number;
  generationPending: boolean;
  queuedAt: number;
  llmRequested: boolean;
  /** 已实际展示的句数；每两句构成一轮。 */
  turnCount: number;
  /** 最近八句真正说出口的台词，不写入存档。 */
  conversationContext: string[];
};

export function createAmbientPlayerState(
  overrides: Partial<AmbientPlayerState> = {},
): AmbientPlayerState {
  return {
    npcEventId: 0,
    nextSpeaker: "npc",
    visibleSpeaker: null,
    bubble: "",
    bubbleUntil: 0,
    bubbleShownAt: 0,
    generationPending: false,
    queuedAt: 0,
    llmRequested: true,
    turnCount: 0,
    conversationContext: [],
    ...overrides,
  };
}

export function startAmbientPlayerConversation(
  npcEventId: number,
  nextSpeaker: AmbientPlayerSpeaker,
  now: number,
) {
  return createAmbientPlayerState({
    npcEventId,
    nextSpeaker,
    generationPending: true,
    queuedAt: now,
    llmRequested: false,
  });
}
