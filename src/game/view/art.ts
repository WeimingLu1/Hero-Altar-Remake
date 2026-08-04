import Phaser from "phaser";

export interface CharPalette {
  hair: string;
  skin: string;
  top: string;
  pants: string;
  shoes: string;
  accent: string;
  eye: string;
}

const MALE: CharPalette = { hair: "#4a3626", skin: "#e8b58a", top: "#7a5a38", pants: "#4b453c", shoes: "#33291e", accent: "#c9a13a", eye: "#241a12" };
const FEMALE: CharPalette = { hair: "#3a2733", skin: "#f0c39a", top: "#c46a7a", pants: "#5b4a5e", shoes: "#4a3040", accent: "#e8b7c2", eye: "#241a12" };

// 人形模板：头身 12 行 + 腿 11 行（12 宽，画布 16×24）
const CHAR_TOP = [
  "....HHHH....",
  "...HHHHHH...",
  "...HHHHHH...",
  "...SSSSSS...",
  "...SE..ES...",
  "...SSSSSS...",
  "...TTTTTT...",
  "..TTTTTTTT..",
  ".TTTTTTTTTT.",
  ".TTTTTTTTTT.",
  "..AAAAAAAA..",
  "...TTTTTT..."
];

const CHAR_LEGS_IDLE = [
  "..PPPPPP....",
  "..PPPPPP....",
  "..PPP.PP....",
  "..PPP.PP....",
  "..PPP.PP....",
  "..PPP.PP....",
  "..PPP.PP....",
  "..PPP.PP....",
  "..PPP.PP....",
  "..OOO.OO....",
  "..OOO.OO...."
];

// 行走 A：左腿前跨、右腿后蹬；B 帧由镜像得到，两腿真正交替
const CHAR_LEGS_WALK = [
  "..PPPPPP....",
  "..PPPPPP....",
  ".PPPP.PPP...",
  ".PPP...PPP..",
  ".PP.....PP..",
  "PPP.....PPP.",
  "PP.......PP.",
  "PP.......PP.",
  "PP.......PP.",
  "OO........OO",
  "OO........OO"
];

function mirrorRows(rows: string[]): string[] {
  return rows.map((r) => r.split("").reverse().join(""));
}

const CHAR_ROWS = [...CHAR_TOP, ...CHAR_LEGS_IDLE];
const CHAR_ROWS_WALK = [...CHAR_TOP, ...CHAR_LEGS_WALK];
const CHAR_ROWS_WALK2 = [...CHAR_TOP, ...mirrorRows(CHAR_LEGS_WALK)];

// 壮汉模板：加宽人形（20 宽，画布 20×26）
const BRUTE_TOP = [
  "......HHHHHH........",
  ".....HHHHHHHH.......",
  ".....HHHHHHHH.......",
  ".....SSSSSSSS.......",
  ".....SESSSSES.......",
  ".....SSSSSSSS.......",
  "....TTTTTTTTTT......",
  "..TTTTTTTTTTTTTT....",
  ".TTTTTTTTTTTTTTTT...",
  ".TTTTTTTTTTTTTTTT...",
  ".TTTAAAAAAAAAAATT...",
  ".TTTTTTTTTTTTTTTT...",
  "..TTTTTTTTTTTTTT....",
  "...TTTTTTTTTTTT....."
];

const BRUTE_LEGS_IDLE = [
  "...PPPPPPPPPPP......",
  "...PPPPP..PPPPP.....",
  "...PPPPP..PPPPP.....",
  "...PPPP...PPPP......",
  "...PPPP...PPPP......",
  "...PPP....PPPP......",
  "...PPP.....PPP......",
  "...PPP.....PPP......",
  "...PPP.....PPP......",
  "...PPP.....PPP......",
  "..OOOO.....OOOO.....",
  "..OOOO.....OOOO....."
];

const BRUTE_LEGS_WALK = [
  "...PPPPPPPPPPP......",
  "..PPPPPP..PPPPPP....",
  "..PPPP.....PPPPP....",
  ".PPPP.......PPPP....",
  ".PPP.........PPP....",
  ".PPP.........PPP....",
  "PPPP.........PPPP...",
  "PPP...........PPP...",
  "PPP...........PPP...",
  "PPP...........PPP...",
  "OOOO..........OOOO..",
  "OOOO..........OOOO.."
];

const BRUTE_ROWS = [...BRUTE_TOP, ...BRUTE_LEGS_IDLE];
const BRUTE_ROWS_WALK = [...BRUTE_TOP, ...BRUTE_LEGS_WALK];
const BRUTE_ROWS_WALK2 = [...BRUTE_TOP, ...mirrorRows(BRUTE_LEGS_WALK)];

// 掌门/终局 BOSS 模板：戴冠高袍人形（14 宽，画布 16×28）
const BOSS_TOP = [
  ".....CCCCCC.....",
  "....HHHHHHHH....",
  "....HHHHHHHH....",
  "....HHHHHHHH....",
  "....SSSSSSSS....",
  "....SESSSSES....",
  "....SSSSSSSS....",
  ".....SSSSSS.....",
  "...TTTTTTTTTT...",
  "..TTTTTTTTTTTT..",
  ".TTTTTTTTTTTTTT.",
  ".TTTTTTTTTTTTTT.",
  ".TTAAAAAAAAAAAT.",
  ".TTTTTTTTTTTTTT.",
  "..TTTTTTTTTTTT..",
  "...TTTTTTTTTT..."
];

const BOSS_ROBE_IDLE = [
  "...PPPPPPPPPP...",
  "..PPPPPPPPPPPP..",
  "..PPPPP..PPPPP..",
  "..PPPP...PPPPP..",
  "..PPPP....PPPP..",
  "..PPP.....PPPP..",
  "..PPP......PPP..",
  "..PPP......PPP..",
  ".PPPP......PPPP.",
  ".PPPP......PPPP.",
  ".OOOO......OOOO.",
  ".OOOO......OOOO."
];

const BOSS_ROBE_WALK = [
  "...PPPPPPPPPP...",
  "..PPPPPPPPPPPP..",
  ".PPPPPP...PPPPP.",
  ".PPPP......PPPP.",
  ".PPP........PPP.",
  "PPPP........PPPP",
  "PPP..........PPP",
  "PPP..........PPP",
  "PPP..........PPP",
  "PPP..........PPP",
  "OOO..........OOO",
  "OOO..........OOO"
];

const BOSS_ROWS = [...BOSS_TOP, ...BOSS_ROBE_IDLE];
const BOSS_ROWS_WALK = [...BOSS_TOP, ...BOSS_ROBE_WALK];
const BOSS_ROWS_WALK2 = [...BOSS_TOP, ...mirrorRows(BOSS_ROBE_WALK)];

// 鬼影模板：无腿飘忽、半透明（14 宽，画布 16×24，底部留空制造悬浮感）
const GHOST_BODY = [
  ".....GGGGGG.....",
  "...GGGGGGGGGG...",
  "..GGGGGGGGGGGG..",
  "..GGEGGGGGGEGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG..",
  "..GGGGGGGGGGGG.."
];

const GHOST_HEM_IDLE = [
  "..GG.GGGG.GGGG..",
  "..GG..GGG...GG..",
  "...G...GG...G...",
  ".......GG.......",
  "................"
];

const GHOST_HEM_WALK = [
  "..GGG..GG..GGG..",
  "..GG...GGG...G..",
  "...G....GG..G...",
  "........G.......",
  "................"
];

const GHOST_HEM_WALK2 = [
  "..G.GGGGGG..G...",
  "...G..GG..G..G..",
  "....G..G..G.....",
  ".....G..........",
  "................"
];

const GHOST_ROWS = [...GHOST_BODY, ...GHOST_HEM_IDLE];
const GHOST_ROWS_WALK = [...GHOST_BODY, ...GHOST_HEM_WALK];
const GHOST_ROWS_WALK2 = [...GHOST_BODY, ...GHOST_HEM_WALK2];

// 兽形模板：20 宽，画在 24 高画布底部，脚掌与人形脚底对齐
const PAD10 = ["", "", "", "", "", "", "", "", "", ""].map(() => "....................");

