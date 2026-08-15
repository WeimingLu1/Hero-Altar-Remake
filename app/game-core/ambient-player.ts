export type AmbientPlayerState = {
  npcIds: number[];
  replyToNpcId: number;
  bubble: string;
  bubbleUntil: number;
  bubbleShownAt: number;
  replyAt: number;
  llmRequested: boolean;
  responderQueue?: number[];
};

export function createAmbientPlayerState(
  overrides: Partial<AmbientPlayerState> = {},
): AmbientPlayerState {
  return {
    npcIds: [],
    replyToNpcId: 0,
    bubble: "",
    bubbleUntil: 0,
    bubbleShownAt: 0,
    replyAt: 0,
    llmRequested: true,
    ...overrides,
  };
}
