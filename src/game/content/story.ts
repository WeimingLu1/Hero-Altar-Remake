import type { DialogNode } from "./types";
import { NPCS } from "./npcs";
import { SECTS } from "./sects";
import { SKILLS } from "./skills";
import type { GameState, PlayerState } from "../sim/state";

function q(s: GameState, id: string) {
  return s.player.quests[id] || { stage: 0, done: false, repeat: 0 };
}

function has(s: GameState, item: string, n = 1): boolean {
  return (s.player.items[item] || 0) >= n;
}

function count(s: GameState, item: string): number {
  return s.player.items[item] || 0;
}

function plates(s: GameState): number {
  return count(s, "sanJiaoBan");
}

function effective(s: GameState) {
  const p = s.player;
  return {
    li: p.attrs.li + Math.floor((p.skills.jibenQuan || 0) / 10),
    wu: p.attrs.wu + Math.floor((p.skills.duShu || 0) / 10),
    min: p.attrs.min + Math.floor((p.skills.jibenQingGong || 0) / 10),
    gen: p.attrs.gen + Math.floor((p.skills.jibenNeiGong || 0) / 10)
  };
}

function sectJoinNode(s: GameState, sectId: string, prefix = ""): DialogNode[] {
  const sect = SECTS[sectId];
  const p: PlayerState = s.player;
  const eff = effective(s);
  const reason: string[] = [];
  const guide: string[] = [];
  if (p.sect) {
    reason.push(`你已是${SECTS[p.sect]?.name || "别派"}弟子，一徒不事二师。`);
    guide.push("武学贵在专一。若真想改投，需先辞别旧师，天下大得很。");
  }
  if (sect.gender && p.gender !== sect.gender) {
    reason.push("此派只收女子，施主请回。");
    guide.push("此派规矩如此。男儿自有金刚路，去太极、八卦、雪山看看，未必不如百花谷。");
  }
  if (sect.moralMin && p.moral < sect.moralMin) {
    reason.push(`你一身罪孽（善恶 ${p.moral}），本派不收。`);
    guide.push(`本派要善恶不低于 ${sect.moralMin}。县衙捕快的缉恶差事、老婆婆的义工、铲除黑风寨恶徒，都能积攒善名。`);
  }
  const attrNames = { li: "膂力", wu: "悟性", min: "敏捷", gen: "根骨" } as const;
  const attrGuide: Record<string, string> = {
    li: "去振威武馆找李振威，把基本拳脚练起来；膂力每长十级便增一点。",
    wu: "找顾炎武学读书识字，或者去书院抄书；悟性每长十级便增一点。",
    min: "勤练基本轻功，多在镇里镇外跑动；敏捷每长十级便增一点。",
    gen: "练基本内功，多打坐吐纳；根骨每长十级便增一点。"
  };
  for (const req of sect.attrReq || []) {
    const key = req.k;
    if (eff[key] < req.v) {
      reason.push(`你的${attrNames[key]}不足 ${req.v}，尚达不到本派门墙。`);
      guide.push(attrGuide[key]);
    }
  }
  if (sect.basicReq) {
    const bd = SKILLS[sect.basicReq.skill];
    const lv = p.skills[sect.basicReq.skill] || 0;
    if (lv < sect.basicReq.lv) {
      reason.push(`你的「${bd?.name || "基本功夫"}」只有 ${lv} 级，火候还不到 ${sect.basicReq.lv} 级。`);
      guide.push(`先把「${bd?.name || "基本功"}」练到 ${sect.basicReq.lv} 级，可去振威武馆向李振威请教。`);
    }
  }
  if (reason.length) {
    return [
      {
        id: prefix + "r",
        speaker: sect.master,
        text: `「${reason.join("")}」\n\n${sect.intro}`,
        opts: [
          { text: "求一条指引", node: prefix + "guide" },
          { text: "告辞", node: prefix + "bye" }
        ]
      },
      {
        id: prefix + "guide",
        speaker: sect.master,
        text: "「听好了——" + guide.join("") + "」",
        opts: [{ text: "多谢指点", node: prefix + "bye" }]
      },
      { id: prefix + "bye", speaker: sect.master, text: "「功夫到了，山门自开。」", opts: [] }
    ];
  }
  return [
    {
      id: prefix + "r",
      speaker: sect.master,
      text: `${sect.intro}\n\n「你若诚心向武，便在三清像前立个誓：此后行侠仗义，不负所学。」`,
      opts: [
        { text: "弟子拜见师父！", action: `join-sect:${sectId}` },
        { text: "弟子只想学几手功夫", node: prefix + "learn" },
        { text: "告辞", node: prefix + "bye" }
      ]
    },
    {
      id: prefix + "learn",
      speaker: sect.master,
      text: "「武学一途，没有捷径。你想学什么，尽管开口。」",
      opts: [
        { text: "请教武功", action: "learn" },
        { text: "告辞", node: prefix + "bye" }
      ]
    }
  ];
}

function masterCommon(s: GameState, sectId: string, npcId: string): DialogNode[] {
  const sect = SECTS[sectId];
  const p = s.player;
  const hasPlate = has(s, "sanJiaoBan");
  const joined = p.sect === sectId;
  const nodes: DialogNode[] = [];
  // 传书令差事：太极/八卦/雪山三位掌门可递交
  const deliverable =
    ["qingXu", "wangWeiYang", "baiRuiDe"].includes(npcId) &&
    !q(s, "qChuanShu").done &&
    !!s.player.quests.qChuanShu &&
    has(s, "chuanShiLing") &&
    !p.flags[`shu-${npcId}`];
  const deliverOpt = deliverable ? [{ text: "递交官府传书令", action: `deliver-shu:${npcId}` }] : [];
  if (!joined) {
    nodes.push(
      {
        id: "r",
        speaker: NPCS[npcId].name,
        text: `${NPCS[npcId].desc}\n\n「${sect.intro}」`,
        opts: [
          ...deliverOpt,
          { text: "拜师学艺", node: "join-r" },
          { text: "请教武功", action: "learn" },
          { text: "切磋武艺", node: "fight" },
          { text: "告辞", node: "bye" }
        ]
      },
      ...sectJoinNode(s, sectId, "join-")
    );
  } else {
    nodes.push({
      id: "r",
      speaker: NPCS[npcId].name,
      text: `「回来了。功课练得如何？」`,
      opts: [
        ...deliverOpt,
        { text: "请教武功", action: "learn" },
        { text: "切磋武艺", node: "fight" },
        { text: "告辞", node: "bye" }
      ]
    });
  }
  nodes.push({
    id: "fight",
    speaker: NPCS[npcId].name,
    text:
      hasPlate
        ? "「石板你已经拿到了，还要再打一场吗？好，就当活动筋骨。」"
        : "「想取三角石板，先问问我这一身功夫答不答应。」",
    opts: [
      { text: "请师父赐教", action: `challenge:${npcId}` },
      { text: "改日再来", node: "bye" }
    ]
  });
  nodes.push({
    id: "bye",
    speaker: NPCS[npcId].name,
    text: "「江湖路远，各自珍重。」",
    opts: []
  });
  return nodes;
}