const WOLF_BODY = [
  "................H..H",
  "...............HHHHH",
  ".T............HHHEHH",
  "TT.........HHHHHHHHH",
  ".THHHHHHHHHHHHHHHHHH",
  "..HHHHHHHHHHHHHHHHH.",
  "...HHHHHHHHHHHHHHH.."
];

const WOLF_LEGS_IDLE = [
  "...LL.........LLL...",
  "...LL.........LLL...",
  "...LL.........LLL...",
  "...LL.........LLL...",
  "...LL.........LLL...",
  "..OO.........OOOO...",
  "...................."
];

const WOLF_LEGS_WALK = [
  "....L.........LL....",
  "....L.........LL....",
  ".....L.........LL...",
  ".....L..........LL..",
  "......L..........LL.",
  ".....O...........OO.",
  "...................."
];

const WOLF_LEGS_WALK2 = [
  "....LL.........L....",
  "...LL..........L....",
  "...LL..........L....",
  "..LL............L...",
  "..LL............L...",
  "..OO............O...",
  "...................."
];

const BOAR_BODY = [
  "....................",
  "...HHHHHHHHHHHH.....",
  "..HHHHHHHHHHHHHHH...",
  ".HHHHHHHHHHHHHHHHH..",
  ".HHHHHHHHHHHHHHHEH..",
  ".HHHHHHHHHHHHHHHHNNN",
  ".HHHHHHHHHHHHHHHHWNW",
  "..HHHHHHHHHHHHHHHNNN",
  "...HHHHHHHHHHHHHH...",
  "....HHHHHHHHHHHH...."
];

const BOAR_LEGS_IDLE = [
  "....LL....LL...LL...",
  "....LL....LL...LL...",
  "....LL....LL...LL...",
  "...OO....OO...OO...."
];

const BOAR_LEGS_WALK = [
  ".....L.....L...L....",
  ".....L.....L....L...",
  "......L.....L...L...",
  ".....O.....O....OO.."
];

const BOAR_LEGS_WALK2 = [
  "....LL.....L...L....",
  "....LL.....L...L....",
  "...LL......L....L...",
  "...OO......O....O..."
];

const SNAKE_HEAD = [
  "....................",
  "................HH..",
  "...............HEHH.",
  "................HHH."
];

const SNAKE_BODY_IDLE = [
  "..SS...........H....",
  ".SSSSS.....SSSSS....",
  "SS...SSSSSSS....SS..",
  "SS..............SS..",
  ".SSSSSSSSSSSSSSSS...",
  "...................."
];

const SNAKE_BODY_WALK = [
  "....SS.........H....",
  "...SSSSS...SSSS.....",
  "..SS...SSSSS...SS...",
  "..SS..........SS....",
  "....SSSSSSSSSSSSSS..",
  "...................."
];

const SNAKE_BODY_WALK2 = [
  "......SS.......H....",
  ".....SSSSS.SSSSS....",
  "....SS...SS....SS...",
  "..SS..........SS....",
  "..SSSSSSSSSSSSSS....",
  "...................."
];

interface BeastDef {
  w: number;
  h: number;
  palette: Record<string, string>;
  idle: string[];
  walk: string[];
  walk2: string[];
}

const BEAST_DEFS: Record<string, BeastDef> = {
  wolf: {
    w: 20,
    h: 24,
    palette: { H: "#7a6a58", E: "#c83a2a", T: "#5f5245", L: "#5f5245", O: "#3f352b" },
    idle: [...PAD10, ...WOLF_BODY, ...WOLF_LEGS_IDLE],
    walk: [...PAD10, ...WOLF_BODY, ...WOLF_LEGS_WALK],
    walk2: [...PAD10, ...WOLF_BODY, ...WOLF_LEGS_WALK2]
  },
  snowwolf: {
    w: 20,
    h: 24,
    palette: { H: "#d8dee4", E: "#b82828", T: "#aab2bc", L: "#aab2bc", O: "#5f6874" },
    idle: [...PAD10, ...WOLF_BODY, ...WOLF_LEGS_IDLE],
    walk: [...PAD10, ...WOLF_BODY, ...WOLF_LEGS_WALK],
    walk2: [...PAD10, ...WOLF_BODY, ...WOLF_LEGS_WALK2]
  },
  boar: {
    w: 20,
    h: 24,
    palette: { H: "#6b5136", E: "#24180d", L: "#4a3826", O: "#33261a", N: "#c7b092", W: "#e8e0d0" },
    idle: [...PAD10, ...BOAR_BODY, ...BOAR_LEGS_IDLE],
    walk: [...PAD10, ...BOAR_BODY, ...BOAR_LEGS_WALK],
    walk2: [...PAD10, ...BOAR_BODY, ...BOAR_LEGS_WALK2]
  },
  snake: {
    w: 20,
    h: 24,
    palette: { S: "#4f8f5a", H: "#5c9a63", E: "#d8e05a" },
    idle: [...PAD10, ...PAD10.slice(0, 4), ...SNAKE_HEAD, ...SNAKE_BODY_IDLE],
    walk: [...PAD10, ...PAD10.slice(0, 4), ...SNAKE_HEAD, ...SNAKE_BODY_WALK],
    walk2: [...PAD10, ...PAD10.slice(0, 4), ...SNAKE_HEAD, ...SNAKE_BODY_WALK2]
  }
};

const GHOST_PALETTE = { G: "rgba(158,178,210,0.52)", E: "rgba(150,230,255,0.95)" };

function drawPixels(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  rows: string[],
  palette: Record<string, string>
): Phaser.Textures.CanvasTexture {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  tex.refresh();
  return tex;
}

export function genCharacters(scene: Phaser.Scene): void {
  const palettes: Record<string, CharPalette> = {
    male: MALE,
    female: FEMALE,
    taoist: { hair: "#3b3b3b", skin: "#e5b28a", top: "#5c6678", pants: "#4a4f5a", shoes: "#2f333a", accent: "#d9d2b8", eye: "#1c1c22" },
    master: { hair: "#9a9a9a", skin: "#d9a87e", top: "#6d4a2c", pants: "#403a30", shoes: "#2b2419", accent: "#d4a94e", eye: "#1f1a12" },
    guard: { hair: "#2e2e38", skin: "#d9a87e", top: "#37415a", pants: "#2d3443", shoes: "#1d222c", accent: "#a6b1c4", eye: "#151820" },
    bandit: { hair: "#3a2a1c", skin: "#d79b6e", top: "#7d4630", pants: "#4b3527", shoes: "#2c2015", accent: "#c7a06a", eye: "#20130c" },
    thief: { hair: "#2c2a24", skin: "#d79b6e", top: "#4e5240", pants: "#3a3d2e", shoes: "#26241c", accent: "#8a906a", eye: "#1a1610" },
    raider: { hair: "#402a20", skin: "#c98f66", top: "#6e3a2e", pants: "#453026", shoes: "#2a1d14", accent: "#b8884f", eye: "#221208" },
    dark: { hair: "#26222e", skin: "#c79a7a", top: "#3d3a48", pants: "#2e2c38", shoes: "#1e1c26", accent: "#8b86a8", eye: "#1a1620" },
    gold: { hair: "#3d2d1e", skin: "#e5b28a", top: "#b0894f", pants: "#5b4530", shoes: "#382a1c", accent: "#e3c06a", eye: "#20160d" },
    ice: { hair: "#cfe3ef", skin: "#e8d7c8", top: "#a8c8d9", pants: "#7d9aad", shoes: "#5a748a", accent: "#eaf6ff", eye: "#20303c" },
    flower: { hair: "#5b3347", skin: "#f0c39a", top: "#d9829f", pants: "#a15a78", shoes: "#7a3f58", accent: "#f0b7c9", eye: "#2a1a22" },
    ninja: { hair: "#1f1f28", skin: "#d9a87e", top: "#4c4f5e", pants: "#3a3c48", shoes: "#26282f", accent: "#a84a4a", eye: "#101014" },
    red: { hair: "#4a2b28", skin: "#e0a87e", top: "#b84038", pants: "#5e3430", shoes: "#3a211e", accent: "#f0b080", eye: "#20100e" }
  };
  for (const [name, pal] of Object.entries(palettes)) {
    const p = charColors(pal);
    drawPixels(scene, `char-${name}-idle`, 16, 24, CHAR_ROWS, p);
    drawPixels(scene, `char-${name}-walk`, 16, 24, CHAR_ROWS_WALK, p);
    drawPixels(scene, `char-${name}-walk2`, 16, 24, CHAR_ROWS_WALK2, p);
  }
  // 壮汉（加宽人形）
  const brutePalettes: Record<string, CharPalette> = {
    bandit: palettes.bandit,
    dark: { hair: "#1c1a20", skin: "#c79a7a", top: "#3d3a48", pants: "#2e2c38", shoes: "#1e1c26", accent: "#8b86a8", eye: "#1a1620" },
    leng: { hair: "#26222e", skin: "#c7bccf", top: "#4a4e5e", pants: "#32343e", shoes: "#1e1c26", accent: "#b0b8cc", eye: "#10141c" }
  };
  for (const [name, pal] of Object.entries(brutePalettes)) {
    const p = charColors(pal);
    drawPixels(scene, `brute-${name}-idle`, 20, 26, BRUTE_ROWS, p);
    drawPixels(scene, `brute-${name}-walk`, 20, 26, BRUTE_ROWS_WALK, p);
    drawPixels(scene, `brute-${name}-walk2`, 20, 26, BRUTE_ROWS_WALK2, p);
  }
  // 七掌门 + 三终局 BOSS：戴冠高袍、独立配色
  for (const [name, pal] of Object.entries(BOSS_PALETTES)) {
    const p = { ...charColors(pal), C: pal.crown };
    drawPixels(scene, `boss-${name}-idle`, 16, 28, BOSS_ROWS, p);
    drawPixels(scene, `boss-${name}-walk`, 16, 28, BOSS_ROWS_WALK, p);
    drawPixels(scene, `boss-${name}-walk2`, 16, 28, BOSS_ROWS_WALK2, p);
  }
  // 走兽 / 爬行
  for (const [kind, def] of Object.entries(BEAST_DEFS)) {
    drawPixels(scene, `beast-${kind}-idle`, def.w, def.h, def.idle, def.palette);
    drawPixels(scene, `beast-${kind}-walk`, def.w, def.h, def.walk, def.palette);
    drawPixels(scene, `beast-${kind}-walk2`, def.w, def.h, def.walk2, def.palette);
  }
  // 夜行鬼影（半透明、无腿悬浮）
  drawPixels(scene, "ghost-dark-idle", 16, 24, GHOST_ROWS, GHOST_PALETTE);
  drawPixels(scene, "ghost-dark-walk", 16, 24, GHOST_ROWS_WALK, GHOST_PALETTE);
  drawPixels(scene, "ghost-dark-walk2", 16, 24, GHOST_ROWS_WALK2, GHOST_PALETTE);
}

