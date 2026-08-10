import type { SceneActorState } from "./scene-event";
import { fullHp } from "./inventory-system";
import { originalSystem, originalTables } from "./original-data";
import { effectiveLevel } from "./skill-system";
import { MAX_PLAYER_EXP } from "./progression-limits";

// 玩家可通过物品(如王蛇胆 add_mfp)无上限堆内力上限到 65535、气血随之到 ~16783；
// 修改器上限与规则一致，允许玩家设置到可达极限。
const MAX_INNER = 65535;
const maxAchievableHp = (actor: SceneActorState) => {
  let value =
    100 + Math.floor(MAX_INNER / 4) + (Math.min(actor.age, 29) - 14) * 20;
  if (
    actor.classId === 3 &&
    (actor.skills["27"]?.level || 0) >= 80 &&
    actor.age >= 20
  )
    value += Math.floor(((actor.skills["27"]?.level || 0) * actor.baseBon) / 10);
  return value;
};

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
    detail: "百万资源、满内力/法力上限、四维 30、已学功夫 255",
    dangerous: true,
  },
  {
    id: "maxAll",
    name: "全参数 MAX",
    detail: "资源、属性、容貌、福缘与已学功夫达到规则上限，保留当前年龄",
    dangerous: true,
  },
];

const cap = (value: number, maximum: number, minimum = 0) =>
  Math.max(minimum, Math.min(maximum, Math.floor(Number.isFinite(value) ? value : minimum)));

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
  if (action === "experience") actor.exp = cap(actor.exp + 100000, MAX_PLAYER_EXP);
  if (action === "potential")
    actor.potential = cap(actor.potential + 10000, 4294967295);
  if (action === "attributes" || action === "master" || action === "maxAll") {
    const value = 30;
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
    actor.exp = MAX_PLAYER_EXP; // 满级经验，命中率不被宗师 NPC 的经验压制
    actor.potential = Math.max(actor.potential, 1000000);
    actor.maxFp = Math.max(actor.maxFp, MAX_INNER);
    actor.maxMp = Math.max(actor.maxMp, MAX_INNER);
    // 把加力/法点直接提到内功/法术有效等级的一半（否则初始 0 会被 clamp 保持为 0）
    actor.fpPlus = cheatStatMaximum(
      actor,
      cheatStats.findIndex((stat) => stat.key === "fpPlus"),
    );
    actor.mpPlus = cheatStatMaximum(
      actor,
      cheatStats.findIndex((stat) => stat.key === "mpPlus"),
    );
    applyCheatQuick(actor, "recover");
    return "宗师秘技生效：资源、属性和已学功夫已经强化。";
  }
  if (action === "maxAll") {
    for (let index = 0; index < cheatStats.length; index++)
      if (cheatStats[index].key !== "age") maxCheatStat(actor, index);
    clampModifierPower(actor);
    applyCheatQuick(actor, "recover");
    return "全参数已经达到规则上限，年龄保持不变。";
  }
  return (
    cheatQuickOptions.find((item) => item.id === action)?.name || "秘技生效。"
  );
}

