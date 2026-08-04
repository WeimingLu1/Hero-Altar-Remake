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