function charColors(pal: CharPalette): Record<string, string> {
  return {
    H: pal.hair,
    S: pal.skin,
    E: pal.eye,
    T: pal.top,
    A: pal.accent,
    P: pal.pants,
    O: pal.shoes
  };
}

type BossPalette = CharPalette & { crown: string };

const BOSS_PALETTES: Record<string, BossPalette> = {
  qingXu: { hair: "#3b3b3b", skin: "#e5b28a", top: "#5c7086", pants: "#424c5c", shoes: "#2c313a", accent: "#d9d2b8", eye: "#1c1c22", crown: "#e3c06a" },
  wangWeiYang: { hair: "#2e2620", skin: "#d9a87e", top: "#7a5a2e", pants: "#4a3a24", shoes: "#2e2416", accent: "#e3c06a", eye: "#1a140e", crown: "#c9a13a" },
  baiRuiDe: { hair: "#e8eef2", skin: "#e8d7c8", top: "#a8c8d9", pants: "#7d9aad", shoes: "#5a748a", accent: "#eaf6ff", eye: "#20303c", crown: "#d8e8f0" },
  liQingZhao: { hair: "#3a2733", skin: "#f0c39a", top: "#d9829f", pants: "#a15a78", shoes: "#7a3f58", accent: "#f0b7c9", eye: "#2a1a22", crown: "#e8c850" },
  heZhongYang: { hair: "#1f1f28", skin: "#d9a87e", top: "#4c4f5e", pants: "#3a3c48", shoes: "#26282f", accent: "#a84a4a", eye: "#101014", crown: "#6a6a78" },
  yuHongRu: { hair: "#4a2b28", skin: "#e0a87e", top: "#b84038", pants: "#5e3430", shoes: "#3a211e", accent: "#f0b080", eye: "#20100e", crown: "#ffd98a" },
  qiaoSiHai: { hair: "#3d2d1e", skin: "#e5b28a", top: "#b0894f", pants: "#5b4530", shoes: "#382a1c", accent: "#e3c06a", eye: "#20160d", crown: "#8a6a3a" },
  woShiShui: { hair: "#14121c", skin: "#c7bccf", top: "#2c2838", pants: "#1e1b28", shoes: "#141220", accent: "#8b86a8", eye: "#e8e8ff", crown: "#4a4460" },
  daoDeHeShang: { hair: "#d9d2b8", skin: "#e5b28a", top: "#c9a13a", pants: "#8a6a2e", shoes: "#4a3a1c", accent: "#fff0c0", eye: "#241a12", crown: "#e3c06a" },
  dongFangQiuBai: { hair: "#1c1a22", skin: "#f0d0b0", top: "#c23e46", pants: "#e8e0d0", shoes: "#2a1a1e", accent: "#ffd98a", eye: "#3a1020", crown: "#f0e0c0" }
};

export type CharFrame = "idle" | "walk" | "walk2";

export interface CharVisual {
  key: (frame: CharFrame) => string;
  w: number;
  h: number;
  // 体量倍率：战斗/世界里再乘基础 setScale
  scaleMul: number;
}

// 七掌门 + 三终局 BOSS（NPC 与敌人两态共用 boss 模板）
const BOSS_IDS = new Set(Object.keys(BOSS_PALETTES));

const ENEMY_BEAST: Record<string, string> = {
  yezhu: "boar",
  elang: "wolf",
  xueLang: "snowwolf",
  dushe: "snake"
};

const ENEMY_BRUTE: Record<string, string> = {
  zhouSan: "bandit",
  zhaiTou: "dark",
  qingLongTanZhu: "leng"
};

const ENEMY_PALETTE: Record<string, string> = {
  jianjing: "thief",
  shanzei: "raider",
  yunZhongHe: "dark",
  qingLongJingWei: "guard"
};

const NPC_PALETTE: Record<string, string> = {
  laozhe: "master",
  heiren: "dark",
  axiu: "flower",
  yuexia: "master",
  xiaoer: "bandit",
  liZhenWei: "guard",
  guYanWu: "taoist",
  tiejiang: "guard",
  pingYiZhi: "taoist",
  xiucai: "taoist",
  xunbu: "guard",
  xianling: "master",
  cunzhang: "master",
  popo: "master",
  funv: "flower",
  huoji: "bandit",
  qingXu: "master",
  gusong: "taoist",
  cangyue: "taoist",
  wangWeiYang: "master",
  shangJianMing: "bandit",
  baiRuiDe: "ice",
  xuewei: "guard",
  liQingZhao: "flower",
  tangWanCi: "flower",
  heZhongYang: "ninja",
  langren: "ninja",
  yuHongRu: "red",
  xiangzhu: "red",
  qiaoSiHai: "gold",
  zhanglao: "bandit",
  lengTieYi: "dark",
  tiaofu: "bandit",
  xiaoqigai: "thief",
  shuoshu: "taoist",
  liehu: "raider",
  huaPopo: "flower",
  chuanFu: "bandit"
};

// NPC 体型差异：老婆婆驼背、小孩矮个
const NPC_SCALE: Record<string, { x: number; y: number }> = {
  popo: { x: 0.92, y: 0.82 },
  huaPopo: { x: 0.92, y: 0.84 },
  xiaoqigai: { x: 0.78, y: 0.78 }
};

export function npcScaleHint(npcId: string): { x: number; y: number } {
  return NPC_SCALE[npcId] || { x: 1, y: 1 };
}

const visualCache = new Map<string, CharVisual>();

