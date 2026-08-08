import { originalTables, type OriginalRecord } from "./original-data";

const n = (record: OriginalRecord, key: string) => Number(record[key] || 0);

export function npcCombatLevel(record: OriginalRecord) {
  return ((record.skill_list as number[][] | undefined) || []).reduce(
    (highest, [id, level]) => {
      const type = Number(originalTables.kungfus[id]?.type || 0);
      return type >= 1 && type <= 10
        ? Math.max(highest, Number(level || 0))
        : highest;
    },
    0,
  );
}

export function npcCombatMultipliers(level: number) {
  if (level <= 0) return { vitality: 1, energy: 1, power: 1 };
  if (level < 40) return { vitality: 1.15, energy: 1.2, power: 1.05 };
  if (level < 80) return { vitality: 1.6, energy: 1.6, power: 1.12 };
  if (level < 120) return { vitality: 2.4, energy: 2.3, power: 1.22 };
  if (level < 160) return { vitality: 3.8, energy: 3.2, power: 1.35 };
  if (level < 200) return { vitality: 5.5, energy: 4.5, power: 1.5 };
  if (level < 230) return { vitality: 7.5, energy: 6, power: 1.7 };
  return { vitality: 10, energy: 8, power: 2 };
}

function innateBonus(level: number) {
  if (level < 80) return 0;
  if (level < 120) return 3;
  if (level < 160) return 6;
  if (level < 200) return 10;
  if (level < 230) return 15;
  return 20;
}

/** Preserve civilians and authored hierarchy while making true masters durable. */
export function scaledNpcCombatRecord(
  record: OriginalRecord,
  dynamic = false,
): OriginalRecord {
  if (dynamic) return record;
  const level = npcCombatLevel(record),
    multipliers = npcCombatMultipliers(level);
  if (level <= 0) return record;
  const maxHp = Math.max(
      Math.round(n(record, "maxhp") * multipliers.vitality),
      Math.floor((level * level) / 10),
    ),
    maxFp = Math.max(
      Math.round(n(record, "maxfp") * multipliers.energy),
      Math.floor((level * level) / 14),
    ),
    hasMagic = ((record.skill_list as number[][] | undefined) || []).some(
      ([id, skillLevel]) =>
        Number(skillLevel) > 0 &&
        Number(originalTables.kungfus[id]?.type || 0) === 8,
    ),
    maxMp = hasMagic
      ? Math.max(
          Math.round(n(record, "maxmp") * multipliers.energy),
          Math.floor((level * level) / 16),
        )
      : 0,
    bonus = innateBonus(level),
    boosted = (key: string, fallback?: string) =>
      Math.min(
        60,
        (n(record, key) || (fallback ? n(record, fallback) : 0)) + bonus,
      );
  return {
    ...record,
    hp: maxHp,
    maxhp: maxHp,
    fp: maxFp,
    maxfp: maxFp,
    mp: maxMp,
    maxmp: maxMp,
    fp_plus: Math.max(n(record, "fp_plus"), Math.floor(maxFp / 80)),
    mp_plus: hasMagic
      ? Math.max(n(record, "mp_plus"), Math.floor(maxMp / 80))
      : 0,
    atk: Math.round(n(record, "atk") * multipliers.power + level / 2),
    pdef: Math.round(n(record, "pdef") * multipliers.power + level / 3),
    base_hit: n(record, "base_hit") + (level >= 80 ? Math.floor(level * 0.4) : 0),
    base_str: boosted("base_str", "str"),
    base_agi: boosted("base_agi", "agi"),
    base_int: boosted("base_int", "int"),
    base_bon: boosted("base_bon", "bon"),
    str: boosted("str", "base_str"),
    agi: boosted("agi", "base_agi"),
    int: boosted("int", "base_int"),
    bon: boosted("bon", "base_bon"),
  };
}
