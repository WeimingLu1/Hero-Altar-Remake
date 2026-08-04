export interface RomanceGift {
  item: string;
  value: number;
  text: string;
}

export interface RomanceDef {
  npcId: string;
  gender: "male" | "female";
  gifts: RomanceGift[];
  intimateText: string;
}

export const ROMANCE: Record<string, RomanceDef> = {
  axiu: {
    npcId: "axiu",
    gender: "female",
    gifts: [
      { item: "shanChaHua", value: 20, text: "阿绣接过山茶花，指尖轻轻碰了碰花瓣，眼睛亮得像盛了月光。" },
      { item: "baiyuXiao", value: 45, text: "阿绣捧着白玉萧看了很久，眼圈微红：这是娘留给我的。她再抬头看你时，眼神已然不同。" },
      { item: "huangjiu", value: 8, text: "阿绣把黄酒转手送给了隔壁的阿婆，回头朝你吐了吐舌头。" }
    ],
    intimateText:
      "红烛摇影，纱帐低垂。\n\n窗外月色正好，屋内只听得见彼此的心跳。\n\n阿绣的声音又轻又软：「你……可要好好的。」\n\n一夜春风过，帘外落花深。"
  },
  tangWanCi: {
    npcId: "tangWanCi",
    gender: "female",
    gifts: [
      { item: "shanChaHua", value: 25, text: "唐晚词接过山茶花，没有笑，却把花枝仔细簪在了发间。" },
      { item: "qingcha", value: 10, text: "她难得地抿了抿嘴角：「谷里的茶，不如你带来的这一杯。」" },
      { item: "huangjiu", value: 15, text: "唐晚词饮了一小口，脸上浮起薄薄的红：「刀客不忌酒。」" }
    ],
    intimateText:
      "散花亭的灯一盏盏熄了，只剩檐下一盏。\n\n唐晚词的刀挂在床头，她说刀在，人就在。\n\n月色从窗棂漏进来，她闭着眼，呼吸渐渐平稳。\n\n花落无声，长夜温柔。"
  },
  liZhenWei: {
    npcId: "liZhenWei",
    gender: "male",
    gifts: [
      { item: "huangjiu", value: 20, text: "李振威拍开泥封灌了一大口：「好酒！比镇口那家卖的正宗。」" },
      { item: "shaoji", value: 20, text: "他把烧鸡撕成两半，一半塞给你：「练武的人，一顿不吃饿得慌。」" }
    ],
    intimateText:
      "武馆的灯熄了，只有后院还亮着一盏。\n\n李振威坐在门槛上，声音比白天低了许多：「我这样的人，也会有人惦记么。」\n\n他没有等你回答，只是把外衫轻轻披在你肩上。\n\n夜风微凉，灯火昏黄。"
  },
  shangJianMing: {
    npcId: "shangJianMing",
    gender: "male",
    gifts: [
      { item: "huangjiu", value: 20, text: "商剑鸣仰头喝干，抹了把嘴：「痛快！改日教你两路拳。」" },
      { item: "jinchuang", value: 15, text: "他愣了愣：「……这是给我备的？我皮糙肉厚，用不着。」说着却小心收进了怀里。" }
    ],
    intimateText:
      "商家堡的演武场上没有人。\n\n商剑鸣坐在墙头看月亮，忽然说：「我这个人，除了拳脚，什么都拿不出手。」\n\n月色落在他的侧脸上，他别过头去，耳根却红了。\n\n夜风很轻，谁也没有说话。"
  }
};

const PARTNER_STATUS_FIRST = [
  "红烛摇影那一夜之后，{name}待你不同了。嘴上还是江湖客套，眼底却多了一分只给你看的软。",
  "你与{name}共度良宵之后，成了彼此心里有数的人。{name}不再说客套话，只问你几时再来。",
  "那晚之后，{name}把你的名字记在了心里。江湖人本不信什么天长地久，{name}却悄悄信了一回。",
  "你们有了共度良宵的情分。{name}说起你时语气平平，耳朵却先红了。",
  "一夜红烛，从此成了道侣。{name}嘴上不说，却总在人多时站到你身侧半步之内。",
  "自那夜起，{name}的作息里多了一条：睡前替你留一盏灯。",
  "你们之间的事，外人不清楚，{name}自己却清楚得很：这份情，是过了明路的。",
  "{name}逢人只说你是过路的，可夜深人静时，先想起的总是你。",
  "那晚红烛落尽，{name}却在灯下坐了很久，像是在等你开口说那句留下来。"
];