function humanoidVisual(palette: string): CharVisual {
  return {
    key: (frame) => `char-${palette}-${frame}`,
    w: 16,
    h: 24,
    scaleMul: 1
  };
}

export function visualForEnemy(enemyId: string): CharVisual {
  const cacheKey = "e:" + enemyId;
  let v = visualCache.get(cacheKey);
  if (v) return v;
  const beast = ENEMY_BEAST[enemyId];
  if (beast) {
    const def = BEAST_DEFS[beast];
    v = { key: (f) => `beast-${beast}-${f}`, w: def.w, h: def.h, scaleMul: 1 };
  } else if (enemyId === "eGui") {
    v = { key: (f) => `ghost-dark-${f}`, w: 16, h: 24, scaleMul: 1 };
  } else if (ENEMY_BRUTE[enemyId]) {
    const pal = ENEMY_BRUTE[enemyId];
    v = { key: (f) => `brute-${pal}-${f}`, w: 20, h: 26, scaleMul: 1.05 };
  } else if (BOSS_IDS.has(enemyId)) {
    v = { key: (f) => `boss-${enemyId}-${f}`, w: 16, h: 28, scaleMul: 1.15 };
  } else {
    v = humanoidVisual(ENEMY_PALETTE[enemyId] || "bandit");
  }
  visualCache.set(cacheKey, v);
  return v;
}

export function visualForNpc(npcId: string): CharVisual {
  const cacheKey = "n:" + npcId;
  let v = visualCache.get(cacheKey);
  if (v) return v;
  if (BOSS_IDS.has(npcId)) {
    v = { key: (f) => `boss-${npcId}-${f}`, w: 16, h: 28, scaleMul: 1.15 };
  } else {
    v = humanoidVisual(NPC_PALETTE[npcId] || "male");
  }
  visualCache.set(cacheKey, v);
  return v;
}

// 切磋敌人（spar-*）沿用对应 NPC 的形象
export function visualForBattleEnemy(enemyId: string): CharVisual {
  return enemyId.startsWith("spar-") ? visualForNpc(enemyId.slice(5)) : visualForEnemy(enemyId);
}

export interface BuildingStyle {
  wall: string;
  wall2: string;
  roof: string;
  roof2: string;
  door: string;
  trim: string;
  h: number;
}

// 建筑贴图实际尺寸（世界坐标换算用）
export function buildingTexSize(kind: string): { w: number; h: number } {
  const style = BUILDING_STYLES[kind] || BUILDING_STYLES.home;
  return { w: 180, h: style.h + 30 };
}

const BUILDING_STYLES: Record<string, BuildingStyle> = {
  gate: { wall: "#b8a37f", wall2: "#a08c68", roof: "#7a4a2a", roof2: "#5f3a20", door: "#4a2f16", trim: "#e3c98f", h: 120 },
  inn: { wall: "#c9b28a", wall2: "#b39a70", roof: "#6d4a2c", roof2: "#4f3520", door: "#4a2f16", trim: "#d9b96a", h: 150 },
  hall: { wall: "#a58d66", wall2: "#90784f", roof: "#5b4630", roof2: "#3f3020", door: "#3f2a16", trim: "#c9a06a", h: 150 },
  smith: { wall: "#8d8378", wall2: "#756b60", roof: "#4f4033", roof2: "#382e24", door: "#33281c", trim: "#b0a08a", h: 130 },
  drug: { wall: "#b7ad8a", wall2: "#a29673", roof: "#5f6b4a", roof2: "#44502f", door: "#3f4526", trim: "#c9d08a", h: 130 },
  study: { wall: "#c4b8a0", wall2: "#ad9f85", roof: "#5a5248", roof2: "#403a32", door: "#3a342a", trim: "#e3d6b8", h: 140 },
  yamen: { wall: "#9a958e", wall2: "#837e76", roof: "#4f4a45", roof2: "#37332f", door: "#2e2a26", trim: "#c9c0b0", h: 150 },
  home: { wall: "#c2a87f", wall2: "#ab8f66", roof: "#6a4a2a", roof2: "#4c351e", door: "#4a2f16", trim: "#d9b98a", h: 120 },
  shrine: { wall: "#8f8a80", wall2: "#777168", roof: "#4f4035", roof2: "#3a2f26", door: "#33291f", trim: "#c9b28a", h: 150 },
  shop: { wall: "#b39a70", wall2: "#9c8359", roof: "#6a4a2a", roof2: "#4c351e", door: "#4a2f16", trim: "#e3c06a", h: 125 },
  hill: { wall: "#5f6b4a", wall2: "#4d5a3a", roof: "#3f4a2f", roof2: "#2f3824", door: "#2a3320", trim: "#8f9c6a", h: 110 }
};