export const cheatStats = [
  { key: "hp", name: "当前气血", group: "状态", step: 100, max: 65535 },
  { key: "maxHp", name: "气血上限", group: "状态", step: 100, max: 65535 },
  { key: "fp", name: "当前内力", group: "状态", step: 100, max: 65535 },
  { key: "maxFp", name: "内力上限", group: "状态", step: 100, max: 65535 },
  { key: "mp", name: "当前法力", group: "状态", step: 100, max: 65535 },
  { key: "maxMp", name: "法力上限", group: "状态", step: 100, max: 65535 },
  { key: "food", name: "饱食", group: "状态", step: 10, max: 65535 },
  { key: "water", name: "饮水", group: "状态", step: 10, max: 65535 },
  { key: "gold", name: "金钱", group: "资源", step: 10000, max: 4294967295 },
  { key: "exp", name: "经验", group: "资源", step: 10000, max: MAX_PLAYER_EXP },
  { key: "potential", name: "潜能", group: "资源", step: 1000, max: 4294967295 },
  { key: "morals", name: "名声／道德", group: "身份", step: 10, max: 255 },
  { key: "face", name: "容貌", group: "身份", step: 1, max: 255 },
  { key: "luck", name: "福缘", group: "身份", step: 1, max: 255 },
  { key: "age", name: "年龄", group: "身份", step: 1, min: 1, max: 255 },
  { key: "baseStr", name: "先天膂力", group: "四维", step: 1, max: 30 },
  { key: "baseAgi", name: "先天敏捷", group: "四维", step: 1, max: 30 },
  { key: "baseInt", name: "先天悟性", group: "四维", step: 1, max: 30 },
  { key: "baseBon", name: "先天根骨", group: "四维", step: 1, max: 30 },
  { key: "fpPlus", name: "加力", group: "战斗", step: 1, max: 32767 },
  { key: "mpPlus", name: "法点", group: "战斗", step: 1, max: 32767 },
  { key: "tanId", name: "九坛进度", group: "进度", step: 1, max: 9 },
  { key: "badmanKill", name: "追杀计数", group: "进度", step: 1, max: 65535 },
  { key: "taskKill", name: "杀手计数", group: "进度", step: 1, max: 65535 },
  { key: "killNum", name: "通缉轮次", group: "进度", step: 1, max: 10 },
  { key: "dance", name: "跳舞纪录", group: "进度", step: 10, max: 65535 },
  { key: "ball", name: "投球纪录", group: "进度", step: 10, max: 65535 },
  { key: "roomLevel", name: "房屋等级", group: "家园", step: 1, max: 3 },
  { key: "forgeChallengeStep", name: "铸剑挑战轮次", group: "铸剑", step: 1, max: 4 },
] as const;

export function cheatStatMaximum(actor: SceneActorState, index: number) {
  const stat = cheatStats[index];
  if (!stat) return 0;
  if (stat.key === "hp") return actor.maxHp;
  if (stat.key === "fp") return actor.maxFp;
  if (stat.key === "mp") return actor.maxMp;
  // 上限对齐规则可达值：内力/法力可通过物品堆到 65535，气血随之到 ~16783
  if (stat.key === "maxHp") return maxAchievableHp(actor);
  if (stat.key === "maxFp") return MAX_INNER;
  if (stat.key === "maxMp") return MAX_INNER;
  if (stat.key === "food") return (actor.baseStr + 5) * 15;
  if (stat.key === "water") return (actor.baseStr + 4) * 15;
  if (stat.key === "fpPlus")
    return Math.floor(effectiveLevel(actor, actor.skillUse[3] || 1) / 2);
  if (stat.key === "mpPlus")
    return Math.floor(effectiveLevel(actor, actor.skillUse[5] || 8) / 2);
  return stat.max;
}

function clampModifierPower(actor: SceneActorState) {
  for (const key of ["fpPlus", "mpPlus"] as const) {
    const index = cheatStats.findIndex((stat) => stat.key === key);
    setCheatStat(actor, index, actor[key]);
  }
}

export function setCheatStat(actor: SceneActorState, index: number, raw: number) {
  const stat = cheatStats[index];
  if (!stat) return "没有这个数值。";
  const value = cap(raw, cheatStatMaximum(actor, index), "min" in stat ? stat.min : 0);
  (actor as unknown as Record<string, unknown>)[stat.key] = value;
  if (stat.key === "baseStr") actor.str = value;
  if (stat.key === "baseAgi") actor.agi = value;
  if (stat.key === "baseInt") actor.int = value;
  if (stat.key === "baseBon") actor.bon = value;
  if (stat.key === "maxHp") actor.hp = Math.min(actor.hp, value);
  if (stat.key === "maxFp") actor.fp = Math.min(actor.fp, value);
  if (stat.key === "maxMp") actor.mp = Math.min(actor.mp, value);
  return `${stat.name}调整为 ${value}（允许范围 ${"min" in stat ? stat.min : 0}–${cheatStatMaximum(actor, index)}）。`;
}

