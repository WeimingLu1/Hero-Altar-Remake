// NPC 生活引擎的纯逻辑层：关系对挑选与语料抽取（不含 Phaser，演出在 WorldScene）
import { KIND_LINES, RELATIONS, type NpcRelation, type RelationKind } from "../content/relations";
import type { GameState } from "./state";

// 一场互动的一句台词：who 指关系对中的 a 或 b
export interface LifeBeat {
  who: "a" | "b";
  emoji: string;
  text: string;
}

export interface LifeCtx {
  weather: string;
  hour: number;
  qmStage: number;
  coldIronDead: boolean;
}

export function relationPairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

// 从在场 NPC id 列表中找出双方都在场的关系对（距离过滤由场景层做）
export function candidatePairs(present: string[]): NpcRelation[] {
  const set = new Set(present);
  return RELATIONS.filter((r) => set.has(r.a) && set.has(r.b));
}

export function lifeCtxFrom(s: GameState): LifeCtx {
  const p = s.player;
  const qm = p.quests.qMain;
  return {
    weather: p.weather,
    hour: p.time.hour,
    qmStage: qm ? qm.stage : 0,
    coldIronDead: !!p.flags["coldIronDead"]
  };
}

const KIND_EMOJI: Record<RelationKind, string[]> = {
  couple: ["❤️", "😊"],
  master: ["🍵", "📜"],
  neighbor: ["💬", "🍵"],
  rival: ["⚔️", "😠"],
  friend: ["😂", "🍵"],
  trade: ["💰", "😂"],
  hate: ["😠", "🔥"],
  crush: ["💕", "😳"]
};

const WEATHER_BEATS: Record<string, { emoji: string; lines: string[] }> = {
  rain: { emoji: "🌧️", lines: ["这雨下得，裤脚全湿透了。", "出门忘看天，该打。"] },
  snow: { emoji: "❄️", lines: ["雪片子跟鹅毛似的。", "瑞雪兆丰年，就是冻手。"] },
  fog: { emoji: "🌫️", lines: ["这么大的雾，对面看不清人。", "雾里走路，仔细脚下。"] },
  wind: { emoji: "💨", lines: ["这风，把帽子都吹跑了。", "风大，眯着眼说话。"] }
};

const NIGHT_LINES = ["这么晚了，还不歇着？", "夜里凉，添件衣裳。", "今晚的月亮挺好。"];

// 主线后期（冷铁衣已除）的传闻式感慨
const STORY_LINES = ["听说了吗，黑风寨叫人挑了……", "冷坛主都栽了，这世道要变。", "那位少侠，据说就在这一带。"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 抽取一场互动的台词序列：基础对话（专属 75% / 通用池 25%）+ 天气/夜晚/主线情境插入，最多 5 条
export function pickRelationBeats(rel: NpcRelation, ctx: LifeCtx): LifeBeat[] {
  const beats: LifeBeat[] = [];
  const pool = rel.lines.length && Math.random() < 0.75 ? rel.lines : KIND_LINES[rel.kind];
  const group = pick(pool);
  const emoji = pick(KIND_EMOJI[rel.kind]);
  group.slice(0, 3).forEach((text, i) => beats.push({ who: i % 2 === 0 ? "a" : "b", emoji, text }));
  const side = (): "a" | "b" => (Math.random() < 0.5 ? "a" : "b");
  if (ctx.weather !== "sunny" && beats.length < 5 && Math.random() < 0.35) {
    const wb = WEATHER_BEATS[ctx.weather];
    if (wb) beats.push({ who: side(), emoji: wb.emoji, text: pick(wb.lines) });
  }
  if ((ctx.hour >= 20 || ctx.hour < 6) && beats.length < 5 && Math.random() < 0.3) {
    beats.push({ who: side(), emoji: "🌙", text: pick(NIGHT_LINES) });
  }
  if (ctx.coldIronDead && beats.length < 5 && Math.random() < 0.25) {
    beats.push({ who: side(), emoji: "💬", text: pick(STORY_LINES) });
  }
  return beats;
}