export function genBuildingTexture(scene: Phaser.Scene, kind: string, w: number): void {
  const style = BUILDING_STYLES[kind] || BUILDING_STYLES.home;
  const h = style.h;
  const tex = scene.textures.createCanvas(`bld-${kind}`, w, h + 30);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h + 30);
  const wallGrad = ctx.createLinearGradient(0, 34, 0, h);
  wallGrad.addColorStop(0, style.wall);
  wallGrad.addColorStop(1, style.wall2);
  // 屋顶瓦片
  ctx.fillStyle = style.roof;
  ctx.beginPath();
  ctx.moveTo(-4, 32);
  ctx.lineTo(w / 2, 2);
  ctx.lineTo(w + 4, 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = style.roof2;
  for (let row = 0; row < 5; row++) {
    const y = 8 + row * 5;
    const t = row / 5;
    const x0 = w / 2 - (w / 2) * t;
    const x1 = w / 2 + (w / 2) * t;
    ctx.beginPath();
    ctx.moveTo(x0, y + 4);
    ctx.lineTo(x1, y + 4);
    ctx.strokeStyle = style.roof2;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // 屋脊
  ctx.fillStyle = style.trim;
  ctx.fillRect(w / 2 - 4, 0, 8, 6);
  ctx.fillStyle = style.roof2;
  ctx.fillRect(w / 2 - 1, 5, 2, 26);
  // 屋檐阴影
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.fillRect(0, 30, w, 7);
  // 墙体
  ctx.fillStyle = wallGrad;
  ctx.fillRect(5, 36, w - 10, h - 36);
  ctx.fillStyle = "rgba(0,0,0,.12)";
  ctx.fillRect(5, 36, w - 10, 4);
  // 砖缝
  ctx.strokeStyle = "rgba(0,0,0,.16)";
  ctx.lineWidth = 1;
  for (let y = 52; y < h; y += 13) {
    ctx.beginPath();
    ctx.moveTo(7, y);
    ctx.lineTo(w - 7, y);
    ctx.stroke();
  }
  // 柱子
  ctx.fillStyle = "#5a3a1c";
  ctx.fillRect(8, 40, 7, h - 40);
  ctx.fillRect(w - 15, 40, 7, h - 40);
  // 窗（带窗棂与灯影）
  const winX = [18, w - 52];
  for (const wx of winX) {
    ctx.fillStyle = "#241a10";
    ctx.fillRect(wx, 52, 26, 24);
    ctx.fillStyle = "#e8d9a8";
    ctx.fillRect(wx + 2, 54, 22, 20);
    ctx.fillStyle = "#6d4a2a";
    ctx.fillRect(wx + 11, 54, 3, 20);
    ctx.fillRect(wx + 2, 62, 22, 3);
    ctx.fillStyle = "rgba(255,220,140,.16)";
    ctx.fillRect(wx + 2, 54, 22, 20);
  }
  // 匾额：文字离屏 2 倍绘制再缩放，避免小字号模糊
  ctx.fillStyle = "#2e2417";
  ctx.fillRect(w / 2 - 42, 39, 84, 19);
  ctx.fillStyle = "#e3c98f";
  ctx.fillRect(w / 2 - 39, 42, 78, 13);
  const sign = buildingSign(kind);
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 156;
  signCanvas.height = 26;
  const sctx = signCanvas.getContext("2d");
  if (sctx) {
    sctx.fillStyle = "#4a2f16";
    sctx.font = "bold 20px 'Noto Serif SC', serif";
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillText(sign, 78, 14);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(signCanvas, 0, 0, 156, 26, w / 2 - 39, 42, 78, 13);
  }
  // 红灯笼
  ctx.fillStyle = "#b84038";
  ctx.beginPath();
  ctx.arc(14, 34, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(13, 29, 2, 3);
  ctx.beginPath();
  ctx.arc(w - 14, 34, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(w - 15, 29, 2, 3);
  // 门
  const dw = Math.min(34, w - 40);
  const dx = (w - dw) / 2;
  ctx.fillStyle = style.door;
  ctx.fillRect(dx, h - 46, dw, 46);
  ctx.fillStyle = style.trim;
  ctx.fillRect(dx, h - 46, dw, 3);
  ctx.fillStyle = "rgba(0,0,0,.2)";
  ctx.fillRect(dx, h - 43, dw, 6);
  ctx.fillStyle = style.door;
  ctx.fillRect(dx + 3, h - 37, dw / 2 - 4, 37);
  ctx.fillRect(dx + dw / 2 + 1, h - 37, dw / 2 - 4, 37);
  ctx.fillStyle = "#e3c98f";
  ctx.fillRect(dx + 8, h - 20, 3, 3);
  ctx.fillRect(dx + dw - 11, h - 20, 3, 3);
  ctx.fillStyle = style.wall2;
  ctx.fillRect(dx - 5, h - 48, dw + 10, 4);
  tex.refresh();
}

function buildingSign(kind: string): string {
  const map: Record<string, string> = {
    gate: "平安",
    inn: "客栈",
    hall: "武馆",
    smith: "铁铺",
    drug: "药铺",
    study: "书院",
    yamen: "县衙",
    home: "民宅",
    shrine: "宝刹",
    shop: "杂货",
    hill: "后山"
  };
  return map[kind] || "";
}

export function genStoneTexture(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas("stone", 32, 32);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = "#7b7d7f";
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = "#6b6d70";
  ctx.fillRect(0, 0, 32, 6);
  ctx.fillRect(0, 16, 32, 6);
  ctx.fillStyle = "#8a8c8f";
  ctx.fillRect(2, 8, 13, 6);
  ctx.fillRect(18, 24, 12, 6);
  ctx.fillStyle = "#5f6164";
  ctx.fillRect(0, 28, 32, 4);
  tex.refresh();
}

export function genWoodTexture(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas("wood", 24, 24);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 24, 24);
  ctx.fillStyle = "#8a5a2b";
  ctx.fillRect(0, 0, 24, 24);
  ctx.fillStyle = "#75491f";
  for (let y = 3; y < 24; y += 6) ctx.fillRect(0, y, 24, 1);
  ctx.fillStyle = "#a06c36";
  ctx.fillRect(0, 0, 24, 2);
  tex.refresh();
}

export function genGrassTexture(scene: Phaser.Scene, theme: string): void {
  const palette: Record<string, string[]> = {
    town: ["#8fb45a", "#82a84f", "#98bd64", "#77a048"],
    forest: ["#5f8f4a", "#55803f", "#6b9a54", "#4d7438"],
    snow: ["#dce9ef", "#cfdee6", "#e8f2f6", "#c3d5df"],
    mountain: ["#7d8f6a", "#718260", "#889a74", "#667853"],
    island: ["#a88f6a", "#9b825c", "#b39a72", "#8e7754"],
    dark: ["#5b5560", "#514c56", "#645e69", "#48434c"],
    cave: ["#4e4852", "#443f48", "#57515b", "#3b3740"],
    cloud: ["#7f7f94", "#737388", "#8a8a9e", "#68687c"],
    temple: ["#7f8f7a", "#73836f", "#8a9a85", "#697965"]
  };
  const colors = palette[theme] || palette.town;
  const tex = scene.textures.createCanvas(`ground-${theme}`, 32, 32);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = colors[1 + Math.floor(Math.random() * 3)];
    ctx.fillRect(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), 3, 2);
  }
  if (theme === "snow") {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 8; i++) ctx.fillRect(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), 4, 2);
  }
  tex.refresh();
}

