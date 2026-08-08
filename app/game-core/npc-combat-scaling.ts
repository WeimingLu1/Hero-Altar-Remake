import { originalTables, type OriginalRecord } from "./original-data";

// 战斗等级 = 战斗类武功(类型 1-10)的最高等级。
// NPC 的数值已由 scripts/rebalance-npcs.mjs 按同一等级直接写入原始数据，
// 因此战斗不再需要运行时倍率强化层。
export function npcCombatLevel(record: OriginalRecord) {
  return ((record.skill_list as number[][] | undefined) || []).reduce(
    (highest, [id, level]) => {
      const type = Number(originalTables.kungfus[id]?.type || 0);
      return type >= 1 && type <= 10
        ? Math.max(highest, Number(level || 0))
        : highest;
    },
    0,
  );
}
