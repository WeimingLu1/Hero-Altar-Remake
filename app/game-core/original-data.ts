import kungfusJson from "../../game-data/kungfus.json";
import skillsJson from "../../game-data/skills.json";
import itemsJson from "../../game-data/items.json";
import weaponsJson from "../../game-data/weapons.json";
import armorsJson from "../../game-data/armors.json";
import enemiesJson from "../../game-data/enemies.json";

export type OriginalRecord = Record<string, unknown> & { name?: string; id?: number; description?: string };
const records = (value: unknown) => ((value as { data?: unknown[] }).data || []).filter(Boolean) as OriginalRecord[];

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
