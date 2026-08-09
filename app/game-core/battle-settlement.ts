import { originalTables } from "./original-data";
import type { SceneActorState } from "./scene-event";

export function settleVictoryLoot(
  actor: SceneActorState,
  enemyId: number,
  killed: boolean,
) {
  const enemy = originalTables.enemies[enemyId] || {},
    drops: number[][] = [];
  if (Number(enemy.weapon_id || 0)) drops.push([2, Number(enemy.weapon_id)]);
  for (const key of ["item1", "item2", "item3", "item4"]) {
    const item = enemy[key] as number[];
    if (Array.isArray(item) && Number(item[0]) > 0) drops.push(item);
  }
  actor.gold += Number(enemy.gold || 0);
  const names: string[] = [];
  for (const [kind, signedId] of drops) {
    const id = Math.abs(signedId);
    if (kind === 1 && id === 19) {
      actor.stoneList ||= [];
      if (!actor.stoneList.includes(enemyId)) {
        actor.stoneList.push(enemyId);
        names.push(String(originalTables.items[19]?.name || "三角石板"));
      }
      continue;
    }
    if (kind === 1 && id >= 21 && id <= 28) {
      // 坛地图只由「当前坛主」掉落：163–170 中与坛进度匹配(enemyId-162===tanId)
      // 的那一坛。每位坛主掉落机械顺序的下一坛地图；青龙坛地图(21)由村长直接赠送，
      // 其余来源(普通敌人、已推进后的旧坛主)一律不产出坛地图，避免误导与重复掉落。
      if (!(enemyId >= 163 && enemyId <= 170 && enemyId - 162 === actor.tanId))
        continue;
    }
    const key = `${kind}:${id}`;
    actor.inventory[key] = (actor.inventory[key] || 0) + 1;
    const table =
      kind === 1
        ? originalTables.items
        : kind === 2
          ? originalTables.weapons
          : originalTables.armors;
    names.push(String(table[id]?.name || id));
  }
  if (killed) {
    if (enemyId === 198) actor.badmanKill = (actor.badmanKill || 0) + 1;
    else {
      actor.killList = Array.from(
        new Set([...(actor.killList || []), enemyId]),
      );
      if (enemyId < 163 || enemyId > 170) {
        const morals = Number(enemy.morals || 0);
        actor.morals -=
          actor.morals >= 128
            ? morals
            : morals > 0
              ? Math.floor(morals / 2)
              : 0;
      }
    }
  }
  const execution = killed
    ? enemyId === 198
      ? `通缉犯伏诛，追杀数增至 ${actor.badmanKill || 0}。`
      : `已将${String(enemy.name || "对手")}斩首，击杀记录 ${actor.killList?.length || 0} 人，名声 ${actor.morals}。`
    : "对手被你放走了。";
  return {
    gold: Number(enemy.gold || 0),
    items: names,
    text: `${execution} 获得银两 ${Number(enemy.gold || 0)}${names.length ? `，战利品：${names.join("、")}` : ""}。`,
  };
}
