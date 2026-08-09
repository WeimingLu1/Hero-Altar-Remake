import assert from "node:assert/strict";
import test from "node:test";
import {
  ALTAR_MAP_ITEM_ENTRANCE,
  altarEntranceHint,
  altarOwnMap,
} from "../app/game-core/altar-map";
import { originalTables } from "../app/game-core/original-data";
import { getOriginalMap } from "../app/game-core/original-world";

// 机械坛序：坛任务按敌人 id 163→170 推进。
const BOSS_ORDER = [163, 164, 165, 166, 167, 168, 169, 170];

function altarMapDrop(enemyId: number): number | undefined {
  const enemy = originalTables.enemies[enemyId];
  for (const key of ["item1", "item2", "item3", "item4"]) {
    const item = enemy?.[key];
    if (Array.isArray(item) && item[0] === 1 && 21 <= Math.abs(item[1]) && Math.abs(item[1]) <= 28)
      return Math.abs(item[1]);
  }
  return undefined;
}

test("每位坛主都有自身坛地图，起始青龙坛地图(21)由村长赠送", () => {
  for (const id of BOSS_ORDER) {
    const map = altarOwnMap(id);
    assert.ok(map !== undefined, `敌 ${id} 应有自身坛地图`);
    assert.ok(map >= 21 && map <= 28, `地图 id ${map} 应在坛地图范围内`);
  }
  assert.equal(altarOwnMap(163), 21);
});

test("击杀当前坛主掉落的正是下一坛的自身地图，形成连续指引链", () => {
  for (let i = 0; i < BOSS_ORDER.length - 1; i++) {
    const boss = BOSS_ORDER[i];
    const nextBoss = BOSS_ORDER[i + 1];
    assert.equal(
      altarMapDrop(boss),
      altarOwnMap(nextBoss),
      `敌 ${boss} 应掉落下一坛(敌 ${nextBoss})的地图 ${altarOwnMap(nextBoss)}`,
    );
  }
});

test("最后一坛(170)不掉落坛地图", () => {
  assert.equal(altarMapDrop(170), undefined);
});

test("每张坛地图使用后都返回入口所在的地图与坐标", () => {
  const cases: Record<number, { altar: string; mapName: string; x: number; y: number }> = {
    21: { altar: "青龙坛", mapName: "失落的世界", x: 16, y: 12 },
    22: { altar: "地罡坛", mapName: "南海", x: 7, y: 2 },
    23: { altar: "朱雀坛", mapName: "失落的世界", x: 1, y: 36 },
    24: { altar: "山岚坛", mapName: "东海", x: 10, y: 10 },
    25: { altar: "玄武坛", mapName: "东海", x: 3, y: 6 },
    26: { altar: "紫煞坛", mapName: "失落的世界", x: 11, y: 3 },
    27: { altar: "天徽坛", mapName: "失落的世界", x: 8, y: 18 },
    28: { altar: "白虎坛", mapName: "东海", x: 7, y: 2 },
  };
  for (const [itemId, expected] of Object.entries(cases)) {
    const hint = altarEntranceHint(Number(itemId));
    assert.ok(hint, `物品 ${itemId} 应有入口提示`);
    assert.match(hint!, new RegExp(expected.altar));
    assert.match(hint!, new RegExp(expected.mapName));
    assert.match(hint!, new RegExp(`\\(${expected.x}, ${expected.y}\\)`));
  }
});

test("非坛地图物品没有入口提示", () => {
  assert.equal(altarEntranceHint(1), undefined);
  assert.equal(altarEntranceHint(8), undefined);
  assert.equal(altarEntranceHint(19), undefined);
});

test("硬编码入口坐标与实际地图事件一致，避免指引漂移", () => {
  const ITEM_TO_ALTAR: Record<number, number> = {
    21: 59, 22: 60, 23: 61, 24: 62, 25: 63, 26: 64, 27: 65, 28: 66,
  };
  const found: Record<number, { mapId: number; x: number; y: number }> = {};
  for (let mapId = 1; mapId <= 69; mapId++) {
    const map = getOriginalMap(mapId);
    for (const event of map.events || []) {
      for (const page of event.pages || []) {
        const scripts = (page.commands || [])
          .map((command) => String(command.parameters?.[0] || ""))
          .join("\n");
        const match = scripts.match(/Scene_Event\.new\(\s*13\s*,\s*(\d+)/);
        if (!match) continue;
        const altarMapId = Number(match[1]);
        if (altarMapId >= 59 && altarMapId <= 66 && !found[altarMapId])
          found[altarMapId] = { mapId, x: event.x, y: event.y };
      }
    }
  }
  for (const [itemId, altarId] of Object.entries(ITEM_TO_ALTAR)) {
    const expected = ALTAR_MAP_ITEM_ENTRANCE[Number(itemId)];
    const actual = found[altarId];
    assert.ok(actual, `坛 ${altarId} 应有入口事件`);
    assert.equal(actual.mapId, expected.mapId, `物品${itemId} 入口地图`);
    assert.equal(actual.x, expected.x, `物品${itemId} 入口 x`);
    assert.equal(actual.y, expected.y, `物品${itemId} 入口 y`);
  }
});
