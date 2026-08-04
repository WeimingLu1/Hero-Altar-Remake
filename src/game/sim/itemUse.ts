import { ITEMS } from "../content/items";
import { NPCS } from "../content/npcs";
import { clamp } from "./formulas";
import { mutateRelation } from "./relations";
import type { DynamicObjectState, GameState } from "./state";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FOOD_TEXT = [
  "你把{name}扔进{obj}里，它沾上了油光，看着竟比先前精神了些。",
  "{obj}边上多了半块{name}，不知是福是祸。",
  "你把{name}碾碎撒在{obj}周围，空气里多了一股奇怪的味道。"
];

const DRINK_TEXT = [
  "你把{name}浇在{obj}上，水珠顺着枝叶滚落，像刚下过一场小雨。",
  "{obj}被{name}淋过之后，颜色似乎更深了一分。",
  "你把{name}泼出去，溅了{obj}一身，它微微抖了抖。"
];

const MEDICINE_TEXT = [
  "你把{name}的药粉洒在{obj}上，伤口一样的裂纹竟慢慢收拢了。",
  "{obj}沾了药气，看起来没那么蔫了。",
  "药力渗进{obj}，它的颜色变得比先前鲜亮。"
];

const MATERIAL_TEXT = [
  "你把{name}堆在{obj}旁边，像给它添了一座小小的靠山。",
  "{obj}边上多了些{name}，看着有点乱，也有点像新的景致。",
  "你随手把{name}搁在{obj}上，它纹丝不动，像什么都没发生。"
];

const BOOK_TEXT = [
  "你对着{obj}念了一段书，它没有回应，但风好像安静了些。",
  "你把{name}摊开放在{obj}边，纸页被风翻了几页。",
  "{obj}旁多了一本{name}，像是谁留下的一段旧事。"
];

const WEIRD_TEXT = [
  "你把{name}放在{obj}上，世界似乎没有变化，又似乎变了一点。",
  "{obj}沾了{name}的气息，颜色变得有些古怪。",
  "你围着{obj}转了一圈，把{name}留下，然后退开两步观察。"
];

export function useItemOnObject(s: GameState, itemId: string, obj: DynamicObjectState): string {
  const def = ITEMS[itemId];
  if (!def) return "这东西不知道怎么用。";
  if ((s.player.items[itemId] || 0) <= 0) return "你已经没有这件东西了。";
  s.player.items[itemId] -= 1;
  if (s.player.items[itemId] <= 0) delete s.player.items[itemId];

  const kind = def.kind;
  const name = def.name;
  const objName = obj.kind === "flower" ? "花" : obj.kind === "bush" ? "灌木" : obj.kind === "herb" ? "药草" : "石头";
  let text: string;
  if (kind === "food") {
    obj.growth = clamp(obj.growth + Math.floor(Math.random() * 12) - 2, 0, 100);
    obj.integrity = clamp(obj.integrity + Math.floor(Math.random() * 8) - 2, 0, 100);
    text = pick(FOOD_TEXT).replace(/\{name\}/g, name).replace(/\{obj\}/g, objName);
  } else if (kind === "drink") {
    obj.growth = clamp(obj.growth + 8 + Math.floor(Math.random() * 8), 0, 100);
    obj.tint = obj.tint || "#e8c850";
    text = pick(DRINK_TEXT).replace(/\{name\}/g, name).replace(/\{obj\}/g, objName);
  } else if (kind === "medicine") {
    obj.integrity = clamp(obj.integrity + 12 + Math.floor(Math.random() * 12), 0, 100);
    obj.size = Math.min(2.2, obj.size + 0.08);
    text = pick(MEDICINE_TEXT).replace(/\{name\}/g, name).replace(/\{obj\}/g, objName);
  } else if (kind === "material") {
    obj.quantity += 1;
    obj.integrity = clamp(obj.integrity + 4, 0, 100);
    text = pick(MATERIAL_TEXT).replace(/\{name\}/g, name).replace(/\{obj\}/g, objName);
  } else if (kind === "book") {
    obj.growth = clamp(obj.growth + 2, 0, 100);
    text = pick(BOOK_TEXT).replace(/\{name\}/g, name).replace(/\{obj\}/g, objName);
  } else {
    obj.tint = obj.tint || "#d9829f";
    obj.size = Math.max(0.4, obj.size + (Math.random() - 0.5) * 0.25);
    text = pick(WEIRD_TEXT).replace(/\{name\}/g, name).replace(/\{obj\}/g, objName);
  }
  obj.history.push(text);
  s.world.objectHistory.push(text);
  return text;
}

const NPC_ITEM_TEXT = {
  food: [
    "你把{name}递给{npc}，{npc}接过去，眼神松了松：「谢了。」",
    "{npc}把{name}掰成两半，一半递回给你：「一起吃。」",
    "{npc}闻了闻{name}，忽然笑了：「这东西，倒让我想起从前。」"
  ],
  drink: [
    "你递上{name}，{npc}接过去喝了一口：「好酒，有心了。」",
    "{npc}抿了一口{name}，眉头舒展开来。",
    "{npc}把{name}收进怀里：「这份心意，我记下了。」"
  ],
  medicine: [
    "你拿出{name}，{npc}看了你一眼：「你倒是个会疼人的。」",
    "{npc}接过{name}，低声道：「伤药难得，多谢。」",
    "{npc}没有接，只是说：「你留着，比我更需要。」"
  ],
  book: [
    "你把{name}递给{npc}，{npc}翻了两页：「字是好字，就是道理太旧。」",
    "{npc}接过{name}，沉吟道：「这东西，不该流落江湖。」",
    "{npc}看了一会儿{name}，忽然抬头：「你从哪得来的？」"
  ],
  other: [
    "你把{name}塞给{npc}，{npc}愣住：「这是……给我的？」",
    "{npc}端详着{name}，又看了看你：「你这个人，真是看不透。」",
    "{npc}把{name}收了，没有多问，只点了点头。"
  ]
};

export function useItemOnNpc(s: GameState, npcId: string, itemId: string): string {
  const def = ITEMS[itemId];
  const npcName = NPCS[npcId]?.name || npcId;
  if (!def || (s.player.items[itemId] || 0) <= 0) return "这东西现在拿不出来。";
  s.player.items[itemId] -= 1;
  if (s.player.items[itemId] <= 0) delete s.player.items[itemId];
  const pool = NPC_ITEM_TEXT[def.kind as keyof typeof NPC_ITEM_TEXT] || NPC_ITEM_TEXT.other;
  const text = pick(pool).replace(/\{name\}/g, def.name).replace(/\{npc\}/g, npcName);
  mutateRelation(s, "player", npcId, {
    friendliness: 3 + Math.floor(Math.random() * 5),
    trust: 2 + Math.floor(Math.random() * 3),
    love: def.kind === "food" || def.kind === "drink" ? 1 : 0
  }, text);
  return text;
}