export function genTreeTexture(scene: Phaser.Scene, theme: string): void {
  const trunk = theme === "snow" ? "#6d6258" : "#6a4a2a";
  const leaf: Record<string, string[]> = {
    town: ["#7da04f", "#5f8f3f", "#8db45f"],
    forest: ["#5f8f4a", "#4d7a35", "#6f9f55"],
    snow: ["#e6f2f7", "#cfe3ef", "#f4faff"],
    mountain: ["#6b8559", "#56704a", "#7d9a66"],
    island: ["#93a258", "#7d8a4a", "#a5b36a"],
    dark: ["#4a4455", "#3f3a45", "#575063"],
    temple: ["#739168", "#5f7a55", "#86a579"],
    cloud: ["#9a9ab0", "#8f8fa8", "#aaaac0"]
  };
  const colors = leaf[theme] || ["#7da04f", "#5f8f3f", "#8db45f"];
  const tex = scene.textures.createCanvas(`tree-${theme}`, 96, 132);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 96, 132);
  // 树根
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath();
  ctx.ellipse(48, 128, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // 树干
  const trunkGrad = ctx.createLinearGradient(40, 0, 56, 0);
  trunkGrad.addColorStop(0, theme === "snow" ? "#5b5148" : "#54371c");
  trunkGrad.addColorStop(0.5, trunk);
  trunkGrad.addColorStop(1, theme === "snow" ? "#7d7268" : "#7d5a36");
  ctx.fillStyle = trunkGrad;
  ctx.fillRect(41, 62, 14, 66);
  // 枝干
  ctx.strokeStyle = trunk;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(46, 76);
  ctx.lineTo(20, 58);
  ctx.moveTo(50, 70);
  ctx.lineTo(78, 48);
  ctx.stroke();
  // 树冠
  const c1 = ctx.createRadialGradient(38, 30, 6, 38, 34, 42);
  c1.addColorStop(0, colors[2]);
  c1.addColorStop(1, colors[0]);
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.arc(38, 34, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.arc(62, 38, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(24, 52, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.arc(30, 26, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(52, 26, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = trunk;
  ctx.fillRect(44, 44, 8, 18);
  if (theme === "snow") {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(26, 18, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(50, 22, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(68, 30, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.refresh();
}

export function genBushTexture(scene: Phaser.Scene, theme: string): void {
  const colors: Record<string, string[]> = {
    town: ["#5f8f3f", "#7da04f", "#8db45f"],
    forest: ["#4d7a35", "#5f8f4a", "#6f9f55"],
    snow: ["#c3dbe7", "#dbeaf2", "#eef7fb"],
    mountain: ["#56704a", "#6b8559", "#7d9a66"],
    island: ["#7d8a4a", "#93a258", "#a5b36a"],
    dark: ["#3f3a45", "#4a4455", "#575063"],
    temple: ["#5f7a55", "#739168", "#86a579"],
    cloud: ["#8f8fa8", "#9a9ab0", "#aaaac0"]
  };
  const c = colors[theme] || colors.town;
  const tex = scene.textures.createCanvas(`bush-${theme}`, 46, 30);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 46, 30);
  ctx.fillStyle = c[0];
  ctx.beginPath();
  ctx.arc(13, 22, 11, 0, Math.PI * 2);
  ctx.arc(33, 22, 12, 0, Math.PI * 2);
  ctx.arc(23, 16, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c[1];
  ctx.beginPath();
  ctx.arc(20, 14, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c[2];
  ctx.beginPath();
  ctx.arc(28, 12, 4, 0, Math.PI * 2);
  ctx.fill();
  if (theme !== "snow") {
    ctx.fillStyle = "#c9504a";
    ctx.beginPath();
    ctx.arc(11, 18, 2.2, 0, Math.PI * 2);
    ctx.arc(30, 24, 2.2, 0, Math.PI * 2);
    ctx.arc(22, 26, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.refresh();
}

export function genFlowerTexture(scene: Phaser.Scene, color: string): void {
  const tex = scene.textures.createCanvas(`flower-${color.replace("#", "")}`, 18, 22);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 18, 22);
  ctx.fillStyle = "#5f8f3f";
  ctx.fillRect(8, 10, 2, 11);
  ctx.fillStyle = color;
  const petals = 5;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(9 + Math.cos(a) * 4, 7 + Math.sin(a) * 4, 3, 2, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#e8c850";
  ctx.beginPath();
  ctx.arc(9, 7, 2.5, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
}

export function genFxTextures(scene: Phaser.Scene): void {
  const spark = scene.textures.createCanvas("fx-spark", 8, 8);
  if (spark) {
    const ctx = spark.getContext();
    ctx.clearRect(0, 0, 8, 8);
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.arc(4, 4, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(4, 4, 1.6, 0, Math.PI * 2);
    ctx.fill();
    spark.refresh();
  }
  const petal = scene.textures.createCanvas("fx-petal", 10, 8);
  if (petal) {
    const ctx = petal.getContext();
    ctx.clearRect(0, 0, 10, 8);
    ctx.fillStyle = "#e8a7b8";
    ctx.beginPath();
    ctx.ellipse(5, 4, 4, 2.4, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2c2cf";
    ctx.beginPath();
    ctx.ellipse(4, 3, 2, 1.2, 0.5, 0, Math.PI * 2);
    ctx.fill();
    petal.refresh();
  }
  const snow = scene.textures.createCanvas("fx-snow", 8, 8);
  if (snow) {
    const ctx = snow.getContext();
    ctx.clearRect(0, 0, 8, 8);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(4, 4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eaf6ff";
    ctx.beginPath();
    ctx.arc(3, 3, 1, 0, Math.PI * 2);
    ctx.fill();
    snow.refresh();
  }
  const smoke = scene.textures.createCanvas("fx-smoke", 24, 24);
  if (smoke) {
    const ctx = smoke.getContext();
    ctx.clearRect(0, 0, 24, 24);
    const g = ctx.createRadialGradient(12, 12, 2, 12, 12, 11);
    g.addColorStop(0, "rgba(190,190,200,.55)");
    g.addColorStop(1, "rgba(190,190,200,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(12, 12, 11, 0, Math.PI * 2);
    ctx.fill();
    smoke.refresh();
  }
  const flash = scene.textures.createCanvas("fx-flash", 96, 96);
  if (flash) {
    const ctx = flash.getContext();
    ctx.clearRect(0, 0, 96, 96);
    const g = ctx.createRadialGradient(48, 48, 6, 48, 48, 48);
    g.addColorStop(0, "rgba(255,240,190,.95)");
    g.addColorStop(0.5, "rgba(255,190,80,.45)");
    g.addColorStop(1, "rgba(255,190,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 96);
    flash.refresh();
  }
  const rain = scene.textures.createCanvas("fx-rain", 3, 18);
  if (rain) {
    const ctx = rain.getContext();
    ctx.clearRect(0, 0, 3, 18);
    ctx.fillStyle = "rgba(210,225,245,.85)";
    ctx.fillRect(1, 0, 1, 18);
    rain.refresh();
  }
  const bird = scene.textures.createCanvas("fx-bird", 22, 12);
  if (bird) {
    const ctx = bird.getContext();
    ctx.clearRect(0, 0, 22, 12);
    ctx.strokeStyle = "#2d2a33";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, 8);
    ctx.quadraticCurveTo(7, 1, 11, 7);
    ctx.quadraticCurveTo(15, 1, 20, 8);
    ctx.stroke();
    bird.refresh();
  }
  // 雨滴落地溅射
  const splash = scene.textures.createCanvas("fx-splash", 10, 6);
  if (splash) {
    const ctx = splash.getContext();
    ctx.clearRect(0, 0, 10, 6);
    ctx.strokeStyle = "rgba(215,230,248,.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1, 5);
    ctx.quadraticCurveTo(5, 0, 9, 5);
    ctx.stroke();
    ctx.fillStyle = "rgba(230,240,252,.9)";
    ctx.fillRect(2, 1, 1, 2);
    ctx.fillRect(7, 1, 1, 2);
    splash.refresh();
  }
  // 落叶
  const leaf = scene.textures.createCanvas("fx-leaf", 10, 8);
  if (leaf) {
    const ctx = leaf.getContext();
    ctx.clearRect(0, 0, 10, 8);
    ctx.fillStyle = "#a8843a";
    ctx.beginPath();
    ctx.ellipse(5, 4, 4.2, 2.2, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9a44e";
    ctx.beginPath();
    ctx.ellipse(4, 3, 2, 1.1, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7d5f24";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1, 6);
    ctx.lineTo(9, 2);
    ctx.stroke();
    leaf.refresh();
  }
  // 沙尘
  const sand = scene.textures.createCanvas("fx-sand", 6, 6);
  if (sand) {
    const ctx = sand.getContext();
    ctx.clearRect(0, 0, 6, 6);
    ctx.fillStyle = "rgba(210,190,150,.85)";
    ctx.fillRect(2, 2, 2, 2);
    ctx.fillStyle = "rgba(230,214,175,.6)";
    ctx.fillRect(1, 3, 1, 1);
    ctx.fillRect(4, 1, 1, 1);
    sand.refresh();
  }
  // 灰烬火星
  const ember = scene.textures.createCanvas("fx-ember", 6, 6);
  if (ember) {
    const ctx = ember.getContext();
    ctx.clearRect(0, 0, 6, 6);
    ctx.fillStyle = "rgba(255,150,60,.9)";
    ctx.fillRect(2, 2, 2, 2);
    ctx.fillStyle = "rgba(255,220,140,.9)";
    ctx.fillRect(2, 2, 1, 1);
    ember.refresh();
  }
  // 贴地阴影
  const shadow = scene.textures.createCanvas("fx-shadow", 30, 10);
  if (shadow) {
    const ctx = shadow.getContext();
    ctx.clearRect(0, 0, 30, 10);
    const g = ctx.createRadialGradient(15, 5, 1, 15, 5, 14);
    g.addColorStop(0, "rgba(0,0,0,.34)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(15, 5, 14, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    shadow.refresh();
  }
}

// 天体与光晕：太阳 / 月亮 / 云 / 暖光晕
export function genCelestialTextures(scene: Phaser.Scene): void {
  const sun = scene.textures.createCanvas("fx-sun", 96, 96);
  if (sun) {
    const ctx = sun.getContext();
    ctx.clearRect(0, 0, 96, 96);
    const glow = ctx.createRadialGradient(48, 48, 6, 48, 48, 47);
    glow.addColorStop(0, "rgba(255,236,170,.95)");
    glow.addColorStop(0.4, "rgba(255,210,120,.4)");
    glow.addColorStop(1, "rgba(255,210,120,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 96, 96);
    ctx.fillStyle = "#fff3c8";
    ctx.beginPath();
    ctx.arc(48, 48, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,250,225,.9)";
    ctx.beginPath();
    ctx.arc(44, 44, 9, 0, Math.PI * 2);
    ctx.fill();
    sun.refresh();
  }
  const moon = scene.textures.createCanvas("fx-moon", 72, 72);
  if (moon) {
    const ctx = moon.getContext();
    ctx.clearRect(0, 0, 72, 72);
    const glow = ctx.createRadialGradient(36, 36, 6, 36, 36, 35);
    glow.addColorStop(0, "rgba(215,225,255,.55)");
    glow.addColorStop(1, "rgba(215,225,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 72, 72);
    ctx.fillStyle = "#e8edfa";
    ctx.beginPath();
    ctx.arc(36, 36, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9d2e8";
    ctx.beginPath();
    ctx.arc(31, 32, 4, 0, Math.PI * 2);
    ctx.arc(40, 40, 3, 0, Math.PI * 2);
    ctx.arc(33, 43, 2.4, 0, Math.PI * 2);
    ctx.fill();
    moon.refresh();
  }
  const cloud = scene.textures.createCanvas("fx-cloud", 140, 56);
  if (cloud) {
    const ctx = cloud.getContext();
    ctx.clearRect(0, 0, 140, 56);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.beginPath();
    ctx.ellipse(70, 36, 52, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(46, 26, 30, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(96, 24, 26, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(70, 18, 24, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(228,236,244,.7)";
    ctx.beginPath();
    ctx.ellipse(70, 42, 46, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    cloud.refresh();
  }
  const glow = scene.textures.createCanvas("fx-glow", 64, 64);
  if (glow) {
    const ctx = glow.getContext();
    ctx.clearRect(0, 0, 64, 64);
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, "rgba(255,205,120,.85)");
    g.addColorStop(0.45, "rgba(255,180,90,.32)");
    g.addColorStop(1, "rgba(255,170,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    glow.refresh();
  }
}

export function genRockTexture(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas("rock", 48, 36);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 48, 36);
  ctx.fillStyle = "#6e7075";
  ctx.beginPath();
  ctx.ellipse(24, 22, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#828489";
  ctx.beginPath();
  ctx.ellipse(18, 16, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
}

export function genWellTexture(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas("well", 40, 44);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 40, 44);
  ctx.fillStyle = "#6f7478";
  ctx.fillRect(6, 12, 28, 28);
  ctx.fillStyle = "#575c60";
  ctx.fillRect(6, 34, 28, 6);
  ctx.fillStyle = "#2c3034";
  ctx.fillRect(16, 4, 8, 8);
  ctx.fillStyle = "#8d9399";
  ctx.fillRect(8, 10, 24, 5);
  tex.refresh();
}

export function genSignTexture(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas("sign", 34, 44);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 34, 44);
  ctx.fillStyle = "#6a4a2a";
  ctx.fillRect(15, 18, 4, 26);
  ctx.fillStyle = "#8a5a2b";
  ctx.fillRect(1, 2, 32, 18);
  ctx.fillStyle = "#e3c98f";
  ctx.fillRect(4, 5, 26, 12);
  ctx.fillStyle = "#4a2f16";
  ctx.font = "9px serif";
  ctx.fillText("镇", 10, 15);
  tex.refresh();
}

export function genHangTreeTexture(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas("hangtree", 80, 110);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 80, 110);
  ctx.fillStyle = "#5f4a30";
  ctx.fillRect(36, 56, 9, 54);
  ctx.strokeStyle = "#5f4a30";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(40, 58);
  ctx.lineTo(70, 34);
  ctx.stroke();
  ctx.fillStyle = "#5f8f3f";
  ctx.beginPath();
  ctx.arc(64, 26, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7da84f";
  ctx.beginPath();
  ctx.arc(22, 34, 20, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
}

// 室内家具纹理：暗色描边 + 木纹/布纹渐变，与建筑风格一致
export function genFurnitureTextures(scene: Phaser.Scene): void {
  const WOOD_D = "#4a2f16";
  const wood = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c1 = "#8a5a2b", c2 = "#6d4520") => {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = WOOD_D;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = "rgba(0,0,0,.14)";
    ctx.lineWidth = 1;
    for (let yy = y + 7; yy < y + h - 3; yy += 8) {
      ctx.beginPath();
      ctx.moveTo(x + 3, yy);
      ctx.lineTo(x + w - 3, yy);
      ctx.stroke();
    }
  };
  const make = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, w, h);
    draw(ctx);
    tex.refresh();
  };

  // 床
  make("furn-bed", 92, 48, (ctx) => {
    wood(ctx, 2, 26, 88, 18);
    wood(ctx, 2, 6, 10, 38, "#7a4e24", "#5f3c1c");
    const g = ctx.createLinearGradient(0, 10, 0, 30);
    g.addColorStop(0, "#b8503f");
    g.addColorStop(1, "#8f3a2e");
    ctx.fillStyle = g;
    ctx.fillRect(12, 14, 78, 16);
    ctx.strokeStyle = "#5f241c";
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 14, 78, 16);
    ctx.fillStyle = "#e8dcc0";
    ctx.fillRect(66, 10, 22, 12);
    ctx.strokeStyle = "#b8a888";
    ctx.strokeRect(66, 10, 22, 12);
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.fillRect(14, 15, 74, 4);
  });

  // 方桌
  make("furn-table", 72, 46, (ctx) => {
    wood(ctx, 4, 8, 64, 10, "#9a6530", "#7a4e24");
    wood(ctx, 8, 18, 8, 26);
    wood(ctx, 56, 18, 8, 26);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(4, 16, 64, 3);
    ctx.fillStyle = "#c9b28a";
    ctx.fillRect(30, 4, 12, 5);
  });

  // 凳子
  make("furn-stool", 24, 24, (ctx) => {
    wood(ctx, 3, 4, 18, 7, "#9a6530", "#7a4e24");
    wood(ctx, 5, 11, 4, 12);
    wood(ctx, 15, 11, 4, 12);
  });

  // 立柜
  make("furn-cabinet", 56, 82, (ctx) => {
    wood(ctx, 4, 4, 48, 74, "#7d5230", "#5f3c20");
    ctx.strokeStyle = WOOD_D;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, 6);
    ctx.lineTo(28, 76);
    ctx.stroke();
    ctx.fillStyle = "#c9a13a";
    ctx.fillRect(22, 38, 4, 6);
    ctx.fillRect(30, 38, 4, 6);
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(6, 6, 44, 8);
  });

  // 灶台
  make("furn-stove", 72, 60, (ctx) => {
    ctx.fillStyle = "#6e6a62";
    ctx.fillRect(6, 18, 60, 38);
    ctx.strokeStyle = "#3f3c36";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 18, 60, 38);
    ctx.strokeStyle = "rgba(0,0,0,.2)";
    ctx.lineWidth = 1;
    for (let y = 26; y < 54; y += 8) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(64, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#241a10";
    ctx.fillRect(20, 34, 32, 22);
    const fire = ctx.createRadialGradient(36, 50, 2, 36, 50, 14);
    fire.addColorStop(0, "#ffd98a");
    fire.addColorStop(0.6, "#e07a2e");
    fire.addColorStop(1, "rgba(160,60,20,0)");
    ctx.fillStyle = fire;
    ctx.fillRect(20, 34, 32, 22);
    ctx.fillStyle = "#3a3733";
    ctx.beginPath();
    ctx.ellipse(36, 14, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#57534c";
    ctx.beginPath();
    ctx.ellipse(36, 11, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // 书架
  make("furn-shelf", 72, 92, (ctx) => {
    wood(ctx, 3, 3, 66, 86, "#7d5230", "#5a3a1c");
    const bookColors = ["#a84a4a", "#4a6a8a", "#5f8f4a", "#b0894f", "#7a5a8a", "#8a8a6a"];
    for (let shelf = 0; shelf < 3; shelf++) {
      const y = 10 + shelf * 27;
      ctx.fillStyle = "#3a2812";
      ctx.fillRect(7, y, 58, 20);
      let x = 9;
      let i = shelf * 3;
      while (x < 58) {
        const bw = 5 + ((i * 7) % 4);
        const bh = 13 + ((i * 5) % 6);
        ctx.fillStyle = bookColors[i % bookColors.length];
        ctx.fillRect(x, y + 19 - bh, bw, bh);
        ctx.fillStyle = "rgba(255,255,255,.16)";
        ctx.fillRect(x, y + 19 - bh, bw, 2);
        x += bw + 1;
        i++;
      }
      wood(ctx, 6, y + 20, 60, 4, "#8a5a2b", "#6d4520");
    }
  });

  // 神龛香炉
  make("furn-shrine", 84, 92, (ctx) => {
    wood(ctx, 8, 56, 68, 32, "#6a3a20", "#4e2a16");
    wood(ctx, 4, 50, 76, 8, "#8a5a2b", "#6d4520");
    ctx.fillStyle = "#2e2417";
    ctx.fillRect(24, 8, 36, 42);
    ctx.strokeStyle = "#c9a13a";
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 8, 36, 42);
    ctx.fillStyle = "#e3c98f";
    ctx.font = "bold 16px 'Noto Serif SC', serif";
    ctx.textAlign = "center";
    ctx.fillText("神", 42, 36);
    ctx.fillStyle = "#8a6a3a";
    ctx.beginPath();
    ctx.ellipse(42, 52, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2c14";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(38, 48);
    ctx.lineTo(36, 40);
    ctx.moveTo(46, 48);
    ctx.lineTo(48, 40);
    ctx.stroke();
    ctx.fillStyle = "#e8dcc0";
    ctx.fillRect(14, 30, 4, 20);
    ctx.fillRect(66, 30, 4, 20);
    ctx.fillStyle = "#ffd98a";
    ctx.beginPath();
    ctx.arc(16, 27, 3, 0, Math.PI * 2);
    ctx.arc(68, 27, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // 药柜
  make("furn-drug", 72, 92, (ctx) => {
    wood(ctx, 4, 4, 64, 84, "#6d4a2a", "#523520");
    ctx.fillStyle = "#3a2812";
    ctx.fillRect(8, 8, 56, 14);
    ctx.fillStyle = "#c9b28a";
    for (let i = 0; i < 4; i++) ctx.fillRect(11 + i * 13, 11, 9, 8);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const x = 9 + c * 19;
        const y = 26 + r * 15;
        ctx.fillStyle = "#5f3c1c";
        ctx.fillRect(x, y, 16, 12);
        ctx.strokeStyle = "#3a2812";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 16, 12);
        ctx.fillStyle = "#c9a13a";
        ctx.fillRect(x + 6, y + 5, 4, 2);
      }
    }
  });

  // 铁匠炉
  make("furn-forge", 84, 66, (ctx) => {
    ctx.fillStyle = "#5f5a52";
    ctx.fillRect(8, 16, 56, 44);
    ctx.strokeStyle = "#38352f";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 16, 56, 44);
    ctx.fillStyle = "#4a463f";
    ctx.fillRect(58, 4, 14, 56);
    ctx.strokeRect(58, 4, 14, 56);
    ctx.fillStyle = "#241a10";
    ctx.fillRect(16, 30, 40, 26);
    const fire = ctx.createRadialGradient(36, 50, 2, 36, 50, 18);
    fire.addColorStop(0, "#ffe0a0");
    fire.addColorStop(0.5, "#e8862e");
    fire.addColorStop(1, "rgba(170,70,20,0)");
    ctx.fillStyle = fire;
    ctx.fillRect(16, 30, 40, 26);
    ctx.fillStyle = "rgba(255,190,90,.25)";
    ctx.fillRect(8, 16, 56, 10);
  });

  // 铁砧
  make("furn-anvil", 52, 40, (ctx) => {
    ctx.fillStyle = "#4a4d52";
    ctx.fillRect(8, 10, 36, 10);
    ctx.beginPath();
    ctx.moveTo(44, 10);
    ctx.lineTo(52, 13);
    ctx.lineTo(44, 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#26282c";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 10, 36, 10);
    ctx.fillStyle = "#3a3d42";
    ctx.fillRect(18, 20, 16, 8);
    wood(ctx, 12, 28, 28, 10, "#6d4a2a", "#523520");
    ctx.fillStyle = "rgba(255,255,255,.2)";
    ctx.fillRect(10, 11, 32, 2);
  });

  // 柜台
  make("furn-counter", 104, 60, (ctx) => {
    wood(ctx, 4, 6, 96, 12, "#9a6530", "#7a4e24");
    wood(ctx, 8, 18, 88, 38, "#7d5230", "#5a3a1c");
    ctx.strokeStyle = WOOD_D;
    ctx.lineWidth = 2;
    for (let x = 30; x < 90; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, 54);
      ctx.stroke();
    }
    ctx.fillStyle = "#c9b28a";
    ctx.fillRect(66, 0, 26, 8);
    ctx.strokeStyle = "#8a7a5a";
    ctx.lineWidth = 1;
    ctx.strokeRect(66, 0, 26, 8);
    ctx.fillStyle = "#4a3a20";
    for (let i = 0; i < 5; i++) ctx.fillRect(69 + i * 4.6, 2, 2, 4);
    ctx.fillStyle = "#5f8f4a";
    ctx.beginPath();
    ctx.arc(18, 4, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // 木人桩
  make("furn-dummy", 36, 92, (ctx) => {
    wood(ctx, 14, 6, 8, 80, "#8a5a2b", "#6d4520");
    ctx.fillStyle = "#6d4520";
    ctx.beginPath();
    ctx.arc(18, 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = WOOD_D;
    ctx.lineWidth = 2;
    ctx.stroke();
    wood(ctx, 2, 26, 12, 6, "#8a5a2b", "#6d4520");
    wood(ctx, 22, 26, 12, 6, "#8a5a2b", "#6d4520");
    wood(ctx, 22, 44, 10, 6, "#8a5a2b", "#6d4520");
    wood(ctx, 6, 84, 24, 6, "#7d5230", "#5a3a1c");
  });

  // 书桌
  make("furn-desk", 72, 50, (ctx) => {
    wood(ctx, 4, 12, 64, 9, "#9a6530", "#7a4e24");
    wood(ctx, 8, 21, 7, 27);
    wood(ctx, 57, 21, 7, 27);
    ctx.fillStyle = "#e8e0cc";
    ctx.fillRect(14, 6, 24, 8);
    ctx.strokeStyle = "#b0a488";
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 6, 24, 8);
    ctx.strokeStyle = "#8a8066";
    ctx.beginPath();
    ctx.moveTo(17, 9);
    ctx.lineTo(35, 9);
    ctx.moveTo(17, 12);
    ctx.lineTo(32, 12);
    ctx.stroke();
    ctx.fillStyle = "#2e2a26";
    ctx.fillRect(48, 7, 10, 6);
    ctx.fillStyle = "#57534c";
    ctx.fillRect(50, 5, 6, 2);
  });

  // 水缸
  make("furn-jar", 36, 42, (ctx) => {
    const g = ctx.createLinearGradient(4, 0, 32, 0);
    g.addColorStop(0, "#5a4a3a");
    g.addColorStop(0.5, "#7d6a54");
    g.addColorStop(1, "#4a3c2e");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(6, 8);
    ctx.quadraticCurveTo(2, 24, 8, 38);
    ctx.lineTo(28, 38);
    ctx.quadraticCurveTo(34, 24, 30, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#33291e";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#2e3a44";
    ctx.beginPath();
    ctx.ellipse(18, 9, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(160,200,230,.5)";
    ctx.beginPath();
    ctx.ellipse(15, 8, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // 宝座
  make("furn-throne", 72, 92, (ctx) => {
    wood(ctx, 10, 4, 52, 46, "#7a3a28", "#5a2a1c");
    ctx.fillStyle = "#c9a13a";
    ctx.fillRect(14, 8, 44, 4);
    ctx.fillRect(14, 38, 44, 4);
    wood(ctx, 4, 44, 10, 30, "#6d4520", "#52351a");
    wood(ctx, 58, 44, 10, 30, "#6d4520", "#52351a");
    const g = ctx.createLinearGradient(0, 50, 0, 74);
    g.addColorStop(0, "#a84038");
    g.addColorStop(1, "#7a2a24");
    ctx.fillStyle = g;
    ctx.fillRect(14, 50, 44, 22);
    ctx.strokeStyle = "#5f1c16";
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 50, 44, 22);
    wood(ctx, 8, 72, 56, 14, "#6d4520", "#52351a");
  });

  // 兵器架
  make("furn-rack", 62, 84, (ctx) => {
    wood(ctx, 4, 10, 6, 68);
    wood(ctx, 52, 10, 6, 68);
    wood(ctx, 2, 12, 58, 6, "#8a5a2b", "#6d4520");
    wood(ctx, 2, 40, 58, 6, "#8a5a2b", "#6d4520");
    ctx.strokeStyle = "#3a3d42";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, 78);
    ctx.lineTo(30, 4);
    ctx.stroke();
    ctx.strokeStyle = "#6a4a2a";
    ctx.beginPath();
    ctx.moveTo(40, 78);
    ctx.lineTo(38, 6);
    ctx.stroke();
    ctx.fillStyle = "#a6b1c4";
    ctx.beginPath();
    ctx.moveTo(28, 4);
    ctx.lineTo(33, 10);
    ctx.lineTo(29, 12);
    ctx.closePath();
    ctx.fill();
  });

  // 吊灯
  make("furn-lamp", 30, 40, (ctx) => {
    ctx.strokeStyle = "#3a3028";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(15, 12);
    ctx.stroke();
    ctx.fillStyle = "#b84038";
    ctx.beginPath();
    ctx.ellipse(15, 24, 11, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7a241e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(15, 24, 6, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#c9a13a";
    ctx.fillRect(11, 11, 8, 4);
    ctx.fillRect(11, 34, 8, 3);
    ctx.strokeStyle = "#e3c06a";
    ctx.beginPath();
    ctx.moveTo(15, 37);
    ctx.lineTo(15, 40);
    ctx.stroke();
  });
}
