import type { ArmorDef, ItemDef, WeaponDef } from "./types";

export const ITEMS: Record<string, ItemDef> = {
  mantou: {
    id: "mantou",
    name: "馒头",
    kind: "food",
    price: 3,
    desc: "热气腾腾的白面馒头，平平淡淡，最是踏实。",
    effect: { hunger: 35 }
  },
  baozi: {
    id: "baozi",
    name: "肉包子",
    kind: "food",
    price: 6,
    desc: "薄皮大馅，一口咬下去油水四溢。店小二说，十个包子能换一个天大的秘密。",
    effect: { hunger: 65 }
  },
  shaoji: {
    id: "shaoji",
    name: "烧鸡",
    kind: "food",
    price: 20,
    desc: "皮焦肉嫩，香气能飘出半条街。",
    effect: { hunger: 130 }
  },
  jingcha: {
    id: "jingcha",
    name: "井水",
    kind: "drink",
    price: 1,
    desc: "镇口老井的井水，清冽甘甜。",
    effect: { thirst: 40 }
  },
  qingcha: {
    id: "qingcha",
    name: "清茶",
    kind: "drink",
    price: 5,
    desc: "书院旁茶棚的粗茶，解渴，也醒神。",
    effect: { thirst: 80, mp: 10 }
  },
  huangjiu: {
    id: "huangjiu",
    name: "黄酒",
    kind: "drink",
    price: 8,
    desc: "老窖黄酒，后劲绵长。醉意三分，拳脚也活泛三分。",
    effect: { thirst: 45, hunger: 15, mp: 25 }
  },
  jinchuang: {
    id: "jinchuang",
    name: "金创药",
    kind: "medicine",
    price: 40,
    desc: "行走江湖必备良药，敷于伤口，止血生肌。",
    effect: { hp: 150 }
  },
  huichun: {
    id: "huichun",
    name: "回春丹",
    kind: "medicine",
    price: 120,
    desc: "平一指亲手调制的灵丹，药到病除，还能温养受损的经脉。",
    effect: { hp: 420, effective: 15 }
  },
  daHuan: {
    id: "daHuan",
    name: "大还丹",
    kind: "medicine",
    price: 500,
    desc: "传说能起死回生的丹药，气血、内力尽复，伤势尽愈。",
    effect: { hp: 9999, mp: 9999, effective: 100 }
  },
  jieDu: {
    id: "jieDu",
    name: "解毒丸",
    kind: "medicine",
    price: 30,
    desc: "清心化毒，百毒不侵不敢说，寻常蛇毒药到即解。",
    effect: { curePoison: true }
  },
  tiekuang: {
    id: "tiekuang",
    name: "铁矿石",
    kind: "material",
    price: 25,
    desc: "后山矿脉里采出的粗铁矿石，铁匠张见了眼睛发亮。",
    effect: {}
  },
  xuantie: {
    id: "xuantie",
    name: "玄铁",
    kind: "material",
    price: 260,
    desc: "陨落星铁，乌沉似墨，重逾寻常精铁数倍。打造神兵的关键。",
    effect: {}
  },
  yaocai: {
    id: "yaocai",
    name: "药草",
    kind: "material",
    price: 15,
    desc: "后山采的寻常草药，晒干了能卖几个钱。",
    effect: {}
  },
  shiliao: {
    id: "shiliao",
    name: "石料",
    kind: "material",
    price: 15,
    desc: "无名石窟里凿下的青石料，石质细密，正合修补碑石墓墙。",
    effect: {}
  },
  mafeng: {
    id: "mafeng",
    name: "麻绳",
    kind: "special",
    price: 2,
    desc: "一根结实的麻绳。镇西的歪脖树，听说见证过许多江湖人的最后一程。",
    effect: {}
  },
  shouChaoBen: {
    id: "shouChaoBen",
    name: "手抄本",
    kind: "book",
    price: 50,
    desc: "字迹潦草的手抄小册，记载着些不成章的吐纳口诀。",
    learnSkill: "jibenNeiGong"
  },
  quanJing: {
    id: "quanJing",
    name: "拳经",
    kind: "book",
    price: 0,
    desc: "不知何人抄录的拳谱，翻到最后一页，赫然是「猛虎」二字。",
    learnSkill: "mengHuQuan"
  },
  jingTianPu: {
    id: "jingTianPu",
    name: "惊天刀谱",
    kind: "book",
    price: 0,
    desc: "店小二用十个包子换来的刀谱，纸页泛黄，刀意却凛冽如新。",
    learnSkill: "jingTianDaoFa"
  },
  jiaoHuang: {
    id: "jiaoHuang",
    name: "焦黄纸页",
    kind: "book",
    price: 0,
    desc: "一片烧焦了大半的纸页，残存的字迹像酒醉后的狂草。",
    learnSkill: "zuiQuan"
  },
  maobi: {
    id: "maobi",
    name: "毛笔",
    kind: "quest",
    price: 8,
    desc: "一管紫毫笔，笔杆上刻着「三更灯火五更鸡」。",
    effect: {}
  },
  baiyuXiao: {
    id: "baiyuXiao",
    name: "白玉萧",
    kind: "quest",
    price: 0,
    desc: "温润如脂的白玉萧，箫尾系着一缕褪色的红绳。",
    effect: {}
  },
  jinfeng: {
    id: "jinfeng",
    name: "金钗",
    kind: "quest",
    price: 0,
    desc: "一枝凤凰衔珠的金钗，做工精巧，不知为何落在后山。",
    effect: {}
  },
  sanJiaoBan: {
    id: "sanJiaoBan",
    name: "三角石板",
    kind: "quest",
    price: 0,
    desc: "击败掌门后得到的奇异石板，边缘刻着玄奥纹路。六块齐聚，据说能打开时空尽头。",
    effect: {}
  },
  qingLongTu: {
    id: "qingLongTu",
    name: "青龙坛地图",
    kind: "quest",
    price: 0,
    desc: "村长多年心血所绘，红线标注着黑风寨深处的隐秘坛口。",
    effect: {}
  },
  shanChaHua: {
    id: "shanChaHua",
    name: "山茶花",
    kind: "quest",
    price: 0,
    desc: "阿绣悄悄塞给你的一枝山茶，红得像她笑起来的脸。",
    effect: {}
  },
  chuanShiLing: {
    id: "chuanShiLing",
    name: "传书令",
    kind: "quest",
    price: 0,
    desc: "官府火漆封缄的传书令，见令如见县尊。须亲手交到掌门手中。",
    effect: {}
  },
  mixin: {
    id: "mixin",
    name: "冷铁衣的密信",
    kind: "quest",
    price: 0,
    desc: "一封以蜡封缄的信，信上的字迹像是用左手写的，落款只有一个扭曲的「瓢」字。",
    effect: {}
  },
  xiuPa: {
    id: "xiuPa",
    name: "绣帕",
    kind: "quest",
    price: 0,
    desc: "一方绣着并蒂莲的绢帕，针脚细密，像是女儿家一针一线缝出来的。",
    effect: {}
  }
};