export function adjustCheatStat(
  actor: SceneActorState,
  index: number,
  direction: -1 | 1,
) {
  const stat = cheatStats[index];
  if (!stat) return "没有这个数值。";
  const key = stat.key as keyof SceneActorState,
    current = Number(actor[key] || 0);
  return setCheatStat(actor, index, current + stat.step * direction);
}

export function maxCheatStat(actor: SceneActorState, index: number) {
  const stat = cheatStats[index];
  if (!stat) return "没有这个数值。";
  const maximum = cheatStatMaximum(actor, index);
  setCheatStat(actor, index, maximum);
  return `${stat.name}已经达到理论上限 ${maximum}。`;
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

export function setCheatSkill(actor: SceneActorState, id: number, raw: number) {
  if (!originalTables.kungfus[id]) return "没有这门功夫。";
  const level = cap(raw, 255, 1);
  actor.skills[String(id)] = { level, points: 0 };
  return `${originalTables.kungfus[id]?.name || id}调整为 ${level} 级（允许范围 1–255）。`;
}

export function removeCheatSkill(actor: SceneActorState, id: number) {
  if (!actor.skills[String(id)]) return "尚未学会这门功夫。";
  delete actor.skills[String(id)];
  actor.skillUse = actor.skillUse.map((skillId) => skillId === id ? 0 : skillId);
  return `已经移除${originalTables.kungfus[id]?.name || id}，并解除相关运用。`;
}

export type CheatInventoryKind = 1 | 2 | 3;
export function cheatInventoryCatalog(kind: CheatInventoryKind) {
  const table = kind === 1 ? originalTables.items : kind === 2 ? originalTables.weapons : originalTables.armors;
  return table.flatMap((record, id) => record ? [{ id, name: String(record.name || id) }] : []);
}

export function setCheatInventory(actor: SceneActorState, kind: CheatInventoryKind, id: number, raw: number) {
  const table = kind === 1 ? originalTables.items : kind === 2 ? originalTables.weapons : originalTables.armors;
  if (!table[id]) return "没有这个物品。";
  const key = `${kind}:${id}`, amount = cap(raw, kind === 1 ? 255 : 1);
  if (amount === 0) {
    delete actor.inventory[key];
    if (kind === 2 && actor.weaponId === id) actor.weaponId = 0;
    if (kind === 3) actor.armorIds = actor.armorIds.filter((armorId) => armorId !== id);
    return `已经移除${table[id]?.name || id}。`;
  }
  actor.inventory[key] = amount;
  return `${table[id]?.name || id}数量调整为 ${amount}（允许范围 0–${kind === 1 ? 255 : 1}）。`;
}

export function addCheatInventory(actor: SceneActorState, kind: CheatInventoryKind, id: number, raw: number) {
  const amount = cap(raw, kind === 1 ? 255 : 1, 1),
    current = actor.inventory[`${kind}:${id}`] || 0;
  return setCheatInventory(actor, kind, id, kind === 1 ? current + amount : 1);
}

export const cheatSchools = (originalSystem.school as string[]) || [];
export const cheatTeachers = originalTables.enemies.flatMap((npc, id) =>
  npc && (Number(npc.type || 0) > 0 || id === 7 || id === 31)
    ? [{ id, name: String(npc.name || id), schoolId: Math.max(0, Number(npc.type || 0)) }]
    : [],
);

export function setCheatIdentity(actor: SceneActorState, schoolId: number, teacherId: number) {
  actor.classId = cap(schoolId, Math.max(0, cheatSchools.length - 1));
  actor.teacherId = teacherId > 0 && originalTables.enemies[teacherId] ? teacherId : 0;
  return `身份调整为${cheatSchools[actor.classId] || "江湖小虾"}，师父${actor.teacherId ? originalTables.enemies[actor.teacherId]?.name : "无"}。`;
}

export function reviveCheatNpc(actor: SceneActorState, id: number) {
  const before = actor.killList || [];
  if (!before.includes(id)) return "该人物不在已击杀名单中。";
  actor.killList = before.filter((npcId) => npcId !== id);
  return `${originalTables.enemies[id]?.name || id}已经复活，会重新出现在原地图。`;
}
