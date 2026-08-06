import { originalTables } from "./original-data";
import type { SceneActorState } from "./scene-event";

const bagCount = (actor: SceneActorState) =>
  Object.values(actor.inventory).filter((amount) => amount > 0).length;

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
      if (!actor.stoneList.includes(enemyId)) actor.stoneList.push(enemyId);
      continue;
    }
    if (kind === 1 && id >= 21 && id <= 28 && actor.tanId + 20 !== id) continue;
    const key = `${kind}:${id}`;
    if (!actor.inventory[key] && bagCount(actor) >= 20) continue;
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
    actor.killList = Array.from(new Set([...(actor.killList || []), enemyId]));
    const morals = Number(enemy.morals || 0);
    actor.morals -=
      actor.morals >= 128 ? morals : morals > 0 ? Math.floor(morals / 2) : 0;
  }
  return {
    gold: Number(enemy.gold || 0),
    items: names,
    text: `获得银两 ${Number(enemy.gold || 0)}${names.length ? `，战利品：${names.join("、")}` : ""}。`,
  };
}