export const WEAPONS: Record<string, WeaponDef> = {
  fist: { id: "fist", name: "一双肉掌", kind: "fist", atk: 0, weight: 0, price: 0, desc: "赤手空拳，也是一条汉子。" },
  mudao: { id: "mudao", name: "木刀", kind: "blade", atk: 6, weight: 3, price: 30, desc: "武馆学徒练习用的木刀，砍在树上都留不下印子。" },
  mujian: { id: "mujian", name: "木剑", kind: "sword", atk: 5, weight: 2, price: 25, desc: "轻飘飘的桃木剑，练剑最宜。" },
  tiejian: { id: "tiejian", name: "铁剑", kind: "sword", atk: 14, weight: 8, price: 120, desc: "百炼精铁所铸，剑锋寒光内敛。" },
  yanlingDao: { id: "yanlingDao", name: "雁翎刀", kind: "blade", atk: 15, weight: 9, price: 140, desc: "刀身似雁翎微弯，适合刀客。" },
  tiefu: { id: "tiefu", name: "镔铁杖", kind: "staff", atk: 16, weight: 14, price: 150, desc: "镔铁所铸的齐眉杖，沉手扎实。" },
  ruanbian: { id: "ruanbian", name: "软鞭", kind: "whip", atk: 12, weight: 4, price: 110, desc: "牛皮绞成的软鞭，甩开来风声猎猎。" },
  qingfeng: { id: "qingfeng", name: "青锋剑", kind: "sword", atk: 26, weight: 7, price: 450, desc: "剑身隐泛青光，吹毛断发。" },
  jinDaHuanDao: { id: "jinDaHuanDao", name: "金丝大环刀", kind: "blade", atk: 28, weight: 16, price: 500, desc: "刀背缀九个大环，舞动时叮当作响，声势骇人。" },
  dagouBang: { id: "dagouBang", name: "打狗棒", kind: "staff", atk: 30, weight: 10, price: 600, desc: "翠绿竹棒，分量沉手，丐帮圣物。" },
  xuantieJian: { id: "xuantieJian", name: "玄铁重剑", kind: "sword", atk: 42, weight: 42, price: 1800, desc: "重剑无锋，大巧不工。玄铁所铸，重逾寻常兵刃数倍。" },
  yitian: { id: "yitian", name: "倚天剑", kind: "sword", atk: 48, weight: 8, price: 3000, desc: "武林至尊，宝刀屠龙；倚天不出，谁与争锋。" },
  tulong: { id: "tulong", name: "屠龙刀", kind: "blade", atk: 50, weight: 30, price: 3200, desc: "屠龙宝刀，号令天下，莫敢不从。" }
};