export function getNpcDialog(npcId: string, s: GameState): DialogNode[] | null {
  const p = s.player;
  switch (npcId) {
    case "laozhe": {
      const qm = q(s, "qMain");
      const xy = p.flags["xiaoyao"];
      const xyDone = p.flags["xiaoyaoDone"];
      const opts: DialogNode["opts"] = [
        { text: "请教江湖消息", node: "rumor" },
        { text: "打听四本秘籍", node: "books" },
        { text: "告辞", node: "bye" }
      ];
      if (xy && !xyDone) {
        opts.unshift({ text: "（怀中三本秘籍微微发烫）请老丈过目", action: "xiaoyao-grant" });
      }
      return [
        {
          id: "r",
          speaker: "无名老者",
          text: xyDone
            ? "「逍遥散人，今日又来晒太阳？」\n\n老者眯着眼笑，仿佛只是随口一叫，又仿佛这个名号他等了许多年。"
            : qm.stage === 0
              ? "「新来的？十四岁，正是闯江湖的好年纪。老朽在镇口晒了一辈子太阳，见过许多人从这牌坊下走过——有人走出去成了大侠，有人走出去，就再没回来。\n\n这镇子看着太平，暗地里却不太平。你若想知道些什么，先去悦来客栈，问问那个嘴快的店小二。」"
              : "「还认得这棵歪脖树么？多少豪杰，最后都吊死在心魔上。记住，功夫能救你的命，救不了你的心。」",
          opts
        },
        {
          id: "rumor",
          speaker: "无名老者",
          text: "「江湖消息嘛，多半不值钱，却也未必没用——后山的药草能换钱，矿洞里有好东西；镇东的马大哈又丢了东西；夜里的后山，常有官府悬赏的恶人出没。\n\n还有，听说店小二拿十个包子，能换到一本惊天刀谱。」",
          opts: [{ text: "多谢老丈", node: "bye" }]
        },
        {
          id: "books",
          speaker: "无名老者",
          text: "「江湖上有四本奇书：店小二的惊天刀谱、书院里藏的拳经、马大哈手里的焦黄纸页，还有一本手抄本，据说在黑衣服的人身上。\n\n四书齐了，便自成一路，不必拜师，也能开宗立派。」",
          opts: [{ text: "受教了", node: "bye" }]
        },
        { id: "bye", speaker: "无名老者", text: "「去吧，趁日头还没落山。」", opts: [] }
      ];
    }
    case "heiren": {
      if (p.flags["gotShouChaoBen"]) {
        return [
          {
            id: "r",
            speaker: "神秘人",
            text: "「又见面了。手抄本上的吐纳口诀，可曾日夜用功？\n\n黑暗就要来了。青龙坛、黑风寨……都不过是爪牙。真正的对手，藏在时空尽头，连他自己都忘了自己是谁。」",
            opts: [
              { text: "你究竟是谁？", node: "who" },
              { text: "告辞", node: "bye" }
            ]
          },
          {
            id: "who",
            speaker: "神秘人",
            text: "「一个迷路的人。和你一样。」\n\n他说完，压低帽檐，不再言语。",
            opts: [{ text: "告辞", node: "bye" }]
          },
          { id: "bye", speaker: "神秘人", text: "斗篷在风中猎猎作响，他转身消失在巷口。", opts: [] }
        ];
      }
      return [
        {
          id: "r",
          speaker: "神秘人",
          text: "「你终于来了。\n\n这本手抄本，算是我给新人的见面礼。上面的吐纳法虽然粗浅，却是内功的根。练好了它，你再学什么都快。\n\n记住：平安镇只是起点。黑暗的势力，正在这片大陆上悄悄生根。」",
          opts: [
            { text: "多谢前辈（收下手抄本）", action: "get-shouChaoben" },
            { text: "告辞", node: "bye" }
          ]
        },
        { id: "bye", speaker: "神秘人", text: "「还会再见的。」", opts: [] }
      ];
    }
    case "xiaoer": {
      const hasTen = has(s, "baozi", 10);
      return [
        {
          id: "r",
          speaker: "店小二",
          text: "「哟！客官里边请！咱们悦来客栈，吃饭住宿，打尖歇脚，包您舒坦！\n\n平安镇最近可不太平——镇西来了个神秘人，东头恶霸周三天天收保护费，后山夜里还有人看见绿油油的眼睛……」",
          opts: [
            { text: "投宿住店", action: "rest-panel" },
            { text: "来点酒食", action: "shop" },
            { text: "打听消息", node: "rumor" },
            { text: "我带了十个包子……", node: hasTen ? "swap" : "noswap" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "rumor",
          speaker: "店小二",
          text: "「消息嘛，小店有的是——\n\n黑风寨的喽啰越来越猖狂了，听说寨子深处藏着什么坛，坛主是个穿铁衣的煞星。\n\n书院穷秀才藏着本拳经，却只肯拿毛笔换。马大哈丢了一枝金钗，急得满镇转悠。\n\n阿绣姑娘天天在门口卖花，你要是替镇上除了周三，她一准高兴。」",
          opts: [{ text: "多谢小二哥", node: "bye" }]
        },
        {
          id: "swap",
          speaker: "店小二",
          text: "「嘘——客官真有眼光！十个包子换一本惊天刀谱，童叟无欺！这刀谱是我从一个醉倒的刀客怀里摸来的，那刀客醒来说，这是惊天老人的遗物……」",
          opts: [{ text: "成交", action: "give-baozi" }]
        },
        {
          id: "noswap",
          speaker: "店小二",
          text: "「包子啊……您要是能攒够十个，我这儿倒是有个天大的秘密可以换给您。」",
          opts: [{ text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "店小二", text: "「客官慢走，下回还来啊！」", opts: [] }
      ];
    }
    case "axiu": {
      const zhouDead = p.flags["zhouSanDead"];
      const gotShancha = p.flags["gotShancha"];
      const giftOpt = has(s, "baiyuXiao") ? [{ text: "送你这枝白玉萧", action: "give-baiyuxiao" }] : [];
      const aff = p.affections.axiu || 0;
      return [
        {
          id: "r",
          speaker: "阿绣",
          text: zhouDead
            ? gotShancha
              ? aff >= 80
                ? "「你来了。」她声音很轻，颊边飞起薄红，像黄昏前最后的一朵云。"
                : "「你来啦。」她眼睛弯弯的，像是枝头刚开的花。"
              : "「是你！那天你打跑了周三，我偷偷看了好久……这个，送给你。」\n\n她红着脸，塞给你一枝山茶花。"
            : "「公子买花么？山茶开得正好。」",
          opts: zhouDead && !gotShancha
            ? [
                { text: "接住山茶花", action: "get-shancha" },
                { text: "闲聊几句", node: "chat" }
              ]
            : [
                ...giftOpt,
                { text: "陪她说说话", action: "like-axiu" },
                { text: "你有没有丢了什么？", node: "lost" },
                { text: "告辞", node: "bye" }
              ]
        },
        {
          id: "chat",
          speaker: "阿绣",
          text: "「镇上的花，就数山茶开得最好。娘说，花是给有心人看的。\n\n你要是喜欢，往后路过，都可以来和我说说话。」",
          opts: [
            { text: "我会常来的", action: "like-axiu" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "lost",
          speaker: "阿绣",
          text: "「丢东西的是东头的马大哈婶子，不是我。不过……你要是捡到一枝白玉萧，倒是可以送给我。娘说过，那是我们家早年间丢的。」",
          opts: [{ text: "记下了", node: "bye" }]
        },
        { id: "bye", speaker: "阿绣", text: "「花开花落，你要好好的。」", opts: [] }
      ];
    }
    case "yuexia": {
      const ok = p.age >= 18 && p.house && (p.affections.axiu || 0) >= 60 && p.gender === "male";
      return [
        {
          id: "r",
          speaker: "月下老人",
          text: "「红绳一根，牵住两个有缘人。年轻人，你来找我，可是心里有了人？」",
          opts: [
            { text: ok ? "请老丈为我与阿绣牵线" : "打听成亲的规矩", node: ok ? "marry" : "rules" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "rules",
          speaker: "月下老人",
          text: "「规矩嘛，三条：年纪得满十八，得有自己的宅子，得让她心里有你。\n\n宅子嘛，武当山那处桃花源小筑倒是不错，可惜要两百两银子，还要有胆子敢住。」",
          opts: [{ text: "告辞", node: "bye" }]
        },
        {
          id: "marry",
          speaker: "月下老人",
          text: "「好啊！难得难得！红绳一系，白首不离！」",
          opts: [{ text: "拜谢老丈（成亲）", action: "marry" }]
        },
        { id: "bye", speaker: "月下老人", text: "「有缘人，后会有期。」", opts: [] }
      ];
    }
    case "liZhenWei":
      return [
        {
          id: "r",
          speaker: "李振威",
          text: (p.affections.liZhenWei || 0) >= 80
            ? "「来得正好。我刚温了一壶酒。」他嗓门还是大，眼神却比往日软。"
            : "「来武馆的，十个有九个是想学两招防身的。来，站好，先让我看看你的根基。」",
          opts: [
            { text: "请师傅教基本功", action: "learnBasic" },
            { text: "告辞", node: "bye" }
          ]
        },
        { id: "bye", speaker: "李振威", text: "「基本功练扎实了，再来找我。」", opts: [] }
      ];
    case "guYanWu":
      return [
        {
          id: "r",
          speaker: "顾炎武",
          text: "「天下武功，一横一竖；天下学问，一撇一捺。少年，你可知道，读书读通了，拳脚才打得通？」",
          opts: [
            { text: "请先生教读书识字", action: "learnLiteracy" },
            { text: "请先生指点武学道理", node: "dao" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "dao",
          speaker: "顾炎武",
          text: "「学问是悟性的柴火。柴越多，火越旺。你去书院抄几天书，回来便知道老夫所言不虚。」",
          opts: [{ text: "受教", node: "bye" }]
        },
        { id: "bye", speaker: "顾炎武", text: "「去读书吧。今日不读，明日江湖里的亏，还是要你自己吃。」", opts: [] }
      ];
    case "tiejiang": {
      const qp = q(s, "qTieJiang");
      return [
        {
          id: "r",
          speaker: "铁匠张",
          text: qp.done
            ? "「玄铁这东西，可遇不可求。你要是再寻来三块，工钱照旧！」"
            : "「打铁的！要买兵器护具，自个儿挑；要打造神兵，带铁矿石和玄铁来，大爷我给你打出点名堂！」",
          opts: [
            { text: "看看货", action: "shop" },
            { text: "打造兵器", action: "forge" },
            ...(qp.done
              ? [{ text: "再替你寻三块玄铁", action: "quest-accept:qTieJiang" }]
              : qp.stage === 0 && !s.player.quests.qTieJiang
                ? [{ text: "听说你在寻玄铁？", action: "quest-accept:qTieJiang" }]
                : has(s, "xuantie", 3)
                  ? [{ text: "三块玄铁在此", action: "quest-advance:qTieJiang:0" }]
                  : []),
            { text: "告辞", node: "bye" }
          ]
        },
        { id: "bye", speaker: "铁匠张", text: "「锤子不认人，银子认得人。」", opts: [] }
      ];
    }
    case "pingYiZhi": {
      const qp = q(s, "qSha");
      return [
        {
          id: "r",
          speaker: "平一指",
          text: qp.done
            ? "「又来了？也罢，杀一人，医一人，公平买卖，童叟无欺。」"
            : p.flags["zhaiTouDead"]
              ? "「人头带来了？」"
              : "「看病？先谈买卖。我平一指的规矩，杀一人，医一人。你要买药，拿银子来；你要治病，拿人头来。」",
          opts: [
            { text: "买药", action: "shop" },
            ...(qp.done
              ? [{ text: "再接一单", action: "quest-accept:qSha" }]
              : p.flags["zhaiTouDead"]
                ? [{ text: "黑风寨头目的人头在此", action: "quest-complete:qSha" }]
                : [{ text: "接他的杀人买卖", action: "quest-accept:qSha" }]),
            { text: "告辞", node: "bye" }
          ]
        },
        { id: "bye", speaker: "平一指", text: "「医者仁心，那是别人的话。我只信一手交钱，一手交货。」", opts: [] }
      ];
    }
    case "xiucai": {
      const hasBrush = has(s, "maobi");
      return [
        {
          id: "r",
          speaker: "穷秀才",
          text: "「十年寒窗，一盏孤灯。公子来得正好——书院的纸笔，我这儿都有些。」",
          opts: [
            { text: "买些文房之物", action: "shop" },
            { text: hasBrush ? "我带来一管毛笔" : "听说你有本拳经？", node: hasBrush ? "swap" : "noswap" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "swap",
          speaker: "穷秀才",
          text: "「好笔！三更灯火五更鸡，正是男儿读书时。既如此，我拿这本拳经与你换——书呆子练不了拳，放着也是蒙尘。」",
          opts: [{ text: "成交", action: "give-maobi" }]
        },
        {
          id: "noswap",
          speaker: "穷秀才",
          text: "「拳经是有一本，可惜不卖。你要是有管好毛笔，倒是可以换。字是人的脸面，笔是字的脸面啊。」",
          opts: [{ text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "穷秀才", text: "「书中自有黄金屋，公子多来坐坐。」", opts: [] }
      ];
    }
    case "xunbu": {
      const qp = q(s, "qChuE");
      const qy = q(s, "qYunZhongHe");
      const qt = q(s, "qTaoHun");
      const opts: DialogNode["opts"] = [];
      // 旧差事：夜行鬼（可重复）
      if (qp.done) {
        opts.push({ text: "接下新差事", action: "quest-accept:qChuE" });
      } else if (p.flags["eGuiDead"]) {
        opts.push({ text: "尸首就在后山", action: "quest-complete:qChuE" });
      } else {
        opts.push({ text: "接下缉拿差事", action: "quest-accept:qChuE" });
      }
      // 新差事：云中鹤通缉链（一次）
      if (!qy.done) {
        if (qy.stage === 0 && !s.player.quests.qYunZhongHe) {
          opts.push({ text: "打听缉拿云中鹤的悬赏", action: "quest-accept:qYunZhongHe" });
        } else if (p.flags["yunZhongHeDead"]) {
          opts.push({ text: "云中鹤已伏诛，特来复命", action: "quest-complete:qYunZhongHe" });
        }
      }
      // 逃婚风波·乙线：劝回之后来报官领谢仪
      if (!qt.done && qt.stage === 2) {
        opts.push({ text: "逃婚少女已回心转意", action: "taohun-report-done" });
      }
      opts.push({ text: "告辞", node: "bye" });
      const text = qy.done
        ? "「捕风者，什么风把你吹来了？」捕快难得露出笑脸，「自从你拿了云中鹤，这一带的飞贼都消停多了。」"
        : s.player.quests.qYunZhongHe && !qy.done
          ? p.flags["yunZhongHeDead"]
            ? "「云中鹤死了？！好，好一个少年英雄！快，随我验明正身，赏银一文不会少你的！」"
            : "「云中鹤那厮轻功绝世，作案一十九起，悬赏八百两。他昼伏夜出，亥时到寅时之间，多半在后山一带落脚。夜里去，仔细他的鹤爪功。」"
          : qp.done
            ? "「好手！这年头，敢替官府办事的不多了。还有一单，接不接？」"
            : p.flags["eGuiDead"]
              ? "「夜行鬼死了？尸首在哪，带我去验！」"
              : "「悬赏的告示贴了满街，敢揭的却没几个。你若有胆量，夜里去后山走一趟——通缉犯夜行鬼，专在丑时出没。杀了他，赏银照给，一个铜板不少。」";
      return [
        { id: "r", speaker: "捕快", text, opts },
        { id: "bye", speaker: "捕快", text: "「刀口上讨生活，眼睛得放亮些。」", opts: [] }
      ];
    }
    case "xianling": {
      const qc = q(s, "qChuanShu");
      const opts: DialogNode["opts"] = [{ text: "告辞", node: "bye" }];
      if (!qc.done && qc.stage === 0 && !s.player.quests.qChuanShu) {
        opts.unshift({ text: "愿替县尊跑一趟腿", action: "quest-accept:qChuanShu" });
      }
      return [
        {
          id: "r",
          speaker: "县令",
          text: qc.done
            ? "「少侠来了！坐坐坐——自从传书令送到，三位掌门都回了话，本县这觉啊，睡得安稳多了！」"
            : s.player.quests.qChuanShu
              ? "「传书令……可都送到了？太极门的清虚道长、八卦门的王掌门、雪山派的白先生，一位都少不得啊。」\n\n他说着说着，又开始抖茶碗。"
              : "「咳咳……本县治下，向来太平。什么采花大盗、什么黑风寨，都是刁民谣传！你，你莫要听信！」\n\n他说这话时，手抖得连茶碗都端不稳。",
          opts
        },
        { id: "bye", speaker: "县令", text: "「退、退下！」", opts: [] }
      ];
    }
    case "cunzhang": {
      const qm = q(s, "qMain");
      const stage = qm.stage;
      if (qm.done) {
        return [
          {
            id: "r",
            speaker: "村长",
            text: "「时空尽头的大门已经合拢，但平安镇的日子还在过。你若是愿意，随时回来喝杯茶。」",
            opts: [{ text: "告辞", node: "bye" }]
          },
          { id: "bye", speaker: "村长", text: "茶香袅袅，镇口的风也温柔了许多。", opts: [] }
        ];
      }
      if (stage >= 7) {
        return [
          {
            id: "r",
            speaker: "村长",
            text:
              plates(s) >= 6
                ? "「六块石板……竟然真的集齐了！\n\n年轻人，时空尽头就在平安镇的地下。那扇门，只有石板能开。至于门后是什么——是谜，还是救赎，老朽也不知道。你去吧，替所有人看一眼。」"
                : "「冷铁衣一死，黑暗势力必然疯狂反扑。六大掌门各执一块石板，那是通往时空尽头的钥匙。你……能有这个本事吗？」",
            opts: [
              { text: "开启时空尽头", action: plates(s) >= 6 ? "open-end" : "notyet" },
              { text: "告辞", node: "bye" }
            ]
          },
          { id: "notyet", speaker: "村长", text: "「还差得远。六块石板，一块都不能少。」", opts: [{ text: "告辞", node: "bye" }] }
        ];
      }
      const stageTexts = [
        "「新来的？好，平安镇正缺敢做事的人。你先去后山采三株药草回来，镇上的伤药快见底了。」",
        "「药草采回来了么？镇东的穷人家还等着用药呢。」",
        "「药草的事辛苦你了。接下来，去武馆向顾先生请教学问。读书识字不通，武功练得再高也是蛮牛。」",
        "「周三还在街上收保护钱。你若是练好了功夫，就替全镇人教训教训他。」",
        "「干得好！这些年，我在镇子底下埋了一条线——黑风寨深处，藏着黑暗势力的青龙坛。你经验够了，这张地图拿去，按图索骥，把那坛子给我端了！」",
        "「冷铁衣守着的密信，是黑暗势力各据点的联络图。你把它带回来，我们就能知道他们在哪里扎根。」",
        "「密信我收到了。谢谢你，年轻人。不过真正的战斗，才刚刚开始。」"
      ];
      const opts: DialogNode["opts"] = [{ text: "告辞", node: "bye" }];
      const qBei = q(s, "qBeiFang");
      if (!qBei.done && qBei.stage === 0 && !s.player.quests.qBeiFang) {
        opts.unshift({ text: "愿替村长跑腿拜访", action: "quest-accept:qBeiFang" });
      }
      if (!qBei.done && s.player.task.visits >= 3) {
        opts.unshift({ text: "三家门派已经拜访完毕", action: "quest-complete:qBeiFang" });
      }
      if (stage === 0) {
        opts.unshift({ text: "愿为平安镇出力", action: "quest-advance:qMain:0" });
      }
      if (stage === 2 && (p.skills.duShu || 0) >= 10) {
        opts.unshift({ text: "读书已有所成", action: "quest-advance:qMain:2" });
      }
      if (stage === 3 && p.flags["zhouSanDead"]) {
        opts.unshift({ text: "周三已被我赶出平安镇", action: "quest-advance:qMain:3" });
      }
      if (stage === 1 && has(s, "yaocai", 3)) {
        opts.unshift({ text: "药草采回来了", action: "quest-advance:qMain:1" });
      }
      if (stage === 4 && p.exp >= 5000) {
        opts.unshift({ text: "我已有足够的江湖阅历", action: "quest-advance:qMain:4" });
      }
      if (stage === 6 && has(s, "mixin")) {
        opts.unshift({ text: "这是冷铁衣身上的密信", action: "quest-advance:qMain:6" });
      }
      return [
        {
          id: "r",
          speaker: "村长",
          text: stageTexts[Math.min(stage, stageTexts.length - 1)],
          opts
        },
        { id: "bye", speaker: "村长", text: "「去吧，镇子等着你的消息。」", opts: [] }
      ];
    }
    case "popo": {
      const qq = q(s, "qYigong");
      if (!qq.done && qq.stage === 0) {
        return [
          {
            id: "r",
            speaker: "老婆婆",
            text: "「好孩子，过来帮婆婆干点活吧。挑三回水、劈三捆柴、扫三遍院子，婆婆给你工钱，还给你包点心。」",
            opts: [
              { text: "接下婆婆的活", action: "quest-accept:qYigong" },
              { text: "告辞", node: "bye" }
            ]
          },
          { id: "bye", speaker: "老婆婆", text: "「行吧，改天再来也行。」", opts: [] }
        ];
      }
      return [
        {
          id: "r",
          speaker: "老婆婆",
          text:
            qq.done
              ? "「又来了？婆婆这院子，总也扫不完哪。」"
              : `「还差得远呢：水 ${3 - Math.min(3, p.task.popoWater)} 回，柴 ${3 - Math.min(3, p.task.popoChop)} 捆，院子 ${3 - Math.min(3, p.task.popoSweep)} 遍。」`,
          opts: qq.done
            ? [{ text: "再帮婆婆干活", action: "quest-restart:qYigong" }, { text: "告辞", node: "bye" }]
            : [{ text: "干活去了", node: "bye" }]
        },
        { id: "bye", speaker: "老婆婆", text: "「去吧，婆婆等着。」", opts: [] }
      ];
    }
    case "funv": {
      const qq = q(s, "qXunWu");
      if (qq.stage === 0) {
        return [
          {
            id: "r",
            speaker: "马大哈",
            text: "「呜呜……我的金钗！祖传的金钗！前天去后山看花，回来就没了！好汉，你行行好，帮我找回来，我必有重谢！」",
            opts: [
              { text: "我这就去找", action: "quest-accept:qXunWu" },
              { text: "告辞", node: "bye" }
            ]
          },
          { id: "bye", speaker: "马大哈", text: "「一定要找回来啊！」", opts: [] }
        ];
      }
      if (qq.stage === 1) {
        return [
          {
            id: "r",
            speaker: "马大哈",
            text: "「找到了？快给我看看！」",
            opts: has(s, "jinfeng")
              ? [{ text: "给你，金钗", action: "quest-complete:qXunWu" }]
              : [{ text: "还没找到", node: "bye" }]
          },
          { id: "bye", speaker: "马大哈", text: "「那……那你有消息了再来。」", opts: [] }
        ];
      }
      return [
        {
          id: "r",
          speaker: "马大哈",
          text: "「又来看我啦？这回我可没丢东西……吧？」她低头翻起袖子来。",
          opts: [{ text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "马大哈", text: "她翻着袖子走远了，嘴里还念叨着什么。", opts: [] }
      ];
    }
    case "huoji":
      return [
        {
          id: "r",
          speaker: "杂货铺掌柜",
          text: "「杂货铺，什么都有，什么都不多。客官看点啥？」",
          opts: [
            { text: "看看货", action: "shop" },
            { text: "告辞", node: "bye" }
          ]
        },
        { id: "bye", speaker: "杂货铺掌柜", text: "「慢走，有事没事都常来。」", opts: [] }
      ];
    case "qingXu":
      return masterCommon(s, "taiji", "qingXu");
    case "wangWeiYang":
      return masterCommon(s, "bagua", "wangWeiYang");
    case "baiRuiDe":
      return masterCommon(s, "xueshan", "baiRuiDe");
    case "liQingZhao":
      return masterCommon(s, "huajian", "liQingZhao");
    case "heZhongYang":
      return masterCommon(s, "yinhe", "heZhongYang");
    case "yuHongRu":
      return masterCommon(s, "honglian", "yuHongRu");
    case "qiaoSiHai": {
      if (p.sect === "gaibang") {
        return [
          {
            id: "r",
            speaker: "乔四海",
            text: "「回来了？丐帮没有那么多规矩，饭要吃饱，棒要练熟。」",
            opts: [
              { text: "请教武功", action: "learn" },
              { text: "切磋武艺", node: "fight" },
              { text: "告辞", node: "bye" }
            ]
          },
          {
            id: "fight",
            speaker: "乔四海",
            text: "「打狗棒法不传无名之辈。你若能接我三棒，我便传你降龙十八掌的真意！」",
            opts: [{ text: "请帮主赐教", action: "challenge:qiaoSiHai" }]
          },
          { id: "bye", speaker: "乔四海", text: "「讨饭不丢人，丢人的是讨饭还不肯干活。」", opts: [] }
        ];
      }
      return [
        {
          id: "r",
          speaker: "乔四海",
          text: "「小兄弟，行走江湖，肚子里没食可不行。来，先吃块馍。」\n\n他递过来一块干得掉渣的馍，自己咬得嘎嘣响。",
          opts: [
            { text: "拜入丐帮", node: "join-r" },
            { text: "请教武功", action: "learn" },
            { text: "切磋武艺", node: "fight" },
            { text: "告辞", node: "bye" }
          ]
        },
        ...sectJoinNode(s, "gaibang", "join-"),
        {
          id: "fight",
          speaker: "乔四海",
          text: "「打狗棒法不传无名之辈。你若能接我三棒，我便传你降龙十八掌的真意！」",
          opts: [{ text: "请帮主赐教", action: "challenge:qiaoSiHai" }]
        },
        { id: "bye", speaker: "乔四海", text: "「讨饭不丢人，丢人的是讨饭还不肯干活。」", opts: [] }
      ];
    }
    case "gusong":
      return [
        {
          id: "r",
          speaker: "古松道长",
          text: "「山上有云，观里有钟。你来的不是时候，也不是不是时候。」\n\n他说完又闭目打坐去了。",
          opts: [{ text: "请教武功", action: "learn" }, { text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "古松道长", text: "「去吧。」", opts: [] }
      ];
    case "cangyue":
      return [
        {
          id: "r",
          speaker: "苍月道长",
          text: "「月亮快圆了。月光照在剑上，剑就有了三分月色。」",
          opts: [{ text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "苍月道长", text: "「夜凉，回吧。」", opts: [] }
      ];
    case "shangJianMing":
      return [
        {
          id: "r",
          speaker: "商剑鸣",
          text: (p.affections.shangJianMing || 0) >= 80
            ? "「还以为你今天不来了。」他抱着刀坐在墙头，跳下来时比谁都轻。"
            : "「堡里规矩：来客先过三招。你嘛……等练好了再来。」",
          opts: [{ text: "请教武功", action: "learn" }, { text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "商剑鸣", text: "「拳不离手，曲不离口。」", opts: [] }
      ];
    case "xuewei":
      return [
        {
          id: "r",
          speaker: "雪卫",
          text: "「凌霄城，非本派弟子，不得擅入。不过你既走到这里，想必也不是怕冷的寻常人。」",
          opts: [{ text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "雪卫", text: "他抱剑而立，眉梢的霜又厚了一层。", opts: [] }
      ];
    case "tangWanCi":
      return [
        {
          id: "r",
          speaker: "唐晚词",
          text: (p.affections.tangWanCi || 0) >= 80
            ? "「花又开了。你……又来了。」她别过脸去，耳尖却悄悄红了。"
            : "「谷里的花，开一季谢一季；我的刀，练了一年又一年。姐姐说，心里有事的人，刀才快。」",
          opts: [
            { text: "请教武功", action: "learn" },
            { text: "告辞", node: "bye" }
          ]
        },
        { id: "bye", speaker: "唐晚词", text: "「花落的时候，记得再来。」", opts: [] }
      ];
    case "langren":
      return [
        {
          id: "r",
          speaker: "扶桑浪人",
          text: "「私は……不对，说中原话。我在等一场雪。雪来了，人就该走了。\n\n你想学刀？刀不是挥出去的，是等出来的。」",
          opts: [{ text: "请教刀法", action: "learn" }, { text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "扶桑浪人", text: "他面朝大海，刀横膝上，仿佛已经成了一尊石像。", opts: [] }
      ];
    case "xiangzhu":
      return [
        {
          id: "r",
          speaker: "红衣香主",
          text: "「教中香火，日夜不熄。光明能照见的地方，黑暗就站不住脚。你信么？」",
          opts: [{ text: "请教武功", action: "learn" }, { text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "红衣香主", text: "他不再说话，只是往长明灯里添了一勺油。", opts: [] }
      ];
    case "zhanglao":
      return [
        {
          id: "r",
          speaker: "九袋长老",
          text: "「小叫花子，你听好了：打狗棒法，打的是恶狗，护的是穷人。棒子可以断，心不能黑。」",
          opts: [{ text: "请教棒法", action: "learn" }, { text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "九袋长老", text: "「丐帮弟子遍天下，有难处，喊一声。」", opts: [] }
      ];
    case "lengTieYi":
      return [
        {
          id: "r",
          speaker: "冷铁衣",
          text: p.flags["coldIronDead"]
            ? "「……还来做什么。总瓢把子若知道我败了，不会放过我，也不会放过你。」"
            : "「就凭你，也敢闯我的聚义厅？报上名来，铁衣之下，不杀无名之辈。」",
          opts: p.flags["coldIronDead"]
            ? [{ text: "告辞", node: "bye" }]
            : [
                { text: "今日来取你项上人头", action: "fight:qingLongTanZhu" },
                { text: "告辞", node: "bye" }
              ]
        },
        { id: "bye", speaker: "冷铁衣", text: "他沉默地坐着，铁衣在烛火下泛着青光。", opts: [] }
      ];
    case "tiaofu":
      return [
        {
          id: "r",
          speaker: "挑夫",
          text: "「嘿，让让道！这趟货要赶在落日前送到。\n\n要听路上的事？行，一句话——黑风寨的喽啰最近换了新头领，可寨子里的狗还是那么凶。」",
          opts: [
            { text: "再讲讲路上见闻", node: "rumor" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "rumor",
          speaker: "挑夫",
          text: "「西边武当山下雨下了三天三夜，山道上冲出一块石碑，没人认得上面的字。\n\n东边商家堡的演武场，天天半夜有人练刀，练得比鸡叫还早。」",
          opts: [{ text: "受教了", node: "bye" }]
        },
        { id: "bye", speaker: "挑夫", text: "他挑起担子，扁担吱呀吱呀地走远了。", opts: [] }
      ];
    case "xiaoqigai":
      return [
        {
          id: "r",
          speaker: "小乞丐",
          text: "「大侠！大侠行行好，给个铜板吧！……不给也行，那我跟你说个秘密：镇口老井底下，有人藏了东西，我亲眼看见的！」",
          opts: [
            { text: "什么秘密？", node: "secret" },
            { text: "你晚上睡哪儿？", node: "sleep" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "sleep",
          speaker: "小乞丐",
          text: "「镇外破庙呀！菩萨肚子底下，风吹不着，雨淋不着，就是老鼠有点吵。\n\n所以夜里你找不着我，天一擦黑我就回去睡了。白天我一准在这墙根下晒太阳！」",
          opts: [{ text: "记下了", node: "bye" }]
        },
        {
          id: "secret",
          speaker: "小乞丐",
          text: "「骗你是小狗！前天夜里，有人往老井里扔了个布包，扑通一声，可响了。你要是捞得上来，分我半个馒头就行！」",
          opts: [{ text: "记下了", node: "bye" }]
        },
        { id: "bye", speaker: "小乞丐", text: "他朝你眨眨眼，一溜烟钻进巷子里去了。", opts: [] }
      ];
    case "shuoshu": {
      const stage = q(s, "qMain").done ? 99 : q(s, "qMain").stage;
      const pinghua =
        stage < 3
          ? "「啪！醒木一拍——列位，今日讲一段『铁拳周三霸街坊』！\n\n话说那铁拳周三，一双拳头打死过三条好汉，镇东街收保护钱，镇西街踹寡妇门，连狗见了他都夹着尾巴绕道走。\n\n可叹满镇男儿，竟无一人敢吭一声！列位，这世道缺的不是拳头，是敢出头的人啊！」"
          : stage < 6
            ? "「啪！醒木一拍——今日讲一段『黑风寨里藏青龙』！\n\n话说那黑风寨表面上杀人放火，暗地里却供着一座青龙坛。坛主冷铁衣，一件铁衣寒暑不卸，据说睡觉时都睁着半只眼。\n\n有人说他是山大王，有人说他只是条看门狗——那狗主人是谁？列位，书里不便说，你品，你细品！」"
            : stage < 7
              ? "「啪！醒木一拍——今日讲一段『六块石板镇乾坤』！\n\n话说上古之时，有高人铸六块三角石板，分赠六大派，说是：石板齐聚之日，时空尽头之门自开。\n\n六派掌门各守一块，守了几十年，守得头发都白了，也没人知道那门后头到底是仙乡还是鬼域。列位，你们说，这门，开还是不开？」"
              : "「啪！醒木一拍——今日这段，叫做『时空尽头问我是谁』！\n\n上古有个寓言：有个人追着一面会跑的镜子跑了一辈子，追到天涯海角，追到时空尽头，镜子忽然立住不动了。\n\n他往镜里一看——列位猜怎么着？镜子里空空如也，一个人影都没有！原来他追了一辈子，追的是他自己心里那个一问：我是谁？\n\n这人后来怎么了？书上没写。列位，书到此处，留个扣子，各自琢磨去吧！」";
      return [
        {
          id: "r",
          speaker: "说书先生",
          text: "「啪！——列位看官，且听我讲：二十年前，平安镇出过一个独臂刀客，一把刀从镇东砍到镇西，只为替一个卖豆腐的姑娘讨公道……\n\n那姑娘，如今就在你们镇上过日子呢。」",
          opts: [
            { text: "听一段评话", node: "pinghua" },
            { text: "再讲一段", node: "more" },
            { text: "告辞", node: "bye" }
          ]
        },
        { id: "pinghua", speaker: "说书先生", text: pinghua, opts: [{ text: "讲得好！", node: "bye" }] },
        {
          id: "more",
          speaker: "说书先生",
          text: "「还有一段：六大门派的掌门，各怀一块石板，石板上刻着同一句话——『到时空尽头来，问问自己是谁』。\n\n这话是真是假，老夫也不知道。但说书嘛，三分真七分假，假里有真。」",
          opts: [{ text: "多谢先生", node: "bye" }]
        },
        { id: "bye", speaker: "说书先生", text: "醒木一拍：列位，欲知后事如何，且听下回分解！", opts: [] }
      ];
    }
    case "liehu":
      return [
        {
          id: "r",
          speaker: "猎户老柴",
          text: "「后山风大，进林子前先看看天色。你看，云往南走，雨就要来了。\n\n要是碰上雪狼群，别跑，它们专追转身的人。」",
          opts: [
            { text: "打听山里的草药", node: "herb" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "herb",
          speaker: "猎户老柴",
          text: "「药草长在溪边背阴处，金钗那东西，只有崖缝里才找得到。马大哈的金钗丢在哪儿，我劝她别找了，多半被野猪拱进洞了。」",
          opts: [{ text: "受教了", node: "bye" }]
        },
        { id: "bye", speaker: "猎户老柴", text: "他把弓往肩上一甩，踩着落叶往林子里去了。", opts: [] }
      ];
    case "huaPopo":
      return [
        {
          id: "r",
          speaker: "花婆婆",
          text: "「花有花的时辰，人有人的缘法。你来得正好，谷里的晚香玉刚开第一朵。」",
          opts: [
            { text: "请教种花", node: "flower" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "flower",
          speaker: "花婆婆",
          text: "「种花跟练武一样，急不得。浇多了水，根会烂；练急了功，人会垮。年轻人，记住喽。」",
          opts: [{ text: "受教了", node: "bye" }]
        },
        { id: "bye", speaker: "花婆婆", text: "她弯腰给花培土，不再理会你。", opts: [] }
      ];
    case "chuanFu":
      return [
        {
          id: "r",
          speaker: "船夫",
          text: "「要渡海？看这天色，今夜有风，明早该是晴天。冰火岛一半是冰一半是火，你上岛可别穿太少。」",
          opts: [
            { text: "打听岛上的事", node: "island" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "island",
          speaker: "船夫",
          text: "「岛东的浪人天天看海，岛西的忍者在练什么影分身，说来也怪，他们互不搭理。但你要是在岛上迷了路，找谁都行。」",
          opts: [{ text: "多谢船家", node: "bye" }]
        },
        { id: "bye", speaker: "船夫", text: "他解开缆绳，小船在浪里一荡一荡。", opts: [] }
      ];
    case "chapeng": {
      return [
        {
          id: "r",
          speaker: "茶棚老板",
          text: "「客官，歇脚嘞——！粗茶解乏，干粮管饱，来壶黄酒暖暖身子也成！\n\n这官道上南来北往的，什么人都得在我这棚子里坐一坐。坐一坐，就有故事。」",
          opts: [
            { text: "买些茶水干粮", action: "shop" },
            { text: "听老板唠唠路上的事", node: "rumor" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "rumor",
          speaker: "茶棚老板",
          text: "「要说新鲜事嘛——前儿有个逃婚的姑娘打这儿过，眼睛哭得跟桃儿似的，往南去了。\n\n还有那个常醉在棚子边上的刀客，别看他落魄，听说当年一把刀护过一整支镖队。人呐，谁还没个当年。\n\n" + randomRumor(s) + "」",
          opts: [{ text: "再续一碗", node: "bye" }]
        },
        { id: "bye", speaker: "茶棚老板", text: "「慢走！下回路过，棚子里给您留碗热茶！」", opts: [] }
      ];
    }
    case "xingjiao": {
      return [
        {
          id: "r",
          speaker: "行脚商人",
          text: "「哟，客官好眼力！我这担子里，伤药、文玩、石料、麻绳，天南海北的玩意儿都有。\n\n做买卖讲究个缘分——您今天碰上我，就是缘分。」",
          opts: [
            { text: "看看货担", action: "shop" },
            { text: "听他讲走南闯北的见闻", node: "tales" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "tales",
          speaker: "行脚商人",
          text: "「我走的地方多了——北边的雪能把山门埋半截，南边的海岛一半结冰一半冒火。\n\n有一回我在石窟那边收货，洞里滴水声跟打更似的，还有个老头守着几座没名字的坟，说什么也不肯走。怪人，可敬。\n\n做买卖的规矩：听来的事，卖得；看来的货，说不得。您再听，就得付茶钱了，哈哈！」",
          opts: [{ text: "受教", node: "bye" }]
        },
        { id: "bye", speaker: "行脚商人", text: "「走好嘞！货比三家，还数我这儿最实诚！」", opts: [] }
      ];
    }
    case "langzhong": {
      return [
        {
          id: "r",
          speaker: "游方郎中",
          text: "「叮当——叮当——看病嘞！内科外科跌打损伤，疑难杂症药到病除！\n\n客官我看你印堂……嗯，血气方刚，是个好练武的苗子。就是身上难免有点暗伤，要不要老朽给你瞧瞧？二十两，童叟无欺。」",
          opts: [
            { text: "花二十两诊治一番", action: "heal-langzhong" },
            { text: "买些伤药", action: "shop" },
            { text: "你这医术，保真么？", node: "doubt" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "doubt",
          speaker: "游方郎中",
          text: "「哎——这话说的！老朽行医三十年，治好的没有一千也有八百！\n\n……当然了，治坏的，也就那么三五个。医术嘛，三分治，七分养，还有九十分看天意。你要是不信，先去后山摔一跤，回来再找我也不迟。」",
          opts: [{ text: "……还是看看吧", action: "heal-langzhong" }, { text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "游方郎中", text: "「叮当——叮当——」串铃声慢悠悠地远了。", opts: [] }
      ];
    }
    case "luopo": {
      const taught = p.flags["luopoTaught"];
      const wine = has(s, "huangjiu");
      return [
        {
          id: "r",
          speaker: "落魄刀客",
          text: taught
            ? "「是你啊。」他难得坐直了些，「上回那几手，练熟了么？刀这东西，一天不摸，手就生了。」"
            : "「……有酒么？」他半睁开眼，「没酒就别打搅我做梦。梦里我还是个刀客，醒了，就只是个欠账的。」",
          opts: [
            { text: wine ? "请他喝一壶黄酒" : "（得带一壶黄酒来）", action: "give-luopo-wine" },
            { text: "打听他的来历", node: "past" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "past",
          speaker: "落魄刀客",
          text: "「十年前，我替人护镖过黑风寨地界。三十七口人的镖队，回来的只有我一个。\n\n有人说我命大，有人说我临阵脱逃。我自己也说不清。所以后来，刀还在，人就这么撂下了。\n\n你要学刀？学吧。刀比人有良心——你对它好，它永远不亏待你。」",
          opts: [{ text: "请他喝一壶黄酒", action: "give-luopo-wine" }, { text: "告辞", node: "bye" }]
        },
        { id: "bye", speaker: "落魄刀客", text: "他又歪回草垛上，嘴里含糊地哼着一支不成调的刀歌。", opts: [] }
      ];
    }
    case "taohun": {
      const qt = q(s, "qTaoHun");
      if (qt.done) {
        return [
          {
            id: "r",
            speaker: "逃婚少女阿沅",
            text: p.flags["taohun-branchA"]
              ? "「恩公！」她眼睛一亮，「我在百花谷住下了，花婆婆教我认花，侍女姐姐教我梳新式的头。\n\n原来不用嫁给自己不爱的人，日子也能过得这样好。这支簪子你戴着，看见它，就当看见我过得好。」"
              : "「……是你。」她低下头，「我后来想通了，回家把话说清楚。爹再固执，总还是疼我的。\n\n谢你那天劝我。逃得了一时，逃不了一世，是这个理。」",
            opts: [{ text: "保重", node: "bye" }]
          },
          { id: "bye", speaker: "逃婚少女阿沅", text: "她福了一福，眼里的肿早就消了。", opts: [] }
        ];
      }
      if (!s.player.quests.qTaoHun) {
        return [
          {
            id: "r",
            speaker: "逃婚少女阿沅",
            text: "「这位……这位少侠，行行好。」她攥着包袱角，声音发颤，「我是从邻县逃出来的。爹把我许给城南的富商做填房，那人都五十多了，我、我宁愿死也不嫁！\n\n花轿出门那天我跳窗跑了。他们肯定派家丁追来了……少侠，你说，我该怎么办？」",
            opts: [
              { text: "别怕，我替你想办法", action: "quest-accept:qTaoHun" },
              { text: "我还有事", node: "bye" }
            ]
          },
          { id: "bye", speaker: "逃婚少女阿沅", text: "她抱着包袱，手足无措地站在路边。", opts: [] }
        ];
      }
      if (qt.stage === 0) {
        return [
          {
            id: "r",
            speaker: "逃婚少女阿沅",
            text: "「少侠，你肯帮我拿个主意么？\n\n往南再走就是百花谷，听说那里满山都是花，谷里的婆婆心最善。可我一个人，实在走不动了……\n\n要么……要么我就这么回去算了，认命，兴许还能少连累爹娘。」",
            opts: [
              { text: "【帮她】我护送你逃去百花谷", action: "taohun-help" },
              { text: "【劝她】逃不是办法，报官了结", action: "taohun-report" },
              { text: "容我想想", node: "bye" }
            ]
          },
          { id: "bye", speaker: "逃婚少女阿沅", text: "她眼巴巴望着你，像望着最后一根稻草。", opts: [] }
        ];
      }
      return [
        {
          id: "r",
          speaker: "逃婚少女阿沅",
          text: qt.stage === 1
            ? "「我都听你的！去百花谷，现在就走么？」她攥紧包袱，眼里第一次有了光。"
            : "「我……我这就回去。少侠，官府那边，劳你替我说一声，就说我阿沅回心转意了，不叫他们再派人寻我。」",
          opts: [{ text: "走吧", node: "bye" }]
        },
        { id: "bye", speaker: "逃婚少女阿沅", text: "她深深吸了口气，点了点头。", opts: [] }
      ];
    }
    case "shoumu": {
      const qs = q(s, "qShiKu");
      const opts: DialogNode["opts"] = [{ text: "告辞", node: "bye" }];
      if (!qs.done) {
        if (!s.player.quests.qShiKu) {
          opts.unshift({ text: "老人家，可有什么帮得上忙的？", action: "quest-accept:qShiKu" });
        } else if (has(s, "shiliao", 3)) {
          opts.unshift({ text: "三块石料都在此", action: "quest-complete:qShiKu" });
        }
      }
      opts.unshift({ text: "打听石窟的来历", node: "lore" });
      return [
        {
          id: "r",
          speaker: "守墓老人",
          text: qs.done
            ? "「碑修好了，我这心里头一块石头也落了地。」他往石窟深处看了一眼，「往后常来坐坐，这洞子里，好久没人陪老骨头说话了。」"
            : s.player.quests.qShiKu
              ? "「石料备齐了么？这石窟深处的废矿脉里就有好青石，一镐一块。若嫌抡镐费劲，官道上那个行脚货郎，担子里也常带着几块。」"
              : "「生人啊……这石窟里，几十年没来过生人了。」老人浑浊的眼睛打量着你，「你是来避世的，还是来寻事的？」",
          opts
        },
        {
          id: "lore",
          speaker: "守墓老人",
          text: "「这几座坟里埋的是谁？说出来吓你一跳——都是当年名震一方的高手。厌倦了打打杀杀，躲进这石窟里了此残生。\n\n老朽年轻时候，是给他们送饭的。他们一个个走了，我就留下守着。人这一辈子啊，进得来这洞子的，都是有故事的人；出得去的，才算把故事讲完了。」",
          opts: [{ text: "肃然起敬", node: "bye" }]
        },
        { id: "bye", speaker: "守墓老人", text: "老人重新蹲回墓前，用袖子慢慢擦着碑上的灰。", opts: [] }
      ];
    }
    case "daotong": {
      const qw = q(s, "qWudangDaily");
      const opts: DialogNode["opts"] = [{ text: "告辞", node: "bye" }];
      if (!qw.done) {
        if (!s.player.quests.qWudangDaily) {
          opts.unshift({ text: "小师傅，要帮忙么？", action: "quest-accept:qWudangDaily" });
        } else if (has(s, "yaocai", 3)) {
          opts.unshift({ text: "三株药草，给你", action: "quest-advance:qWudangDaily:0" });
        }
      } else {
        opts.unshift({ text: "再替你采些药草", action: "quest-accept:qWudangDaily" });
      }
      return [
        {
          id: "r",
          speaker: "武当道童",
          text: !s.player.quests.qWudangDaily || qw.done
            ? "「嘘——告诉你个秘密！」道童凑过来，神神秘秘，「我在跟古松师伯偷学炼丹！就差药草了！你帮我采三株来，我给你好处！\n\n对了对了，你会武功吗？你见过雪山的剑吗？师父说我洒扫满三年就教我真功夫，可我都扫了两年零四个月了……」"
            : "「药草采到没有呀？三株就够！后山有，石窟里也有，百花谷的花丛边上最多！\n\n快快快，丹炉我都偷偷生好火了，就等你的药草下锅……啊不，入炉！」",
          opts
        },
        { id: "bye", speaker: "武当道童", text: "「记得替我保密啊！」他朝你挤挤眼，抱着笤帚一溜烟跑了。", opts: [] }
      ];
    }
    case "gaibangDizi": {
      const qg = q(s, "qGaibangDaily");
      const food = count(s, "mantou") + count(s, "baozi") + count(s, "shaoji");
      const opts: DialogNode["opts"] = [{ text: "告辞", node: "bye" }];
      if (!qg.done) {
        if (!s.player.quests.qGaibangDaily) {
          opts.unshift({ text: "兄弟，缺什么尽管说", action: "quest-accept:qGaibangDaily" });
        } else if (food >= 2) {
          opts.unshift({ text: "两份吃食，拿去", action: "quest-advance:qGaibangDaily:0" });
        }
      } else {
        opts.unshift({ text: "再弄些吃食来", action: "quest-accept:qGaibangDaily" });
      }
      return [
        {
          id: "r",
          speaker: "丐帮弟子",
          text: !s.player.quests.qGaibangDaily || qg.done
            ? "「哈哈，面生得很！头一回来莲花山吧？」他拍拍身上的土，爽朗一笑，「别嫌弃我们这破庙，天下叫花子是一家！\n\n就是最近山里兄弟多，米缸见了底。你要是个痛快人，匀两份吃食给兄弟们，馒头包子烧鸡都行，我记你一份情！」"
            : "「吃食凑齐了没？两份就成！馒头、肉包子、烧鸡，都不挑！\n\n你放心，我们丐帮有丐帮的规矩：受人一饭，必有一报。」",
          opts
        },
        { id: "bye", speaker: "丐帮弟子", text: "「走好！有难处，到莲花山喊一声！」", opts: [] }
      ];
    }
    case "xueshanDizi":
      return [
        {
          id: "r",
          speaker: "雪山弟子",
          text: "「……」\n\n他看了你一眼，算是打过招呼。半晌，才又补了三个字：「雪大，路滑。」",
          opts: [
            { text: "凌霄城的剑法，真有那么冷么？", node: "sword" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "sword",
          speaker: "雪山弟子",
          text: "「剑不冷。」他望着雪线尽头，「是人先把心冻硬了，剑才冷的。\n\n……话多了。当我没说。」",
          opts: [{ text: "受教", node: "bye" }]
        },
        { id: "bye", speaker: "雪山弟子", text: "他重新站回雪里，一动不动，仿佛从未开过口。", opts: [] }
      ];
    case "huajianShinv":
      return [
        {
          id: "r",
          speaker: "花间侍女",
          text: "「这位客人，谷里的花开得正好，只是脚下请留情，莫踩了花苗。」\n\n她抿嘴一笑，「客人是来看花的，还是来拜山的？」",
          opts: [
            { text: "打听花间派的规矩", node: "rules" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "rules",
          speaker: "花间侍女",
          text: "「我们花间派呀，只收女弟子，这是开派祖师定下的规矩。掌门还说了：容貌不佳不收，悟性不高不收，文采不够不收。\n\n客人若是男儿身，便在谷里看看花也好；若是女儿家，散花亭里奉着茶呢。」",
          opts: [{ text: "多谢告知", node: "bye" }]
        },
        { id: "bye", speaker: "花间侍女", text: "她提着花篮款款去了，裙角扫过花丛，惊起两只粉蝶。", opts: [] }
      ];
    case "honglianJiaotu":
      return [
        {
          id: "r",
          speaker: "红莲教徒",
          text: "「这位朋友，你可曾见过真正的光？」\n\n他不由分说拉住你，「黑暗笼罩大地，恶人横行世间，唯有红莲圣火，能烧尽一切不公！我教教主力挽狂澜，正是应劫而生！朋友，入我教来，光明路上，有你有我！」",
          opts: [
            { text: "红莲教到底是什么？", node: "what" },
            { text: "我考虑考虑", node: "bye" }
          ]
        },
        {
          id: "what",
          speaker: "红莲教徒",
          text: "「红莲者，出淤泥而不染，燃自身而照人也！\n\n教主常说：世道烂了，光骂是没用的，得有人点火。我们五指山日夜燃着的长明灯，就是给天下人照路的第一把火！」",
          opts: [{ text: "好一把火", node: "bye" }]
        },
        { id: "bye", speaker: "红莲教徒", text: "「光明与你同在！」他在你身后深深一揖。", opts: [] }
      ];
    case "yinheXuetu":
      return [
        {
          id: "r",
          speaker: "尹贺学徒",
          text: "「あ……啊！你好！」他慌忙鞠躬，差点撞上身旁的柱子，「我、尹贺谷的学徒，中原话，学习中！\n\n这里的岛，非常奇怪：那边，冷；这边，热。我的师匠说，这就是『阴阳』。我觉得，这就是『感冒』。」",
          opts: [
            { text: "尹贺谷都学些什么？", node: "learn" },
            { text: "告辞", node: "bye" }
          ]
        },
        {
          id: "learn",
          speaker: "尹贺学徒",
          text: "「忍术！忍术是非常厉害的——隐身、分身、变木头！\n\n我学了三年，隐身术还不行。昨天练习，师父说：『你的脚，露在外面了。』……修行，很难。」他认真地说，「但是中原话说得好多了！昨天的饭团，是我用自己的话买到的！」",
          opts: [{ text: "说得真不错", node: "bye" }]
        },
        { id: "bye", speaker: "尹贺学徒", text: "「再见！请多关照！」他深深鞠躬，这回总算没撞到柱子。", opts: [] }
      ];
    default:
      return null;
  }
}

export const PROLOGUE =
  "你在颠簸的牛车上醒来。车帘外，一座灰扑扑的小镇正从晨雾里浮出来——牌坊上写着「平安」二字，字漆已经剥落了大半。\n\n车夫说，到了。你说不清自己从哪里来，只记得梦里有一扇巨大的门，和门后一个一直在问「我是谁」的声音。\n\n少年十四岁，初入江湖。故事，就从这里开始。";

export const ENDINGS: Record<string, string> = {
  woShiShui:
    "铜镜缓缓裂开，一道光落在你身上。\n\n「我是谁？」那声音问。\n\n你想了很久。你想起牛车上醒来的清晨，想起镇口晒太阳的老人，想起卖花姑娘鬓边的山茶，想起后山的夜雨、黑风寨的火把、石窟里守墓人的眼睛。你想起每一次拔刀，也想起每一次把刀收回去。\n\n你忽然说：我是那个在牛车上醒来、穿过整座江湖的人。我是平安镇口晒太阳的老人，是卖花姑娘眼里的少年，是这扇门后所有的谜与答案。我不是别人丢下的谜题，我是我自己走出来的路。\n\n镜子没有回答，只是碎成满天星光。星光落尽处，你看见无数个自己——学剑的、仗义的、迷路的、回头的——他们隔着时空朝你点头，然后一个一个，融进你的影子里。\n\n你在星光里醒来，牛车还在走，牌坊上的「平安」二字，像被晨露洗过一样新。车夫回头问你：客官，到了，下车么？你笑了笑，跳下车去。江湖还是那座江湖，但你已经不是原来的你了。",
  daoDeHeShang:
    "道德和尚缓缓坐下，像一块终于放下了的石头。\n\n「老衲度尽天下人，唯独度不了自己。」他望着虚空，声音很轻，「我劝人放下屠刀，自己却攥着『道德』这把刀不放；我劝人看破，自己却看破了所有人、唯独没看破自己。这一掌，算是谢你的。」\n\n他闭目合十，开始念一段谁也听不懂的经。念着念着，他身上的袈裟在风中渐渐褪色，像一朵谢了的花；那一直紧绷的眉头，却一寸一寸舒展开来，最后竟有了几分少年时的模样。\n\n你转身离开时空尽头时，身后只剩一声悠长的佛号。那佛号里没有悲，也没有喜，倒像是一个走了很远很远夜路的人，终于看见了自家窗子里的一点灯。\n\n后来平安镇的人说，那年冬天特别暖和。说书先生把这段编成了新书，开场只有一句：度人易，度己难；放下的那一刻，他便已经得道了。",
  dongFangQiuBai:
    "东方求败看着自己胸口的伤，忽然笑了，笑得像个小孩子。\n\n「求了一辈子败，原来败了，是这样轻松。」他低头看着自己握剑的手，那只手几十年来第一次松开，「我赢遍了所有人，最后赢到没有人和我说话。原来站在最高处的人，是听不见人间烟火气的。」\n\n他把那柄举世无双的剑轻轻放在地上，像放下一个背了一生的包袱。「剑给你也好，给岁月也好。从今天起，我不叫求败了。」他顿了顿，眼睛里映着虚空尽头微亮的光，「我叫东方……东方清晨。今天的清晨。」\n\n他转身走进虚空，脚步不快，背影却比来的时候年轻了许多。你忽然明白，他等的人不是对手，只是一个能让他放下剑的理由。\n\n虚空重新合拢之前，你听见远处传来一阵笑声，爽朗，放肆，像个刚刚偷溜出家门去赶集的孩子。那笑声告诉你：有些人输了一次，才终于赢回了自己。"
};

export const DEATH_TEXT =
  "眼前一黑，你听见牛车吱呀吱呀的声响。\n\n「醒了？到平安镇了。」\n\n你在镇口醒来，腰包瘪了一些，身上还带着伤。镇口老者看了你一眼，只说：江湖就是这样，输过，才知道怎么赢。";

export const HANG_TEXT =
  "你把麻绳甩上歪脖树的枝桠，打了个结。\n\n远处有人吆喝着卖包子，有人骂孩子，有人唱着小调。平安镇的日子还在过，只是再没有你了。\n\n江湖路远，你这一程，到此为止。";

// 传闻体系统一出口：常识传闻 + 区域传闻 + 状态感知传闻（按主线进度/善恶/称号出现）
const RUMORS_COMMON = [
  "「后山夜里不太平，总有绿油油的眼睛。别问我是怎么知道的。」",
  "「平一指杀一人医一人，找他看病，得先做好杀人的打算。」",
  "「县太爷悬赏八百两缉拿云中鹤，可惜他自己连衙门都不敢出。」",
  "「听说冷铁衣的铁衣，是三百个铁匠打出来的。」",
  "「六大门派的掌门，各藏着一块石板。集齐了，能打开时空尽头。」",
  "「顾先生说，读书写字练到高深，悟性还能往上涨。」",
  "「阿绣姑娘的花，不卖给恶人。」",
  "「人这一辈子，拳头可以硬，心不能黑。」",
  "「歪脖树又高了一截。这年头，想不开的人比树长得快。」",
  "「店小二十个包子换刀谱的事，全镇都知道了，就他自己以为是个秘密。」",
  "「铁匠张打的刀，三十年没卷过口。谁敢说卷了，他跟谁急。」",
  "「丐帮的乔帮主，九个口袋里有一个专门装馍。」",
  "「听说百花谷有个侍女，天天望着唐姑娘练刀，一看就是一下午。」",
  "「武当那个小道士，一有空就蹲在苍月道长门口数星星。」",
  "「官道上的货郎最近总往南边跑，也不知道在看什么。」",
  "「镇口老井里有人扔过布包，捞上来却只有一只破鞋。」",
  "「有人半夜听见武馆后院有哭声，走过去又什么都没有。」",
  "「说书先生说，那面铜镜照不出人影，却能照出心里最怕的事。」",
  "「老乞丐说，冰火岛的雪线和火线，其实是一条线的两头。」",
  "「铁匠铺的炉火，几十年没熄过，据说熄了会出事。」",
  "「大雪山雪地里的脚印，有时会自己拐个弯，拐得不像人走的。」",
  "「石窟里的滴水声，数着数着会突然少一声，像是有人抢拍子。」",
  "「莲花山那棵老树上的布条，听说每一根都是一个心愿。」",
  "「红莲教的灯油，有人说是从日出时分的露水里炼出来的。」",
  "「渡口的船夫说，半夜的芦苇荡里，有人喊他名字，他一次也没应。」"
];

const RUMORS_AREA: Record<string, string[]> = {
  town: ["「镇东的马大哈又丢东西了，这回丢的是什么来着？」", "「夜里别往后山去，绿眼睛盯着你呢。」"],
  wudang: ["「三清观的清虚道长，太极神功深不可测。」", "「山上有处桃花源，听说两千两银子就能买下来。」"],
  shangjia: ["「商家堡的王掌门，一双肉掌威震河朔。」", "「商剑鸣的八卦掌，得了他师父七分真传。」"],
  guandao: ["「官道上近来不太平，结伴走好些。」", "「路边茶棚的粗茶，最解乏。」"],
  houshan: ["「后山的矿洞里，有人挖到过玄铁。」", "「夜行鬼专在丑时出没，官府悬赏缉拿。」"],
  shiku: ["「无名石窟里滴水成潭，石壁上留着半阙残词。」", "「石窟深处有道裂缝，轻功不到家，下去就上不来。」"],
  xueshan: ["「大雪山的梅花，开得像血一样红。」", "「凌霄城的白掌门，鹤发童颜，剑比雪还冷。」"],
  baihua: ["「百花谷的花婆婆，种了一辈子花。」", "「花间派只收女弟子，容貌不佳的还不要。」"],
  dukou: ["「过了这片海，就是冰火两重天的岛。」", "「船夫的橹，浪里来浪里去，三十年没翻过船。」"],
  binghuo: ["「岛上有个扶桑浪人，天天面海等一场雪。」", "「花讽院的和谷主出手诡奇：中土为正，扶桑为奇。」"],
  wuzhi: ["「红莲教的香火，日夜不熄。」", "「余教主书生模样，出手却如怒雷。」"],
  lianhua: ["「莲花山的破庙里，住着天下第一大帮。」", "「打狗棒法，打的是恶狗，护的是穷人。」"],
  heifeng: ["「黑风寨的喽啰，最近换了个穿铁衣的当家。」", "「聚义厅里常年只有一个人坐着，坐得像块铁。」"],
  end: ["「时空尽头有面镜子，照不出人影，只照得出『我是谁』。」"]
};

const RUMORS_STATE: { when: (s: GameState) => boolean; lines: string[] }[] = [
  {
    when: (s) => !!s.player.flags["zhouSanDead"],
    lines: ["「听说周三叫一个少年人打出了平安镇，真是痛快！」"]
  },
  {
    when: (s) => !!s.player.flags["coldIronDead"],
    lines: [
      "「听说有个少年英雄独闯黑风寨，把冷坛主都给办了！」",
      "「黑风寨叫人挑了，青龙坛的旗都倒了。」"
    ]
  },
  {
    when: (s) => !!s.player.flags["yunZhongHeDead"],
    lines: [
      "「采花大盗云中鹤叫人拿了！八百两赏银，听说是位少年英雄领走的！」",
      "「官府管那位少侠叫『捕风者』——连风都捕得住，何况贼人。」"
    ]
  },
  {
    when: (s) => (s.player.items.sanJiaoBan || 0) >= 1,
    lines: ["「听说六大掌门的石板，叫人赢走了一块。」"]
  },
  {
    when: (s) => (s.player.items.sanJiaoBan || 0) >= 3,
    lines: ["「掌门们的石板丢了小一半的传言，怕是真的。」"]
  },
  {
    when: (s) => s.player.moral <= -20,
    lines: ["「最近镇上来了个煞星，走路都绕着点好……」"]
  },
  {
    when: (s) => s.player.moral >= 60,
    lines: ["「镇上那位少侠，日行一善，难得。」"]
  },
  {
    when: (s) => s.player.titles.includes("采花大盗"),
    lines: ["「镇上出了个采花大盗，姑娘家夜里都闩紧了门。」"]
  },
  {
    when: (s) => !!s.player.married,
    lines: ["「那对新人成亲那天，满镇的桃花都开了。」"]
  },
  {
    when: (s) => !!s.player.quests.qMain?.done,
    lines: ["「时空尽头的大门合上了，日子还得照常过。」"]
  }
];

export function randomRumor(s?: GameState): string {
  const pool = [...RUMORS_COMMON];
  if (s) {
    pool.push(...(RUMORS_AREA[s.player.area] || []));
    for (const r of RUMORS_STATE) {
      if (r.when(s)) pool.push(...r.lines);
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickText<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 通用闲话池：NPC 头顶气泡与「打听闲话」共用，保证同一互动有大量不同回复
const CHAT_FLAVOR = [
  "今日日头正好，晒得人骨头都懒了。",
  "听说后山夜里又有绿眼睛，怕不是山猫成精。",
  "你猜我昨天在官道上见着什么了？反正我不说。",
  "这碗茶再续一口，故事就能再多讲一段。",
  "天下这么大，能在一个镇子里碰上，也是缘分。",
  "练武的人，最怕的不是输，是没对手。",
  "有人把刀藏在怀里，有人把心事藏在酒里。",
  "镇口的歪脖树又长高了，这些年吊死的，比饿死的多。",
  "你身上有江湖的味道，像刚下过雨的山路。",
  "我年轻时也像你，天不怕地不怕，后来就只剩怕老了。",
  "夜里睡不着，数了三百颗星，还是睡不着。",
  "做买卖讲良心，练武讲一口气，做人嘛，讲个问心无愧。",
  "听说书先生讲，那面铜镜里能看见自己的一生。",
  "药草晒干了是钱，晒不干是命。",
  "这年头，能站着说话的人不多了。",
  "你若去黑风寨，记得先拜拜土地公。",
  "风一吹，什么恩怨都轻了。",
  "老话说，山不转水转，人不转江湖转。",
  "我瞧你眉宇间有股英气，将来定是个人物。",
  "江湖上最值钱的，是别人欠你一句实话。",
  "吃饭要趁热，交朋友要趁早，练功要趁小。",
  "这世上哪有什么绝招，不过是别人多练了一万遍。",
  "夜里起风的时候，别回头看，一回头就是一辈子。",
  "你猜我怀里这枚铜钱，是哪个侠客掉下的？"
];

// 谈心回复池：同一句「谈心」每次出现不同回应
const TALK_FLAVOR = [
  "与你说话，风都慢了下来。",
  "有些话堵在心里很久，见到你忽然就想说了。",
  "你这个人，倒是比镇上的风景耐看。",
  "今日听见你脚步，心里先笑了一下。",
  "别笑话我，我这话可攒了三天。",
  "你愿意听，我便多说几句。",
  "江湖很大，能说上话的人却不多。",
  "你说话的样子，像在哄一棵开花的树。",
  "若人人都像你这般好说话，天下就太平了。",
  "有些缘分，是从一句闲话开始的。",
  "你身上有种让人安心的味道，像晒过太阳的旧衣裳。",
  "我活了这些年，头一回觉得话不够说。",
  "你笑起来的时候，天上的云都挪开了。",
  "这话我只对你一个人说，别传出去。",
  "跟你说话，我连喝水都忘了。",
  "要是每天都能这样聊两句，日子就有盼头了。"
];

const SPAR_WIN = [
  "承让承让！你这一手当真漂亮，我输得心服口服。",
  "罢罢罢，拳怕少壮，今日是我栽了。",
  "好功夫！我这条命，算你手下留情了。",
  "你且记住了，今日赢我的这份，他日我定要赢回来。",
  "我认输。往后这镇上的名声，你说了算。",
  "佩服佩服，我这身本事，在你面前竟使不出来。",
  "你赢了，我不怨。江湖上输给英雄，不算丢人。",
  "好！这一架打得痛快，我请你喝酒！",
  "我服了。以后谁再找你麻烦，先问我这双拳头答不答应。",
  "你这一招藏着三变，我看出来了，可就是接不住。",
  "行，我认栽。要杀要剐，给个痛快话。",
  "输给你不冤，你这身手，能去闯黑风寨了。"
];

const SPAR_LOSE = [
  "就这点本事，也敢在江湖上走动？",
  "回去再练三年吧，今日算我指点你。",
  "哈哈，你这一跤摔得，跟过年放炮似的。",
  "拳脚没个准头，倒是有股莽劲。",
  "我看你连木桩都未必打得倒。",
  "莫要灰心，像你这样的，我一天能打哭八个。",
  "你若拜我为师，我倒是肯教几手。",
  "起来吧，地上凉，躺着也不像话。",
  "你这一招，还不如我梦里的招式。",
  "输不可怕，可怕的是输了还不知道怎么输。",
  "下回再来，记得先练练腿脚。",
  "年轻人，路还长，先学会站稳再想着赢。"
];

const SPAR_CRUSH = [
  "你方才那一招……竟让我心里跳了一下。",
  "喂，你赢了。赢了可不能就这么走了。",
  "你这个人，怎么连打架都打得这么好看？",
  "我好像有点，喜欢上你了。",
  "你若是天天来，我便天天输给你。",
  "方才你出手的样子，我记下了。",
  "这江湖上能赢我的人不多，能让我心动的人更少。",
  "你赢了功夫，也赢走了我一些别的。",
  "我从来不服人，今日倒想多看你两眼。",
  "方才那一场，够我想好几天了。"
];

// 特定 NPC 的切磋反应优先于通用池
const FIGHT_QUIPS: Record<string, { win?: string[]; lose?: string[]; crush?: string[] }> = {
  axiu: {
    win: [
      "你、你真厉害！方才那几下，我吓得眼睛都闭起来了。",
      "阿绣脸都红了：原来你这么能打。",
      "好，好厉害……我以后不怕有人欺负我了。"
    ],
    lose: [
      "阿绣噗嗤一笑：你打架的样子，比劈柴还笨。",
      "哎呀，你摔疼了么？我、我不是故意的。",
      "阿绣掩着嘴：你这功夫，还得再练练呀。"
    ],
    crush: [
      "阿绣低着头，声音越来越小：你要是天天来陪我练，我便天天输给你。",
      "阿绣脸红红的：方才你出手的样子，真好看。",
      "阿绣把山茶花递过来：赢了也不许得意，这可是奖励。"
    ]
  },
  tangWanCi: {
    win: [
      "唐晚词收了刀，微微点头：你比我预想的强。",
      "她冷清的脸上难得露出一丝笑：这一场，我记住了。",
      "唐晚词看着你：下次，我不会再输。"
    ],
    lose: [
      "唐晚词摇了摇头：花还没开透，人就先倒了。",
      "她把刀收回鞘里：你这样的，还得再练三年。",
      "唐晚词淡淡说：输给我，不丢人。"
    ],
    crush: [
      "唐晚词别过脸：刀在我手里，心却不知落在哪了。",
      "她低声说：谷里的花开了，你可以常来。",
      "唐晚词望着你：你若赢了，我便认了这个输。"
    ]
  },
  liZhenWei: {
    win: [
      "李振威大笑：好小子！这一拳有我的风范！",
      "他拍着你的肩：痛快！改天再比！",
      "李振威服气地抱拳：你这身功夫，能开馆授徒了。"
    ],
    lose: [
      "李振威哈哈一笑：还差得远，回头跟我练。",
      "他一把拉起你：男子汉大丈夫，摔一跤算什么。",
      "李振威摇头：你这腿脚，先扎三年马步再说。"
    ],
    crush: [
      "李振威难得红了脸：方才那一下……我竟有点喜欢。",
      "他咳嗽一声：你赢了，我心也输了。",
      "李振威望着你的背影：往后多来武馆走动。"
    ]
  },
  shangJianMing: {
    win: [
      "商剑鸣拍了拍尘土：好身手，我认了。",
      "他咧嘴一笑：输给你，我服。",
      "商剑鸣把刀抛给你：拿去，就当交个朋友。"
    ],
    lose: [
      "商剑鸣大笑：你这三脚猫功夫，还没够格进商家堡。",
      "他摇着头：再练两年，我教你两招。",
      "商剑鸣一抱拳：承让了，兄弟。"
    ],
    crush: [
      "商剑鸣耳根一红：你方才出手，倒是……很有模样。",
      "他忽然低声道：我好像有点中意你了。",
      "商剑鸣望着你：改日，我教你一手真的。"
    ]
  }
};

// 环境「查看」随机文案：同一处地方每次看都不一样
const LOOK_TEXT_COMMON = [
  "你细细看了一圈，没发现什么特别，但心里莫名踏实。",
  "物件上落着薄灰，像很久没人碰过。",
  "你伸手摸了摸，凉丝丝的，像是刚下过雨。",
  "角落里隐约有字，细看却只剩下划痕。",
  "风吹过来，这里的一切都轻轻晃了一下。",
  "你看了半天，忽然想起某个远方的名字。",
  "这东西看着寻常，却让你多看了两眼。",
  "没有机关，也没有宝物，只有时间留下的旧痕。",
  "你弯腰细看，发现它比远处看起来新一些。",
  "这地方像是有什么故事，可惜没人愿意讲。"
];

const LOOK_TEXT_AREA: Record<string, string[]> = {
  town: [
    "牌坊上的「平安」二字，漆落了大半，像是被人反复描过。",
    "青石板上有一道浅浅的刀痕，该是许多年前留下的。",
    "墙角蹲着一只猫，见你看它，懒洋洋地走开了。"
  ],
  wudang: [
    "山门前的青石被香客踩得发亮。",
    "松树下有半壶凉茶，主人不知去了哪里。",
    "石阶缝里长出一株倔强的小草。"
  ],
  shangjia: [
    "堡墙上的箭孔已经长满青苔。",
    "兵器架上的缺口，像被谁狠狠砍过。",
    "墙根堆着几块练功石，最小的也比磨盘重。"
  ],
  guandao: [
    "路碑上的字被风磨得只剩半边。",
    "车辙很深，像是走了几百年的马车。",
    "草丛里露出一角褪色的红布。"
  ],
  houshan: [
    "老树下的磨盘积着水，映出半片天。",
    "山道的岔口被人用石子摆了个箭头，指向黑风寨。",
    "树叶底下埋着半枚铜钱，已经锈得认不出年号。"
  ],
  shiku: [
    "石壁上刻着半阙残词，字迹已经风化。",
    "钟乳石尖滴着水，一下，一下，像在打更。",
    "角落里有几道抓痕，深得不像人手。"
  ],
  xueshan: [
    "雪地上有一串脚印，走到一半忽然消失了。",
    "冻住的梅枝上还挂着冰花，像假的。",
    "风把雪吹成一道道细纹，像刀痕。"
  ],
  baihua: [
    "花丛边的竹篱上系着褪色的红线。",
    "溪畔的石阶被水洗得圆润。",
    "一只蝴蝶停在花瓣上，翅膀一张一合。"
  ],
  dukou: [
    "拴船的桩子被缆绳磨出深深的沟。",
    "芦苇荡里传出几声水鸟叫。",
    "渡口的木板缝里夹着一枚贝壳。"
  ],
  binghuo: [
    "冒烟的礁石烫得不能久摸。",
    "雪线和熔岩在几步之间对峙。",
    "沙滩上有两道脚印，一道往东，一道往西。"
  ],
  wuzhi: [
    "长明灯的灯座被擦得发亮，像有人天天照料。",
    "岩壁上的符号像是文字，又像是一幅地图。",
    "石缝里插着几支没有烧完的红香。"
  ],
  lianhua: [
    "破庙的香炉里插着三炷粗香。",
    "老树挂满布条，风一吹，像无数双手在招。",
    "墙角的破碗里，盛着半碗清水。"
  ],
  heifeng: [
    "铁蒺藜上挂着几缕破布，不知是谁的。",
    "寨墙的豁口能看到里面的火光。",
    "地上的脚印杂乱，像是刚有一群人走过。"
  ],
  end: [
    "碎裂的石板浮在虚空中，拼不出完整的纹路。",
    "镜面的裂缝里透出微弱的光。",
    "这里没有风，却总觉得有什么在动。"
  ],
  inn: [
    "柜台上的算盘珠子被磨得发亮。",
    "墙角挂着一件旧蓑衣，还在滴水。",
    "桌面上刻着一句歪歪扭扭的「江湖再见」。"
  ],
  hall: [
    "木人桩上缠着旧布，已经被打得开裂。",
    "墙上的字画落满灰尘，只有落款还清晰。",
    "门槛被踩出一个浅浅的凹坑。"
  ],
  smith: [
    "铁砧上有一道深深的锤痕。",
    "炉边的炭灰还是温的。",
    "墙上挂着一排半成品，刀身泛着幽蓝。"
  ],
  drug: [
    "药柜上的标签有些已经褪色。",
    "柜角露出一截干枯的草药。",
    "桌上摊着半张药方，字迹潦草。"
  ],
  study: [
    "书架顶层的书落满灰尘，像很久没人翻。",
    "砚台里的墨还没干。",
    "窗台上压着一页手抄的诗。"
  ],
  yamen: [
    "案上惊堂木摆得整整齐齐。",
    "墙角立着一面旧木牌，写着「明镜高悬」。",
    "窗纸破了一个洞，漏进一线光。"
  ],
  home: [
    "灶台边放着一碗凉了的粥。",
    "窗台上摆着几朵晒干的花。",
    "门槛被磨得发亮，像走了许多年。"
  ],
  shrine: [
    "香炉里的灰是温的，有人刚上过香。",
    "神像的眉眼被烛烟熏得模糊。",
    "供桌上摆着三个馒头，还冒着热气。"
  ],
  shop: [
    "柜台上的算盘缺了一颗珠子。",
    "货架后面的墙上贴着一副旧对联。",
    "门口的风铃被风吹得轻轻响。"
  ]
};

export function randomNpcChatDialog(npcId: string, s?: GameState): DialogNode[] {
  const npc = NPCS[npcId];
  const text = s && Math.random() < 0.65 ? randomRumor(s) : pickText(CHAT_FLAVOR);
  return [{ id: "r", speaker: npc?.name || "江湖客", text, opts: [] }];
}

export function randomChatText(s?: GameState): string {
  return s && Math.random() < 0.65 ? randomRumor(s) : pickText(CHAT_FLAVOR);
}

export function randomTalkText(): string {
  return "「" + pickText(TALK_FLAVOR) + "」";
}

export function randomLookText(areaId: string): string {
  const pool = [...LOOK_TEXT_COMMON, ...(LOOK_TEXT_AREA[areaId] || [])];
  return pickText(pool);
}

export function sparReaction(npcId: string, won: boolean, playerGender: "male" | "female"): DialogNode[] {
  const npc = NPCS[npcId];
  const name = npc?.name || "对方";
  const quips = FIGHT_QUIPS[npcId] || {};
  let text: string;
  if (!won) {
    text = pickText(quips.lose || SPAR_LOSE);
  } else if (npc?.gender && npc.gender !== playerGender && Math.random() < 0.65) {
    text = pickText(quips.crush || SPAR_CRUSH);
  } else {
    text = pickText(quips.win || SPAR_WIN);
  }
  return [{ id: "r", speaker: name, text, opts: [] }];
}
