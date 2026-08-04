import type { GameState } from "./state";
import { AREAS } from "../content/areas";

const KEY = "yxts-golden-save";
const CORRUPT_KEY = "yxts-golden-save.corrupt";

// 当前存档版本；旧档读取时经 migrate 逐级迁移
export const SAVE_VERSION = 2;

// 启动时可读：最近一次读取存档时是否发现过损坏数据（损坏串已隔离备份）
export let hadCorruptSave = false;

export function saveGame(s: GameState, slot: number): void {
  const all = readAll();
  all[String(slot)] = { ...s, savedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function autosave(s: GameState): void {
  saveGame(s, 0);
}

export function loadGame(slot: number): GameState | null {
  const all = readAll();
  const data = all[String(slot)];
  if (!data) return null;
  return migrate(data);
}

export function hasSave(slot: number): boolean {
  const all = readAll();
  return !!all[String(slot)];
}

export function saveSlots(): { slot: number; name: string; savedAt: number }[] {
  const all = readAll();
  return Object.keys(all)
    .map((k) => ({
      slot: Number(k),
      name: all[k]?.player?.name || "未知",
      savedAt: all[k]?.savedAt || 0
    }))
    .filter((x) => !Number.isNaN(x.slot))
    .sort((a, b) => a.slot - b.slot);
}

export function clearSlot(slot: number): void {
  const all = readAll();
  delete all[String(slot)];
  localStorage.setItem(KEY, JSON.stringify(all));
}

function readAll(): Record<string, GameState> {
  const raw = localStorage.getItem(KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    // 存档损坏：把原始串备份到隔离 key，再按空档处理，避免坏档反复卡死
    try {
      localStorage.setItem(CORRUPT_KEY, raw);
    } catch {
      // 存储空间不足时放弃备份
    }
    hadCorruptSave = true;
    return {};
  }
}

// 版本迁移管线：旧档逐级迁移到 SAVE_VERSION，再补全缺省字段
function migrate(s: GameState): GameState {
  const v = s.version || 1;
  if (v < 2) migrateV1toV2(s);
  s.version = SAVE_VERSION;
  fillDefaults(s);
  return s;
}

// v1 → v2：阿绣好感统一进 affections.axiu（旧字段 axiuLiking 取较大值后删除）
function migrateV1toV2(s: GameState): void {
  const p = s.player as GameState["player"] & { axiuLiking?: number };
  p.affections = p.affections || {};
  if (typeof p.axiuLiking === "number") {
    p.affections.axiu = Math.max(p.affections.axiu || 0, p.axiuLiking);
    delete p.axiuLiking;
  }
}

// 旧档缺字段补全
function fillDefaults(s: GameState): void {
  s.player.quests = s.player.quests || {};
  s.player.task = s.player.task || { popoWater: 0, popoChop: 0, popoSweep: 0, visits: 0 };
  s.player.flags = s.player.flags || {};
  s.player.storage = s.player.storage || {};
  if (!s.player.weaponsOwned) s.player.weaponsOwned = ["fist"];
  if (!s.player.armorsOwned) s.player.armorsOwned = ["buyi"];
  if (!s.player.accessoriesOwned) s.player.accessoriesOwned = ["pifeng"];
  if (s.player.forgeEquipped === undefined) s.player.forgeEquipped = !!s.player.forgeWeapon;
  if (s.player.doorX === undefined) s.player.doorX = null;
  if (!s.player.weather) s.player.weather = "sunny";
  if (!s.player.affections) s.player.affections = {};
  if (!s.player.lastIntimacyDay) s.player.lastIntimacyDay = 0;
  if (!s.player.titles) s.player.titles = [];
  if (s.player.weapon && !s.player.weaponsOwned.includes(s.player.weapon)) s.player.weaponsOwned.push(s.player.weapon);
  if (s.player.armor && !s.player.armorsOwned.includes(s.player.armor)) s.player.armorsOwned.push(s.player.armor);
  if (s.player.accessory && !s.player.accessoriesOwned.includes(s.player.accessory)) s.player.accessoriesOwned.push(s.player.accessory);
  // 舆图已知区域：旧档缺失时补默认四区域 + 当前所在区域
  if (!Array.isArray(s.player.flags["known-areas"])) {
    const known = ["town", "houshan", "wudang", "shangjia"];
    if (s.player.area && !known.includes(s.player.area) && AREAS[s.player.area]) known.push(s.player.area);
    s.player.flags["known-areas"] = known;
  }
}
