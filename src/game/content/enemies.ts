import type { EnemyDef } from "./types";
import { NPCS } from "./npcs";

// 数值配合比例减伤公式（dmg ∝ atk²/(atk+def×0.9)）重排：
// 野怪 4-6 回合、精英 6-10 回合、掌门 8-12 回合、终局 12-18 回合（对应 C1-C4 成长检查点）
export const ENEMIES: Record<string, EnemyDef> = {
  yezhu: {
    id: "yezhu",
    name: "野猪",
    hp: 180,
    mp: 0,
    atk: 11,
    def: 6,
    spd: 4,
    accuracy: 70,
    dodge: 4,
    crit: 4,
    exp: 16,
    potential: 10,
    money: 3,
    ai: "wild",
    desc: "一头红着眼睛的野猪，獠牙上还挂着树皮。",
    color: "#8a6a4a"
  },
  elang: {
    id: "elang",
    name: "恶狼",
    hp: 200,
    mp: 0,
    atk: 14,
    def: 8,
    spd: 7,
    accuracy: 76,
    dodge: 8,
    crit: 6,
    exp: 24,
    potential: 14,
    money: 4,
    ai: "wild",
    desc: "后山恶狼，夜里常叼走镇上的鸡。",
    color: "#6b6b76"
  },
  dushe: {
    id: "dushe",
    name: "五步毒蛇",
    hp: 210,
    mp: 30,
    atk: 14,
    def: 6,
    spd: 10,
    accuracy: 80,
    dodge: 14,
    crit: 8,
    exp: 38,
    potential: 24,
    money: 6,
    ai: "wild",
    desc: "色彩斑斓的毒蛇，信子一吐一吐。被它咬上一口，五步之内毒发。",
    color: "#4f8f5a",
    skills: [{ name: "毒牙", chance: 25, mult: 1.15, poison: 3, mpCost: 10, text: "毒蛇一口咬中，毒液顺着伤口钻了进去！" }]
  },
  xueLang: {
    id: "xueLang",
    name: "雪狼",
    hp: 850,
    mp: 40,
    atk: 50,
    def: 20,
    spd: 12,
    accuracy: 78,
    dodge: 12,
    crit: 8,
    exp: 130,
    potential: 95,
    money: 20,
    ai: "wild",
    desc: "雪山狼群的头狼，毛发如雪，眼珠却是血红的。",
    color: "#d8dee4",
    skills: [{ name: "撕咬", chance: 20, mult: 1.35, mpCost: 12, text: "雪狼纵身一扑，利齿直取你的咽喉！" }]
  },
  jianjing: {
    id: "jianjing",
    name: "剪径小贼",
    hp: 200,
    mp: 20,
    atk: 14,
    def: 10,
    spd: 7,
    accuracy: 72,
    dodge: 8,
    crit: 6,
    exp: 34,
    potential: 22,
    money: 25,
    ai: "bandit",
    desc: "「此山是我开，此树是我栽！」一个拿锈刀跳出来的瘦小贼人。",
    color: "#9a6a42"
  },
  shanzei: {
    id: "shanzei",
    name: "黑风寨山贼",
    hp: 450,
    mp: 40,
    atk: 30,
    def: 18,
    spd: 8,
    accuracy: 75,
    dodge: 9,
    crit: 8,
    exp: 75,
    potential: 50,
    money: 40,
    ai: "bandit",
    desc: "黑风寨喽啰，腰里别着抢来的钱袋。",
    color: "#7d5a44",
    skills: [{ name: "黑风刀法", chance: 18, mult: 1.4, mpCost: 15, text: "山贼怪叫一声，泼风般乱刀砍来！" }]
  },
  zhaiTou: {
    id: "zhaiTou",
    name: "山贼头目",
    hp: 900,
    mp: 60,
    atk: 46,
    def: 30,
    spd: 9,
    accuracy: 78,
    dodge: 10,
    crit: 10,
    exp: 160,
    potential: 120,
    money: 120,
    ai: "bandit",
    desc: "黑风寨小头目，脸上的刀疤从额头爬到下巴。",
    color: "#6d4630",
    skills: [{ name: "力劈华山", chance: 18, mult: 1.7, heavy: true, mpCost: 25, text: "头目暴喝一声，大刀力劈而下！" }]
  },

  /* 通缉恶人 */
  zhouSan: {
    id: "zhouSan",
    name: "铁拳周三",
    title: "镇恶霸",
    hp: 420,
    mp: 40,
    atk: 22,
    def: 12,
    spd: 8,
    accuracy: 76,
    dodge: 8,
    crit: 9,
    exp: 140,
    potential: 90,
    money: 150,
    ai: "bandit",
    desc: "平安镇一霸，一双铁拳打死过三条好汉，专收保护钱。",
    color: "#8a3b33",
    boss: true,
    wanted: true,
    skills: [{ name: "铁拳", chance: 20, mult: 1.5, mpCost: 15, text: "周三双拳一错，带着风雷之势砸来！" }]
  },
  yunZhongHe: {
    id: "yunZhongHe",
    name: "云中鹤",
    title: "采花大盗",
    hp: 1300,
    mp: 200,
    atk: 52,
    def: 32,
    spd: 15,
    accuracy: 84,
    dodge: 17,
    crit: 14,
    exp: 650,
    potential: 450,
    money: 600,
    ai: "boss",
    desc: "轻功绝世的大盗，作案一十九起，官府悬赏八百两。",
    color: "#5b6d8f",
    boss: true,
    wanted: true,
    skills: [
      { name: "鹤爪功", chance: 20, mult: 1.8, heavy: true, mpCost: 25, text: "云中鹤身形一飘，五指如钩，直取咽喉！" },
      { name: "迷魂香", chance: 12, mult: 0.7, debuff: { stat: "atk", value: -20, turns: 3 }, mpCost: 20, text: "一股甜香飘过，你只觉得手脚发软！" }
    ]
  },
  eGui: {
    id: "eGui",
    name: "夜行鬼",
    title: "官府通缉",
    hp: 850,
    mp: 40,
    atk: 48,
    def: 26,
    spd: 10,
    accuracy: 77,
    dodge: 12,
    crit: 10,
    exp: 170,
    potential: 130,
    money: 100,
    ai: "bandit",
    desc: "在平安镇一带犯下七条命案的凶徒，脸上刺着官印。",
    color: "#4f4f5e",
    wanted: true,
    skills: [{ name: "夜袭", chance: 18, mult: 1.5, mpCost: 20, text: "夜行鬼身影一矮，自死角递出致命一击！" }]
  },
  jiading: {
    id: "jiading",
    name: "家丁",
    title: "富商护院",
    hp: 480,
    mp: 30,
    atk: 32,
    def: 18,
    spd: 8,
    accuracy: 76,
    dodge: 9,
    crit: 8,
    exp: 80,
    potential: 55,
    money: 60,
    ai: "bandit",
    desc: "富商重金雇来的护院家丁，一条齐眉棍使得有模有样，奉命把逃婚的小姐抓回去。",
    color: "#7a6a4d",
    skills: [{ name: "齐眉棍", chance: 18, mult: 1.4, mpCost: 15, text: "家丁抡圆了齐眉棍，带着风声横扫而来！" }]
  },

  /* 青龙坛（黑风寨深处） */
  qingLongJingWei: {
    id: "qingLongJingWei",
    name: "青龙坛护卫",
    hp: 700,
    mp: 80,
    atk: 50,
    def: 34,
    spd: 10,
    accuracy: 80,
    dodge: 11,
    crit: 11,
    exp: 220,
    potential: 160,
    money: 120,
    ai: "guard",
    desc: "黑衣劲装的坛中护卫，衣襟上绣着一条盘踞的青龙。",
    color: "#3d5a6b",
    skills: [
      { name: "青龙探爪", chance: 18, mult: 1.8, heavy: true, mpCost: 25, text: "护卫沉肩探爪，爪风凌厉！" },
      { name: "青龙护体", chance: 12, mult: 1.0, buff: { stat: "def", value: 25, turns: 3 }, mpCost: 20, text: "护卫气沉丹田，周身泛起一层青芒！" }
    ]
  },
  qingLongTanZhu: {
    id: "qingLongTanZhu",
    name: "冷铁衣",
    title: "青龙坛坛主「青面兽」",
    hp: 1500,
    mp: 300,
    atk: 50,
    def: 44,
    spd: 13,
    accuracy: 84,
    dodge: 15,
    crit: 14,
    exp: 2200,
    potential: 1600,
    money: 2000,
    ai: "boss",
    desc: "面如青铁，一件铁衣从不离身。总瓢把子手下三大坛主之一。",
    color: "#4d7a6b",
    boss: true,
    drops: [{ item: "xuantie", chance: 80 }],
    skills: [
      { name: "铁衣横江", chance: 18, mult: 1.6, heavy: true, mpCost: 25, text: "冷铁衣挥动衣摆，铁衣如闸门般横压而来！" },
      { name: "青面獠牙", chance: 14, mult: 2.1, heavy: true, mpCost: 35, text: "冷铁衣面皮一青，利爪直取你双目！" },
      { name: "毒雾", chance: 12, mult: 0.8, poison: 8, mpCost: 20, text: "一股碧绿毒雾自他袖中滚滚而出！" }
    ]
  },

  /* 六大掌门（比武取石板） */
  qingXu: {
    id: "qingXu",
    name: "清虚道长",
    title: "太极门掌门",
    hp: 3100,
    mp: 900,
    atk: 122,
    def: 64,
    spd: 14,
    accuracy: 86,
    dodge: 18,
    crit: 15,
    exp: 4200,
    potential: 3200,
    money: 1500,
    ai: "master",
    desc: "三清三圣之首，一身太极神功圆转如意，深不可测。",
    color: "#8fa8c8",
    boss: true,
    skills: [
      { name: "震字诀", chance: 20, mult: 1.8, heavy: true, mpCost: 30, text: "清虚一掌吐出，震字诀直透经脉！" },
      { name: "乱环诀", chance: 14, mult: 2.4, heavy: true, mpCost: 38, text: "你被卷进乱环之内，四两拨千斤！" },
      { name: "阴阳诀", chance: 10, mult: 3.1, heavy: true, mpCost: 40, text: "阴阳二气交割，清虚这一掌已非凡尘手段！" },
      { name: "太极回天", chance: 8, mult: 1.0, heal: 0.08, mpCost: 50, text: "清虚双掌画圆，气定神闲，伤势竟缓缓平复！" }
    ]
  },
  wangWeiYang: {
    id: "wangWeiYang",
    name: "王维扬",
    title: "八卦门掌门「威震河朔」",
    hp: 3000,
    mp: 850,
    atk: 126,
    def: 66,
    spd: 15,
    accuracy: 85,
    dodge: 20,
    crit: 16,
    exp: 4200,
    potential: 3200,
    money: 1500,
    ai: "master",
    desc: "一双八卦掌、一把八卦刀威震江湖绿林。",
    color: "#b0894f",
    boss: true,
    skills: [
      { name: "化掌为刀", chance: 20, mult: 1.9, heavy: true, mpCost: 30, text: "王维扬掌缘如刀，横切而来！" },
      { name: "刀影掌", chance: 15, mult: 2.5, heavy: true, mpCost: 38, text: "刀光掌影同时迸发，避无可避！" },
      { name: "八阵化刀", chance: 10, mult: 3.2, heavy: true, mpCost: 40, text: "八阵八卦掌展开，天地风云尽数压来！" }
    ]
  },
  baiRuiDe: {
    id: "baiRuiDe",
    name: "白瑞德",
    title: "雪山剑派掌门「威德先生」",
    hp: 2900,
    mp: 800,
    atk: 132,
    def: 60,
    spd: 20,
    accuracy: 88,
    dodge: 24,
    crit: 20,
    exp: 4300,
    potential: 3300,
    money: 1500,
    ai: "master",
    desc: "剑术之精实为天下之冠，一招雪花六出，剑影漫天。",
    color: "#cfe3ef",
    boss: true,
    skills: [
      { name: "雪花六出", chance: 22, mult: 2.0, heavy: true, mpCost: 32, text: "六道剑光同时绽开，快得肉眼难追！" },
      { name: "冰心诀", chance: 12, mult: 1.0, buff: { stat: "def", value: 30, turns: 3 }, mpCost: 25, text: "白瑞德周身凝起冰甲，防御大涨！" },
      { name: "神倒鬼跌", chance: 10, mult: 2.9, heavy: true, mpCost: 38, text: "白瑞德一揪一抓一拌，你险些栽倒！" }
    ]
  },
  liQingZhao: {
    id: "liQingZhao",
    name: "李青照",
    title: "花间派掌门「千庵居士」",
    hp: 2800,
    mp: 950,
    atk: 118,
    def: 62,
    spd: 22,
    accuracy: 87,
    dodge: 26,
    crit: 18,
    exp: 4300,
    potential: 3300,
    money: 1500,
    ai: "master",
    desc: "武功卓绝且文采飞扬，出手如诗，杀人如画。",
    color: "#e3a0bd",
    boss: true,
    skills: [
      { name: "梅影三叠", chance: 20, mult: 1.8, heavy: true, mpCost: 30, text: "三道梅影叠叠而至，无声无息！" },
      { name: "落英缤纷", chance: 15, mult: 2.4, heavy: true, mpCost: 38, text: "鞭花如落英缤纷，将你卷得踉跄！" },
      { name: "三花聚顶", chance: 12, mult: 1.0, buff: { stat: "spd", value: 8, turns: 3 }, mpCost: 25, text: "李青照三花聚顶，身法骤然加快！" }
    ]
  },
  heZhongYang: {
    id: "heZhongYang",
    name: "和仲阳",
    title: "尹贺谷谷主「花讽院主」",
    hp: 2850,
    mp: 1000,
    atk: 122,
    def: 60,
    spd: 24,
    accuracy: 86,
    dodge: 28,
    crit: 19,
    exp: 4300,
    potential: 3300,
    money: 1500,
    ai: "master",
    desc: "扶桑忍术的大家，出手诡奇，如鬼如魅。",
    color: "#a98ec4",
    boss: true,
    skills: [
      { name: "忍术烟幕", chance: 16, mult: 0.8, debuff: { stat: "def", value: -15, turns: 2 }, mpCost: 20, text: "烟幕腾起，你眼前一片迷茫！" },
      { name: "旋风三连斩", chance: 18, mult: 2.2, heavy: true, mpCost: 32, text: "三道刀光交错，第三刀竟从背后斩来！" },
      { name: "迎风一刀斩", chance: 10, mult: 3.3, heavy: true, mpCost: 40, text: "和仲阳一刀平平斩出，天地色变！" }
    ]
  },
  yuHongRu: {
    id: "yuHongRu",
    name: "余鸿儒",
    title: "红莲教教主",
    hp: 3200,
    mp: 950,
    atk: 130,
    def: 64,
    spd: 13,
    accuracy: 85,
    dodge: 14,
    crit: 17,
    exp: 4400,
    potential: 3400,
    money: 1500,
    ai: "master",
    desc: "红莲教教主，功夫以力大招沉取胜，义之所在，虽万人吾往矣。",
    color: "#d96a5d",
    boss: true,
    skills: [
      { name: "百步神拳", chance: 20, mult: 1.9, heavy: true, mpCost: 30, text: "拳风破空如雷！" },
      { name: "雷动九天", chance: 12, mult: 2.8, heavy: true, mpCost: 38, text: "雷动九天！你被这一击震得气血翻涌！" },
      { name: "流星飞掷", chance: 8, mult: 3.8, heavy: true, mpCost: 40, text: "余鸿儒将钢杖如流星般掷出！" },
      { name: "红莲业火", chance: 8, mult: 1.0, heal: 0.08, mpCost: 50, text: "业火红莲自他周身绽放，灼伤竟渐渐愈合！" }
    ]
  },

  /* 丐帮帮主（非石板，可切磋） */
  qiaoSiHai: {
    id: "qiaoSiHai",
    name: "乔四海",
    title: "丐帮帮主",
    hp: 3100,
    mp: 900,
    atk: 128,
    def: 65,
    spd: 16,
    accuracy: 85,
    dodge: 19,
    crit: 16,
    exp: 4400,
    potential: 3400,
    money: 1600,
    ai: "master",
    desc: "背着九个口袋的天下第一大帮帮主，一根打狗棒打得天下恶狗无处藏身。",
    color: "#c79a63",
    boss: true,
    skills: [
      { name: "飞龙在天", chance: 20, mult: 1.9, heavy: true, mpCost: 30, text: "乔四海纵身而起，双掌如龙！" },
      { name: "天下无狗", chance: 14, mult: 2.5, heavy: true, mpCost: 38, text: "棒势铺天盖地，天下无狗！" },
      { name: "亢龙有悔", chance: 10, mult: 3.2, heavy: true, mpCost: 40, text: "亢龙有悔！掌力如怒龙回卷！" }
    ]
  },

  /* 终局三强 */
  woShiShui: {
    id: "woShiShui",
    name: "我是谁",
    title: "时空尽头的谜",
    hp: 9200,
    mp: 1500,
    atk: 270,
    def: 100,
    spd: 26,
    accuracy: 92,
    dodge: 30,
    crit: 24,
    exp: 12000,
    potential: 8000,
    money: 5000,
    ai: "boss",
    desc: "没有姓名，没有来历，只有一面映不出人影的铜镜，和镜中人自己的疑问。",
    color: "#8d86c9",
    boss: true,
    skills: [
      { name: "镜花水月", chance: 22, mult: 1.9, heavy: true, mpCost: 32, text: "镜光一闪，你攻出的招式竟原样打回自己身上！" },
      { name: "我是谁", chance: 14, mult: 2.6, heavy: true, mpCost: 40, text: "「我是谁？」这一问落下，你脑海中一片空白！" },
      { name: "无中生有", chance: 10, mult: 3.5, heavy: true, mpCost: 40, text: "虚空裂开，一掌自你影子中无声拍出！" }
    ]
  },
  daoDeHeShang: {
    id: "daoDeHeShang",
    name: "道德和尚",
    title: "执念成魔的圣僧",
    hp: 9800,
    mp: 1300,
    atk: 255,
    def: 112,
    spd: 18,
    accuracy: 90,
    dodge: 16,
    crit: 20,
    exp: 12000,
    potential: 8000,
    money: 3000,
    ai: "boss",
    desc: "他曾以道德度尽天下人，最后却发现自己度不了自己。",
    color: "#c9a05f",
    boss: true,
    skills: [
      { name: "金刚怒目", chance: 22, mult: 1.9, heavy: true, mpCost: 32, text: "金刚怒目，一掌如泰山压顶！" },
      { name: "当头棒喝", chance: 15, mult: 2.4, heavy: true, mpCost: 38, text: "「放下屠刀！」一声棒喝震得你耳中轰鸣！" },
      { name: "慈悲度化", chance: 12, mult: 3.0, heavy: true, mpCost: 40, text: "他以无边慈悲送你往生——好大的慈悲！" }
    ]
  },
  dongFangQiuBai: {
    id: "dongFangQiuBai",
    name: "东方求败",
    title: "求败不败",
    hp: 8800,
    mp: 1600,
    atk: 295,
    def: 96,
    spd: 30,
    accuracy: 93,
    dodge: 32,
    crit: 26,
    exp: 13000,
    potential: 9000,
    money: 6000,
    ai: "boss",
    desc: "他一生求一败而不可得，于是走进了时空尽头，等一个能打败他的人。",
    color: "#d85f6e",
    boss: true,
    skills: [
      { name: "独孤九剑", chance: 22, mult: 2.0, heavy: true, mpCost: 34, text: "九道剑光如奔雷逐电，专破你招式中的破绽！" },
      { name: "无剑胜有剑", chance: 14, mult: 2.7, heavy: true, mpCost: 40, text: "他手中无剑，剑意却已在你喉前三寸！" },
      { name: "求败一剑", chance: 9, mult: 3.9, heavy: true, mpCost: 40, text: "这一剑不求胜，只求败——你如何能挡？" }
    ]
  }
};

