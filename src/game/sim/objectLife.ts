import { clamp } from "./formulas";
import type { DynamicObjectState, WorldState } from "./state";
import { isEntityBusy, releaseLock, tryLock } from "./socialEngine";

const OBJECT_KINDS: string[] = ["flower", "bush", "rock", "herb"];
const FLOWER_TINTS = ["#d9829f", "#e8c850", "#8fb4e8"];
const KIND_NAMES: Record<string, string> = { flower: "花", bush: "灌木", rock: "石头", herb: "药草" };
const AREA_TINTS = ["#f0d8a8", "#a8d8c8", "#d8b8c8", "#c8d0e8"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function ensureAreaObjects(world: WorldState, area: string, room: string | null): DynamicObjectState[] {
  let objs = world.dynamicObjects.filter((o) => o.area === area && o.room === room);
  if (objs.length) return objs;
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const kind = pick(OBJECT_KINDS);
    world.dynamicObjects.push({
      id: `obj-${area}-${room || "out"}-${i}-${Math.floor(Math.random() * 99999)}`,
      kind,
      x: 120 + Math.random() * Math.max(300, 700),
      y: 458 + Math.random() * 12,
      area,
      room,
      integrity: 45 + Math.floor(Math.random() * 55),
      growth: 20 + Math.floor(Math.random() * 80),
      quantity: 1,
      size: 0.8 + Math.random() * 0.7,
      tint: kind === "flower" ? pick(FLOWER_TINTS) : "",
      history: []
    });
  }
  return world.dynamicObjects.filter((o) => o.area === area && o.room === room);
}

export function growWorld(world: WorldState, area: string, room: string | null): string[] {
  const msgs: string[] = [];
  for (const o of ensureAreaObjects(world, area, room)) {
    if (Math.random() < 0.35) {
      o.growth = clamp(o.growth + 2 + Math.floor(Math.random() * 6), 0, 100);
      o.integrity = clamp(o.integrity + 1, 0, 100);
      msgs.push(`${KIND_NAMES[o.kind] || o.kind}又长了一些。`);
    }
  }
  return msgs;
}

export function randomizeAreaVariation(world: WorldState, area: string): void {
  world.areaVariations[area] = {
    variation: Math.floor(Math.random() * 100),
    tint: pick(AREA_TINTS)
  };
}

export function randomObjectAction(world: WorldState, npcId: string, npcName: string, area: string, room: string | null): string {
  const objs = ensureAreaObjects(world, area, room);
  if (!objs.length) return `${npcName}转了一圈，没找到能下手的东西。`;
  const obj = pick(objs);
  if (isEntityBusy(world, npcId) || isEntityBusy(world, obj.id)) {
    return `${npcName}看了看${KIND_NAMES[obj.kind] || obj.kind}，又走开了。`;
  }
  tryLock(world, npcId, obj.id, "object", 4000);
  const action = pick(["repair", "destroy", "copy", "move", "use"] as const);
  const before = `${KIND_NAMES[obj.kind] || obj.kind}${obj.quantity > 1 ? "丛" : ""}`;
  if (action === "repair") {
    obj.integrity = clamp(obj.integrity + 15 + Math.floor(Math.random() * 15), 0, 100);
    obj.growth = clamp(obj.growth + 10 + Math.floor(Math.random() * 15), 0, 100);
    obj.size = Math.min(2.2, obj.size + 0.12);
    releaseLock(world, npcName, obj.id);
    return `${npcName}蹲下${obj.kind === "flower" ? "给花培了培土" : "把" + before + "仔细收拾了一番"}，它看着精神了许多。`;
  }
  if (action === "destroy") {
    obj.integrity = clamp(obj.integrity - 20 - Math.floor(Math.random() * 20), 0, 100);
    obj.growth = clamp(obj.growth - 10 - Math.floor(Math.random() * 15), 0, 100);
    obj.size = Math.max(0.25, obj.size - 0.18);
    if (obj.integrity <= 0) {
      world.dynamicObjects = world.dynamicObjects.filter((o) => o.id !== obj.id);
      releaseLock(world, npcId, obj.id);
      return `${npcName}随手把${before}弄没了，原地只剩一点残迹。`;
    }
    releaseLock(world, npcId, obj.id);
    return `${npcName}折腾了一番${before}，它蔫了不少。`;
  }
  if (action === "copy") {
    const copy: DynamicObjectState = {
      ...obj,
      id: `obj-${area}-${room || "out"}-copy-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      x: clamp(obj.x + (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 70), 60, 3400),
      size: Math.max(0.4, obj.size + (Math.random() - 0.5) * 0.35),
      integrity: Math.max(10, obj.integrity - 15),
      history: []
    };
    world.dynamicObjects.push(copy);
    obj.quantity += 1;
    releaseLock(world, npcId, obj.id);
    return `${npcName}摆弄了一会儿${before}，旁边竟又多了一个差不多的。`;
  }
  if (action === "move") {
    const nx = clamp(obj.x + (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 90), 60, 3400);
    obj.x = nx;
    releaseLock(world, npcId, obj.id);
    return `${npcName}把${before}挪了个地方，像在重新安排这片江湖。`;
  }
  obj.growth = clamp(obj.growth + 2, 0, 100);
  releaseLock(world, npcId, obj.id);
  return `${npcName}对着${before}看了很久，不知在想什么。`;
}
