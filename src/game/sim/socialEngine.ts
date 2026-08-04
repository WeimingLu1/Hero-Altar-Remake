import { NPCS } from "../content/npcs";
import { ROMANCE } from "../content/romance";
import { randomLore } from "../content/lore";
import { generateDialogue } from "./dialogEngine";
import { randomNpcLine, randomNpcReply } from "../content/story";
import { mutateRelation, relationLabel, type RelationDelta } from "./relations";
import { getRelation, type GameState, type WorldState } from "./state";

export type SocialIntent = "talk" | "kind" | "hostile";

export interface SocialResult {
  text: string;
  deltas: RelationDelta;
  battle?: string;
  panel?: "shop" | "learn" | "forge";
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function isEntityBusy(world: WorldState, id: string): boolean {
  const lock = world.interactionLocks[id];
  return !!lock && lock.until > Date.now();
}

export function tryLock(world: WorldState, a: string, b: string, kind: string, durationMs = 5000): boolean {
  if (isEntityBusy(world, a) || isEntityBusy(world, b)) return false;
  const until = Date.now() + durationMs;
  world.interactionLocks[a] = { partner: b, kind, until };
  world.interactionLocks[b] = { partner: a, kind, until };
  return true;
}

export function releaseLock(world: WorldState, a: string, b: string): void {
  const la = world.interactionLocks[a];
  if (la?.partner === b) delete world.interactionLocks[a];
  const lb = world.interactionLocks[b];
  if (lb?.partner === a) delete world.interactionLocks[b];
}

export function resolveSocialIntent(s: GameState, npcId: string, intent: SocialIntent): SocialResult {
  const npc = NPCS[npcId];
  if (!npc) return { text: "那人已经不在原地了。", deltas: {} };
  if (!tryLock(s.world, "player", npcId, `social-${intent}`, 4000)) {
    return { text: `${npc.name}正忙着别的事，没空理会你。`, deltas: {} };
  }
  const rel = s.world.npcRelations["player"]?.[npcId];
  const love = rel?.love || s.player.affections[npcId] || 0;
  if (intent === "talk") {
    if (npc.shop && Math.random() < 0.45) {
      return { text: `${npc.name}抬眼看看你，把货架上的东西挪了挪：「客官，看看货？」`, deltas: { friendliness: 1, trust: 1 }, panel: "shop" };
    }
    if ((npc.learn || npc.learnBasic) && Math.random() < 0.35) {
      return { text: `${npc.name}打量你一番：「想学几手？路还长着，先挑一样吧。」`, deltas: { friendliness: 1, trust: 1 }, panel: "learn" };
    }
    if (npc.forge && Math.random() < 0.4) {
      return { text: `${npc.name}擦擦手上的铁灰：「打件家伙？炉火正好。」`, deltas: { friendliness: 1 }, panel: "forge" };
    }
    if (ROMANCE[npcId] && love >= 50 && Math.random() < 0.5) {
      return {
        text: `${npc.name}的声音比平时轻了些：「今日的风，倒像你。」`,
        deltas: { friendliness: 2, love: 1, trust: 1 }
      };
    }
    return { text: generateDialogue(npcId, s, "talk").join("\n"), deltas: { friendliness: 1, trust: 1 } };
  }
  if (intent === "kind") {
    if (ROMANCE[npcId] && love >= 60 && Math.random() < 0.55) {
      return {
        text: `${npc.name}垂下眼帘，指尖轻轻碰了碰你的手背：「你待我这样好，教我如何还。」`,
        deltas: { friendliness: 6, love: 4, trust: 3 }
      };
    }
    if (npc.shop && Math.random() < 0.35) {
      return { text: `${npc.name}笑道：「有心了。挑样东西，算你便宜些。」`, deltas: { friendliness: 5, trust: 2 }, panel: "shop" };
    }
    if ((npc.learn || npc.learnBasic) && Math.random() < 0.3) {
      return { text: `${npc.name}受了你的好意，点头道：「功夫这东西，讲缘法。今日便教你几手。」`, deltas: { friendliness: 4, respect: 2, trust: 3 }, panel: "learn" };
    }
    if (npc.forge && Math.random() < 0.3) {
      return { text: `${npc.name}拍了拍你的肩：「懂规矩。来，炉子给你留着。」`, deltas: { friendliness: 4, trust: 2 }, panel: "forge" };
    }
    return {
      text: pick([
        `${npc.name}愣了愣，又笑了笑：「江湖上，肯平白对人好的人不多了。」`,
        `${npc.name}收下你的好意，往怀里揣了揣：「这份情，我记下了。」`,
        `${npc.name}摆摆手：「行了行了，再这样下去，我可要认你当朋友了。」`
      ]),
      deltas: { friendliness: 5, trust: 3, respect: 1 }
    };
  }
  const hostileStreak = Number(s.player.flags[`hostile-${npcId}`] || 0);
  const baseChance = npc.master || npc.enemy ? 0.14 : 0.08;
  const relScore = Math.max(0, -rel?.friendliness || 0);
  const fightChance = Math.min(0.7, baseChance + hostileStreak * 0.1 + relScore * 0.002);
  if (Math.random() < fightChance) {
    delete s.player.flags[`hostile-${npcId}`];
    return {
      text: `${npc.name}眉头一沉：「既然把话说开了，那就手上见真章吧。」`,
      deltas: { friendliness: -12, trust: -6, respect: 2 },
      battle: npc.enemy || `spar-${npcId}`
    };
  }
  s.player.flags[`hostile-${npcId}`] = hostileStreak + 1;
  return {
    text: randomHostileExchange(npc, s, relationLabel(getRelation(s.world, "player", npcId))),
    deltas: { friendliness: -8, trust: -4 }
  };
}

const HOSTILE_EXCHANGES = [
  "{name}冷笑：「{relation}？也配谈交情。」",
  "{name}上下打量你一眼：「就凭你，也敢在我面前放肆？」",
  "{name}嗤道：「{weather}，人和狗一样，火气都容易上来。」",
  "{name}压着嗓子：「你再走近一步，就别怪我不客气。」",
  "{name}把话头堵了回来：「我和你没什么好说的。」",
  "{name}斜睨着你：「听说你近来很能惹事？倒要看看你有几分斤两。」",
  "{name}冷冷道：「江湖上多你一个不多，少你一个不少。」",
  "{name}忽然笑了，笑里带着刺：「你以为我不敢动手？」",
  "{name}慢悠悠地说：「{lore}」顿了顿，「你听懂了么？」",
  "{name}把兵器从左手换到右手：「我劝你，今日收着点。」",
  "{name}压低声音：「这里人多，我不跟你计较。出了镇子，你再试试。」",
  "{name}啐了一口：「跟你多说一句，都算我输。」",
  "{name}抬了抬下巴：「你背后那些事，我可一清二楚。」",
  "{name}阴阳怪气：「{title}？好大的名头，可惜吓不住我。」",
  "{name}攥着拳头，指节咔咔作响：「你最好祈祷今天别散场。」",
  "{name}盯着你看了半晌：「我记住你了。」",
  "{name}讥笑道：「{relation}，也好意思跟我称兄道弟。」",
  "{name}眯起眼：「再嘴硬一句，我就替你师父教训教训你。」",
  "{name}冷冷扫了周围一眼：「今日人多，改日再跟你慢慢算。」",
  "{name}退后半步，又停住：「我不是怕你，是怕脏了自己的手。」"
];

function randomHostileExchange(
  npc: { name: string; title?: string },
  s: GameState,
  relLabel: string
): string {
  const line = pick(HOSTILE_EXCHANGES);
  const weatherNames: Record<string, string> = { sunny: "晴天", rain: "雨天", snow: "雪天", fog: "雾天", wind: "风天" };
  return line
    .replace(/\{name\}/g, npc.name)
    .replace(/\{title\}/g, npc.title || "无名之辈")
    .replace(/\{relation\}/g, relLabel)
    .replace(/\{weather\}/g, weatherNames[s.player.weather] || "晴天")
    .replace(/\{lore\}/g, randomLore(s));
}

const NPC_FRIENDLY = [
  "{a}见到{b}，脸上先有了笑意：「你来得正好，正想找你说话。」",
  "{a}和{b}并肩走着，声音低低的，像是怕惊了旁人的耳朵。",
  "{a}把一块干粮掰成两半，一半塞给{b}：「吃吧，路上别饿着。」",
  "{a}远远看见{b}，先招了招手：「今日天气好，不如喝一盏茶再走。」",
  "{a}拍了拍{b}的肩：「你这个人，够义气，我认。」",
  "{a}把新得的消息原原本本讲给{b}听，末了还叮嘱他别外传。"
];

const NPC_NEUTRAL = [
  "{a}和{b}在路口遇见，互相点了点头，又各自走开。",
  "{a}对{b}说起江湖传闻，{b}听得很认真。",
  "{a}问{b}近况如何，{b}只说「还过得去」。",
  "{a}看了{b}一眼，没有多话，只是让开了半步。",
  "{a}向{b}打听前面镇子的路，{b}抬手一指，两人便各自走了。",
  "{a}和{b}都在等同一件事，谁也不肯先开口问。"
];

const NPC_HOSTILE = [
  "{a}拦住{b}的去路，语气不善：「你欠我的那笔账，该清了吧。」",
  "{a}和{b}说着说着，声音越来越高，路人纷纷绕开。",
  "{a}冷笑一声：「{b}，你我之间，早晚要有一场。」",
  "{a}盯着{b}的兵器，手已经按上了刀柄。",
  "{a}把话说得极难听，{b}的脸色一点点沉下去。",
  "{a}一脚踢翻路边的木凳：「{b}，你少在我面前摆谱。」"
];

function fillNames(line: string, a: string, b: string, rel: string): string {
  return line.replace(/\{a\}/g, a).replace(/\{b\}/g, b).replace(/\{rel\}/g, rel);
}

export function resolveNpcNpcSocial(s: GameState, aId: string, bId: string): { text: string; reply: string; deltas: RelationDelta } {
  const a = NPCS[aId]?.name || aId;
  const b = NPCS[bId]?.name || bId;
  const rel = getRelation(s.world, aId, bId);
  const pool = rel.friendliness < -20 ? NPC_HOSTILE : rel.friendliness > 40 ? NPC_FRIENDLY : NPC_NEUTRAL;
  const text = fillNames(pick(pool), a, b, relationLabel(rel));
  return {
    text,
    reply: rel.friendliness < -20 ? randomNpcLine(bId) : randomNpcReply(bId),
    deltas: {
      friendliness: Math.floor(Math.random() * 9) - 3,
      trust: Math.floor(Math.random() * 6) - 2,
      respect: Math.floor(Math.random() * 4) - 1
    }
  };
}
