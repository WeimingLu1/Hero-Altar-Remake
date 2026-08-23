import { originalTables } from "./original-data";
import type { SceneActorState } from "./scene-event";

export function settleVictoryLoot(
  actor: SceneActorState,
  enemyId: number,
  killed: boolean,
  // 战斗中被落英缤纷缴械时传入 0：原作掉落读战斗实例 @weapon_id(026 - Game_Enemy
  // .rb item_list)，被卷走兵刃的敌人不再掉兵器。
  currentWeaponId?: number,
) {
  const enemy = originalTables.enemies[enemyId] || {},
    drops: number[][] = [],
    weaponId = Math.max(0, Math.floor(currentWeaponId ?? Number(enemy.weapon_id || 0)));
  if (weaponId > 0) drops.push([2, weaponId]);
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
      // 坛地图由对应坛主(163–170)砍头后按故事顺序掉落下一张；
      // 青龙坛地图(21)由村长直接赠送。手下留情与普通敌人不产出坛地图。
      if (!killed || !(enemyId >= 163 && enemyId <= 170)) continue;
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
