import { AREAS } from "../content/areas";
import { ITEMS, WEAPONS, ARMORS } from "../content/items";
import { QUESTS, questDef } from "../content/quests";
import { SECTS } from "../content/sects";
import { SKILLS, skillDef } from "../content/skills";
import { randomRumor } from "../content/story";
import type { DialogNode, EnemyDef } from "../content/types";
import {
  clamp,
  effectiveAttrs,
  expRequired,
  learnCost,
  maxHp,
  maxMp,
  meditateGain,
  potentialPerStrength
} from "./formulas";
import type { GameState, PlayerState } from "./state";

export function addItem(s: GameState, item: string, n = 1): void {
  const p = s.player;
  p.items[item] = (p.items[item] || 0) + n;
  if (p.items[item] <= 0) delete p.items[item];
}

export function removeItem(s: GameState, item: string, n = 1): void {
  addItem(s, item, -n);
}

export function hasItem(s: GameState, item: string, n = 1): boolean {
  return (s.player.items[item] || 0) >= n;
}

export function questProgress(s: GameState, id: string) {
  return s.player.quests[id] || { stage: 0, done: false, repeat: 0 };
}

export function acceptQuest(s: GameState, id: string): boolean {
  const p = s.player;
  if (p.quests[id] && !p.quests[id].done) return false;
  p.quests[id] = { stage: 0, done: false, repeat: (p.quests[id]?.repeat || 0) + 1 };
  return true;
}

export function advanceQuest(s: GameState, id: string, toStage?: number): void {
  const qp = pQuest(s, id);
  const def = questDef(id);
  if (toStage !== undefined) qp.stage = toStage;
  else qp.stage += 1;
  if (qp.stage >= def.stages.length) completeQuest(s, id);
}

function pQuest(s: GameState, id: string) {
  const qp = s.player.quests[id] || (s.player.quests[id] = { stage: 0, done: false, repeat: 0 });
  return qp;
}

export function completeQuest(s: GameState, id: string): void {
  const qp = pQuest(s, id);
  const def = questDef(id);
  const p = s.player;
  const r = def.reward;
  qp.done = true;
  qp.stage = 0;
  if (r.exp) p.exp += r.exp;
  if (r.potential) p.potential += r.potential;
  if (r.money) p.money += r.money;
  if (r.moral) p.moral = clamp(p.moral + r.moral, -100, 100);
  if (r.skill) {
    p.skills[r.skill] = Math.min((p.skills[r.skill] || 0) + (r.skillLv || 1), skillDef(r.skill).max);
  }
  for (const it of r.items || []) addItem(s, it);
}

export function advanceTime(s: GameState, hours: number): void {
  const p = s.player;
  p.time.hour += hours;
  while (p.time.hour >= 24) {
    p.time.hour -= 24;
    p.time.day += 1;
    ageOnDay(p);
    rollWeather(s);
  }
  const hunger = hungerCostFor(p, hours);
  p.hunger = clamp(p.hunger - hunger, 0, 100);
  p.thirst = clamp(p.thirst - hunger * 0.8, 0, 100);
  if (p.hunger > 0 && p.thirst > 0) {
    const mh = maxHp(p);
    const mm = maxMp(p);
    p.hp = Math.min(p.effHp, p.hp + Math.max(1, Math.floor(mh * 0.02 * hours)));
    p.mp = Math.min(mm, p.mp + Math.max(1, Math.floor(mm * 0.03 * hours)));
  }
  if (p.effHp <= 0 || p.hp <= 0) {
    p.hp = Math.max(1, p.effHp);
    handleDeath(s);
  }
}

function hungerCostFor(p: PlayerState, hours: number): number {
  return Math.max(0.5, hours * (0.8 + effectiveAttrs(p).li * 0.02));
}

// 岁月催人：每累计 10 天年龄 +1（闭关七日约长 0.7 岁）
function ageOnDay(p: PlayerState): void {
  if (p.time.day % 10 === 0) p.age += 1;
}