const MASTER_SPAR = ["qingXu", "wangWeiYang", "baiRuiDe", "liQingZhao", "heZhongYang", "yuHongRu", "qiaoSiHai"];
for (const id of MASTER_SPAR) {
  if (ENEMIES[id]) ENEMIES[id].spar = true;
}

function buildSparEnemy(npcId: string): EnemyDef | null {
  const npc = NPCS[npcId];
  if (!npc) return null;
  const tier = npc.master ? 4 : npc.learn || npc.learnBasic ? 3 : npc.walk ? 2 : 1;
  // 四档随新伤害公式同步缩放（hp/atk/def/spd/exp/pot）
  const scale: Record<number, [number, number, number, number, number, number]> = {
    1: [150, 10, 5, 4, 5, 4],
    2: [380, 20, 12, 7, 8, 7],
    3: [700, 38, 28, 10, 12, 11],
    4: [3000, 115, 55, 15, 15, 12]
  };
  const [hp, atk, def, spd, exp, pot] = scale[tier];
  return {
    id: `spar-${npcId}`,
    name: npc.name,
    title: `${npc.title || npc.name} · 切磋`,
    hp,
    mp: 0,
    atk,
    def,
    spd,
    accuracy: 78,
    dodge: tier >= 3 ? 14 : 8,
    crit: tier >= 3 ? 12 : 6,
    exp: Math.round(exp * 0.8),
    potential: Math.round(pot * 0.8),
    money: 0,
    ai: "wild",
    desc: "切磋较量，点到为止。",
    color: npc.color,
    spar: true,
    scale: npc.master ? 1.15 : 1
  };
}

for (const id of Object.keys(NPCS)) {
  const def = buildSparEnemy(id);
  if (def) ENEMIES[def.id] = def;
}

export function sparEnemyId(npcId: string): string {
  return `spar-${npcId}`;
}

export function enemyDef(id: string): EnemyDef {
  const def = ENEMIES[id];
  if (!def) throw new Error("未知敌人: " + id);
  return def;
}
