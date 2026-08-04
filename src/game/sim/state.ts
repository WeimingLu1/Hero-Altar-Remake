export interface Attrs {
  li: number;
  wu: number;
  min: number;
  gen: number;
}

export interface QuestProgress {
  stage: number;
  done: boolean;
  repeat: number;
}

export interface PlayerState {
  name: string;
  gender: "male" | "female";
  age: number;
  attrs: Attrs;
  looks: number;
  hp: number;
  effHp: number;
  mp: number;
  neiliStrength: number;
  potential: number;
  exp: number;
  money: number;
  moral: number;
  hunger: number;
  thirst: number;
  poison: number;
  skills: Record<string, number>;
  neigong: string | null;
  weapon: string;
  armor: string;
  accessory: string;
  weaponsOwned: string[];
  armorsOwned: string[];
  accessoriesOwned: string[];
  forgeWeapon: { name: string; kind: "sword" | "blade" | "staff" | "whip" | "fist"; atk: number; weight: number } | null;
  forgeEquipped: boolean;
  items: Record<string, number>;
  // 桃花源小筑存物柜（已购房后可用）
  storage: Record<string, number>;
  sect: string | null;
  married: boolean;
  spouse: string | null;
  house: boolean;
  time: { day: number; hour: number };
  area: string;
  room: string | null;
  x: number;
  doorX: number | null;
  weather: "sunny" | "rain" | "snow" | "fog" | "wind";
  affections: Record<string, number>;
  lastIntimacyDay: number;
  titles: string[];
  quests: Record<string, QuestProgress>;
  task: {
    popoWater: number;
    popoChop: number;
    popoSweep: number;
    visits: number;
  };
  flags: Record<string, boolean | number | string | string[]>;
  cheatLock: boolean;
  yobdc: boolean;
  ending: string | null;
  dead: boolean;
}

export interface GameState {
  version: number;
  player: PlayerState;
  createdAt: number;
  savedAt?: number; // 最近一次写入存档槽位的时间戳
}

export function rollAttrs(): Attrs {
  let li = 10 + Math.floor(Math.random() * 21);
  let wu = 10 + Math.floor(Math.random() * 21);
  let min = 10 + Math.floor(Math.random() * 21);
  let gen = 10 + Math.floor(Math.random() * 21);
  while (li + wu + min + gen > 80) {
    const k = Math.floor(Math.random() * 4);
    if (k === 0 && li > 10) li--;
    else if (k === 1 && wu > 10) wu--;
    else if (k === 2 && min > 10) min--;
    else if (k === 3 && gen > 10) gen--;
  }
  return { li, wu, min, gen };
}

export function createPlayer(name: string, gender: "male" | "female", attrs: Attrs): PlayerState {
  return {
    name,
    gender,
    age: 14,
    attrs,
    looks: 30 + Math.floor(Math.random() * 41),
    hp: 100,
    effHp: 100,
    mp: 20,
    neiliStrength: 0,
    potential: 30,
    exp: 0,
    money: 100,
    moral: 20,
    hunger: 90,
    thirst: 90,
    poison: 0,
    skills: {
      jibenQuan: 5,
      jibenJian: 1,
      jibenDao: 1,
      jibenZhang: 1,
      jibenBian: 1,
      jibenNeiGong: 1,
      jibenQingGong: 1,
      jibenZhaoJia: 1,
      duShu: 1
    },
    neigong: null,
    weapon: "fist",
    armor: "buyi",
    accessory: "pifeng",
    weaponsOwned: ["fist"],
    armorsOwned: ["buyi"],
    accessoriesOwned: ["pifeng"],
    forgeWeapon: null,
    forgeEquipped: false,
    items: { mantou: 3, jingcha: 2, jinchuang: 1 },
    storage: {},
    sect: null,
    married: false,
    spouse: null,
    house: false,
    time: { day: 1, hour: 8 },
    area: "town",
    room: null,
    x: 290,
    doorX: null,
    weather: "sunny",
    affections: {},
    lastIntimacyDay: 0,
    titles: [],
    quests: {},
    task: { popoWater: 0, popoChop: 0, popoSweep: 0, visits: 0 },
    flags: { "known-areas": ["town", "houshan", "wudang", "shangjia"] },
    cheatLock: false,
    yobdc: false,
    ending: null,
    dead: false
  };
}

export function newGame(name: string, gender: "male" | "female", attrs: Attrs): GameState {
  return {
    version: 2,
    player: createPlayer(name, gender, attrs),
    createdAt: Date.now()
  };
}

export function currentPlayer(s: GameState): PlayerState {
  return s.player;
}