export function useItem(s: GameState, itemId: string): string {
  const p = s.player;
  const def = ITEMS[itemId];
  if (!def || (p.items[itemId] || 0) <= 0) return "没有这个物品。";
  if (def.kind === "book") {
    if (def.learnSkill) {
      const d = skillDef(def.learnSkill);
      const cur = p.skills[def.learnSkill] || 0;
      if (cur > 0) {
        // 已学过的抄本可以复读温习，小有精进（+3~5 级，不超过上限）
        if (cur >= d.max) return `「${d.name}」已练至化境，这本《${def.name}》于你没有新意了。`;
        const toLv = Math.min(d.max, cur + 3 + Math.floor(Math.random() * 3));
        p.skills[def.learnSkill] = toLv;
        removeItem(s, itemId);
        return `温故知新，你对《${def.name}》又有了新的领悟，「${d.name}」提升至 ${toLv} 级。`;
      }
      p.skills[def.learnSkill] = 1;
      removeItem(s, itemId);
      if (def.learnSkill === "mengHuQuan" || def.learnSkill === "jingTianDaoFa" || def.learnSkill === "zuiQuan") {
        checkXiaoyao(s);
      }
      return `你研读《${def.name}》，领悟了「${d.name}」！`;
    }
    return "这书读不懂。";
  }
  const eff = def.effect || {};
  if (eff.hp) p.hp = Math.min(p.effHp, p.hp + eff.hp);
  if (eff.mp) p.mp = Math.min(maxMp(p), p.mp + eff.mp);
  if (eff.hunger) p.hunger = clamp(p.hunger + eff.hunger, 0, 100);
  if (eff.thirst) p.thirst = clamp(p.thirst + eff.thirst, 0, 100);
  if (eff.effective) p.effHp = clamp(p.effHp + eff.effective, 1, maxHp(p));
  if (eff.curePoison) p.poison = 0;
  if (eff.potential) p.potential += eff.potential;
  removeItem(s, itemId);
  return `你使用了「${def.name}」。`;
}

export function learnSkill(s: GameState, skillId: string, levels = 1): string {
  const p = s.player;
  const d = skillDef(skillId);
  const cur = p.skills[skillId] || 0;
  if (cur >= d.max) return `「${d.name}」已经练到顶了。`;
  if (d.hidden && !p.flags[`learned-${skillId}`]) return "这门功夫来路不明，你学不了。";
  if (d.sect && p.sect !== d.sect) return "这不是你门派的功夫。";
  const toLv = Math.min(d.max, cur + levels);
  const cost = learnCost(skillId, cur, toLv, p);
  if (p.potential < cost) return `潜能不足，需要 ${cost} 点潜能。`;
  if (p.exp < expRequired(skillId, toLv)) return `经验不足，需要 ${expRequired(skillId, toLv)} 点经验。`;
  if (d.type === "literacy" && p.money < cost) return `读书识字要花钱，需要 ${cost} 两银子。`;
  if (d.learn) {
    const lr = d.learn;
    if (lr.basic && (p.skills[lr.basic] || 0) < (lr.basicLv || 0)) {
      return `需要先将「${skillDef(lr.basic).name}」练到 ${lr.basicLv} 级。`;
    }
    if (lr.exp && p.exp < lr.exp) return `需要 ${lr.exp} 点江湖经验。`;
    if (lr.attr) {
      const a = effectiveAttrs(p);
      const names = { li: "膂力", wu: "悟性", min: "敏捷", gen: "根骨" } as const;
      if (a[lr.attr.k] < lr.attr.v) return `需要${names[lr.attr.k]}达到 ${lr.attr.v}。`;
    }
  }
  p.potential -= cost;
  if (d.type === "literacy") p.money -= cost;
  p.skills[skillId] = toLv;
  return `「${d.name}」提升到了 ${toLv} 级。`;
}

export function canLearnSkill(s: GameState, skillId: string): string | null {
  const p = s.player;
  const d = skillDef(skillId);
  const cur = p.skills[skillId] || 0;
  if (cur >= d.max) return "已到顶级";
  if (d.hidden && !p.flags[`learned-${skillId}`]) return "来路不明";
  if (d.sect && p.sect !== d.sect) return "非本门武功";
  if (d.learn) {
    const lr = d.learn;
    if (lr.basic && (p.skills[lr.basic] || 0) < (lr.basicLv || 0)) return `需${skillDef(lr.basic).name}${lr.basicLv}级`;
    if (lr.exp && p.exp < lr.exp) return `需经验${lr.exp}`;
    if (lr.attr) {
      const a = effectiveAttrs(p);
      const names = { li: "膂力", wu: "悟性", min: "敏捷", gen: "根骨" } as const;
      if (a[lr.attr.k] < lr.attr.v) return `需${names[lr.attr.k]}${lr.attr.v}`;
    }
  }
  return null;
}

