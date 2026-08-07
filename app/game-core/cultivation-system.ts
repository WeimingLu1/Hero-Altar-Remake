import type { SceneActorState } from "./scene-event";
import { fullHp } from "./inventory-system";
import { effectiveLevel } from "./skill-system";
import { originalTables } from "./original-data";

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

export type CultivationAvailability = {
  ok: boolean;
  text: string;
  requirement: string;
};

export function cultivationAvailability(
  actor: SceneActorState,
  action: "meditate" | "magic" | "recover" | "heal" | "force" | "spell",
): CultivationAvailability {
  const innerLevel = effectiveLevel(actor, forceId(actor));
  if (action === "magic" || action === "spell") {
    if (magicId(actor) < 12)
      return {
        ok: false,
        text: "你尚未装备法术。",
        requirement: "需先在功夫页运用一门法术",
      };
    return {
      ok: true,
      text: action === "magic" ? "可以开始冥思。" : "可以调整法点。",
      requirement:
        action === "magic"
          ? `已装备法术 · 有效等级 ${effectiveLevel(actor, magicId(actor))}`
          : `范围 0–${Math.floor(effectiveLevel(actor, magicId(actor)) / 2)}`,
    };
  }
  if (forceId(actor) < 12)
    return {
      ok: false,
      text: "你尚未装备内功。",
      requirement: "需先在功夫页运用一门内功",
    };
  if (action === "recover") {
    if (actor.fp < 20)
      return {
        ok: false,
        text: "你的内力不足。",
        requirement: "当前内力至少 20",
      };
    if (actor.hp === actor.maxHp)
      return {
        ok: false,
        text: "你的气血已经全满。",
        requirement: "气血未满时可用",
      };
    return {
      ok: true,
      text: "可以吸气恢复气血。",
      requirement: "消耗量按缺失气血计算",
    };
  }
  if (action === "heal") {
    const healthy = fullHp(actor);
    if (innerLevel < 45)
      return {
        ok: false,
        text: "你的内功修为不足以疗伤。",
        requirement: "内功有效等级至少 45",
      };
    if (actor.maxFp < 150)
      return {
        ok: false,
        text: "你的内力上限不足。",
        requirement: "内力上限至少 150",
      };
    if (actor.fp < 100)
      return {
        ok: false,
        text: "你的内力不足。",
        requirement: "当前内力至少 100；成功消耗 50",
      };
    if (actor.maxHp === healthy)
      return {
        ok: false,
        text: "你目前并未受伤。",
        requirement: "气血上限低于健康上限时可用",
      };
    if (actor.maxHp < Math.floor(healthy / 3))
      return {
        ok: false,
        text: "你伤势过重，无法自行运功疗伤。",
        requirement: "当前气血上限不得低于健康上限三分之一",
      };
    return {
      ok: true,
      text: "可以运功疗伤。",
      requirement: "成功恢复伤势上限并消耗 50 内力",
    };
  }
  return {
    ok: true,
    text: action === "meditate" ? "可以开始打坐。" : "可以调整加力。",
    requirement:
      action === "meditate"
        ? `已装备内功 · 有效等级 ${innerLevel}`
        : `范围 0–${Math.floor(innerLevel / 2)}`,
  };
}

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

export function practiceOptions(actor: SceneActorState) {
  return [...new Set(actor.skillUse.slice(0, 3))]
    .filter((id) => id > 11 && actor.skills[String(id)])
    .map((id) => ({
      id,
      name: String(originalTables.kungfus[id]?.name || id),
      level: actor.skills[String(id)].level,
    }));
}

export function practiceOnce(actor: SceneActorState, id: number) {
  const skill = actor.skills[String(id)],
    type = Number(originalTables.kungfus[id]?.type || 0),
    basic = actor.skills[String(type)],
    healthy = fullHp(actor);
  if (!skill || id < 12) return { ok: false, text: "这门功夫无法练习。" };
  if (actor.maxHp < healthy)
    return { ok: false, text: "你身上有伤，无法专心练功。" };
  if (type !== 9) {
    if (actor.weaponId > 0) {
      const weaponBasic =
        Number(originalTables.weapons[actor.weaponId]?.type || 0) + 3;
      if (type !== weaponBasic)
        return { ok: false, text: "手中兵器与这门功夫不合。" };
    } else if (type !== 2)
      return { ok: false, text: "这门功夫需要配合相应兵器。" };
  }
  if (!basic || basic.level === 0)
    return { ok: false, text: "相应的基本功夫尚未学会。" };
  if (basic.level < skill.level || skill.level === 255)
    return { ok: false, text: "基本功夫不足，暂时无法继续练习。" };
  if (actor.exp < Math.floor(skill.level ** 3 / 10))
    return { ok: false, text: "实战经验不足，无法领悟下一层。" };
  if (actor.maxFp < effectiveLevel(actor, id) * 10)
    return { ok: false, text: "内力修为不足，无法继续练功。" };
  skill.points += Math.floor(basic.level / 5) + 1;
  const needed = (skill.level + 1) ** 2;
  if (skill.points >= needed) {
    skill.level += 1;
    skill.points = 0;
    return {
      ok: true,
      leveled: true,
      text: `${originalTables.kungfus[id]?.name}提高到 ${skill.level} 级。`,
    };
  }
  return {
    ok: true,
    leveled: false,
    text: `${originalTables.kungfus[id]?.name}：${skill.points}/${needed}`,
  };
}
