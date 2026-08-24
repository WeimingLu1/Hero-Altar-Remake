// 从固定的强化版提取数据重新生成网页版 NPC 武学与战斗数值。
// 生成过程必须可重复运行：严禁把已经生成过的 enemies.json 再当输入叠加强化。
//
// 用法：node scripts/rebalance-npcs.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "game-data", "enemies_plus.json");
const enemiesPath = join(root, "game-data", "enemies.json");
const teachingPath = join(root, "game-data", "npc-teaching.json");
const kungfusPath = join(root, "game-data", "kungfus.json");
const weaponsPath = join(root, "game-data", "weapons.json");

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const enemies = structuredClone(baseline);
const kungfus = JSON.parse(readFileSync(kungfusPath, "utf8")).data;
const weapons = JSON.parse(readFileSync(weaponsPath, "utf8")).data;
const data = enemies.data;

const SCHOOL_POOLS = {
  1: [12, 15, 16, 14, 13], // 八卦：掌、轻、内、刀、八阵掌
  2: [17, 20, 21, 18, 19, 22], // 花间：掌、轻、内、刀、鞭、学识
  3: [23, 25, 26, 24, 27], // 红莲：拳、轻、内、杖、教义
  4: [28, 30, 31, 29], // 尹贺：拳、轻、内、刀
  5: [32, 35, 36, 33, 34], // 太极：拳、轻、内、剑、刀
  6: [37, 40, 41, 39, 38], // 雪山：擒拿、轻、内、雪山剑、入门剑
  7: [43, 46, 47, 44, 42, 45, 48], // 兽王：拳、轻、内、鹰爪、猿拳、刀、学识
  8: [49, 50, 51, 52, 53, 54, 55], // 茅山：掌、轻、内、三系法术、学识
};

const schoolForSkill = (id) => {
  if (id >= 12 && id <= 16) return 1;
  if (id >= 17 && id <= 22) return 2;
  if (id >= 23 && id <= 27) return 3;
  if (id >= 28 && id <= 31) return 4;
  if (id >= 32 && id <= 36) return 5;
  if (id >= 37 && id <= 41) return 6;
  if (id >= 42 && id <= 48) return 7;
  if (id >= 49 && id <= 55) return 8;
  return 0; // 56–59 为秘传，不参与门派推断。
};
const kungfuType = (id) => Number(kungfus[id]?.type || 0);
const combatLevel = (skillList) =>
  (skillList || []).reduce((highest, [id, level]) => {
    const type = kungfuType(id);
    return id >= 12 && type >= 1 && type <= 10
      ? Math.max(highest, Number(level || 0))
      : highest;
  }, 0);

const rankFor = (level) => {
  if (level >= 220) return { name: "宗师", skill: 254, stat: 1, exp: 6_500_000, count: 99 };
  if (level >= 180) return { name: "掌门", skill: 245, stat: 0.88, exp: 6_000_000, count: 99 };
  if (level >= 140) return { name: "长老", skill: 220, stat: 0.68, exp: 5_000_000, count: 99 };
  if (level >= 100) return { name: "高手", skill: 185, stat: 0.48, exp: 3_500_000, count: 99 };
  if (level >= 60) return { name: "弟子", skill: 145, stat: 0.3, exp: 2_000_000, count: 5 };
  return { name: "入门", skill: 110, stat: 0.16, exp: 1_000_000, count: 4 };
};

const primarySchool = (record) => {
  const declared = Number(record.type || 0);
  if (declared >= 1 && declared <= 8) return declared;
  const score = new Map();
  for (const [id, level] of record.skill_list || []) {
    const school = schoolForSkill(id);
    if (school) score.set(school, (score.get(school) || 0) + Number(level || 0));
  }
  return [...score].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] || 0;
};

const orderedSchoolPool = (school, weaponId) => {
  const pool = [...(SCHOOL_POOLS[school] || [])];
  const weaponType = Number(weapons[weaponId]?.type ?? -1);
  const desiredKungfuType = weaponType >= 0 ? weaponType + 3 : 0;
  const order = new Map(pool.map((id, index) => [id, index]));
  return pool.sort((a, b) => {
    const priority = (id) => {
      const type = kungfuType(id);
      if (type === 2 || type === 9 || type === 1) return 0;
      if (desiredKungfuType && type === desiredKungfuType) return 1;
      if (type === 8) return 2;
      if (type >= 3 && type <= 7) return 3;
      return 4; // 学识等非直接战斗武功只给高阶人物。
    };
    return priority(a) - priority(b) || order.get(a) - order.get(b);
  });
};