export function meditateTick(s: GameState): { ok: boolean; text: string } {
  const p = s.player;
  const cost = potentialPerStrength(p);
  if (p.potential < cost) return { ok: false, text: "潜能耗尽了，先去江湖上挣些潜能吧。" };
  p.potential -= cost;
  p.neiliStrength = Math.min(999, p.neiliStrength + meditateGain(p).strength);
  p.hp = Math.min(p.effHp, p.hp + meditateGain(p).hp);
  p.mp = Math.min(maxMp(p), p.mp + meditateGain(p).mp);
  p.effHp = Math.min(maxHp(p), p.effHp + 1);
  p.time.hour += 0.1;
  if (p.time.hour >= 24) {
    p.time.hour -= 24;
    p.time.day += 1;
    ageOnDay(p);
  }
  return { ok: true, text: `你凝神吐纳，内力强度提升至 ${p.neiliStrength}，气血精神亦随之恢复。` };
}

export function restAtInn(s: GameState): string {
  const p = s.player;
  if (p.money < 10) return "住店要十文钱，你囊中羞涩。";
  p.money -= 10;
  p.hp = p.effHp = maxHp(p);
  p.mp = maxMp(p);
  p.hunger = clamp(p.hunger + 20, 0, 100);
  p.thirst = clamp(p.thirst + 20, 0, 100);
  p.poison = 0;
  advanceTime(s, 6);
  return "你投宿悦来客栈。一夜无话，醒来时气血尽复，伤势也好了大半。";
}

export function retreatSevenDays(s: GameState): string {
  const p = s.player;
  if (p.money < 50) return "闭关七日要五十两银子的食宿钱。";
  p.money -= 50;
  p.hp = p.effHp = maxHp(p);
  p.mp = maxMp(p);
  p.poison = 0;
  advanceTime(s, 168);
  return `你闭门谢客，修炼七日。出关时，又是另一番光景。`;
}

/* ---------------- 随机事件（投宿/闭关/旅行/打坐触发） ---------------- */

export type EventScene = "inn" | "closed" | "travel" | "meditate";

interface TextEventDef {
  w: number; // 权重
  scenes?: EventScene[]; // 缺省=所有场景通用
  weather?: string[]; // 限定的天气
  night?: boolean; // 仅夜间（21-6 时）
  run: (s: GameState) => string;
}

