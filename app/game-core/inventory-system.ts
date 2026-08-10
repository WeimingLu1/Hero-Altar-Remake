import { originalTables, type OriginalRecord } from "./original-data";
import type { SceneActorState } from "./scene-event";
import { altarEntranceHint } from "./altar-map";
import { customSwordBonus, customSwordDescription } from "./life-system";

export type BagEntry = {
  key: string;
  kind: 1 | 2 | 3;
  id: number;
  amount: number;
  name: string;
  description: string;
  equipped: boolean;
  category: string;
  slot: string;
  bonuses: string;
};
const pair = (value: unknown): [number, number] =>
  Array.isArray(value)
    ? [Number(value[0] || 0), Number(value[1] || 0)]
    : [0, 0];
const table = (kind: number) =>
  kind === 1
    ? originalTables.items
    : kind === 2
      ? originalTables.weapons
      : originalTables.armors;
const add = (base: number, value: unknown, percentBase: number) => {
  const [mode, amount] = pair(value);
  return (
    base + (mode === 1 ? Math.floor((percentBase * amount) / 100) : amount)
  );
};
const MAX_RESOURCE = 65535;
export const maxFood = (actor: SceneActorState) => (actor.baseStr + 5) * 15;
export const maxWater = (actor: SceneActorState) => (actor.baseStr + 4) * 15;
export function fullHp(actor: SceneActorState) {
  let value =
    100 + Math.floor(actor.maxFp / 4) + (Math.min(actor.age, 29) - 14) * 20;
  // 红莲教义：需在学识槽装备(第7槽)且满足原版条件才生效。
  if (
    actor.skillUse[6] === 27 &&
    actor.classId === 3 &&
    (actor.skills["27"]?.level || 0) >= 80 &&
    actor.age >= 20
  )
    value += Math.floor((actor.skills["27"].level * actor.baseBon) / 10);
  return value;
}
export function bagEntries(actor: SceneActorState): BagEntry[] {
  const entries = Object.entries(actor.inventory).flatMap(([key, amount]) => {
    const [kind, id] = key.split(":").map(Number),
      record = table(kind)[id];
    if (!record || amount <= 0 || kind < 1 || kind > 3) return [];
    return [
      {
        key,
        kind: kind as 1 | 2 | 3,
        id,
        amount,
        name: String(
          kind === 2 && id === 31 && actor.swordName
            ? actor.swordName
            : record.name || id,
        ),
        description:
          kind === 2 && id === 31 && actor.swordName
            ? customSwordDescription(actor)
            : String(record.description || ""),
        equipped:
          kind === 2
            ? actor.weaponId === id
            : kind === 3
              ? actor.armorIds.includes(id)
              : false,
        category: entryCategory(kind, record),
        slot: entrySlot(kind, record),
        bonuses:
          kind === 2 && id === 31 && actor.swordName
            ? customSwordBonus(actor)
            : entryBonuses(record),
      },
    ];
  });
  const stoneCount = actor.stoneList?.length || 0;
  if (stoneCount > 0) {
    const stone = originalTables.items[19] || {};
    entries.push({
      key: "stone:19",
      kind: 1,
      id: 19,
      amount: stoneCount,
      name: String(stone.name || "三角石板"),
      description: String(stone.description || "六芒星阵所需的古老石板。"),
      equipped: false,
      category: "消耗与杂物",
      slot: "关键物品",
      bonuses: `已收集 ${stoneCount}/6`,
    });
  }
  return entries;
}
function record(entry: BagEntry): OriginalRecord {
  return table(entry.kind)[entry.id] || {};
}
export const weaponKinds = ["剑器", "刀兵", "杖棍", "鞭索"];
// 原作 armor.kind 实际是互斥装备槽：同 kind 只能装备一件，不同 kind 可同时装备。
// kind=6 的钓竿是功能工具，不是防具，只是借用 Armor 数据结构实现装备状态。
export const armorSlotNames = [
  "外衣槽",
  "护甲槽",
  "饰物槽",
  "鞋履槽",
  "腰带槽",
  "披风槽",
  "工具槽",
];
export function equipmentCategory(kind: number, item: OriginalRecord) {
  if (kind === 1) return item.is_book ? "武学秘籍" : "消耗与杂物";
  if (kind === 2) return `武器 · ${weaponKinds[Number(item.type || 0)] || "奇门"}`;
  const slot = Number(item.kind || 0);
  return slot === 6
    ? "工具槽 · 钓具"
    : armorSlotNames[slot] || "其他装备槽";
}
function entryCategory(kind: number, item: OriginalRecord) {
  return equipmentCategory(kind, item);
}
function entrySlot(kind: number, item: OriginalRecord) {
  if (kind === 1) return item.is_book ? "研读" : "使用";
  if (kind === 2) return "主手武器";
  return armorSlotNames[Number(item.kind || 0)] || "装备槽";
}
function entryBonuses(item: OriginalRecord) {
  const labels: Array<[string, string]> = [
    ["add_atk", "攻击"],
    ["add_def", "防御"],
    ["add_hit", "命中"],
    ["add_eva", "闪避"],
    ["add_str", "膂力"],
    ["add_agi", "敏捷"],
    ["add_int", "悟性"],
    ["add_bon", "根骨"],
  ];
  const values = labels.flatMap(([key, label]) => {
    const value = Number(item[key] || 0);
    return value ? [`${label}${value > 0 ? "+" : ""}${value}`] : [];
  });
  return values.length ? values.join(" · ") : "无常驻属性加成";
}
export function equipmentBonus(
  actor: SceneActorState,
  key:
    | "add_str"
    | "add_agi"
    | "add_int"
    | "add_bon"
    | "add_atk"
    | "add_def"
    | "add_hit"
    | "add_eva",
) {
  let value = 0;
  if (actor.weaponId) {
    value += Number(originalTables.weapons[actor.weaponId]?.[key] || 0);
    if (actor.weaponId === 31) {
      if (key === "add_atk") value += actor.sword1 || 0;
      const middleType = Math.floor((actor.sword2 || 0) / 100),
        middleValue = (actor.sword2 || 0) % 100,
        suffixType = Math.floor((actor.sword3 || 0) / 100),
        suffixValue = (actor.sword3 || 0) % 100;
      if (key === "add_eva" && middleType === 3) value += middleValue;
      if (key === "add_hit" && middleType === 4) value += middleValue;
      const suffixKeys = ["", "add_str", "add_agi", "add_int", "add_bon"];
      if (suffixKeys[suffixType] === key) value += suffixValue;
    }
  }
  for (const id of actor.armorIds)
    value += Number(originalTables.armors[id]?.[key] || 0);
  return Math.min(255, value);
}
export function derivedStats(actor: SceneActorState) {
  return {
    str: Math.min(
      255,
      actor.baseStr +
        Math.floor((actor.skills["2"]?.level || 0) / 10) +
        equipmentBonus(actor, "add_str"),
    ),
    agi: Math.min(
      255,
      actor.baseAgi +
        Math.floor((actor.skills["9"]?.level || 0) / 10) +
        equipmentBonus(actor, "add_agi"),
    ),
    int: Math.min(
      255,
      actor.baseInt +
        Math.floor((actor.skills["11"]?.level || 0) / 10) +
        equipmentBonus(actor, "add_int"),
    ),
    bon: Math.min(
      255,
      actor.baseBon +
        Math.floor((actor.skills["1"]?.level || 0) / 10) +
        equipmentBonus(actor, "add_bon"),
    ),
    atk: equipmentBonus(actor, "add_atk"),
    pdef: equipmentBonus(actor, "add_def"),
    hit: equipmentBonus(actor, "add_hit"),
    eva: equipmentBonus(actor, "add_eva"),
  };
}
export function activateEntry(actor: SceneActorState, entry: BagEntry) {
  return activateItemEntry(actor, entry, false);
}
export function activateBattleEntry(actor: SceneActorState, entry: BagEntry) {
  return activateItemEntry(actor, entry, true);
}
export function battleConsumableEntries(actor: SceneActorState) {
  return bagEntries(actor).filter((entry) => {
    if (entry.kind !== 1 || [10, 30].includes(entry.id)) return false;
    const item = originalTables.items[entry.id] || {};
    return !item.is_book && [0, 1].includes(Number(item.occasion || 0));
  });
}
function activateItemEntry(
  actor: SceneActorState,
  entry: BagEntry,
  inBattle: boolean,
) {
  const item = record(entry);
  if (entry.kind === 2) {
    actor.weaponId = actor.weaponId === entry.id ? 0 : entry.id;
    return {
      ok: true,
      text: actor.weaponId ? `装备了${entry.name}。` : `卸下了${entry.name}。`,
    };
  }
  if (entry.kind === 3) {
    const kind = Number(item.kind || 0),
      old = actor.armorIds.find(
        (id) => Number(originalTables.armors[id]?.kind || 0) === kind,
      );
    actor.armorIds = actor.armorIds.filter(
      (id) => id !== old && id !== entry.id,
    );
    if (old !== entry.id) actor.armorIds.push(entry.id);
    return {
      ok: true,
      text:
        old === entry.id ? `卸下了${entry.name}。` : `装备了${entry.name}。`,
    };
  }
  if (item.is_book)
    return { ok: false, text: "翻开秘籍准备研读。", bookId: entry.id };
  // 坛地图是导航物品：使用后提示入口位置，不消耗、不进入普通物品结算。
  const altarHint = altarEntranceHint(entry.id);
  if (altarHint) return { ok: true, text: altarHint };
  const occasion = Number(item.occasion || 0);
  if (occasion !== 0 && occasion !== (inBattle ? 1 : 2))
    return { ok: false, text: "此物只能在战斗中使用。" };
  const before = [
    actor.hp,
    actor.maxHp,
    actor.fp,
    actor.maxFp,
    actor.mp,
    actor.maxMp,
    actor.food,
    actor.water,
  ];
  const healthy = fullHp(actor);
  actor.food = Math.min(
    maxFood(actor),
    add(actor.food, item.add_food, maxFood(actor)),
  );
  actor.water = Math.min(
    maxWater(actor),
    add(actor.water, item.add_water, maxWater(actor)),
  );
  actor.maxHp = Math.min(
    healthy,
    add(actor.maxHp, item.add_mhp, healthy),
  );
  const battleHealingRate = entry.id === 8 ? 15 : entry.id === 9 ? 30 : 0;
  actor.hp = Math.min(
    actor.maxHp,
    add(actor.hp, item.add_hp, healthy) +
      Math.floor((healthy * battleHealingRate) / 100),
  );
  actor.maxFp = Math.min(
    MAX_RESOURCE,
    add(actor.maxFp, item.add_mfp, actor.maxFp),
  );
  actor.fp = Math.min(
    Math.min(MAX_RESOURCE, actor.maxFp * 2),
    add(actor.fp, item.add_fp, actor.maxFp),
  );
  actor.maxMp = Math.min(
    MAX_RESOURCE,
    add(actor.maxMp, item.add_mmp, actor.maxMp),
  );
  actor.mp = Math.min(
    Math.min(MAX_RESOURCE, actor.maxMp * 2),
    add(actor.mp, item.add_mp, actor.maxMp),
  );
  const after = [
    actor.hp,
    actor.maxHp,
    actor.fp,
    actor.maxFp,
    actor.mp,
    actor.maxMp,
    actor.food,
    actor.water,
  ];
  if (
    before.join() === after.join()
  )
    return { ok: false, text: "此物已无法继续提升，当前状态已达上限。" };
  if (item.consumable !== false) {
    actor.inventory[entry.key]--;
    if (actor.inventory[entry.key] <= 0) delete actor.inventory[entry.key];
  }
  const labels = [
    ["气血", before[0], after[0]],
    ["伤势上限", before[1], after[1]],
    ["内力", before[2], after[2]],
    ["内力上限", before[3], after[3]],
    ["法力", before[4], after[4]],
    ["法力上限", before[5], after[5]],
  ] as const;
  const changes = labels.flatMap(([label, oldValue, newValue]) =>
    newValue > oldValue ? [`${label}+${newValue - oldValue}`] : [],
  );
  return {
    ok: true,
    text: `使用了${entry.name}${changes.length ? `：${changes.join("，")}。` : "。"}`,
  };
}