export const ARMORS: Record<string, ArmorDef> = {
  buyi: { id: "buyi", name: "布衣", slot: "armor", def: 0, weight: 0, price: 0, desc: "粗布短打，遮体而已。" },
  none: { id: "none", name: "无甲", slot: "armor", def: 0, weight: 0, price: 0, desc: "不着甲胄，身轻如燕。" },
  noneAcc: { id: "noneAcc", name: "无饰品", slot: "accessory", def: 0, weight: 0, price: 0, desc: "不佩戴饰品，一身清爽。" },
  pijia: { id: "pijia", name: "皮甲", slot: "armor", def: 6, weight: 8, price: 100, desc: "熟牛皮缝制，可挡寻常刀箭。" },
  jingbuyi: { id: "jingbuyi", name: "精制布衣", slot: "armor", def: 15, weight: 2, price: 300, desc: "针脚细密的劲装，轻便又耐穿。" },
  suozijia: { id: "suozijia", name: "锁子甲", slot: "armor", def: 14, weight: 22, price: 400, desc: "铁环相扣，水火不侵。" },
  jinSuoZi: { id: "jinSuoZi", name: "金锁子甲", slot: "armor", def: 28, weight: 24, price: 1500, desc: "金丝环甲，刀枪难入，据说是前朝贡品。" },
  liangyin: { id: "liangyin", name: "亮银甲", slot: "armor", def: 45, weight: 30, price: 3500, desc: "亮银所制，华光流转，只有真正的高手才配得上它。" },
  heiyi: { id: "heiyi", name: "黑衣", slot: "armor", def: 24, weight: 4, price: 900, desc: "夜行衣料，轻若无物，暗夜中难觅踪迹。" },
  pifeng: { id: "pifeng", name: "披风", slot: "accessory", def: 3, weight: 1, price: 60, desc: "挡风遮尘，江湖人的体面。" },
  sahuaXie: { id: "sahuaXie", name: "洒花缎鞋", slot: "accessory", def: 4, weight: 1, price: 120, desc: "缎面绣花，轻软舒适，脚下生风。" },
  niupiDai: { id: "niupiDai", name: "牛皮束带", slot: "accessory", def: 5, weight: 1, price: 90, desc: "束紧腰身，发力时更顺当。" },
  heiyanZhao: { id: "heiyanZhao", name: "黑眼罩", slot: "accessory", def: 6, weight: 1, price: 260, desc: "来历不明的眼罩，遮住半边脸，也遮住了许多故事。" },
  baiYuFo: { id: "baiYuFo", name: "白玉佛", slot: "accessory", def: 8, weight: 1, price: 0, desc: "守墓老人珍藏的白玉小佛，玉色温润，眉眼低垂，戴在身上心里便静了几分。" },
  taohuaZan: { id: "taohuaZan", name: "桃花簪", slot: "accessory", def: 6, weight: 1, price: 0, desc: "阿沅临别相赠的木簪，簪头雕着一朵将开未开的桃花。" }
};

export const INN_FOOD = ["mantou", "baozi", "shaoji"];
export const INN_DRINK = ["jingcha", "qingcha", "huangjiu"];
export const DRUG_ITEMS = ["jinchuang", "huichun", "daHuan", "jieDu"];
export const SMITH_ITEMS = ["tiekuang", "xuantie", "mafeng"];
export const ACADEMY_ITEMS = ["maobi", "shouChaoBen"];
