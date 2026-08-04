import type { QuestDef } from "./types";

export const QUESTS: Record<string, QuestDef> = {
  qMain: {
    id: "qMain",
    name: "除黑",
    kind: "main",
    giver: "村长",
    stages: [
      "向村长打听平安镇的近况",
      "替镇长去后山采三株药草",
      "向顾炎武请教学问，将读书识字练到 10 级",
      "击败在街上横行的恶霸铁拳周三",
      "累积经验达到 5000，向村长领取青龙坛地图",
      "循地图潜入黑风寨，击败青龙坛坛主冷铁衣",
      "将冷铁衣的密信交回村长",
      "挑战六大门派掌门，集齐六块三角石板",
      "回村长处开启通往时空尽头的大门",
      "在时空尽头直面最终的谜"
    ],
    doneText:
      "时空尽头的大门缓缓合拢，平安镇又回到了从前的样子。你知道那扇门还在，谜也还在——但只要有人在，江湖就总会有故事。",
    reward: { exp: 2000, potential: 1000, money: 2000 }
  },
  qYigong: {
    id: "qYigong",
    name: "婆婆的义工",
    kind: "side",
    giver: "老婆婆",
    stages: ["帮老婆婆挑水三次", "帮老婆婆劈柴三次", "帮老婆婆扫地三次"],
    doneText:
      "老婆婆眯着眼睛笑：好孩子，这年头肯弯腰的人不多了。她往你手里塞了几个铜板，又给你包了一包点心。",
    reward: { exp: 30, potential: 18, money: 20 },
    repeatable: true
  },
  qXunWu: {
    id: "qXunWu",
    name: "马大哈寻物",
    kind: "side",
    giver: "马大哈",
    stages: ["去后山找回马大哈弄丢的金钗", "把金钗交还给马大哈"],
    doneText:
      "马大哈捧着金钗左看右看，欢喜得直抹眼睛：失而复得的东西，才最金贵。她送了你一张发黄的纸页。",
    reward: { exp: 120, potential: 70, money: 50, items: ["jiaoHuang"] }
  },
  qChuE: {
    id: "qChuE",
    name: "缉拿恶人",
    kind: "side",
    giver: "捕快",
    stages: ["夜间到后山缉拿通缉犯夜行鬼", "回到县衙向捕快复命"],
    doneText:
      "捕快验了尸首，点了点头：好身手。平安镇有你这样的年轻人，我晚上也能睡个踏实觉了。",
    reward: { exp: 150, potential: 90, money: 120, moral: 5 },
    repeatable: true
  },
  qSha: {
    id: "qSha",
    name: "杀人名医的买卖",
    kind: "side",
    giver: "平一指",
    stages: ["替平一指杀黑风寨头目，提头来见", "向平一指复命领取报酬"],
    doneText:
      "平一指验过那枚刀疤头目的人头，难得地露出一丝笑：杀一人，医一人，公平得很。他随手抛来一包药。",
    reward: { exp: 90, potential: 60, money: 150, moral: -20, items: ["huichun"] },
    repeatable: true
  },
  qBeiFang: {
    id: "qBeiFang",
    name: "村长的拜访",
    kind: "side",
    giver: "村长",
    stages: ["拜访任意三位门派中人", "回村长家复命"],
    doneText:
      "村长听完你带回的口信，良久不语：这些大门派各怀心思，却都还认一个「江湖」字。镇子有救了。",
    reward: { exp: 200, potential: 120, money: 80, moral: 3 }
  },
  qTieJiang: {
    id: "qTieJiang",
    name: "玄铁难求",
    kind: "side",
    giver: "铁匠张",
    stages: ["替铁匠张寻来三块玄铁"],
    doneText:
      "铁匠张掂了掂玄铁，眼睛发亮：「好东西！这三块玄铁，够我打一件像样的兵刃了！」他大手一挥，工钱照付。",
    reward: { exp: 300, potential: 200, money: 500, items: ["tiekuang"] },
    repeatable: true
  },
  qYunZhongHe: {
    id: "qYunZhongHe",
    name: "缉拿云中鹤",
    kind: "side",
    giver: "捕快",
    stages: ["夜间（亥时到寅时）到后山寻出采花大盗云中鹤，将其击杀", "回县衙向捕快复命，领取八百两赏银"],
    doneText:
      "捕快验明正身，重重一拍你的肩：「作案一十九起的云中鹤，今日栽在你手里！八百两赏银，一个子儿不少！」江湖上从此多了个名号——捕风者。",
    reward: { exp: 500, potential: 350, money: 800, moral: 5 }
  },
  qTaoHun: {
    id: "qTaoHun",
    name: "逃婚风波",
    kind: "side",
    giver: "逃婚少女阿沅",
    stages: [
      "替阿沅拿个主意：护送她南逃百花谷，或劝她回去、报官了结",
      "护送阿沅南入百花谷，小心富商派来的家丁",
      "阿沅已回心转意，去县衙回禀捕快"
    ],
    doneText: "官道上的那场风波平息了。有人记得你拔刀的样子，也有人记得你放下刀的样子。",
    reward: { exp: 150, potential: 100, moral: 3 }
  },
  qShiKu: {
    id: "qShiKu",
    name: "石窟残碑",
    kind: "side",
    giver: "守墓老人",
    stages: [
      "为守墓老人寻来三块石料（石窟深处的废弃矿脉必有出产，行脚商人也有存货）",
      "把三块石料交给守墓老人"
    ],
    doneText:
      "墓碑重新立起来了。守墓老人抚着新补的碑角，对着石窟深处喃喃：「老伙计们，碑修好了，安心睡吧。」他塞给你一尊白玉佛，说是谢礼，也是念想。",
    reward: { exp: 200, potential: 120, money: 80 }
  },
  qChuanShu: {
    id: "qChuanShu",
    name: "传书令",
    kind: "side",
    giver: "县令",
    stages: ["把三枚传书令分别送达太极门清虚道长、八卦门王维扬、雪山剑派白瑞德手中"],
    doneText:
      "三枚传书令都有了着落。县令长长松了口气，连连作揖：「多亏少侠！三位掌门既已知晓，本县这顶乌纱，总算又多戴稳了几分。」",
    reward: { exp: 300, potential: 150, moral: 5 }
  },
  qWudangDaily: {
    id: "qWudangDaily",
    name: "武当洒扫",
    kind: "side",
    giver: "武当道童",
    stages: ["替道童采来三株药草（后山、石窟、百花谷都有药草丛）"],
    doneText:
      "道童捧着药草蹦了起来：「够了够了！这一炉丹准能成！」他塞给你一点谢礼，又压低声音：「别告诉古松师伯我炼丹的事。」",
    reward: { exp: 40, potential: 30, money: 10 },
    repeatable: true
  },
  qGaibangDaily: {
    id: "qGaibangDaily",
    name: "丐帮布施",
    kind: "side",
    giver: "丐帮弟子",
    stages: ["给丐帮弟子凑两份吃食（馒头、肉包子、烧鸡皆可）"],
    doneText:
      "丐帮弟子接过吃食，先掰了一半递给身边的小叫花，这才大口吃起来：「痛快！行走江湖，就图个有饭同吃！」",
    reward: { exp: 35, potential: 25, moral: 2 },
    repeatable: true
  }
};

export function questDef(id: string): QuestDef {
  const def = QUESTS[id];
  if (!def) throw new Error("未知任务: " + id);
  return def;
}
