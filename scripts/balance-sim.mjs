// 战斗平衡模拟：esbuild 打包 sim 层后在 node 中跑 N 场自动战斗，输出达标表
// 用法：npm run balance
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = path.join(root, "scripts", ".balance-bundle.mjs");

execFileSync(
  path.join(root, "node_modules", ".bin", "esbuild"),
  [
    path.join(root, "scripts", "balance-entry.ts"),
    "--bundle",
    "--format=esm",
    "--platform=node",
    `--outfile=${bundle}`,
    "--log-level=warning"
  ],
  { stdio: "inherit" }
);

const sim = await import(pathToFileURL(bundle).href + "?t=" + Date.now());

/* ---------------- 检查点玩家 ---------------- */

function mkPlayer(cfg) {
  const s = sim.newGame("模拟", "male", cfg.attrs);
  const p = s.player;
  Object.assign(p.skills, cfg.skills);
  p.weapon = cfg.weapon;
  p.armor = cfg.armor;
  p.accessory = cfg.accessory;
  p.weaponsOwned = [cfg.weapon];
  p.armorsOwned = [cfg.armor];
  p.accessoriesOwned = [cfg.accessory];
  p.neigong = cfg.neigong || null;
  p.neiliStrength = cfg.neili;
  p.age = cfg.age;
  p.items = { jinchuang: 30 };
  p.hp = p.effHp = sim.maxHp(p);
  p.mp = sim.maxMp(p);
  return s;
}

const CHECKPOINTS = {
  C1: {
    label: "C1 新手",
    attrs: { li: 16, wu: 14, min: 16, gen: 14 },
    skills: { jibenQuan: 10, jibenJian: 1, jibenNeiGong: 1, jibenQingGong: 1, jibenZhaoJia: 1, duShu: 1 },
    weapon: "fist",
    armor: "buyi",
    accessory: "pifeng",
    neigong: null,
    neili: 20,
    age: 14
  },
  C2: {
    label: "C2 入门",
    attrs: { li: 24, wu: 18, min: 18, gen: 20 },
    skills: { jibenQuan: 20, jibenJian: 30, taiJiJian: 40, taiJiShenGong: 30, jibenNeiGong: 30, jibenQingGong: 20, jibenZhaoJia: 20, duShu: 10 },
    weapon: "tiejian",
    armor: "jingbuyi",
    accessory: "niupiDai",
    neigong: "taiJiShenGong",
    neili: 110,
    age: 16
  },
  C3: {
    label: "C3 高手",
    attrs: { li: 30, wu: 20, min: 20, gen: 26 },
    skills: { jibenQuan: 60, jibenJian: 80, taiJiJian: 100, taiJiShenGong: 80, jibenNeiGong: 80, jibenQingGong: 60, jibenZhaoJia: 60, duShu: 30 },
    weapon: "xuantieJian",
    armor: "jinSuoZi",
    accessory: "heiyanZhao",
    neigong: "taiJiShenGong",
    neili: 380,
    age: 20
  },
  C4: {
    label: "C4 毕业",
    attrs: { li: 40, wu: 24, min: 20, gen: 26 },
    skills: { jibenQuan: 150, jibenJian: 150, taiJiJian: 150, taiJiShenGong: 150, jibenNeiGong: 150, jibenQingGong: 100, jibenZhaoJia: 150, duShu: 60 },
    weapon: "yitian",
    armor: "liangyin",
    accessory: "heiyanZhao",
    neigong: "taiJiShenGong",
    neili: 999,
    age: 22
  }
};

/* ---------------- 自动战斗 ---------------- */

function fight(cfg, enemyId, maxTurns = 60) {
  const s = mkPlayer(cfg);
  const b = sim.startBattle(s, enemyId);
  let potions = 0;
  while (!b.over && b.turn < maxTurns) {
    const p = b.player;
    if (p.hp < p.maxHp * 0.3 && (s.player.items.jinchuang || 0) > 0) {
      sim.playerItem(b, s, "jinchuang");
      potions += 1;
    } else if (Math.random() < 0.3) {
      const ults = sim.availableUts(s).filter((u) => u.kind === "attack" && u.cost <= p.mp);
      if (ults.length) sim.playerUlt(b, s, ults.sort((a, c) => c.mult - a.mult)[0]);
      else sim.playerAttack(b, s);
    } else {
      sim.playerAttack(b, s);
    }
  }
  return {
    win: b.over && b.victory,
    turns: b.turn,
    hpLoss: 100 * (1 - b.player.hp / b.player.maxHp),
    potions
  };
}

