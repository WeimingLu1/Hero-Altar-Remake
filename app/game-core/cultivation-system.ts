import type { SceneActorState } from "./scene-event";
import { fullHp } from "./inventory-system";
import { effectiveLevel } from "./skill-system";

const forceId = (actor: SceneActorState) => actor.skillUse[3] || 1;
const magicId = (actor: SceneActorState) => actor.skillUse[5] || 8;
const capacity = (actor: SceneActorState, level: number) =>
  Math.min(
    65535,
    level * 10 +
      Math.floor(actor.exp / 1000) +
      (Math.min(actor.age, 60) - 14) * actor.baseBon,
  );

export const fullFp = (actor: SceneActorState) =>
  capacity(actor, effectiveLevel(actor, forceId(actor)));
export const fullMp = (actor: SceneActorState) =>
  capacity(actor, effectiveLevel(actor, magicId(actor)));

function cultivate(
  actor: SceneActorState,
  kind: "fp" | "mp",
): { ok: boolean; increased: boolean; capped: boolean } {
  const id = kind === "fp" ? forceId(actor) : magicId(actor);
  if (id < 12) return { ok: false, increased: false, capped: false };
  const level = effectiveLevel(actor, id),
    current = kind === "fp" ? actor.fp : actor.mp,
    maximum = kind === "fp" ? actor.maxFp : actor.maxMp,
    value = current + Math.floor(level / 10) + Math.floor(actor.bon / 5),
    doubleMaximum = Math.max(1, Math.min(maximum * 2, 65535));
  if (kind === "fp") actor.fp = value;
  else actor.mp = value;
  if (value <= doubleMaximum)
    return { ok: true, increased: false, capped: false };
  const limit = kind === "fp" ? fullFp(actor) : fullMp(actor),
    nextMaximum = maximum + 1;
  if (nextMaximum > limit) {
    if (kind === "fp") actor.fp = actor.maxFp;
    else actor.mp = actor.maxMp;
    return { ok: true, increased: false, capped: true };
  }
  if (kind === "fp") {
    actor.maxFp = nextMaximum;
    actor.fp = 0;
  } else {
    actor.maxMp = nextMaximum;
    actor.mp = 0;
  }
  return { ok: true, increased: true, capped: false };
}

export const meditateForce = (actor: SceneActorState) => cultivate(actor, "fp");
export const meditateMagic = (actor: SceneActorState) => cultivate(actor, "mp");

export function setForcePower(actor: SceneActorState, value: number) {
  const maximum = Math.floor(effectiveLevel(actor, forceId(actor)) / 2);
  actor.fpPlus = Math.max(0, Math.min(Math.floor(value), maximum));
  return actor.fpPlus;
}

export function setMagicPower(actor: SceneActorState, value: number) {
  const maximum = Math.floor(effectiveLevel(actor, magicId(actor)) / 2);
  actor.mpPlus = Math.max(0, Math.min(Math.floor(value), maximum));
  return actor.mpPlus;
}

export function recoverHp(actor: SceneActorState) {
  const level = effectiveLevel(actor, forceId(actor));
  if (actor.fp < 20 || actor.hp === actor.maxHp) return false;
  const missing = actor.maxHp - actor.hp,
    factor = 10 + Math.floor(level / 15);
  let cost = Math.floor((missing * 20) / factor) + 1;
  if (cost > actor.fp) {
    cost = actor.fp;
    actor.hp += Math.floor((cost * factor) / 20);
  } else actor.hp = actor.maxHp;
  actor.fp -= cost;
  return true;
}

export function healWounds(actor: SceneActorState) {
  const level = effectiveLevel(actor, forceId(actor)),
    healthy = fullHp(actor);
  if (
    level < 45 ||
    actor.maxFp < 150 ||
    actor.fp < 100 ||
    actor.maxHp === healthy ||
    actor.maxHp < Math.floor(healthy / 3)
  )
    return false;
  actor.maxHp = Math.min(healthy, actor.maxHp + 10 + Math.floor(level / 5));
  actor.fp -= 50;
  return true;
}
