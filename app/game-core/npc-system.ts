import {
  originalTables,
  originalTasks,
  originalText,
  type OriginalRecord,
} from "./original-data";
import npcTeachingJson from "../../game-data/npc-teaching.json";
import { derivedStats } from "./inventory-system";
import type { SceneActorState } from "./scene-event";
import { npcLoreStatus } from "./npc-lore";

export type NpcOption =
  "talk" | "status" | "battle" | "trade" | "join" | "study" | "forge";
export type ShopGood = {
  kind: 1 | 2 | 3;
  id: number;
  name: string;
  price: number;
  description: string;
};
const rec = (v: unknown) => (v || {}) as Record<string, unknown>;
const enemy = (id: number) => originalTables.enemies[id] || {};
const table = (kind: number) =>
  kind === 1
    ? originalTables.items
    : kind === 2
      ? originalTables.weapons
      : originalTables.armors;

export function npcOptions(id: number, actor: SceneActorState): NpcOption[] {
  const npc = enemy(id),
    type = Number(npc.type || 0);
  const result: NpcOption[] = ["talk", "status", "battle"];
  if (type === -1) result.push("trade");
  else if (type > 0) result.push(actor.teacherId === id ? "study" : "join");
  else if (id === 7 || id === 31) result.push("study");
  // 干匠(148)：铸剑挑战入口。
  if (id === 148) result.push("forge");
  return result;
}
export const npcOptionLabel: Record<NpcOption, string> = {
  talk: "交谈",
  status: "查看",
  battle: "战斗",
  trade: "交易",
  join: "拜师",
  study: "请教",
  forge: "铸剑",
};

export function npcStatus(id: number) {
  const npc = enemy(id),
    description = ((npc.des_text as string[]) || []).filter(Boolean).join(""),
    equipment = [
      Number(npc.weapon_id || 0) > 0
        ? `武器·${originalTables.weapons[Number(npc.weapon_id)]?.name || npc.weapon_id}`
        : "",
      Number(npc.armor_id || 0) > 0
        ? `防具·${originalTables.armors[Number(npc.armor_id)]?.name || npc.armor_id}`
        : "",
    ].filter(Boolean),
    carried = [npc.item1, npc.item2, npc.item3, npc.item4]
      .filter((entry): entry is number[] => Array.isArray(entry))
      .map(([kind, itemId]) =>
        kind > 0 && itemId > 0 ? String(table(kind)[itemId]?.name || "") : "",
      )
      .filter(Boolean),
    goods = ((npc.sell_item as number[][]) || [])
      .map(([kind, itemId]) => String(table(kind)[itemId]?.name || ""))
      .filter(Boolean),
    skills = ((npc.skill_list as number[][]) || [])
      .map(
        ([skillId, level]) =>
          `${originalTables.kungfus[skillId]?.name || `功夫${skillId}`} ${level}级`,
      )
      .filter(Boolean),
    activeSkills = [...new Set((npc.skill_use as number[]) || [])]
      .filter((skillId) => skillId > 0)
      .map((skillId) => String(originalTables.kungfus[skillId]?.name || skillId));
  return [
    `【${npc.name || "无名氏"}】${Number(npc.gender) === 1 ? "女" : "男"} · ${npc.age || 0}岁`,
    description ? `人物描述：${description}` : "人物描述：此人沉默寡言，来历不明。",
    ...npcLoreStatus(id),
    `气血 ${npc.hp || 0}/${npc.maxhp || 0} · 内力 ${npc.fp || 0}/${npc.maxfp || 0} · 法力 ${npc.mp || 0}/${npc.maxmp || 0}`,
    `实战四维：膂力 ${npc.str || 0} · 敏捷 ${npc.agi || 0} · 悟性 ${npc.int || 0} · 根骨 ${npc.bon || npc.base_bon || 0}`,
    `先天四维：膂力 ${npc.base_str || 0} · 敏捷 ${npc.base_agi || 0} · 悟性 ${npc.base_int || 0} · 根骨 ${npc.base_bon || 0}`,
    `攻击 ${npc.atk || npc.base_atk || 0} · 防御 ${npc.pdef || npc.base_def || 0} · 闪避 ${npc.eva || npc.base_eva || 0} · 命中 ${npc.base_hit || 0}`,
    `加力 ${npc.fp_plus || 0} · 法点 ${npc.mp_plus || 0} · 外貌 ${npc.base_fac || 0} · 福缘 ${npc.base_luc || 0}`,
    `经验 ${npc.exp || 0} · 银两 ${npc.gold || 0} · 道德 ${npc.morals || 0} · 掉落率 ${npc.treasure_prob || 0}%`,
    `装备：${equipment.length ? equipment.join("、") : "无"}`,
    `携带物品：${carried.length ? [...new Set(carried)].join("、") : "无"}`,
    `武功：${skills.length ? skills.join("、") : "未显露武功"}`,
    `正在运用：${activeSkills.length ? activeSkills.join("、") : "基本功夫"}`,
    ...(goods.length ? [`出售货物：${goods.join("、")}`] : []),
  ];
}