const TEXT_EVENTS: TextEventDef[] = [
  // —— 通用（保留优化）——
  {
    w: 4,
    run: (s) => {
      const m = 15 + Math.floor(Math.random() * 60);
      s.player.money += m;
      return `途中拾到 ${m} 两散碎银两。`;
    }
  },
  {
    w: 3,
    run: (s) => {
      const v = 8 + Math.floor(Math.random() * 14);
      s.player.potential += v;
      return `你琢磨路上所见，若有所悟，潜能 +${v}。`;
    }
  },
  {
    w: 3,
    run: (s) => {
      const v = 12 + Math.floor(Math.random() * 24);
      s.player.exp += v;
      return `你听人讲了一段江湖旧事，经验 +${v}。`;
    }
  },
  {
    w: 3,
    run: (s) => {
      addItem(s, "yaocai");
      return "路边发现一株药草，随手采了。";
    }
  },
  {
    w: 2,
    run: (s) => {
      s.player.moral = clamp(s.player.moral + 1, -100, 100);
      return "你顺手帮路边的老妪挑了一担水，善名 +1。";
    }
  },
  { w: 1, run: () => "夜里听见远远的山歌，唱的人不知道是谁，调子却好听得很。" },
  // —— 客栈专属 ——
  {
    w: 3,
    scenes: ["inn"],
    run: (s) => `隔壁客官拍着桌子吹牛：${randomRumor(s)}`
  },
  {
    w: 2,
    scenes: ["inn"],
    run: (s) => {
      const p = s.player;
      if (p.money >= 20) {
        p.money -= 20;
        return "夜里遭了三只手，荷包轻了二十两。……也罢，破财免灾。";
      }
      p.money += 2;
      return "夜里遭了三只手。那贼摸到你荷包时愣了半天，倒给你留了两个铜板。";
    }
  },
  {
    w: 3,
    scenes: ["inn"],
    run: (s) => {
      s.player.hunger = clamp(s.player.hunger + 15, 0, 100);
      return "掌柜的送了一碗热姜汤：「客官，暖暖身子。」（饥饱 +15）";
    }
  },
  {
    w: 2,
    scenes: ["inn"],
    run: (s) => {
      const v = 20 + Math.floor(Math.random() * 21);
      s.player.exp += v;
      return `同宿的旅人讲起六大门派的见闻，你听得入神。（经验 +${v}）`;
    }
  },
  { w: 1, scenes: ["inn"], run: () => "同屋的镖师压低声音：「黑风寨那档子事，夜里莫要多问。」" },
  {
    w: 2,
    scenes: ["inn"],
    run: (s) => {
      s.player.potential += 10;
      return "梦里有个白胡子老头喂了你三招，醒来还记得两招。（潜能 +10）";
    }
  },
  // —— 闭关专属 ——
  {
    w: 3,
    scenes: ["closed"],
    run: (s) => {
      const v = 15 + Math.floor(Math.random() * 16);
      s.player.potential += v;
      return `面壁七日，忽然打通一处关窍，潜能 +${v}。`;
    }
  },
  {
    w: 2,
    scenes: ["closed"],
    run: (s) => {
      const p = s.player;
      p.mp = Math.max(0, Math.floor(p.mp * 0.9));
      return "行功稍有岔子，幸亏收得快，只乱了半口气。（内力 -10%）";
    }
  },
  {
    w: 2,
    scenes: ["closed"],
    run: (s) => {
      s.player.exp += 20;
      return "夜里听见隔壁武师练拳，拳风呼呼，你隔着墙比划，也学了两分。（经验 +20）";
    }
  },
  {
    w: 1,
    scenes: ["closed"],
    run: (s) => {
      s.player.hunger = clamp(s.player.hunger - 8, 0, 100);
      return "干粮叫老鼠拖去了一角。也罢，权当布施。（饥饱 -8）";
    }
  },
  {
    w: 2,
    scenes: ["closed"],
    run: (s) => {
      s.player.potential += 12;
      return "客房墙上有前人留下的剑痕，你对着比划半宿，若有所得。（潜能 +12）";
    }
  },
  // —— 天气专属 ——
  {
    w: 4,
    weather: ["rain"],
    run: (s) => {
      s.player.moral = clamp(s.player.moral + 1, -100, 100);
      return "雨天，你把伞借给了一个抱孩子的妇人。（善恶 +1）";
    }
  },
  {
    w: 4,
    weather: ["snow"],
    run: (s) => {
      const p = s.player;
      p.effHp = Math.min(maxHp(p), p.effHp + 3);
      return "雪夜围炉，烤得浑身暖透，旧伤都松快了几分。（有效气血 +3）";
    }
  },
  {
    w: 4,
    weather: ["wind"],
    run: (s) => {
      const r = Math.random();
      if (r < 0.4) {
        addItem(s, "yaocai");
        return "大风天，你捡到一只被吹落的包裹，里面是几株药草。";
      }
      if (r < 0.65) {
        addItem(s, "tiekuang");
        return "大风天，你捡到一只被吹落的包裹，里面竟是一块铁矿石。";
      }
      if (r < 0.85) {
        addItem(s, "jinchuang");
        return "大风天，你捡到一只被吹落的包裹，里面有一瓶金创药。";
      }
      s.player.money += 30;
      return "大风天，你捡到一只被吹落的包裹，里面有三十两碎银。";
    }
  },
  {
    w: 4,
    weather: ["fog"],
    run: (s) => {
      s.player.thirst = clamp(s.player.thirst - 10, 0, 100);
      return "雾里迷了路，多绕了半个时辰，口干舌燥。（口渴 -10）";
    }
  },
  // —— 夜间专属 ——
  {
    w: 2,
    night: true,
    run: (s) => {
      s.player.exp += 10;
      return "半夜睡不着，听见窗外两个黑衣人低语：『总瓢把子那边催得紧……』你屏住呼吸，一个字都不敢漏。（经验 +10）";
    }
  },
  {
    w: 1,
    night: true,
    run: () => "半夜被野猫吵醒，它蹲在墙头，冲你叫得理直气壮。你扔了半个馒头，它叼着跑了。"
  },
  // —— 旅行专属 ——
  {
    w: 3,
    scenes: ["travel"],
    run: (s) => {
      s.player.moral = clamp(s.player.moral + 1, -100, 100);
      return "你给一个迷路的樵夫指了下山的路。他千恩万谢，非要替你背一段行囊。（善恶 +1）";
    }
  },
  {
    w: 3,
    scenes: ["travel"],
    run: (s) => {
      const p = s.player;
      p.hp = Math.min(p.effHp, p.hp + Math.max(1, Math.floor(p.effHp * 0.08)));
      return "你在山溪里濯足，泉水清冽，一身疲乏去了大半。（气血 +8%）";
    }
  },
  {
    w: 3,
    scenes: ["travel"],
    run: (s) => {
      const r = Math.random();
      if (r < 0.4) {
        const m = 20 + Math.floor(Math.random() * 31);
        s.player.money += m;
        return `你拾到前人落下的包袱，里面有 ${m} 两银子。`;
      }
      if (r < 0.7) {
        addItem(s, "jinchuang");
        return "你拾到前人落下的包袱，里面有一瓶金创药。";
      }
      return "你拾到前人落下的包袱，打开一看，只有半块石头和一张欠条。";
    }
  },
  {
    w: 2,
    scenes: ["travel"],
    run: (s) => {
      s.player.exp += 15;
      return "路上与一个挑夫同行，听他讲了一路各地风物，长了不少见识。（经验 +15）";
    }
  },
  {
    w: 2,
    scenes: ["travel"],
    run: (s) => {
      s.player.hunger = clamp(s.player.hunger + 12, 0, 100);
      return "道旁野果正熟，摘了几枚，酸甜可口。（饥饱 +12）";
    }
  },
  // —— 打坐专属 ——
  {
    w: 3,
    scenes: ["meditate"],
    run: (s) => {
      const p = s.player;
      p.neiliStrength = Math.min(999, p.neiliStrength + 1);
      return "吐纳之间，只觉一股暖流沉入丹田，内力越发浑厚。（内力强度 +1）";
    }
  },
  { w: 1, scenes: ["meditate"], run: () => "念着念着，忽然想起镇上的肉包子……收心，收心。" },
  {
    w: 2,
    scenes: ["meditate"],
    run: (s) => {
      s.player.potential += 8;
      return "风声穿林，你忽然听出几分招式的节奏，若有所悟。（潜能 +8）";
    }
  }
];

