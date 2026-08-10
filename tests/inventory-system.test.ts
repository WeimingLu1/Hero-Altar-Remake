import assert from "node:assert/strict";
import test from "node:test";
import {
  bagEntries,
  derivedStats,
  maxFood,
  activateBattleEntry,
  activateEntry,
  battleConsumableEntries,
  discardEntry,
} from "../app/game-core/inventory-system";
import type { SceneActorState } from "../app/game-core/scene-event";
const actor = (): SceneActorState => ({
  inventory: { "1:1": 2, "2:1": 1, "3:4": 1 },
  gold: 0,
  hp: 50,
  maxHp: 100,
  fp: 0,
  maxFp: 0,
  food: 100,
  water: 100,
  exp: 0,
  potential: 0,
  morals: 128,
  tanId: 0,
  teacherId: 0,
  classId: 0,
  gender: 0,
  face: 20,
  mp: 0,
  maxMp: 0,
  age: 14,
  baseBon: 20,
  baseInt: 20,
  baseAgi: 20,
  baseStr: 20,
  bon: 20,
  int: 20,
  agi: 20,
  str: 20,
  luck: 20,
  skills: {},
  weaponId: 0,
  armorIds: [],
  skillUse: [0, 0, 0, 0, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});
test("battle item activation applies original consumable data", () => {
  const a = actor();
  a.inventory = { "1:8": 1 };
  a.hp = 30;
  a.maxHp = 50;
  const medicine = bagEntries(a)[0];
  const result = activateBattleEntry(a, medicine);
  assert.equal(result.ok, true);
  assert.equal(a.hp, 45);
  assert.equal(a.maxHp, 75);
  assert.match(result.text, /气血\+15/);
  assert.match(result.text, /伤势上限\+25/);
  assert.equal(a.inventory["1:8"], undefined);
});
test("生肌膏按完整气血比例同时恢复当前气血和伤势上限", () => {
  const a = actor();
  a.inventory = { "1:9": 1 };
  a.hp = 20;
  a.maxHp = 40;
  const result = activateBattleEntry(a, bagEntries(a)[0]);
  assert.equal(result.ok, true);
  assert.equal(a.hp, 50);
  assert.equal(a.maxHp, 90);
  assert.equal(a.inventory["1:9"], undefined);
});
test("只要当前气血未满，战斗中始终可以使用回血药", () => {
  const a = actor();
  a.inventory = { "1:8": 2 };
  a.hp = 99;
  a.maxHp = 100;
  const result = activateBattleEntry(a, battleConsumableEntries(a)[0]);
  assert.equal(result.ok, true);
  assert.equal(a.hp, 100);
  assert.equal(a.inventory["1:8"], 1);
});
test("战斗物品画面和键盘共用列表且排除永久丹药", () => {
  const a = actor();
  a.inventory = { "1:10": 1, "1:30": 1, "1:9": 1, "1:8": 1 };
  assert.deepEqual(
    battleConsumableEntries(a).map((entry) => entry.id),
    [9, 8],
  );
});
test("永久丹药同时提升内力法力并严格钳制在六万五千五百三十五", () => {
  const a = actor();
  a.inventory = { "1:10": 2 };
  a.fp = a.maxFp = 65534;
  a.mp = a.maxMp = 65534;
  const first = activateEntry(a, bagEntries(a)[0]);
  assert.equal(first.ok, true);
  assert.equal(a.fp, 65535);
  assert.equal(a.maxFp, 65535);
  assert.equal(a.mp, 65535);
  assert.equal(a.maxMp, 65535);
  assert.equal(a.inventory["1:10"], 1);
  const second = activateEntry(a, bagEntries(a)[0]);
  assert.equal(second.ok, false);
  assert.match(second.text, /已达上限/);
  assert.equal(a.inventory["1:10"], 1);
});
test("food follows original item effect and maximum", () => {
  const a = actor(),
    food = bagEntries(a).find((x) => x.key === "1:1")!;
  activateEntry(a, food);
  assert.equal(a.food, Math.min(maxFood(a), 260));
  assert.equal(a.inventory["1:1"], 1);
});
test("equipment slots and bonuses follow original records", () => {
  const a = actor(),
    entries = bagEntries(a);
  activateEntry(
    a,
    entries.find((x) => x.key === "2:1")!,
  );
  activateEntry(
    a,
    entries.find((x) => x.key === "3:4")!,
  );
  assert.equal(a.weaponId, 1);
  assert.deepEqual(a.armorIds, [4]);
  assert.equal(derivedStats(a).atk, 17);
  assert.equal(derivedStats(a).pdef, 5);
});

test("行囊条目公开现代装备界面所需的门类、槽位与属性摘要", () => {
  const a = actor();
  a.inventory["2:16"] = 1;
  a.inventory["3:24"] = 1;
  const entries = bagEntries(a);
  const sword = entries.find((entry) => entry.key === "2:16")!;
  const armor = entries.find((entry) => entry.key === "3:24")!;
  assert.equal(sword.category, "武器 · 剑器");
  assert.equal(sword.slot, "主手武器");
  assert.match(sword.bonuses, /攻击\+65/);
  assert.equal(armor.category, "护甲槽");
  assert.match(armor.bonuses, /防御\+60/);
});

test("防具按互斥槽分组且钓竿明确归入独立工具槽", () => {
  const a = actor();
  a.inventory["3:4"] = 1; // 外衣
  a.inventory["3:5"] = 1; // 外衣
  a.inventory["3:24"] = 1; // 护甲
  a.inventory["3:31"] = 1; // 钓竿工具
  const entries = bagEntries(a),
    cloth = entries.find((entry) => entry.key === "3:4")!,
    armor = entries.find((entry) => entry.key === "3:24")!,
    rod = entries.find((entry) => entry.key === "3:31")!;
  assert.equal(cloth.category, "外衣槽");
  assert.equal(armor.category, "护甲槽");
  assert.equal(rod.category, "工具槽 · 钓具");
  activateEntry(a, cloth);
  activateEntry(a, armor);
  activateEntry(a, rod);
  assert.deepEqual(a.armorIds, [4, 24, 31], "不同装备槽应可同时装备");
  activateEntry(a, entries.find((entry) => entry.key === "3:5")!);
  assert.deepEqual(a.armorIds, [24, 31, 5], "同一装备槽只能保留一件");
});

test("原版石板来源记录在行囊合并显示为关键物品", () => {
  const a = actor();
  a.stoneList = [102, 111];
  const stone = bagEntries(a).find((entry) => entry.key === "stone:19")!;
  assert.equal(stone.name, "三角石板");
  assert.equal(stone.amount, 2);
  assert.equal(stone.slot, "关键物品");
  assert.equal(stone.bonuses, "已收集 2/6");
});

test("自制武器按武器类型分组且丢弃后可重新铸造", () => {
  const a = actor();
  a.inventory["2:31"] = 1;
  a.swords = [
    { forged: true, name: "无名剑", atk: 0, mid: 0, suf: 0, times: 0 },
    { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
    { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
    { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
  ];
  const entry = bagEntries(a).find((item) => item.key === "2:31")!;
  assert.equal(entry.category, "武器 · 剑器", "无名剑应归入剑器分组");
  discardEntry(a, entry);
  assert.equal(a.inventory["2:31"], undefined);
  assert.equal(a.swords![0].forged, false, "丢弃后该类型重置为未铸造");
});

test("丢弃行囊条目会移除物品并卸下已装备的武器/防具", () => {
  const a = actor();
  a.inventory = { "1:5": 2, "2:8": 1, "3:4": 1 };
  a.weaponId = 8;
  a.armorIds = [4];
  const entries = bagEntries(a),
    weapon = entries.find((entry) => entry.key === "2:8")!,
    armor = entries.find((entry) => entry.key === "3:4")!,
    food = entries.find((entry) => entry.key === "1:5")!;
  discardEntry(a, weapon);
  assert.equal(a.inventory["2:8"], undefined);
  assert.equal(a.weaponId, 0);
  discardEntry(a, armor);
  assert.deepEqual(a.armorIds, []);
  discardEntry(a, food);
  assert.equal(a.inventory["1:5"], undefined);
});

test("使用坛地图提示入口位置且不消耗物品", () => {
  const a = actor();
  a.inventory = { "1:28": 1 };
  const result = activateEntry(a, bagEntries(a)[0]);
  assert.equal(result.ok, true);
  assert.match(result.text, /白虎坛/);
  assert.match(result.text, /东海/);
  assert.match(result.text, /\(7, 2\)/);
  assert.equal(a.inventory["1:28"], 1, "坛地图使用后不应被消耗");
});