const originalLevel = data.map((record) => (record ? combatLevel(record.skill_list) : 0));
const bucketIndex = (level) =>
  level < 40 ? 0 : level < 80 ? 1 : level < 120 ? 2 : level < 160 ? 3 : level < 200 ? 4 : level < 230 ? 5 : 6;
const STAT_KEYS = ["maxhp", "maxfp", "str", "agi", "int", "bon", "atk", "pdef", "base_hit", "base_eva"];
const buckets = Array.from({ length: 7 }, () => ({}));
data.forEach((record, id) => {
  if (!record) return;
  const bucket = buckets[bucketIndex(originalLevel[id])];
  for (const key of STAT_KEYS) (bucket[key] ||= []).push(Number(record[key] || 0));
});
const median = (values) => {
  if (!values?.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};
const bucketMedians = buckets.map((bucket) =>
  Object.fromEntries(STAT_KEYS.map((key) => [key, median(bucket[key])])),
);
const identityFactor = (existing, cohortMedian) =>
  cohortMedian > 0
    ? Math.max(0.8, Math.min(1.2, Number(existing || 0) / cohortMedian))
    : 1;
const cap = (value, ceiling) => Math.min(ceiling, Math.max(0, Math.round(value)));

const CEIL = { hp: 12000, fp: 45000, four: 45, atk: 110, pdef: 200, hit: 75, eva: 45 };
const bestSkillOfType = (skills, type) =>
  [...skills.entries()]
    .filter(([id, level]) => kungfuType(id) === type && level > 0)
    .sort(
      (a, b) =>
        Number(b[0] >= 12) - Number(a[0] >= 12) ||
        b[1] - a[1] ||
        b[0] - a[0],
    )[0]?.[0] || 0;

// 战斗掌握与教学上限分离：新增到师父身上的战斗武功不会自动开放给玩家请教。
const teaching = {
  format: "rmxp-hero-data",
  version: 1,
  kind: "npc-teaching",
  data: data.map((record, id) =>
    record && (Number(record.type || 0) > 0 || id === 7 || id === 31)
      ? structuredClone(record.skill_list || [])
      : null,
  ),
};

const report = [];
for (let id = 0; id < data.length; id++) {
  const record = data[id];
  if (!record) continue;
  const level0 = originalLevel[id];
  if (id === 198) {
    report.push({ id, name: record.name, rank: "动态通缉占位", school: 0, before: 0, after: 0, added: [] });
    continue;
  }

  if (level0 <= 0) {
    // 百姓与非战斗人物只略升生存能力，不凭空授予门派绝学。
    const maxhp = Math.min(1500, Math.max(Number(record.maxhp || 1), Math.round(Number(record.maxhp || 1) * 1.2)));
    const maxfp = Math.min(2000, Math.max(Number(record.maxfp || 0), Math.round(Number(record.maxfp || 0) * 1.15)));
    record.maxhp = record.hp = record.full_hp = maxhp;
    record.maxfp = record.fp = record.maxsp = maxfp;
    for (const key of ["str", "agi", "int", "bon"])
      record[key] = Math.min(35, Number(record[key] || 20) + 1);
    record.base_str = record.str;
    record.base_agi = record.agi;
    record.base_int = record.int;
    record.base_bon = record.bon;
    record.atk = Math.max(5, Number(record.atk || 0));
    record.pdef = Math.max(5, Number(record.pdef || 0));
    record.base_hit = Math.max(3, Number(record.base_hit || 0));
    record.base_eva = Math.max(2, Number(record.base_eva || 0));
    report.push({ id, name: record.name, rank: "百姓", school: 0, before: 0, after: 0, added: [] });
    continue;
  }

  const rank = rankFor(level0);
  const school = primarySchool(record);
  const skills = new Map(
    (record.skill_list || []).map(([skillId, level]) => [
      Number(skillId),
      Math.min(254, Math.max(Number(level || 0), Math.round((Number(level || 0) * rank.skill) / Math.max(1, level0)))),
    ]),
  );
  const added = [];

  if (school) {
    const pool = orderedSchoolPool(school, Number(record.weapon_id || 0)).filter(
      (skillId) => kungfuType(skillId) !== 11 || level0 >= 140,
    );
    const chosen = rank.count >= pool.length ? pool : pool.slice(0, rank.count);
    for (const skillId of chosen) {
      if (skills.has(skillId)) continue;
      const type = kungfuType(skillId);
      const equippedWeaponType = Number(weapons[Number(record.weapon_id || 0)]?.type ?? -1) + 3;
      const learnedLevel = type === 11
        ? Math.max(60, Math.floor(rank.skill * 0.65))
        : type >= 3 && type <= 7 && type !== equippedWeaponType
          ? Math.max(70, Math.floor(rank.skill * 0.82))
          : rank.skill;
      skills.set(skillId, learnedLevel);
      added.push(skillId);
    }
  }

  // 每一门专门武功都补足对应基础功夫；所有武林人物具备基本内功、拳脚、轻功和招架。
  const requiredBasics = new Set([1, 2, 9, 10]);
  for (const skillId of skills.keys()) {
    const type = kungfuType(skillId);
    if (skillId >= 12 && type >= 1 && type <= 10) requiredBasics.add(type);
  }
  for (const basicId of requiredBasics)
    skills.set(basicId, Math.max(skills.get(basicId) || 0, rank.skill));

  record.skill_list = [...skills.entries()];
  record.skill_count = record.skill_list.length;
  const weaponType = Number(weapons[Number(record.weapon_id || 0)]?.type ?? -1);
  const hand = bestSkillOfType(skills, 2) || 2;
  const armed = weaponType >= 0 ? bestSkillOfType(skills, weaponType + 3) : 0;
  const dodge = bestSkillOfType(skills, 9) || 9;
  const inner = bestSkillOfType(skills, 1) || 1;
  const magic = bestSkillOfType(skills, 8);
  record.skill_use = [hand, armed, dodge, inner, armed || hand, magic];

  const cohort = bucketMedians[bucketIndex(level0)];
  const scaled = (ceiling, key, existing) =>
    cap(ceiling * rank.stat * identityFactor(existing, cohort[key]), ceiling);
  const maxhp = Math.max(Number(record.maxhp || 1), scaled(CEIL.hp, "maxhp", record.maxhp));
  const maxfp = Math.max(Number(record.maxfp || 0), scaled(CEIL.fp, "maxfp", record.maxfp));
  const caster = [...skills.keys()].some((skillId) => kungfuType(skillId) === 8);
  const maxmp = caster ? Math.max(Number(record.maxmp || 0), maxfp) : 0;
  record.maxhp = record.hp = record.full_hp = maxhp;
  record.maxfp = record.fp = record.maxsp = maxfp;
  record.maxmp = record.mp = maxmp;
  record.exp = Math.max(Number(record.exp || 0), rank.exp);
  record.fp_plus = Math.max(Number(record.fp_plus || 0), Math.floor(rank.skill / 3));
  record.mp_plus = caster ? Math.max(Number(record.mp_plus || 0), Math.floor(rank.skill / 3)) : 0;
  for (const key of ["str", "agi", "int", "bon"])
    record[key] = Math.max(Number(record[key] || 0), scaled(CEIL.four, key, record[key]));
  record.base_str = record.str;
  record.base_agi = record.agi;
  record.base_int = record.int;
  record.base_bon = record.bon;
  record.atk = Math.max(Number(record.atk || 0), scaled(CEIL.atk, "atk", record.atk));
  record.pdef = Math.max(Number(record.pdef || 0), scaled(CEIL.pdef, "pdef", record.pdef));
  record.base_hit = Math.max(Number(record.base_hit || 0), scaled(CEIL.hit, "base_hit", record.base_hit));
  record.base_eva = Math.max(Number(record.base_eva || 0), scaled(CEIL.eva, "base_eva", record.base_eva));
  report.push({ id, name: record.name, rank: rank.name, school, before: level0, after: combatLevel(record.skill_list), added });
}

writeFileSync(enemiesPath, JSON.stringify(enemies, null, 2) + "\n");
writeFileSync(teachingPath, JSON.stringify(teaching, null, 2) + "\n");

const martial = report.filter((entry) => entry.before > 0);
const civilians = report.filter((entry) => entry.rank === "百姓");
const addedSkills = martial.reduce((sum, entry) => sum + entry.added.length, 0);
console.log(`完成：强化 ${martial.length} 名武林人物、${civilians.length} 名普通人物；新增 ${addedSkills} 门人物武功。`);
for (const school of Object.keys(SCHOOL_POOLS).map(Number)) {
  const members = martial.filter((entry) => entry.school === school);
  console.log(`  门派 ${school}：${members.length} 人，新增 ${members.reduce((sum, entry) => sum + entry.added.length, 0)} 门武功`);
}
for (const id of [76, 111, 129, 144, 196]) {
  const record = data[id];
  console.log(`  ${record.name}(${id})：lv${combatLevel(record.skill_list)} hp${record.maxhp} fp${record.maxfp} 武功${record.skill_list.length}门`);
}
