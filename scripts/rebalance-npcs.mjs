// 重平衡所有 NPC：把「等级 → 公平数值」的曲线写进原始数据，
// 移除对运行时倍率强化层的依赖。数值与武功都以满级玩家为对标基准，
// 玩家保持最强，顶级高手（门派掌门/宗师）与玩家旗鼓相当。
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
const combatLevel = (skillList) =>
  (skillList || []).reduce((highest, [id, level]) => {
    const t = kungfuType(id);
    return t >= 1 && t <= 10 ? Math.max(highest, Number(level || 0)) : highest;
  }, 0);
const isCaster = (skillList) =>
  (skillList || []).some(([id, level]) => kungfuType(id) === 8 && Number(level) > 0);

// —— 满级玩家数值基准（NPC 永远略低于玩家）——
// maxFp≈11870-13110(max内功有效等级127), 基础满血≈3700, 四维≈55(先天30+基本功25),
// atk≈99(绣花针)/自制武器更高, pdef 可叠防具到 ~400。
const CEIL = {
  hp: 3650, // 玩家 3700
  fp: 13000, // 玩家 11870-13110（接近满级容量）
  four: 45, // 玩家约 55
  atk: 110, // 玩家 99-300（自制武器）
  pdef: 200, // 玩家可叠到 400
  hit: 75,
  eva: 45,
};
// stat = base + (ceiling - base) * (level/255)^p
const curve = (level, base, ceiling, p) =>
  Math.floor(base + (ceiling - base) * Math.pow(level / 255, p));
const cap = (value, ceiling) => Math.min(ceiling, Math.max(0, Math.round(value)));

// —— 武功等级阶梯：按原始档位分档，让更多高手足以与满级玩家过招 ——
// 宗师/顶尖高手/高手统一高武功与高数值，其余人按曲线平滑下降。
const TIERS = [
  { min: 220, skill: 254, stat: 1.0 }, // 宗师（门派掌门/三大宗师）
  { min: 160, skill: 250, stat: 0.95 }, // 顶尖高手
  { min: 110, skill: 242, stat: 0.82 }, // 高手
];
const tierFor = (lvl0) => TIERS.find((t) => lvl0 >= t.min) || null;
const topTierLevel = 254;
const targetLevel = (lvl0) =>
  Math.max(lvl0, Math.round(topTierLevel * Math.pow(lvl0 / 250, 0.5)));
// NPC 经验对标玩家（玩家满级 1000 万给 kfPower 加 10 万）。
// 分档高手取玩家的 45%-80%，让命中率不被玩家 1000 万经验彻底碾压。
const targetExp = (lvl0) => {
  const tier = tierFor(lvl0);
  if (tier && tier.min >= 220) return 6_500_000;
  if (tier && tier.min >= 160) return 6_000_000;
  if (tier && tier.min >= 110) return 5_000_000;
  return Math.round(2_500_000 * Math.pow(lvl0 / 255, 1.3));
};

// —— 每个 NPC 的原始战斗等级与数值，用于同级基准（保留个体差异）——
const originalLevel = data.map((e) => (e ? combatLevel(e.skill_list) : 0));
const bucketIndex = (level) =>
  level < 40 ? 0 : level < 80 ? 1 : level < 120 ? 2 : level < 160 ? 3 : level < 200 ? 4 : level < 230 ? 5 : 6;

const STAT_KEYS = ["maxhp", "maxfp", "str", "agi", "int", "bon", "atk", "pdef", "base_hit", "base_eva", "exp"];
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

let changed = 0, kept = 0;
for (let i = 0; i < data.length; i++) {
  const e = data[i];
  if (!e) continue;
  const lvl0 = originalLevel[i];
  if (lvl0 <= 0) {
    kept++; // 百姓 / 无战斗武学者保持原值
    continue;
  }
  // 1) 武功阶梯：分档统一高武功，其余按曲线平滑下降
  const tier = tierFor(lvl0);
  if (tier) {
    e.skill_list = e.skill_list.map(([id, lv]) =>
      kungfuType(id) >= 1 && kungfuType(id) <= 10 ? [id, tier.skill] : [id, lv],
    );
  } else {
    const target = targetLevel(lvl0);
    const scale = target / lvl0;
    e.skill_list = e.skill_list.map(([id, lv]) =>
      lv <= 0 ? [id, 0] : [id, Math.min(254, Math.round(Number(lv) * scale))],
    );
  }
  const level = combatLevel(e.skill_list);
  // 2) 经验对标玩家（只影响 NPC 自身 kfPower，击杀奖励不含经验）
  e.exp = targetExp(lvl0);
  const cohort = bucketMedians[bucketIndex(lvl0)];
  const idv = (key, existing) => identityFactor(existing, cohort[key]);
  const caster = isCaster(e.skill_list);
  // 3) 数值 = 玩家对标曲线 × 同级个体差异；分档高手按档位比例取天花板
  const scaled = (base, ceiling, p, key, existing) =>
    tier
      ? cap(ceiling * tier.stat * idv(key, existing), ceiling)
      : cap(curve(level, base, ceiling, p) * idv(key, existing), ceiling);
  const maxhp = scaled(100, CEIL.hp, 1.8, "maxhp", e.maxhp);
  const maxfp = scaled(80, CEIL.fp, 1.8, "maxfp", e.maxfp);
  const maxmp = caster ? scaled(80, CEIL.fp, 1.8, "maxfp", e.maxfp) : 0;
  e.maxhp = e.hp = e.full_hp = maxhp;
  e.maxfp = e.fp = e.maxsp = maxfp;
  e.maxmp = e.mp = maxmp;
  // 加力封顶 等级/3（玩家「内功/2」≈127），NPC 加力参与战斗伤害，
  // 让高手与满级玩家的伤害端更接近；force 倍率已封顶控制上限
  e.fp_plus = Math.max(Number(e.fp_plus || 0), Math.floor(level / 3));
  e.mp_plus = caster ? Math.max(Number(e.mp_plus || 0), Math.floor(level / 3)) : 0;
  // 四维对标玩家（约 50 顶），先天=实战
  for (const key of ["str", "agi", "int", "bon"]) {
    e[key] = scaled(15, CEIL.four, 1.1, key, e[key]);
  }
  e.base_str = e.str; e.base_agi = e.agi; e.base_int = e.int; e.base_bon = e.bon;
  e.atk = scaled(8, CEIL.atk, 1.3, "atk", e.atk);
  e.pdef = scaled(8, CEIL.pdef, 1.3, "pdef", e.pdef);
  e.base_hit = scaled(5, CEIL.hit, 1.2, "base_hit", e.base_hit);
  e.base_eva = scaled(3, CEIL.eva, 1.2, "base_eva", e.base_eva);
  changed++;
}

writeFileSync(enemiesPath, JSON.stringify(enemies, null, 2) + "\n");
console.log(`完成：重写 ${changed} 个 NPC，保留 ${kept} 个无战斗武学者。`);
for (const id of [111, 196, 144, 129, 76]) {
  console.log(`  ${data[id].name}(${id}): lv${combatLevel(data[id].skill_list)} exp${data[id].exp} hp${data[id].maxhp} fp${data[id].maxfp} atk${data[id].atk} str${data[id].str} 主攻${data[id].skill_use[0]}:${data[id].skill_list.find(([s]) => s === (Number(data[id].weapon_id||0) > 0 ? data[id].skill_use[1] : data[id].skill_use[0]))?.[1]}`);
}
