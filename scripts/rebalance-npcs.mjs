// 重平衡所有 NPC：把「等级 → 公平数值」的曲线写进原始数据，
// 移除对运行时倍率强化层的依赖。保留每个 NPC 相对同级同伴的个体差异
// （原数值比例），并温和抬升武功等级阶梯，使顶级高手接近满级玩家。
//
// 用法：node scripts/rebalance-npcs.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const enemiesPath = join(root, "game-data", "enemies.json");
const kungfusPath = join(root, "game-data", "kungfus.json");

const enemies = JSON.parse(readFileSync(enemiesPath, "utf8"));
const kungfus = JSON.parse(readFileSync(kungfusPath, "utf8")).data;
const data = enemies.data;

const kungfuType = (id) => Number(kungfus[id]?.type || 0);

// 战斗等级 = 战斗类武功(类型 1-10)的最高等级
function combatLevel(skillList) {
  return (skillList || []).reduce((highest, [id, level]) => {
    const t = kungfuType(id);
    return t >= 1 && t <= 10 ? Math.max(highest, Number(level || 0)) : highest;
  }, 0);
}
const isCaster = (skillList) =>
  (skillList || []).some(([id, level]) => kungfuType(id) === 8 && Number(level) > 0);

// —— 满级玩家数值天花板（NPC 永远略低于玩家）——
// 命中/闪避刻意压低：kfPower 公式本身随武功等级三次方放大，若 base_hit/eva
// 也拉高会叠加成"几乎打不中"的局面，顶级 NPC 只需少量基础命中/闪避即可。
// 四维(NPC)刻意保持低位：kfPower 的 force 倍率会把高 str/atk 放大成秒人伤害，
// 原版高手 str 都在 30-50 左右；玩家四维天然更高(约85-120)，玩家因此更强。
const CEIL = {
  hp: 3600, // 玩家满级约 4500
  fp: 12000, // 玩家满级约 12760（显示对齐，伤害另由 fp_plus 控制）
  atk: 110, // 玩家攻击可达 ~99-300，NPC 略低
  pdef: 180,
  hit: 80,
  eva: 40,
};
// stat = base + (ceiling - base) * (level/255)^p
const curve = (level, base, ceiling, p) =>
  Math.floor(base + (ceiling - base) * Math.pow(level / 255, p));

// 武功等级阶梯抬升：把中间等级上抬，顶级高手保持在 250 附近
const scaleLevel = (level) =>
  level <= 0
    ? 0
    : Math.min(254, Math.max(level, Math.round(254 * Math.pow(level / 255, 0.85))));

// —— 计算每个 NPC 的原始战斗等级与数值，用于同级基准（保留个体差异）——
const originalLevel = data.map((e) => (e ? combatLevel(e.skill_list) : 0));
const bucketIndex = (level) =>
  level < 40 ? 0 : level < 80 ? 1 : level < 120 ? 2 : level < 160 ? 3 : level < 200 ? 4 : level < 230 ? 5 : 6;

const STAT_KEYS = ["maxhp", "maxfp", "str", "agi", "int", "bon", "atk", "pdef", "base_hit", "base_eva"];
const buckets = Array.from({ length: 7 }, () => ({}));
data.forEach((e, i) => {
  if (!e) return;
  const bucket = buckets[bucketIndex(originalLevel[i])];
  for (const key of STAT_KEYS) {
    const v = Number(e[key] || 0);
    (bucket[key] ||= []).push(v);
  }
});
const median = (arr) => {
  if (!arr || !arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};
const bucketMedians = buckets.map((b) => {
  const out = {};
  for (const key of STAT_KEYS) out[key] = median(b[key]);
  return out;
});
const identityFactor = (existing, cohortMedian) =>
  cohortMedian > 0 ? Math.max(0.8, Math.min(1.2, Number(existing || 0) / cohortMedian)) : 1;

// —— 重写每个 NPC 的数值与武功 ——
let changed = 0,
  kept = 0;
for (let i = 0; i < data.length; i++) {
  const e = data[i];
  if (!e) continue;
  const oldLevel = originalLevel[i];
  if (oldLevel <= 0) {
    // 百姓 / 无战斗武学者保持原值
    kept++;
    continue;
  }
  // 1) 武功阶梯抬升
  e.skill_list = e.skill_list.map(([id, level]) => [id, scaleLevel(Number(level || 0))]);
  const level = combatLevel(e.skill_list); // 抬升后的战斗等级
  const cohort = bucketMedians[bucketIndex(oldLevel)];
  const idv = (key, existing) => identityFactor(existing, cohort[key]);
  const caster = isCaster(e.skill_list);
  // 2) 数值 = 等级曲线 × 同级个体差异
  // 天花板钳制：任何 NPC 都不超过满级玩家（玩家保持最强）
  const cap = (value, ceiling) => Math.min(ceiling, Math.max(0, Math.round(value)));
  const maxhp = cap(curve(level, 100, CEIL.hp, 1.8) * idv("maxhp", e.maxhp), CEIL.hp);
  const maxfp = cap(curve(level, 80, CEIL.fp, 1.8) * idv("maxfp", e.maxfp), CEIL.fp);
  const maxmp = caster
    ? cap(curve(level, 80, CEIL.fp, 1.8) * idv("maxfp", e.maxfp), CEIL.fp)
    : 0;
  e.maxhp = e.hp = e.full_hp = maxhp;
  e.maxfp = e.fp = e.maxsp = maxfp;
  e.maxmp = e.mp = maxmp;
  // 加力封顶为 等级/4，低于玩家的「内功/2」，控制高 force 武功的伤害
  e.fp_plus = Math.max(Number(e.fp_plus || 0), Math.floor(level / 4));
  e.mp_plus = caster ? Math.max(Number(e.mp_plus || 0), Math.floor(level / 4)) : 0;
  // 四维保持原值（不抬升，避免 force 倍率放大成秒人伤害）
  e.base_str = e.str;
  e.base_agi = e.agi;
  e.base_int = e.int;
  e.base_bon = e.bon;
  e.atk = cap(curve(level, 8, CEIL.atk, 1.3) * idv("atk", e.atk), CEIL.atk);
  e.pdef = cap(curve(level, 8, CEIL.pdef, 1.3) * idv("pdef", e.pdef), CEIL.pdef);
  e.base_hit = cap(curve(level, 5, CEIL.hit, 1.2) * idv("base_hit", e.base_hit), CEIL.hit);
  e.base_eva = cap(curve(level, 3, CEIL.eva, 1.2) * idv("base_eva", e.base_eva), CEIL.eva);
  changed++;
}
// 同步 database 计数报告字段（若有）
if (enemies.count !== undefined) enemies.count = data.length;

writeFileSync(enemiesPath, JSON.stringify(enemies, null, 2) + "\n");
console.log(`完成：重写 ${changed} 个 NPC，保留 ${kept} 个无战斗武学者。`);
console.log("示例 白瑞德(111):", JSON.stringify({ maxhp: data[111].maxhp, maxfp: data[111].maxfp, atk: data[111].atk, pdef: data[111].pdef, skill39: data[111].skill_list.find(([id]) => id === 39) }));
console.log("示例 东方求败(196):", JSON.stringify({ maxhp: data[196].maxhp, maxfp: data[196].maxfp, atk: data[196].atk }));
console.log("示例 黑衣教众(76):", JSON.stringify({ maxhp: data[76].maxhp, maxfp: data[76].maxfp, skill: data[76].skill_list.slice(0, 3) }));
