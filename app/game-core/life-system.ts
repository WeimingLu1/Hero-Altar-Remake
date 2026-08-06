import { originalSystem } from "./original-data";
import type { SceneActorState } from "./scene-event";

export const swordTypes = ["剑", "刀", "杖", "鞭"];
export const furnitureNames = (originalSystem.jiaju_menu as string[]) || [
  "小凳",
  "小桌",
  "花瓶",
  "衣柜",
  "书柜",
];

export function createSword(
  actor: SceneActorState,
  type: number,
  name: string,
) {
  if (!actor.swordBattle) return { ok: false, text: "尚未通过铸剑挑战。" };
  if (type < 0 || type > 3 || !name || [...name].length > 8)
    return { ok: false, text: "武器名称须为一至八个字符。" };
  actor.swordType = type;
  actor.swordName = name;
  actor.sword1 = actor.sword1 || 0;
  actor.sword2 = actor.sword2 || 0;
  actor.sword3 = actor.sword3 || 0;
  actor.inventory["2:31"] = Math.max(1, actor.inventory["2:31"] || 0);
  return { ok: true, text: `铸成${swordTypes[type]}器「${name}」。` };
}

const factor = (a: number, b: number, c: number) =>
  Math.floor(((a - 1) * a * c) / 4) + a * b;

export function reforgeSword(
  actor: SceneActorState,
  random: (max: number) => number,
) {
  if ((actor.swordType ?? -1) < 0) return { ok: false, text: "尚无自制兵器。" };
  const needExp = ((actor.swordTimes || 0) + 1) * 100000,
    needGold = Math.floor(actor.exp / 2);
  if (actor.exp < needExp)
    return { ok: false, text: `经验需达到 ${needExp}。` };
  if (actor.gold < needGold)
    return { ok: false, text: `重铸需 ${needGold} 银两。` };
  if (actor.weaponId === 31) return { ok: false, text: "请先卸下自制兵器。" };
  actor.gold -= needGold;
  let randomFactor = random(100),
    n = Math.floor(Math.min(actor.exp, 1100000) / 20000) - 5;
  const c = n * 2,
    b = 20,
    judge = random(Math.max(1, factor(n, b, c)));
  n = factor(19, b, c) < judge ? 20 : 1;
  while (n < 20 && factor(n, b, c) < judge) n++;
  actor.sword1 = Math.max(0, n) * 5 + random(5);
  actor.sword2 = 0;
  randomFactor = random(Math.max(1, 100 - randomFactor)) + actor.luck;
  n = Math.min(randomFactor - 80, 40);
  if (n >= 0) actor.sword2 = Math.floor(n / 10) * 3 + (random(4) + 1) * 100;
  actor.sword3 = 0;
  randomFactor = random(Math.max(1, 100 - randomFactor));
  if (randomFactor >= 20) {
    n = Math.min(randomFactor + actor.luck - 40, 80);
    if (n >= 0) actor.sword3 = Math.floor(n / 20) * 5 + (random(5) + 1) * 100;
  }
  actor.swordTimes = (actor.swordTimes || 0) + 1;
  return { ok: true, text: `重铸完成，攻击增加 ${actor.sword1}。` };
}

export function upgradeRoom(actor: SceneActorState) {
  const level = actor.roomLevel || 0;
  if (!actor.haveNewHome || level < 1)
    return { ok: false, text: "尚未拥有桃花源。" };
  if (level >= 3) return { ok: false, text: "房屋已经达到最高等级。" };
  if (actor.gold < 2000000) return { ok: false, text: "翻修需要二百万银两。" };
  actor.gold -= 2000000;
  actor.roomLevel = level + 1;
  return { ok: true, text: `房屋提升至 ${actor.roomLevel} 级。` };
}

export function buyFurniture(actor: SceneActorState, type: number, amount = 1) {
  const list = actor.jiajuList || [0, 0, 0, 0, 0],
    capacity = Math.max(0, (actor.roomLevel || 0) * 2 - 1),
    used = list.reduce((sum, value) => sum + value, 0),
    count = Math.max(0, Math.floor(amount));
  if (type < 0 || type >= 5 || count < 1)
    return { ok: false, text: "请选择家具。" };
  if (used + count > capacity)
    return { ok: false, text: `房中最多摆放 ${capacity} 件家具。` };
  if (actor.gold < count * 60000)
    return { ok: false, text: "每件家具需要六万银两。" };
  actor.gold -= count * 60000;
  list[type] += count;
  actor.jiajuList = list;
  return { ok: true, text: `购入${furnitureNames[type]} ×${count}。` };
}

export function clearFurniture(actor: SceneActorState) {
  actor.jiajuList = [0, 0, 0, 0, 0];
  return { ok: true, text: "屋内家具已全部移除。" };
}
