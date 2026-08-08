import { originalTables, type OriginalRecord } from "./original-data";

// 战斗等级 = 专门武功(类型 1-10、id>=12)的最高等级。
// 原版数据给商人/平民填了很高的基本武功作为伪影，不计入战斗等级；
// NPC 数值已由 scripts/rebalance-npcs.mjs 按同一等级写入原始数据，
// 因此战斗不再需要运行时倍率强化层。
export function npcCombatLevel(record: OriginalRecord) {
  return ((record.skill_list as number[][] | undefined) || []).reduce(
    (highest, [id, level]) => {
      const type = Number(originalTables.kungfus[id]?.type || 0);
      return id >= 12 && type >= 1 && type <= 10
        ? Math.max(highest, Number(level || 0))
        : highest;
    },
    0,
  );
}
