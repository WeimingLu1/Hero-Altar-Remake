import type { SceneActorState } from "./scene-event";
import { fullHp } from "./inventory-system";
import { effectiveLevel } from "./skill-system";

/** One invocation of the original global `digesting` loop (15 real seconds). */
export function digestActor(actor: SceneActorState, consume = true) {
  actor.playTime = (actor.playTime || 0) + 15;
  if (actor.playTime >= 43200) {
    actor.age += 1;
    actor.playTime -= 43200;
  }
  if (!consume) return actor;

  if (actor.food > 0 && actor.water > 0) {
    if (actor.hp < actor.maxHp) {
      actor.hp = Math.min(
        actor.maxHp,
        actor.hp + Math.floor(actor.bon / 2) + Math.floor(actor.maxFp / 16),
      );
    } else if (actor.maxHp < fullHp(actor)) {
      actor.maxHp += 1;
    }
    if (actor.fp < actor.maxFp) {
      actor.fp = Math.min(
        actor.maxFp,
        actor.fp + effectiveLevel(actor, actor.skillUse[3] || 1),
      );
    }
    if (actor.mp < actor.maxMp) {
      actor.mp = Math.min(
        actor.maxMp,
        actor.mp + effectiveLevel(actor, actor.skillUse[5] || 8),
      );
    }
  }
  actor.food = Math.max(0, actor.food - 1);
  actor.water = Math.max(0, actor.water - 1);
  return actor;
}
