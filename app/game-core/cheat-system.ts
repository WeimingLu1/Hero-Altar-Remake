import type { SceneActorState } from "./scene-event";
import { fullHp } from "./inventory-system";
import { originalTables } from "./original-data";

export type CheatQuickAction =
  | "recover"
  | "gold"
  | "experience"
  | "potential"
  | "attributes"
  | "skills5"
  | "master"
  | "maxAll";

export const cheatQuickOptions: Array<{
  id: CheatQuickAction;
  name: string;
  detail: string;
  dangerous?: boolean;
}> = [
  {
    id: "recover",
    name: "补满全部状态",
    detail: "气血、内力、法力、食物和饮水全部补满",
  },
  { id: "gold", name: "金钱 +100,000", detail: "立即增加十万两" },
  { id: "experience", name: "经验 +100,000", detail: "立即增加十万实战经验" },
  { id: "potential", name: "潜能 +10,000", detail: "立即增加一万潜能" },
  {
    id: "attributes",
    name: "先天四维设为 30",
    detail: "膂力、敏捷、悟性、根骨达到创建上限",
  },
  {
    id: "skills5",
    name: "已学功夫全部 +5",
    detail: "对应原版作弊菜单的单次提升",
  },
  {
    id: "master",
    name: "一键宗师",
    detail: "百万资源、五千内法、四维 30、已学功夫 255",
    dangerous: true,
  },
  {
    id: "maxAll",
    name: "全参数理论 MAX",
    detail: "全部资源、属性、容貌、福缘、年龄与已学功夫达到数据上限",
    dangerous: true,
  },
];

const cap = (value: number, maximum: number) =>
  Math.max(0, Math.min(maximum, Math.floor(value)));

export function applyCheatQuick(
  actor: SceneActorState,
  action: CheatQuickAction,
) {
  if (action === "recover") {
    actor.maxHp = fullHp(actor);
    actor.hp = actor.maxHp;
    actor.fp = actor.maxFp;
    actor.mp = actor.maxMp;
    actor.food = (actor.baseStr + 5) * 15;
    actor.water = (actor.baseStr + 4) * 15;
    return "全部状态已经补满。";
  }
  if (action === "gold") actor.gold = cap(actor.gold + 100000, 4294967295);
  if (action === "experience") actor.exp = cap(actor.exp + 100000, 4294967295);
  if (action === "potential")
    actor.potential = cap(actor.potential + 10000, 4294967295);
  if (action === "attributes" || action === "master" || action === "maxAll") {
    const value = action === "maxAll" ? 255 : 30;
    actor.baseStr = actor.str = value;
    actor.baseAgi = actor.agi = value;
    actor.baseInt = actor.int = value;
    actor.baseBon = actor.bon = value;
  }
  if (action === "skills5" || action === "master" || action === "maxAll")
    for (const skill of Object.values(actor.skills))
      skill.level =
        action === "master" || action === "maxAll"
          ? 255
          : Math.min(255, skill.level + 5);
  if (action === "master") {
    actor.gold = Math.max(actor.gold, 1000000);
    actor.exp = Math.max(actor.exp, 1000000);
    actor.potential = Math.max(actor.potential, 1000000);
    actor.maxFp = Math.max(actor.maxFp, 5000);
    actor.maxMp = Math.max(actor.maxMp, 5000);
    applyCheatQuick(actor, "recover");
    return "宗师秘技生效：资源、属性和已学功夫已经强化。";
  }
  if (action === "maxAll") {
    for (let index = 0; index < cheatStats.length; index++)
      maxCheatStat(actor, index);
    applyCheatQuick(actor, "recover");
    return "全参数已经达到理论上限。";
  }
  return (
    cheatQuickOptions.find((item) => item.id === action)?.name || "秘技生效。"
  );
}

export const cheatStats = [
  { key: "gold", name: "金钱", step: 10000, max: 4294967295 },
  { key: "exp", name: "经验", step: 10000, max: 4294967295 },
  { key: "potential", name: "潜能", step: 1000, max: 4294967295 },
  { key: "maxFp", name: "内力上限", step: 100, max: 65535 },
  { key: "maxMp", name: "法力上限", step: 100, max: 65535 },
  { key: "morals", name: "名声／道德", step: 10, max: 255 },
  { key: "face", name: "容貌", step: 1, max: 255 },
  { key: "luck", name: "福缘", step: 1, max: 255 },
  { key: "age", name: "年龄", step: 1, max: 255 },
] as const;

export function adjustCheatStat(
  actor: SceneActorState,
  index: number,
  direction: -1 | 1,
) {
  const stat = cheatStats[index];
  if (!stat) return "没有这个数值。";
  const key = stat.key as keyof SceneActorState,
    current = Number(actor[key] || 0),
    value = cap(current + stat.step * direction, stat.max);
  (actor as unknown as Record<string, unknown>)[key] = value;
  return `${stat.name}调整为 ${value}。`;
}

export function maxCheatStat(actor: SceneActorState, index: number) {
  const stat = cheatStats[index];
  if (!stat) return "没有这个数值。";
  (actor as unknown as Record<string, unknown>)[stat.key] = stat.max;
  return `${stat.name}已经达到理论上限 ${stat.max}。`;
}

export function cheatSkillRows(actor: SceneActorState) {
  return Object.entries(actor.skills)
    .filter(([, skill]) => skill.level > 0)
    .map(([raw, skill]) => ({
      id: Number(raw),
      name: String(originalTables.kungfus[Number(raw)]?.name || raw),
      level: skill.level,
    }));
}

export function adjustCheatSkill(
  actor: SceneActorState,
  id: number,
  direction: -1 | 1,
) {
  const skill = actor.skills[String(id)];
  if (!skill) return "尚未学会这门功夫。";
  skill.level = Math.max(1, Math.min(255, skill.level + direction * 5));
  skill.points = 0;
  return `${originalTables.kungfus[id]?.name || id}调整为 ${skill.level} 级。`;
}

export function maxCheatSkill(actor: SceneActorState, id: number) {
  const skill = actor.skills[String(id)];
  if (!skill) return "尚未学会这门功夫。";
  skill.level = 255;
  skill.points = 0;
  return `${originalTables.kungfus[id]?.name || id}已经达到返璞归真 255 级。`;
}
