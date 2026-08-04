import { randomLore } from "../content/lore";
import { NPCS } from "../content/npcs";
import { relationLabel } from "./relations";
import { getRelation, type GameState } from "./state";

type Intent = "talk" | "kind" | "hostile";

const WEATHER_NAMES: Record<string, string> = { sunny: "晴天", rain: "雨天", snow: "雪天", fog: "雾天", wind: "风天" };

const OPENERS: Record<Intent, string[]> = {
  talk: [
    "{name}抬眼看着你：「{title}今日正闲，你想听点什么？」",
    "你走近时，{name}已经把话头接了过去：「这阵子江湖上的风吹草动，我倒是知道一些。」",
    "{name}停下手里的事，语气不咸不淡：「是你啊。」",
    "{name}像是早就在等你：「今日的江湖，又添了一桩怪事。」",
    "你还没开口，{name}先笑了：「来得正好，我正缺个说话的人。」",
    "{name}抬头看了看天色：「{weather}，倒不是个适合赶路的日子。」",
    "{name}把手里的事一放：「你来得巧，我正想着些旧事。」",
    "{name}朝你点点头，像对一个老熟人：「又见面了。」"
  ],
  kind: [
    "你递过去一份好意，{name}愣了愣：「你这是……做什么？」",
    "{name}看着你，眼神松动了一些：「你这个人，倒不像旁的江湖人。」",
    "你替{name}把挡路的东西挪开，{name}低声道：「多谢。」",
    "你递过去半壶水，{name}接过去，喉结动了动：「……有心了。」",
    "你把身上的干粮分出一份，{name}看着你，像是想说什么又咽了回去。",
    "你替{name}挡了一阵风，{name}拢了拢衣领：「江湖人，难得遇上你这样不图回报的。」",
    "{name}接过你的好意，低头看了看，没有立刻说话。",
    "你替{name}把刀鞘扶正，{name}愣住半晌：「……谢谢。」"
  ],
  hostile: [
    "你目光不善，{name}也冷了下来：「怎么，今日是来找事的？」",
    "{name}嗤笑一声：「我劝你想清楚再开口。」",
    "你往前一步，{name}退后半步，又站定：「看来今日这事，不能善了。」",
    "你盯着{name}，{name}也盯着你，谁都不肯先移开目光。",
    "{name}冷笑：「我早料到，你我迟早会走到这一步。」",
    "你按住兵器，{name}也按住兵器，四下忽然静了下来。",
    "{name}的眼神冷下去：「你今日是存心要难为我了。」",
    "{name}把袖子一挽：「闲话少说，划下道来。」"
  ]
};

const MIDDLES: Record<Intent, string[]> = {
  talk: [
    "「说起来，{lore}」{name}说到这里，忽然住了口。",
    "「今日{weather}，倒是适合说些旧事。{lore}」",
    "{name}压低声音：「你听说过么——{lore}」",
    "「你和我的交情，也就是{relation}。」{name}半真半假地笑了笑。",
    "「这世道，{lore}」{name}说完又补了一句：「你可别到处说是听我讲的。」",
    "{name}压着嗓子：「{lore}。这话，我只说给你听。」",
    "「江湖上的事，十句里有九句是假的。」{name}顿了顿，「剩下那句，更假。」",
    "{name}望着远处：「{lore}。说来也怪，这些话我从不与人讲。」"
  ],
  kind: [
    "「你待我不薄，我心里记着。」{name}语气平和了些，「{relation}，说来也是缘分。」",
    "{name}收下好意，又想起什么：「对了，你听过这段旧话么——{lore}」",
    "「江湖上肯这样待人的不多。」{name}顿了顿，「改日你有难处，可来找我。」",
    "{name}把东西收好，语气松了些：「你这人，值得深交。」",
    "「人心都是肉长的。」{name}低声道，「你这番好意，我记住了。」",
    "{name}难得露出一点笑：「若人人都像你，这江湖倒也不那么冷了。」",
    "「{lore}」{name}说到这里，忽然看着你：「这些话，我倒是愿意说给你听。」",
    "{name}沉默片刻：「这份情，不是一句谢字能还的。」"
  ],
  hostile: [
    "「你我之间，也不过是{relation}。」{name}的指节捏得发白。",
    "「今日{weather}，火气大了些，你偏偏撞上来。」",
    "{name}冷冷道：「要打便打，不必再绕弯子。」",
    "「{relation}，说得难听些，你我本就该一刀两断。」",
    "{name}语气像结了霜：「今日你把话说到这份上，那就别怪我翻脸。」",
    "「你走你的阳关道，我过我的独木桥。」{name}一字一顿，「从今日起，两清。」",
    "{name}哼了一声：「我忍你很久了，今日正好一并算清。」",
    "「你最好记住今天。」{name}说，「往后这条路上，别再让我遇见你。」"
  ]
};

const CLOSERS: Record<Intent, string[]> = {
  talk: [
    "话说到这里，{name}摆摆手：「江湖路远，自己保重。」",
    "{name}又看了你一眼：「这些话，你听听就好。」",
    "{name}说完便不再多言，像是这些话已经用尽了一日的气力。",
    "{name}目送你走远，才慢慢把没说完的话咽了回去。",
    "{name}轻笑一声：「好了，话已至此，各走各路吧。」",
    "{name}摇摇头：「说得太多，反倒不像江湖了。」"
  ],
  kind: [
    "{name}点点头：「这份情，我记下了。」",
    "{name}难得地笑了笑：「但愿这江湖，多几个像你的人。」",
    "{name}朝你拱了拱手，没有再多说什么。",
    "{name}在原地站了一会儿，像是把你的话一并收进了怀里。",
    "{name}低声道：「往后你若有难处，说一声便是。」",
    "{name}看着你走远，才轻轻叹了口气。"
  ],
  hostile: [
    "{name}沉声道：「话不投机半句多，你好自为之。」",
    "{name}最后看你一眼，像在看一个迟早要撞上南墙的人。",
    "{name}拂袖而去，袖口却攥得死紧。",
    "{name}没有再说话，只是把门重重合上。",
    "{name}冷冷转身：「今日之事，我记下了。」",
    "{name}嗤笑：「但愿下次见面，你还能这么硬气。」"
  ]
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(line: string, vars: Record<string, string>): string {
  return line.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] || "");
}

export function generateDialogue(npcId: string, s: GameState, intent: Intent): string[] {
  const npc = NPCS[npcId];
  const name = npc?.name || "那人";
  const title = npc?.title || "江湖客";
  const rel = getRelation(s.world, "player", npcId);
  const vars = {
    name,
    title,
    relation: relationLabel(rel),
    weather: WEATHER_NAMES[s.player.weather] || "晴天",
    lore: randomLore(s)
  };
  return [
    fill(pick(OPENERS[intent]), vars),
    fill(pick(MIDDLES[intent]), vars),
    fill(pick(CLOSERS[intent]), vars)
  ];
}
