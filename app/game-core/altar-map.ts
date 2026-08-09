// 机械坛序与每座坛自身地图的对应。
// 坛任务按敌人 id 推进(163→170)，每位坛主镇守一座坛，击杀时消耗「本坛地图」，
// 下一坛地图由掉落提供，形成连续的指引链。原作数据按故事顺序编号地图，
// 与机械推进不一致，这里用显式映射对齐。
export const ALTAR_OWN_MAP: Readonly<Record<number, number>> = {
  163: 21, // 青龙坛主(青龙坛) → 青龙坛地图
  164: 28, // 总瓢把子(白虎坛) → 白虎坛地图
  165: 23, // 朱雀坛主(朱雀坛) → 朱雀坛地图
  166: 25, // 玄武坛主(玄武坛) → 玄武坛地图
  167: 27, // 天徽坛主(天徽坛) → 天徽坛地图
  168: 26, // 紫煞坛主(紫煞坛) → 紫煞坛地图
  169: 24, // 山岚坛主(山岚坛) → 山岚坛地图
  170: 22, // 地罡坛主(地罡坛) → 地罡坛地图
};

export function altarOwnMap(enemyId: number): number | undefined {
  return ALTAR_OWN_MAP[enemyId];
}

// 每张坛地图(物品 21–28)对应一座坛，使用地图时提示入口所在的地图和坐标，
// 让玩家知道该去哪里找这座坛。入口坐标来自地图事件(type 13)的真实位置。
export type AltarEntrance = {
  altar: string;
  mapId: number;
  mapName: string;
  x: number;
  y: number;
};

export const ALTAR_MAP_ITEM_ENTRANCE: Readonly<Record<number, AltarEntrance>> = {
  21: { altar: "青龙坛", mapId: 1, mapName: "失落的世界", x: 16, y: 12 },
  22: { altar: "地罡坛", mapId: 50, mapName: "南海", x: 7, y: 2 },
  23: { altar: "朱雀坛", mapId: 1, mapName: "失落的世界", x: 1, y: 36 },
  24: { altar: "山岚坛", mapId: 49, mapName: "东海", x: 10, y: 10 },
  25: { altar: "玄武坛", mapId: 49, mapName: "东海", x: 3, y: 6 },
  26: { altar: "紫煞坛", mapId: 1, mapName: "失落的世界", x: 11, y: 3 },
  27: { altar: "天徽坛", mapId: 1, mapName: "失落的世界", x: 8, y: 18 },
  28: { altar: "白虎坛", mapId: 49, mapName: "东海", x: 7, y: 2 },
};

export function altarEntranceHint(itemId: number): string | undefined {
  const entrance = ALTAR_MAP_ITEM_ENTRANCE[itemId];
  if (!entrance) return undefined;
  return `你展开地图：${entrance.altar}的入口就在「${entrance.mapName}」(${entrance.x}, ${entrance.y})附近。`;
}
