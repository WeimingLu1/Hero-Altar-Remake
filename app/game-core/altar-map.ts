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