export function shopGoods(id: number): ShopGood[] {
  return ((enemy(id).sell_item as number[][]) || []).map(([kind, itemId]) => {
    const item = table(kind)[itemId] || {};
    return {
      kind: kind as 1 | 2 | 3,
      id: itemId,
      name: String(item.name || itemId),
      price: Number(item.price || 0),
      description: String(item.description || ""),
    };
  });
}
export function buyGood(actor: SceneActorState, good: ShopGood, amount = 1) {
  amount = good.kind === 1 ? Math.max(1, Math.min(255, amount)) : 1;
  const cost = good.price * amount;
  if (actor.gold < cost)
    return {
      ok: false,
      text: String(originalText.learn_no_gold || "你的银两不够。"),
    };
  actor.gold -= cost;
  const key = `${good.kind}:${good.id}`;
  actor.inventory[key] = (actor.inventory[key] || 0) + amount;
  return {
    ok: true,
    text: `买下${good.name}${amount > 1 ? ` × ${amount}` : ""}，花费 ${cost} 两。`,
  };
}

function condition(actor: SceneActorState, type: number, num: number) {
  if (type === 0) return true;
  if (type > 0) return (actor.skills[String(type)]?.level || 0) >= num;
  if (type === -1) return actor.gender === num;
  if (type === -2) return actor.maxFp >= num;
  if (type === -3) return actor.face >= num;
  if (type === -12) return actor.maxMp >= num;
  const derived = derivedStats(actor);
  const attrs = [
    actor.baseBon,
    actor.baseInt,
    actor.baseAgi,
    actor.baseStr,
    derived.bon,
    derived.int,
    derived.agi,
    derived.str,
  ];
  if (type >= -11 && type <= -4) {
    const value = attrs[type + 11];
    return num < 0 ? value <= Math.abs(num) : value >= num;
  }
  return false;
}
export function attemptJoin(id: number, actor: SceneActorState) {
  const targetSchool = Number(enemy(id).type || 0);
  if (actor.classId === 9)
    return {
      ok: false,
      text: String((originalText.have_school as string[])?.[0] || "你已经自立门户，不能再拜入他门。"),
    };
  if (actor.classId !== 0 && actor.classId !== targetSchool)
    return {
      ok: false,
      text: String((originalText.have_school as string[])?.[1] || "你已经加入其他门派。"),
    };
  const needs = (rec(originalTasks.teacher_need)[String(id)] as number[][]) || [
      [0, 0],
    ],
    texts = (rec(originalText.baishi_text)[String(id)] as string[]) || [
      "你我无师徒之缘。",
      "很好，从今以后你就是我的弟子。",
    ];
  let failed = -1;
  for (let i = 0; i < needs.length; i++) {
    const row = needs[i],
      ok = row.some(
        (_, j) => j % 2 === 0 && condition(actor, row[j], row[j + 1]),
      );
    if (!ok) {
      failed = i;
      break;
    }
  }
  if (failed >= 0)
    return { ok: false, text: texts[Math.min(failed, texts.length - 1)] };
  actor.teacherId = id;
  actor.classId = Number(enemy(id).type || 0);
  return {
    ok: true,
    text: String(texts[texts.length - 1] || "").replaceAll(
      "name",
      String(enemy(id).name || "师父"),
    ),
  };
}

export function canStudyWithNpc(id: number, actor: SceneActorState) {
  if (id === 7 && actor.exp < 200000)
    return {
      ok: false,
      text: String(originalText.daxia_exp || "你的江湖阅历尚不足以向独行大侠请教。"),
    };
  return { ok: true, text: "" };
}