function simulate(cpId, enemyId, runs = 200) {
  const cfg = CHECKPOINTS[cpId];
  let wins = 0;
  let turns = 0;
  let hpLossWin = 0;
  let winCount = 0;
  let potions = 0;
  for (let i = 0; i < runs; i++) {
    const r = fight(cfg, enemyId);
    if (r.win) {
      wins += 1;
      hpLossWin += r.hpLoss;
      winCount += 1;
    }
    turns += r.turns;
    potions += r.potions;
  }
  return {
    winRate: ((wins / runs) * 100).toFixed(0),
    avgTurns: (turns / runs).toFixed(1),
    avgLoss: winCount ? (hpLossWin / winCount).toFixed(0) : "-",
    avgPotions: (potions / runs).toFixed(1)
  };
}

/* ---------------- 检查点面板 ---------------- */

console.log("\n## 检查点玩家面板（公式实算）\n");
console.log("| 检查点 | 攻击 | 防御 | 气血 | 内力 |");
console.log("|---|---|---|---|---|");
for (const [id, cfg] of Object.entries(CHECKPOINTS)) {
  const s = mkPlayer(cfg);
  console.log(`| ${cfg.label} | ${sim.attackPower(s.player)} | ${sim.defensePower(s.player)} | ${sim.maxHp(s.player)} | ${sim.maxMp(s.player)} |`);
}

/* ---------------- 学艺曲线 ---------------- */

const dummy = mkPlayer(CHECKPOINTS.C2);
dummy.player.attrs.wu = 0;
dummy.player.skills.duShu = 0;
const c0100 = sim.learnCost("taiJiJian", 0, 100, dummy.player);
const c100150 = sim.learnCost("taiJiJian", 100, 150, dummy.player);
dummy.player.attrs.wu = 30;
const c0100w30 = sim.learnCost("taiJiJian", 0, 100, dummy.player);
const c100150w30 = sim.learnCost("taiJiJian", 100, 150, dummy.player);
console.log("\n## 学艺潜能曲线（门派武功 taiJiJian）\n");
console.log(`- 0→100 级（悟性 0 / 30）：${c0100} / ${c0100w30} 潜能`);
console.log(`- 100→150 级（悟性 0 / 30）：${c100150} / ${c100150w30} 潜能`);

/* ---------------- 战斗矩阵 ---------------- */

const MATRIX = [
  ["C1", ["yezhu", "elang", "dushe", "jianjing", "jiading", "zhouSan"]],
  ["C2", ["jianjing", "shanzei", "jiading", "xueLang", "zhaiTou", "eGui", "qingLongJingWei", "zhouSan", "yunZhongHe", "qingLongTanZhu"]],
  ["C3", ["zhaiTou", "qingLongJingWei", "yunZhongHe", "qingLongTanZhu", "qingXu", "wangWeiYang", "baiRuiDe", "liQingZhao", "heZhongYang", "yuHongRu", "qiaoSiHai"]],
  ["C4", ["qingLongTanZhu", "qingXu", "yuHongRu", "qiaoSiHai", "woShiShui", "daoDeHeShang", "dongFangQiuBai"]]
];

// 切磋 spar-* 四档抽一名代表
const sparRep = {};
for (const [npcId, npc] of Object.entries(sim.NPCS)) {
  const tier = npc.master ? 4 : npc.learn || npc.learnBasic ? 3 : npc.walk ? 2 : 1;
  if (!sparRep[tier]) sparRep[tier] = npcId;
}
const SPAR_MATRIX = [
  ["C1", 1],
  ["C2", 2],
  ["C2", 3],
  ["C3", 4]
];

console.log("\n## 战斗模拟（每组 200 场；战损为胜场平均气血损失%）\n");
console.log("| 检查点 | 敌人 | AI | 胜率% | 平均回合 | 胜场战损% | 场均金创药 |");
console.log("|---|---|---|---|---|---|---|");
for (const [cpId, enemies] of MATRIX) {
  for (const eid of enemies) {
    const e = sim.ENEMIES[eid];
    const r = simulate(cpId, eid);
    console.log(`| ${CHECKPOINTS[cpId].label} | ${e.name} | ${e.ai} | ${r.winRate} | ${r.avgTurns} | ${r.avgLoss} | ${r.avgPotions} |`);
  }
}
for (const [cpId, tier] of SPAR_MATRIX) {
  const npcId = sparRep[tier];
  if (!npcId) continue;
  const eid = `spar-${npcId}`;
  const e = sim.ENEMIES[eid];
  if (!e) continue;
  const r = simulate(cpId, eid);
  console.log(`| ${CHECKPOINTS[cpId].label} | ${e.name}(切磋T${tier}) | ${e.ai} | ${r.winRate} | ${r.avgTurns} | ${r.avgLoss} | ${r.avgPotions} |`);
}

console.log("\n目标区间：野怪 4-6 回合/战损 10-20%；精英 6-10 回合/25-40%；掌门 8-12 回合/40-60%；终局 12-18 回合且需药品与防御。\n");