function pickWeighted<T extends { w: number }>(pool: T[]): T | null {
  if (!pool.length) return null;
  let total = 0;
  for (const e of pool) total += e.w;
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.w;
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

// 文本事件：投宿/闭关 30%，旅行 20%，打坐收功 15%
export function rollRandomEvent(s: GameState, scene: EventScene): string | null {
  const gate = scene === "travel" ? 0.2 : scene === "meditate" ? 0.15 : 0.3;
  if (Math.random() > gate) return null;
  const p = s.player;
  const night = p.time.hour >= 21 || p.time.hour < 6;
  const pool = TEXT_EVENTS.filter(
    (e) => (!e.scenes || e.scenes.includes(scene)) && (!e.weather || e.weather.includes(p.weather)) && (!e.night || night)
  );
  const ev = pickWeighted(pool);
  return ev ? ev.run(s) : null;
}

// 选择支事件（走对话面板，选项发 event-* action），约占触发次数的 15%
interface ChoiceEventDef {
  w: number;
  scenes: EventScene[];
  night?: boolean;
  build: (s: GameState) => DialogNode[];
}

const CHOICE_EVENTS: ChoiceEventDef[] = [
  {
    w: 3,
    scenes: ["inn", "travel"],
    build: () => [
      {
        id: "r",
        speaker: "奇遇",
        text: "一个衣衫褴褛的老乞婆颤巍巍拦住你，伸出枯瘦的手：「行行好，老婆子三天没沾米粒了……」",
        opts: [
          { text: "给她十两银子", action: "event-qipo-give" },
          { text: "摇摇头走开", action: "event-qipo-ignore" }
        ]
      }
    ]
  },
  {
    w: 2,
    scenes: ["inn", "travel"],
    build: () => [
      {
        id: "r",
        speaker: "奇遇",
        text: "一个獐头鼠目的商贩凑过来，神秘兮兮地摊开手帕：「客官，大还丹！平一指亲手调的，只要五十两！」",
        opts: [
          { text: "花五十两买下来", action: "event-shenyao-buy" },
          { text: "扭头就走", action: "event-shenyao-leave" }
        ]
      }
    ]
  },
  {
    w: 2,
    scenes: ["inn", "travel"],
    build: () => [
      {
        id: "r",
        speaker: "奇遇",
        text: "一个醉汉拎着酒葫芦拦住去路，打了个酒嗝：「你、你瞅着挺能打……陪爷练两手？」",
        opts: [
          { text: "陪他练练", action: "event-zuihan-fight" },
          { text: "绕开他走", action: "event-zuihan-go" }
        ]
      }
    ]
  },
  {
    w: 2,
    scenes: ["travel"],
    night: true,
    build: () => [
      {
        id: "r",
        speaker: "奇遇",
        text: "破庙廊下，一个书生抱着书箱冻得直哆嗦，嘴唇乌青，还在借着月光背书。",
        opts: [
          { text: "把外衣披给他", action: "event-shusheng-help" },
          { text: "装作没听见", action: "event-shusheng-ignore" }
        ]
      }
    ]
  },
  {
    w: 1,
    scenes: ["inn", "travel"],
    build: () => [
      {
        id: "r",
        speaker: "奇遇",
        text: "一个货郎拦住你，摊开一张皱巴巴的羊皮：「藏宝图！祖上传下来的，三十两就卖！」",
        opts: [
          { text: "三十两买张梦想", action: "event-baotu-buy" },
          { text: "一笑了之", action: "event-baotu-leave" }
        ]
      }
    ]
  }
];

export function rollChoiceEvent(s: GameState, scene: EventScene): DialogNode[] | null {
  if (Math.random() > 0.15) return null;
  const night = s.player.time.hour >= 21 || s.player.time.hour < 6;
  const pool = CHOICE_EVENTS.filter((e) => e.scenes.includes(scene) && (!e.night || night));
  const ev = pickWeighted(pool);
  return ev ? ev.build(s) : null;
}

export function buyItem(s: GameState, itemId: string, qty = 1): string {
  const p = s.player;
  const def = ITEMS[itemId];
  if (!def) return "没有这种东西。";
  const cost = def.price * qty;
  if (p.money < cost) return "银子不够。";
  p.money -= cost;
  addItem(s, itemId, qty);
  return `你买下了 ${qty} 个「${def.name}」。`;
}

export function sellItem(s: GameState, itemId: string, qty = 1): string {
  const p = s.player;
  const def = ITEMS[itemId];
  if (!def || def.price <= 0) return "这个不值钱。";
  if ((p.items[itemId] || 0) < qty) return "你没有那么多。";
  removeItem(s, itemId, qty);
  const gain = Math.floor(def.price * 0.5 * qty);
  p.money += gain;
  return `你卖掉了 ${qty} 个「${def.name}」，得银 ${gain} 两。`;
}

export function buyWeapon(s: GameState, id: string): string {
  const p = s.player;
  const def = WEAPONS[id];
  if (!def) return "没有这种兵器。";
  if (p.money < def.price) return "银子不够。";
  p.money -= def.price;
  if (!p.weaponsOwned.includes(id)) p.weaponsOwned.push(id);
  p.forgeEquipped = false;
  p.weapon = id;
  return `你买下并装备了「${def.name}」。`;
}

export function buyArmor(s: GameState, id: string): string {
  const p = s.player;
  const def = ARMORS[id];
  if (!def) return "没有这种护具。";
  if (p.money < def.price) return "银子不够。";
  p.money -= def.price;
  if (def.slot === "accessory") {
    if (!p.accessoriesOwned.includes(id)) p.accessoriesOwned.push(id);
    p.accessory = id;
  } else {
    if (!p.armorsOwned.includes(id)) p.armorsOwned.push(id);
    p.armor = id;
  }
  return `你买下并穿上了「${def.name}」。`;
}

export function joinSect(s: GameState, sectId: string): string {
  const p = s.player;
  const sect = SECTS[sectId];
  if (p.sect) return "一徒不事二师。";
  if (sect.gender && p.gender !== sect.gender) {
    return sect.gender === "female" ? "此派只收女子，施主请回。" : "此派只收男子，施主请回。";
  }
  if (sect.moralMin && p.moral < sect.moralMin) return "你一身罪孽，本派不收。";
  // 与对话层 sectJoinNode 一致的门槛：天赋与基本功（规则归模拟层）
  const eff = effectiveAttrs(p);
  const attrNames = { li: "膂力", wu: "悟性", min: "敏捷", gen: "根骨" } as const;
  for (const req of sect.attrReq || []) {
    if (eff[req.k] < req.v) return `你的${attrNames[req.k]}不足 ${req.v}，尚达不到本派门墙。`;
  }
  if (sect.basicReq) {
    const lv = p.skills[sect.basicReq.skill] || 0;
    if (lv < sect.basicReq.lv) {
      return `你的「${skillDef(sect.basicReq.skill).name}」只有 ${lv} 级，火候还不到 ${sect.basicReq.lv} 级。`;
    }
  }
  p.sect = sectId;
  const first = sect.skills[0];
  if (first) p.skills[first] = 1;
  return `你拜入${sect.name}，在${sect.master}门下正式习武。`;
}

export function checkXiaoyao(s: GameState): void {
  const p = s.player;
  const hidden = ["mengHuQuan", "jingTianDaoFa", "zuiQuan"];
  if (!p.sect && hidden.every((h) => (p.skills[h] || 0) > 0)) {
    p.flags["xiaoyao"] = true;
  }
}

export function getRewards(s: GameState, enemy: EnemyDef, mult = 1): string[] {
  const p = s.player;
  const msgs: string[] = [];
  const exp = Math.round(enemy.exp * mult);
  const potential = Math.round(enemy.potential * mult);
  const money = Math.round(enemy.money * mult);
  p.exp += exp;
  p.potential += potential;
  p.money += money;
  msgs.push(`获得经验 ${exp}、潜能 ${potential}、银两 ${money}。`);
  if (enemy.wanted || enemy.boss) {
    const moralGain = enemy.wanted ? 3 : 2;
    p.moral = clamp(p.moral + moralGain, -100, 100);
    msgs.push(`为民除害，善恶 +${moralGain}。`);
  }
  for (const drop of enemy.drops || []) {
    if (Math.random() * 100 < drop.chance) {
      addItem(s, drop.item);
      msgs.push(`捡到了「${ITEMS[drop.item]?.name || drop.item}」！`);
    }
  }
  return msgs;
}

export function handleDeath(s: GameState): void {
  const p = s.player;
  // 有效气血减半已在战斗结算（syncBack）做过，这里只把当前气血钳回有效值内
  p.hp = clamp(p.hp, 1, Math.max(1, p.effHp));
  p.money = Math.floor(p.money * 0.5);
  p.potential = Math.floor(p.potential * 0.7);
  p.poison = 0;
  p.area = "town";
  p.room = null;
  p.x = 240;
  advanceTime(s, 6);
  p.dead = true;
}

export function hangEnding(s: GameState): void {
  s.player.ending = "hang";
  s.player.dead = true;
}

export function marry(s: GameState): string {
  const p = s.player;
  if (p.married) return "你们已经成亲了。";
  if (p.age < 18) return "年纪尚轻，再等两年吧。";
  if (!p.house) return "没有宅子，总不能露宿街头拜堂。";
  if (p.gender === "male" && (p.affections.axiu || 0) >= 60) {
    p.married = true;
    p.spouse = "阿绣";
    p.flags["spouse-home"] = true;
    return "红绳一系，白首不离。你在桃花源小筑迎娶了阿绣，满镇的桃花都开了。";
  }
  return "你还没有找到愿意与你共度一生的人。";
}

export function buyHouse(s: GameState): string {
  const p = s.player;
  if (p.house) return "你已经有宅子了。";
  if (p.money < 2000) return "桃花源小筑要两千两银子。";
  p.money -= 2000;
  p.house = true;
  p.flags["house"] = true;
  return "你在武当山下的桃花源买下一座小筑。推窗见山，闭门听雨，从此江湖有归处。";
}

// 舆图已知区域：首次成功进入某区域时记入，旧档/异常档缺省时补默认四区域
export function knownAreas(s: GameState): string[] {
  const p = s.player;
  let k = p.flags["known-areas"];
  if (!Array.isArray(k)) {
    k = ["town", "houshan", "wudang", "shangjia"];
    if (p.area && !k.includes(p.area) && AREAS[p.area]) k.push(p.area);
    p.flags["known-areas"] = k;
  }
  return k as string[];
}

// 区域进入门槛：返回拦阻文案（留在原地），null 表示可通行
function travelGate(s: GameState, area: string): string | null {
  if (area === "heifeng" && !hasItem(s, "qingLongTu")) {
    return "密林深处路径难辨，没有地图指引根本找不到黑风寨……";
  }
  return null;
}

export function travelTo(s: GameState, area: string): string | null {
  const p = s.player;
  const def = AREAS[area];
  if (!def) return "不知那是什么地方。";
  const blocked = travelGate(s, area);
  if (blocked) return blocked;
  p.area = area;
  p.room = null;
  p.x = 200;
  p.doorX = null;
  const known = knownAreas(s);
  if (!known.includes(area)) known.push(area);
  advanceTime(s, 2);
  rollWeather(s);
  return null;
}

export function leaveRoom(s: GameState): void {
  const p = s.player;
  const door = p.doorX ?? 180;
  p.room = null;
  p.x = door;
  p.doorX = null;
  advanceTime(s, 1);
  rollWeather(s);
}

export function rollWeather(s: GameState): void {
  const p = s.player;
  const theme = AREAS[p.area]?.theme;
  const r = Math.random();
  if (theme === "snow") {
    p.weather = r < 0.3 ? "snow" : r < 0.55 ? "fog" : r < 0.75 ? "wind" : r < 0.9 ? "sunny" : "rain";
  } else if (theme === "dark" || theme === "cloud" || theme === "cave") {
    p.weather = r < 0.3 ? "fog" : r < 0.55 ? "wind" : r < 0.7 ? "rain" : r < 0.85 ? "sunny" : "snow";
  } else {
    p.weather = r < 0.42 ? "sunny" : r < 0.6 ? "rain" : r < 0.76 ? "wind" : r < 0.9 ? "fog" : "snow";
  }
}

export function giveBaozi(s: GameState): string {
  if (!hasItem(s, "baozi", 10)) return "包子不够。";
  if (hasItem(s, "jingTianPu")) return "刀谱已经在你手里了。";
  removeItem(s, "baozi", 10);
  addItem(s, "jingTianPu");
  return "店小二眉开眼笑，把一本泛黄的惊天刀谱塞进你手里。";
}

export function giveMaobi(s: GameState): string {
  if (!hasItem(s, "maobi")) return "没有毛笔。";
  if (hasItem(s, "quanJing")) return "拳经已经在你手里了。";
  removeItem(s, "maobi");
  addItem(s, "quanJing");
  return "穷秀才抚着笔杆，恋恋不舍，最终还是把拳经换给了你。";
}

export function giveBaiyuXiao(s: GameState): string {
  if (!hasItem(s, "baiyuXiao")) return "没有白玉萧。";
  removeItem(s, "baiyuXiao");
  const aff = clamp((s.player.affections.axiu || 0) + 40, 0, 100);
  s.player.affections.axiu = aff;
  addItem(s, "shanChaHua");
  return "阿绣捧着白玉萧，眼圈红了：这是娘留给我的。她摘了一枝山茶花，轻轻放进你手心。";
}

export function giveJinfeng(s: GameState): string {
  if (!hasItem(s, "jinfeng")) return "没有金钗。";
  removeItem(s, "jinfeng");
  return "马大哈接住金钗，激动得直哆嗦。";
}

// 丐帮布施：馒头/包子/烧鸡任意凑数
const BEGGAR_FOOD = ["mantou", "baozi", "shaoji"];

export function countBeggarFood(s: GameState): number {
  return BEGGAR_FOOD.reduce((n, id) => n + (s.player.items[id] || 0), 0);
}

export function removeBeggarFood(s: GameState, n: number): boolean {
  if (countBeggarFood(s) < n) return false;
  for (const id of BEGGAR_FOOD) {
    while (n > 0 && (s.player.items[id] || 0) > 0) {
      removeItem(s, id);
      n -= 1;
    }
  }
  return true;
}

export function interactAction(s: GameState, action: string): string {
  const p = s.player;
  switch (action) {
    case "mine": {
      // 无名石窟的废弃矿脉：石料必掉 1-2 块（石窟残碑任务材料），偶有玄铁
      if (p.area === "shiku") {
        const roll = Math.random();
        if (roll < 0.08) {
          addItem(s, "xuantie");
          return "矿脉深处寒光一闪——你挖到了一块玄铁！";
        }
        const n = 1 + (Math.random() < 0.5 ? 1 : 0);
        addItem(s, "shiliao", n);
        return `你抡起镐头，凿下 ${n} 块青石料，石质细密，正合修碑之用。`;
      }
      const roll = Math.random();
      if (roll < 0.1) {
        addItem(s, "xuantie");
        return "矿洞里寒光一闪——你挖到了一块玄铁！";
      }
      if (roll < 0.6) {
        addItem(s, "tiekuang");
        return "你挖到一块铁矿石。";
      }
      if (roll < 0.65) {
        addItem(s, "baiyuXiao");
        return "矿洞里埋着一枝白玉萧，不知是哪位故人留下的。";
      }
      return "矿洞深处空空如也，只有水滴声。";
    }
    case "herb": {
      const roll = Math.random();
      if (roll < 0.45) {
        addItem(s, "yaocai");
        return "你采到一株药草。";
      }
      if (roll < 0.6) {
        addItem(s, "jinfeng");
        return "草丛里躺着一枝金钗——这大概就是马大哈丢的那支。";
      }
      return "草叶带着露水，却没有药草。";
    }
    case "well":
      p.thirst = clamp(p.thirst + 30, 0, 100);
      return "你俯身掬起一捧井水，清冽甘甜。";
    case "tree": {
      if (hasItem(s, "mafeng")) {
        return "tree";
      }
      return "歪脖树在风里轻轻摇晃。树皮上刻满了名字，有的还能辨认，有的早已风化。";
    }
    case "sign":
      return "sign";
    case "shrine":
      return "shrine";
    case "rest":
      return "rest";
    case "desk":
      return "desk";
    case "chest":
      return "chest";
    case "meditate":
      return "meditate";
    default:
      return "";
  }
}

export function enemyAvailable(s: GameState, enemyId: string): boolean {
  const p = s.player;
  if (enemyId === "zhouSan" && p.flags["zhouSanDead"]) return false;
  if (enemyId === "eGui" && (p.time.hour < 21 && p.time.hour > 5)) return false;
  return true;
}