export function resolveSpecialNpcTalk(id: number, actor: SceneActorState) {
  const questTalk = rec(originalText.quest_talk)[String(id)] as string[] | undefined;
  if (id === 139 && actor.gold >= 500000) {
    actor.gold -= 500000;
    actor.donateTimes = (actor.donateTimes || 0) + 1;
    actor.luck = Math.min(250, actor.luck + 1);
    return { handled: true, text: questTalk?.[0] || "多谢你的捐赠。" };
  }
  const snakeGall = "1:30";
  if (
    id === 111 &&
    actor.teacherId === 111 &&
    !actor.xue6 &&
    (actor.skills["39"]?.level || 0) >= 150 &&
    (actor.inventory[snakeGall] || 0) > 0
  ) {
    actor.inventory[snakeGall]--;
    if (actor.inventory[snakeGall] <= 0) delete actor.inventory[snakeGall];
    actor.xue6 = true;
    return { handled: true, text: questTalk?.[0] || "你领悟了雪花六出的第六剑。" };
  }
  return { handled: false, text: "" };
}

export function studyOptions(id: number) {
  const teaching = ((npcTeachingJson as { data?: Array<number[][] | null> }).data || [])[id];
  return (((teaching || enemy(id).skill_list) as number[][]) || []).map(
    ([skillId, maxLevel]) => ({
      id: skillId,
      name: String(originalTables.kungfus[skillId]?.name || skillId),
      maxLevel: Math.min(255, maxLevel),
    }),
  );
}
export function bookStudyOptions(id: number) {
  return ((originalTables.items[id]?.skill_list as number[][]) || []).map(
    ([skillId, maxLevel]) => ({
      id: skillId,
      name: String(originalTables.kungfus[skillId]?.name || skillId),
      maxLevel: Math.min(255, maxLevel),
    }),
  );
}
export function canReadBook(actor: SceneActorState, id: number) {
  if (id === 20 && actor.gender === 1)
    return { ok: false, text: "女子无法修习菜花宝典。" };
  if (id === 20 && actor.gender === 0)
    return { ok: false, text: "菜花宝典需要先完成原作的净身抉择。" };
  if ((actor.skills["11"]?.level || 0) === 0)
    return {
      ok: false,
      text: String(originalText.no_int_text || "你不识字，无法阅读。"),
    };
  if (actor.classId !== 0 && actor.classId !== 9)
    return {
      ok: false,
      text: String(originalText.not_read_text || "本门规矩不容修习这本秘籍。"),
    };
  actor.classId = 9;
  return { ok: true, text: "你翻开秘籍，逐字研读。" };
}
export function studyOnce(
  actor: SceneActorState,
  skillId: number,
  maxLevel: number,
  random = 0.5,
) {
  const current = actor.skills[String(skillId)] || { level: 0, points: 0 };
  if (current.level > maxLevel || current.level === 255)
    return {
      ok: false,
      leveled: false,
      text: "这门功夫已经无法再从此人处提高。",
    };
  if (actor.exp < Math.floor(current.level ** 3 / 10))
    return {
      ok: false,
      leveled: false,
      text: String(originalText.learn_no_exp || "你的实战经验不足。"),
    };
  if (actor.potential <= 0)
    return {
      ok: false,
      leveled: false,
      text: String(originalText.learn_no_pot || "你的潜能已经耗尽。"),
    };
  const fee =
    skillId === 11
      ? current.level <= 20
        ? 5
        : current.level <= 30
          ? 10
          : current.level <= 60
            ? 50
            : current.level <= 80
              ? 150
              : current.level <= 100
                ? 300
                : current.level <= 120
                  ? 500
                  : 1000
      : 0;
  if (actor.gold < fee)
    return {
      ok: false,
      leveled: false,
      text: String(originalText.learn_no_gold || "你的银两不足。"),
    };
  actor.potential--;
  actor.gold -= fee;
  const speed =
    Math.floor((actor.int / 2 + Math.floor(actor.int * random)) / 2) +
    Math.floor((actor.luck / 5) * random);
  current.points += speed;
  const needed = (current.level + 1) ** 2;
  if (current.points >= needed) {
    current.points = 0;
    current.level++;
    actor.skills[String(skillId)] = current;
    return {
      ok: true,
      leveled: true,
      text: String(originalText.sk_lv_up || "你的功夫进步了！"),
    };
  }
  actor.skills[String(skillId)] = current;
  return {
    ok: true,
    leveled: false,
    text: `${originalTables.kungfus[skillId]?.name}：${current.points}/${needed}`,
  };
}

export function npcRecord(id: number): OriginalRecord {
  return enemy(id);
}