const PARTNER_STATUS_MORE = [
  "你们已不是头一回共度良宵。{name}与你之间少了试探，多了心照不宣的默契。",
  "几回良宵下来，{name}已经习惯你在身侧。江湖再大，对方只认你这一个归处。",
  "你与{name}的情分早就越过了客套。{name}偶尔会拿你打趣，眼神却骗不了人。",
  "夜夜灯下有人等，说的就是{name}。你们之间的事，镇上早已不是秘密。",
  "{name}嘴上嫌你来得晚，夜里却把被子往你那边挪了又挪。",
  "几度良宵，{name}已能一眼认出你的脚步声，连街口卖馄饨的都知道你在等人。",
  "你们不再提那些脸红的话，可一个眼神，就知道今晚的灯该留给谁。",
  "{name}把心事藏得深，藏不住的是你走后那盏迟迟不灭的灯。"
];

const CASUAL_STATUS_FIRST = [
  "你与{name}有过一夜春风。天亮之后各自上路，谁也没提以后。",
  "那晚的门是{name}亲手开的，天亮后你们又成了点头之交。江湖很大，这样的夜只当没来过。",
  "你与{name}有过一夜偷香。{name}再见你时神色如常，只有耳根微微发热。",
  "一夜春风过，两不相欠。{name}待你还是从前那样，客气得恰到好处。",
  "你们有过一场无名的夜。{name}没有问你的名字，却记住了你的脚步声。",
  "那一夜像落进深潭的石子，水面很快平了，只有{name}知道底下还沉着一圈涟漪。",
  "{name}再见到你时笑得很淡，仿佛那晚只是月下做的一个梦。",
  "你们什么也没许诺。{name}把窗关上时，动作轻得像怕惊动什么。"
];

const CASUAL_STATUS_MORE = [
  "你与{name}不止一次有过一夜春风。你们心照不宣：只谈今夜，不谈明天。",
  "几回偷香下来，{name}见你已不那么拘谨，甚至会在窗前多等片刻。",
  "你们之间有过几场春风。{name}从不追问你的去处，却总在你走后掩好窗。",
  "次数多了，{name}与你之间多了种说不清的默契——谁也不当真，谁也没忘。",
  "几回春风下来，{name}已学会不等天亮就问你要不要留下喝口热茶。",
  "你们的关系像没装锁的门：夜半能进，天明即散，谁都不点破。",
  "{name}嘴上说惯了江湖客套，可你再来时，窗台总比往常干净。"
];

const CLOSE_STATUS = [
  "你与{name}相识已久，话越说越密，灯越坐越晚。",
  "{name}待你与旁人不同，你心里清楚，对方也清楚。",
  "你们之间只差一句话、一步路、一夜灯。",
  "{name}会在人群里先看见你，再把目光移开，假装只是偶然。",
  "你们之间隔着一层窗纸，谁先伸手，谁就先看见里面的光。",
  "{name}旁敲侧击打听你的去处，又在你回头时装作只是随口一问。",
  "你与{name}的距离越来越近，近到连风都不好意思从中间穿过去。"
];

function pickText<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillName(text: string, name: string): string {
  return text.replace(/\{name\}/g, name);
}

export function randomRelationshipStatus(
  name: string,
  kind: "partner" | "casual" | "close",
  times: number
): string {
  if (kind === "partner") {
    return fillName(pickText(times > 1 ? PARTNER_STATUS_MORE : PARTNER_STATUS_FIRST), name);
  }
  if (kind === "casual") {
    return fillName(pickText(times > 1 ? CASUAL_STATUS_MORE : CASUAL_STATUS_FIRST), name);
  }
  return fillName(pickText(CLOSE_STATUS), name);
}
