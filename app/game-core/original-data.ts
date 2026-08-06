import kungfusJson from "../../game-data/kungfus.json";
import skillsJson from "../../game-data/skills.json";
import itemsJson from "../../game-data/items.json";
import weaponsJson from "../../game-data/weapons.json";
import armorsJson from "../../game-data/armors.json";
import enemiesJson from "../../game-data/enemies.json";
import coreJson from "../../game-data/core.json";
import tasksJson from "../../game-data/tasks.json";

export type OriginalRecord = Record<string, unknown> & { name?: string; id?: number; description?: string };
const records = (value: unknown) => ((value as { data?: unknown[] }).data || []).filter(Boolean) as OriginalRecord[];
const indexed = (value: unknown) => ((value as { data?: unknown[] }).data || []) as Array<OriginalRecord | null>;

export const originalTables = {
  kungfus: indexed(kungfusJson), skills: indexed(skillsJson), items: indexed(itemsJson),
  weapons: indexed(weaponsJson), armors: indexed(armorsJson), enemies: indexed(enemiesJson),
};
export const originalSystem = ((coreJson as {data:unknown[]}).data[0] || {}) as Record<string, unknown>;
export const originalText = ((coreJson as {data:unknown[]}).data[1] || {}) as Record<string, unknown>;
export const originalTasks = ((tasksJson as {data:unknown}).data || {}) as Record<string, unknown>;

export const originalData = {
  kungfus: records(kungfusJson),
  skills: records(skillsJson),
  items: records(itemsJson),
  weapons: records(weaponsJson),
  armors: records(armorsJson),
  enemies: records(enemiesJson),
};

export const originalCounts = Object.fromEntries(
  Object.entries(originalData).map(([key, value]) => [key, value.length]),
);
