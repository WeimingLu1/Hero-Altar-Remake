// 原版 Game_Map.rb 中，玩家缺少对应令牌时不生成指定 NPC：
//   娜可露(132) 需要 兽王令牌(1:31)
//   茅盈(144)   需要 茅山令牌(1:32)
// 移植版复刻该逻辑：无令牌时这些 NPC 不可见、不可交互、不进入环境运行时。
export const TOKEN_GATED_NPC: Readonly<Record<number, number>> = {
  132: 31, // 娜可露 → 兽王令牌
  144: 32, // 茅盈 → 茅山令牌
};

export function tokenRequiredForNpc(npcId: number): number | undefined {
  return TOKEN_GATED_NPC[npcId];
}

export function npcVisibleWithInventory(
  npcId: number,
  inventory: Record<string, number>,
): boolean {
  const required = tokenRequiredForNpc(npcId);
  return required === undefined || (inventory[`1:${required}`] || 0) > 0;
}

// 令牌持有状态摘要，用于环境人口刷新键：取得/失去令牌后重建环境运行时。
export function tokenGateState(inventory: Record<string, number>): string {
  return Object.values(TOKEN_GATED_NPC)
    .map((itemId) => ((inventory[`1:${itemId}`] || 0) > 0 ? "1" : "0"))
    .join("");
}
