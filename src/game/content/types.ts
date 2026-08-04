export type SkillType =
  | "fist"
  | "sword"
  | "blade"
  | "staff"
  | "whip"
  | "neigong"
  | "lightness"
  | "parry"
  | "literacy"
  | "other";

export interface UltDef {
  id: string;
  name: string;
  lv: number;
  cost: number;
  mult: number;
  kind: "attack" | "defense" | "buff" | "debuff" | "heal";
  desc: string;
  text: string;
  // dodge/parry 为概率加成（0.15 即 +15%），其余为数值加减
  buff?: { stat: "atk" | "def" | "spd" | "dodge" | "parry"; value: number; turns: number };
  // 第二段增益（如逍遥游同时加身法与闪避）
  buff2?: { stat: "atk" | "def" | "spd" | "dodge" | "parry"; value: number; turns: number };
  debuff?: { stat: "atk" | "def" | "spd" | "dodge"; value: number; turns: number };
}

export interface SkillDef {
  id: string;
  name: string;
  type: SkillType;
  max: number;
  desc: string;
  base?: boolean;
  sect?: string;
  attr?: "li" | "wu" | "min" | "gen";
  weapon?: "fist" | "sword" | "blade" | "staff" | "whip";
  learn?: {
    exp?: number;
    basic?: string;
    basicLv?: number;
    moral?: number;
    attr?: { k: "li" | "wu" | "min" | "gen"; v: number };
    costBase?: number;
  };
  ult?: UltDef[];
  hidden?: boolean;
}

export interface SectDef {
  id: string;
  name: string;
  location: string;
  master: string;
  color: string;
  intro: string;
  moralMin?: number;
  gender?: "male" | "female";
  attrReq?: { k: "li" | "wu" | "min" | "gen"; v: number }[];
  basicReq?: { skill: string; lv: number };
  skills: string[];
  lightness: string;
  plate: boolean;
}

export type ItemKind =
  | "food"
  | "drink"
  | "medicine"
  | "material"
  | "quest"
  | "book"
  | "special";

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  price: number;
  desc: string;
  effect?: {
    hp?: number;
    mp?: number;
    hunger?: number;
    thirst?: number;
    effective?: number;
    curePoison?: boolean;
    potential?: number;
  };
  learnSkill?: string;
}

export type WeaponKind = "fist" | "sword" | "blade" | "staff" | "whip";

export interface WeaponDef {
  id: string;
  name: string;
  kind: WeaponKind;
  atk: number;
  weight: number;
  price: number;
  desc: string;
}

export interface ArmorDef {
  id: string;
  name: string;
  slot: "armor" | "accessory";
  def: number;
  weight: number;
  price: number;
  desc: string;
}

export interface EnemySkillDef {
  name: string;
  chance: number;
  mult: number;
  text: string;
  heavy?: boolean;
  poison?: number;
  // 技能耗内力：敌人 mp 不足时该技能不可用
  mpCost?: number;
  // heal：按最大气血比例回复自身（如 0.12 即 12%）
  heal?: number;
  // buff：增益自身（atk/def/spd 数值加减）
  buff?: { stat: "atk" | "def" | "spd"; value: number; turns: number };
  debuff?: { stat: "atk" | "def" | "spd"; value: number; turns: number };
}

export interface EnemyDef {
  id: string;
  name: string;
  title?: string;
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  accuracy: number;
  dodge: number;
  crit: number;
  exp: number;
  potential: number;
  money: number;
  drops?: { item: string; chance: number }[];
  skills?: EnemySkillDef[];
  ai: "wild" | "bandit" | "guard" | "master" | "boss";
  desc: string;
  color: string;
  boss?: boolean;
  scale?: number;
  wanted?: boolean;
  spar?: boolean;
}

export interface BuildingDef {
  id: string;
  name: string;
  x: number;
  w: number;
  kind:
    | "gate"
    | "inn"
    | "hall"
    | "smith"
    | "drug"
    | "study"
    | "yamen"
    | "home"
    | "shrine"
    | "shop"
    | "hill";
  doorX?: number;
  room?: string;
}

export interface AreaDef {
  id: string;
  name: string;
  width: number;
  theme: "town" | "mountain" | "snow" | "forest" | "island" | "cave" | "dark" | "cloud" | "temple";
  desc: string;
  fixedEnemies?: { enemy: string; x: number; walk?: number }[];
  buildings?: BuildingDef[];
  npcs?: string[];
  exits?: { x: number; w?: number; area: string; label: string; worldMap?: boolean }[];
  interactables?: {
    x: number;
    w?: number;
    label: string;
    action: "mine" | "herb" | "well" | "tree" | "sign" | "shrine" | "crack" | "look";
  }[];
}

export interface RoomDef {
  id: string;
  name: string;
  width: number;
  theme: "inn" | "hall" | "smith" | "drug" | "study" | "yamen" | "home" | "shrine" | "shop";
  npcs?: string[];
  exits?: { x: number; w?: number; area: string; label: string; room?: string }[];
  interactables?: {
    x: number;
    w?: number;
    label: string;
    action: "rest" | "meditate" | "desk" | "chest" | "well" | "shrine" | "house-rest" | "look";
  }[];
}

export interface NpcDef {
  id: string;
  name: string;
  title?: string;
  area: string;
  room?: string;
  x: number;
  walk?: number;
  color: string;
  gender?: "male" | "female";
  age?: number;
  looks?: string;
  martial?: string;
  hours?: [number, number];
  desc: string;
  // 切磋/掌门挑战胜利后从该 NPC 身上掉落的随身物品
  drops?: { item: string; chance: number }[];
  master?: boolean;
  enemy?: string;
  shop?: string[];
  buyAll?: boolean;
  learn?: string[];
  learnBasic?: string[];
  forge?: boolean;
  // 任务发布者标记：当前仅作数据标注，后续任务引擎（Phase 5）据此生成/挂载任务
  questGiver?: string;
  marriage?: boolean;
}

export interface QuestDef {
  id: string;
  name: string;
  kind: "main" | "side";
  giver: string;
  stages: string[];
  doneText: string;
  reward: {
    exp?: number;
    potential?: number;
    money?: number;
    items?: string[];
    moral?: number;
    skill?: string;
    skillLv?: number;
  };
  repeatable?: boolean;
}

export interface DialogOption {
  text: string;
  node?: string;
  action?: string;
}

export interface DialogNode {
  id: string;
  speaker?: string;
  text: string;
  opts?: DialogOption[];
}
