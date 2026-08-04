import type { SkillDef } from "./types";

export const SKILLS: Record<string, SkillDef> = {
  /* ---------- 基本功夫 ---------- */
  jibenQuan: {
    id: "jibenQuan",
    name: "基本拳脚",
    type: "fist",
    max: 150,
    base: true,
    attr: "li",
    weapon: "fist",
    desc: "拳脚是万般武艺的根基。拳重一分，膂力便长一分；膂力高一分，拳便又重一分。"
  },
  jibenJian: {
    id: "jibenJian",
    name: "基本剑术",
    type: "sword",
    max: 150,
    base: true,
    weapon: "sword",
    desc: "刺、撩、抹、崩、劈、挂、架、格，剑术八法，是天下剑法的母本。"
  },
  jibenDao: {
    id: "jibenDao",
    name: "基本刀法",
    type: "blade",
    max: 150,
    base: true,
    weapon: "blade",
    desc: "刀是百兵之胆，大开大合，勇往直前。"
  },
  jibenZhang: {
    id: "jibenZhang",
    name: "基本杖法",
    type: "staff",
    max: 150,
    base: true,
    weapon: "staff",
    desc: "杖法讲求借力打力，横扫竖砸，势大力沉。"
  },
  jibenBian: {
    id: "jibenBian",
    name: "基本鞭法",
    type: "whip",
    max: 150,
    base: true,
    weapon: "whip",
    desc: "鞭如游龙，柔中带刚，最难练的兵器功夫。"
  },
  jibenNeiGong: {
    id: "jibenNeiGong",
    name: "基本内功",
    type: "neigong",
    max: 150,
    base: true,
    attr: "gen",
    desc: "导引行气的基础功夫。根骨愈好，内功愈深；内功愈深，打坐愈快。"
  },
  jibenQingGong: {
    id: "jibenQingGong",
    name: "基本轻功",
    type: "lightness",
    max: 150,
    base: true,
    attr: "min",
    desc: "纵跃闪转，趋避进退。敏捷愈高，身法愈灵。"
  },
  jibenZhaoJia: {
    id: "jibenZhaoJia",
    name: "基本招架",
    type: "parry",
    max: 150,
    base: true,
    desc: "格挡来招、卸去劲力的功夫。招架稳了，百招之内才谈得上反击。"
  },
  duShu: {
    id: "duShu",
    name: "读书识字",
    type: "literacy",
    max: 100,
    base: true,
    attr: "wu",
    desc: "学问通了，武功才不是蛮力。每读通十级，战斗中领悟武功的概率便高上一分（每 10 级 +2%，至多 +20%）。"
  },

  /* ---------- 太极门 ---------- */
  taiJiQuan: {
    id: "taiJiQuan",
    name: "太极拳",
    type: "fist",
    max: 150,
    sect: "taiji",
    weapon: "fist",
    desc: "用意不用力，圆转贯串，以柔克刚。练至化境，四两可拨千斤。",
    learn: { basic: "jibenQuan", basicLv: 20 },
    ult: [
      {
        id: "jiZiJue",
        name: "挤字诀",
        lv: 70,
        cost: 25,
        mult: 1.6,
        kind: "debuff",
        desc: "以横劲破开对方招式，使其劲力落空，内力受扰。",
        text: "你一招挤字诀，横劲暗发，将对方的力道尽数撞回！",
        debuff: { stat: "def", value: -25, turns: 3 }
      },
      {
        id: "zhenZiJue",
        name: "震字诀",
        lv: 70,
        cost: 35,
        mult: 2.1,
        kind: "attack",
        desc: "太极神功附于拳中，一触即震，伤人脏腑。",
        text: "你拳势圆转，猛然一吐，震字诀的劲力直透对方五脏六腑！"
      },
      {
        id: "luanHuanJue",
        name: "乱环诀",
        lv: 100,
        cost: 55,
        mult: 2.8,
        kind: "attack",
        desc: "陷敌深入乱环之内，四两拨动千斤。",
        text: "乱环术法最难通，上下随合妙无穷。你以环形之力将对方卷进无形圈中！"
      },
      {
        id: "yinYangJue",
        name: "阴阳诀",
        lv: 120,
        cost: 80,
        mult: 3.6,
        kind: "attack",
        desc: "阴阳相生相克，刚柔互换，变化莫测。",
        text: "吞吐开合问刚柔，闪进全在动中求。阴阳二气在你掌间交割！"
      }
    ]
  },
  xuanXuDao: {
    id: "xuanXuDao",
    name: "玄虚刀法",
    type: "blade",
    max: 150,
    sect: "taiji",
    weapon: "blade",
    desc: "自道德经「玄之又玄」中化出，变化莫测，暗合生生不息之意。",
    learn: { basic: "jibenDao", basicLv: 20, exp: 400 },
    ult: [
      {
        id: "xuanYouXuan",
        name: "玄之又玄",
        lv: 100,
        cost: 55,
        mult: 2.9,
        kind: "attack",
        desc: "刀光似有还无，虚虚实实，令人无从招架。",
        text: "刀光一分，又一分为二，再分为万——玄之又玄，众妙之门！"
      }
    ]
  },
  taiJiJian: {
    id: "taiJiJian",
    name: "太极剑",
    type: "sword",
    max: 150,
    sect: "taiji",
    weapon: "sword",
    desc: "剑走圆弧，神在剑先，以柔克刚，绵绵不绝。易学难精，非大悟性不能登堂入室。",
    learn: { basic: "jibenJian", basicLv: 30, exp: 1000, attr: { k: "wu", v: 22 } },
    ult: [
      {
        id: "chanZiJue",
        name: "缠字诀",
        lv: 80,
        cost: 30,
        mult: 1.8,
        kind: "debuff",
        desc: "弧形刺出，弧形收回，如撒大网，令对手手忙脚乱。",
        text: "你剑走圆弧，织成一张无形的网，将对方紧紧缠住！",
        debuff: { stat: "spd", value: -30, turns: 3 }
      },
      {
        id: "lianZiJue",
        name: "连字诀",
        lv: 80,
        cost: 30,
        mult: 1.2,
        kind: "defense",
        desc: "以极柔之力织成剑阵，守御严密，滴水不漏。",
        text: "你以连字诀在身前织成一座剑阵，剑影如环，滴水不漏！",
        buff: { stat: "def", value: 40, turns: 3 }
      },
      {
        id: "sanHuanTaoYue",
        name: "三环套月",
        lv: 120,
        cost: 75,
        mult: 3.4,
        kind: "attack",
        desc: "暗合三清之意，似慢实快，瞬息间连攻三招。",
        text: "你剑走三环，似慢实快，三道剑光次第绽放，如月影投湖！"
      }
    ]
  },
  taiJiShenGong: {
    id: "taiJiShenGong",
    name: "太极神功",
    type: "neigong",
    max: 150,
    sect: "taiji",
    desc: "太极生两仪，两仪生四象。此功是太极门一切武功的根源。",
    learn: { basic: "jibenNeiGong", basicLv: 20, exp: 300 }
  },
  wanLiuGuiYi: {
    id: "wanLiuGuiYi",
    name: "万流归一",
    type: "lightness",
    max: 100,
    sect: "taiji",
    desc: "万物归元，招招相连，环环相扣。",
    learn: { basic: "jibenQingGong", basicLv: 20, exp: 300 }
  },

  /* ---------- 八卦门 ---------- */
  baGuaYouShenZhang: {
    id: "baGuaYouShenZhang",
    name: "八卦游身掌",
    type: "fist",
    max: 150,
    sect: "bagua",
    weapon: "fist",
    desc: "脚踩先天八卦，转折如意，绕敌游走，令对手头晕目眩。",
    learn: { basic: "jibenQuan", basicLv: 20 },
    ult: [
      {
        id: "huaZhangWeiDao",
        name: "化掌为刀",
        lv: 80,
        cost: 40,
        mult: 2.4,
        kind: "attack",
        desc: "以混天气功将内力逼至掌缘，掌锋如刀。",
        text: "你双掌一错，掌缘泛出刀锋般的寒光，劈向对方要害！"
      }
    ]
  },
  baGuaDao: {
    id: "baGuaDao",
    name: "八卦刀",
    type: "blade",
    max: 150,
    sect: "bagua",
    weapon: "blade",
    desc: "刀大而长，扎砍劈剁、豁挑钩挂，脚踩八卦，转身发刀。",
    learn: { basic: "jibenDao", basicLv: 20, exp: 400 },
    ult: [
      {
        id: "daoYingZhang",
        name: "刀影掌",
        lv: 80,
        cost: 40,
        mult: 2.4,
        kind: "attack",
        desc: "刀中夹掌，一劈之下又猛下杀手击出两掌。",
        text: "刀光劈下，掌影已紧随其后，刀中有掌，掌中有刀！"
      }
    ]
  },
  baZhenBaGuaZhang: {
    id: "baZhenBaGuaZhang",
    name: "八阵八卦掌",
    type: "fist",
    max: 150,
    sect: "bagua",
    weapon: "fist",
    desc: "八卦掌中夹八阵图之法，四正四奇、四开四阖，隐然布阵而战。掌门王维扬只传关门弟子。",
    learn: { basic: "baGuaYouShenZhang", basicLv: 60, exp: 5000, moral: 0 },
    ult: [
      {
        id: "baZhenHuaDao",
        name: "八阵化刀",
        lv: 120,
        cost: 70,
        mult: 3.5,
        kind: "attack",
        desc: "八阵八卦掌的化掌为刀，比普通八卦掌更加威猛。",
        text: "你足踏八门，双掌化刀，天地风云龙虎鸟蜿尽数压向对方！"
      }
    ]
  },
  hunTianQiGong: {
    id: "hunTianQiGong",
    name: "混天气功",
    type: "neigong",
    max: 150,
    sect: "bagua",
    desc: "八卦门内功，气走奇门，刚柔并济。",
    learn: { basic: "jibenNeiGong", basicLv: 20, exp: 300 }
  },
  youLongShenFa: {
    id: "youLongShenFa",
    name: "游龙身法",
    type: "lightness",
    max: 100,
    sect: "bagua",
    desc: "依八卦方位急奔游走，熟极而流，错步不差。",
    learn: { basic: "jibenQingGong", basicLv: 20, exp: 300 }
  },

  /* ---------- 雪山剑派 ---------- */
  ruMenShiSanShi: {
    id: "ruMenShiSanShi",
    name: "入门十三式",
    type: "fist",
    max: 100,
    sect: "xueshan",
    weapon: "fist",
    desc: "雪山弟子打熬力气、练习准头的入门功夫。",
    learn: { basic: "jibenQuan", basicLv: 10 },
    ult: [
      {
        id: "meiHuaLuo",
        name: "梅花落",
        lv: 60,
        cost: 25,
        mult: 1.9,
        kind: "attack",
        desc: "拳法古朴飘逸，如雪中梅花纷纷落下。",
        text: "你拳势古朴，如梅花纷纷落雪，点向对方周身要穴！"
      }
    ]
  },
  xueShanJianFa: {
    id: "xueShanJianFa",
    name: "雪山剑法",
    type: "sword",
    max: 150,
    sect: "xueshan",
    weapon: "sword",
    desc: "剑点密集，如雪花飞舞、朔风呼号，招招抢攻，天下剑法之冠。",
    learn: { basic: "jibenJian", basicLv: 20, exp: 400, attr: { k: "min", v: 22 } },
    ult: [
      {
        id: "xueHuaLiuChu",
        name: "雪花六出",
        lv: 80,
        cost: 45,
        mult: 2.7,
        kind: "attack",
        desc: "按雪花六角之形瞬间刺出数剑，快若闪电。",
        text: "剑光如雪花六出，六道银芒同时绽开，快得肉眼难追！"
      }
    ]
  },
  xueYingQinNaShou: {
    id: "xueYingQinNaShou",
    name: "雪影擒拿手",
    type: "fist",
    max: 150,
    sect: "xueshan",
    weapon: "fist",
    desc: "暗含分筋错骨，勾带锁拿戳击劈拗，附以冰雪寒气。",
    learn: { basic: "jibenQuan", basicLv: 40, exp: 2000, attr: { k: "gen", v: 20 } },
    ult: [
      {
        id: "shenDaoGuiDie",
        name: "神倒鬼跌",
        lv: 100,
        cost: 60,
        mult: 3.0,
        kind: "attack",
        desc: "一揪一抓一拌，神仙也要摔个跟头。",
        text: "你擒拿手一揪一抓一拌，对方身不由己，直直向地上栽去！"
      }
    ]
  },
  xueShanNeiGong: {
    id: "xueShanNeiGong",
    name: "雪山内功",
    type: "neigong",
    max: 150,
    sect: "xueshan",
    desc: "雪山寒冽，正宜练气。此功扎实绵密，另有护体之妙。",
    learn: { basic: "jibenNeiGong", basicLv: 20, exp: 300 },
    ult: [
      {
        id: "bingXinJue",
        name: "冰心诀",
        lv: 60,
        cost: 30,
        mult: 1.0,
        kind: "defense",
        desc: "内力凝成护体冰甲，抵得上一件上好盔甲。",
        text: "你运转雪山内功，周身泛起一片冰雪般的晶莹之色！",
        buff: { stat: "def", value: 55, turns: 4 }
      }
    ]
  },
  taXueWuHen: {
    id: "taXueWuHen",
    name: "踏雪无痕",
    type: "lightness",
    max: 100,
    sect: "xueshan",
    desc: "雪地无痕，难觅其踪。",
    learn: { basic: "jibenQingGong", basicLv: 20, exp: 300 }
  },

  /* ---------- 花间派 ---------- */
  yiJianMeiHuaShou: {
    id: "yiJianMeiHuaShou",
    name: "一剪梅花手",
    type: "fist",
    max: 150,
    sect: "huajian",
    weapon: "fist",
    desc: "自一首词中化出，极尽变化之巧。",
    learn: { basic: "jibenQuan", basicLv: 20, attr: { k: "wu", v: 20 } },
    ult: [
      {
        id: "meiYingSanDie",
        name: "梅影三叠",
        lv: 70,
        cost: 35,
        mult: 2.2,
        kind: "attack",
        desc: "指影如梅花三叠，轻歌曼舞间伤人于无形。",
        text: "你指尖轻点，三道梅影叠叠而至，对方还未看清便已中招！"
      }
    ]
  },
  liuYeDaoFa: {
    id: "liuYeDaoFa",
    name: "柳叶刀法",
    type: "blade",
    max: 150,
    sect: "huajian",
    weapon: "blade",
    desc: "刀式轻灵，易学易精，恰合女儿家身法。",
    learn: { basic: "jibenDao", basicLv: 20, exp: 400 },
    ult: [
      {
        id: "yingFeiYanWu",
        name: "莺飞燕舞",
        lv: 80,
        cost: 40,
        mult: 2.4,
        kind: "attack",
        desc: "一瞬攻出两掌一刀，刀浪如柳，掌风如莺。",
        text: "你身形一旋，两掌一刀如莺飞燕舞，叫人目不暇接！"
      }
    ]
  },
  huaTuanBianFa: {
    id: "huaTuanBianFa",
    name: "花团鞭法",
    type: "whip",
    max: 150,
    sect: "huajian",
    weapon: "whip",
    desc: "日观四季山花，夜聆落英无声，鞭舞时有落花如雨之势。",
    learn: { basic: "jibenBian", basicLv: 20, exp: 400 },
    ult: [
      {
        id: "luoYingBinFen",
        name: "落英缤纷",
        lv: 80,
        cost: 40,
        mult: 2.4,
        kind: "attack",
        desc: "鞭势纵横，乱花如雨，可卷走对手兵器。",
        text: "鞭花如落英缤纷，缠卷而上，险些将对方兵刃卷飞出去！"
      }
    ]
  },
  sanHuaJuDing: {
    id: "sanHuaJuDing",
    name: "三花聚顶",
    type: "neigong",
    max: 150,
    sect: "huajian",
    desc: "花间派不传之秘，真气流转，灵台生花。",
    learn: { basic: "jibenNeiGong", basicLv: 20, exp: 300 },
    ult: [
      {
        id: "sanHua",
        name: "三花聚顶",
        lv: 60,
        cost: 30,
        mult: 1.0,
        kind: "buff",
        desc: "真气流转间周身泛出七彩绚烂之色，身法骤然加快。",
        text: "三花聚顶，五气朝元！你周身泛起七彩流光，身法骤轻！",
        buff: { stat: "spd", value: 35, turns: 4 }
      }
    ]
  },
  feiDieShenFa: {
    id: "feiDieShenFa",
    name: "飞蝶身法",
    type: "lightness",
    max: 100,
    sect: "huajian",
    desc: "轻灵飘逸，武林轻功第一，专补女儿家力小之缺。",
    learn: { basic: "jibenQingGong", basicLv: 20, exp: 300 }
  },
  zhuYanShu: {
    id: "zhuYanShu",
    name: "驻颜术",
    type: "other",
    max: 100,
    sect: "huajian",
    desc: "花间独有异术，驻颜养荣。",
    learn: { basic: "jibenNeiGong", basicLv: 10, exp: 200 }
  },

  /* ---------- 尹贺谷 ---------- */
  wuFaQuan: {
    id: "wuFaQuan",
    name: "无法拳",
    type: "fist",
    max: 150,
    sect: "yinhe",
    weapon: "fist",
    desc: "取无章可依、无法可寻之意，招式诡奇。",
    learn: { basic: "jibenQuan", basicLv: 20, attr: { k: "li", v: 20 } },
    ult: [
      {
        id: "wuFaKeYi",
        name: "无法可依",
        lv: 70,
        cost: 30,
        mult: 2.0,
        kind: "attack",
        desc: "拳路无章可循，往往于不可能的角度击出。",
        text: "你拳路诡奇，仿佛凭空凝成，对方连招架的念头都来不及起！"
      }
    ]
  },
  chuanFengYiDaoLiu: {
    id: "chuanFengYiDaoLiu",
    name: "川枫一刀流",
    type: "blade",
    max: 150,
    sect: "yinhe",
    weapon: "blade",
    desc: "拔刀迅速，出手狠辣，角度刁钻。",
    learn: { basic: "jibenDao", basicLv: 20, exp: 400 },
    ult: [
      {
        id: "xuanFengSanLian",
        name: "旋风三连斩",
        lv: 80,
        cost: 40,
        mult: 2.4,
        kind: "attack",
        desc: "身形交错间急劈三刀，收招极快。",
        text: "你身形交错，刀光连闪三下，第三刀竟从对方背后斩出！"
      },
      {
        id: "yingFengYiDao",
        name: "迎风一刀斩",
        lv: 100,
        cost: 60,
        mult: 3.2,
        kind: "attack",
        desc: "蓄力而发，刀势平平无奇，却势不可挡。",
        text: "你双手握刀，一刀平平斩出——天地为之色变！"
      }
    ]
  },
  fuSangRenShu: {
    id: "fuSangRenShu",
    name: "扶桑忍术",
    type: "neigong",
    max: 150,
    sect: "yinhe",
    desc: "另辟新境的内功，变化万端，出奇制胜。",
    learn: { basic: "jibenNeiGong", basicLv: 20, exp: 300 },
    ult: [
      {
        id: "renShuYanMu",
        name: "忍术烟幕",
        lv: 80,
        cost: 35,
        mult: 1.0,
        kind: "debuff",
        desc: "以掌击地腾起烟尘，令对手攻击力大降。",
        text: "你掌击地面，烟尘骤起，对方在烟雾中失去了你的方位！",
        debuff: { stat: "atk", value: -25, turns: 3 }
      },
      {
        id: "renFaYingFenShen",
        name: "忍法影分身",
        lv: 90,
        cost: 45,
        mult: 1.2,
        kind: "defense",
        desc: "一声呼喝化为两人，扰乱对手视线，令其攻击多半击空。",
        text: "你身形一晃，化作两道一模一样的身影，难分虚实！",
        buff: { stat: "dodge", value: 0.15, turns: 3 }
      }
    ]
  },
  wuYingDunXing: {
    id: "wuYingDunXing",
    name: "无影遁形",
    type: "lightness",
    max: 100,
    sect: "yinhe",
    desc: "往往于不可能中避过一击。",
    learn: { basic: "jibenQingGong", basicLv: 20, exp: 300 }
  },

  /* ---------- 红莲教 ---------- */
  taiZuChangQuan: {
    id: "taiZuChangQuan",
    name: "太祖长拳",
    type: "fist",
    max: 150,
    sect: "honglian",
    weapon: "fist",
    desc: "流传极广的入门拳法，红莲教所传却格外威猛。",
    learn: { basic: "jibenQuan", basicLv: 20, attr: { k: "li", v: 22 } },
    ult: [
      {
        id: "baiBuShenQuan",
        name: "百步神拳",
        lv: 60,
        cost: 30,
        mult: 2.1,
        kind: "attack",
        desc: "拳风破空，百步之外犹闻雷鸣。",
        text: "你一拳击出，拳风破空如雷，隔着三步便已轰在对方身上！"
      }
    ]
  },
  luanPiFengZhangFa: {
    id: "luanPiFengZhangFa",
    name: "乱披风杖法",
    type: "staff",
    max: 150,
    sect: "honglian",
    weapon: "staff",
    desc: "相传由狂士泼墨悟来，舞动时如泼墨山石，势大力沉。",
    learn: { basic: "jibenZhang", basicLv: 20, exp: 400, attr: { k: "li", v: 24 } },
    ult: [
      {
        id: "liuXingFeiZhi",
        name: "流星飞掷",
        lv: 80,
        cost: 70,
        mult: 3.8,
        kind: "attack",
        desc: "孤注一掷，将手中钢杖飞掷而出；若失手便失去兵刃。",
        text: "你运足内力，将手中钢杖如流星般飞掷而出！"
      }
    ]
  },
  hongLianJiaoYi: {
    id: "hongLianJiaoYi",
    name: "红莲教义",
    type: "other",
    max: 100,
    sect: "honglian",
    desc: "崇尚光明，邪不压正。修习到一定境界，身体会因天地正气而获得微妙变化。",
    learn: { basic: "jibenNeiGong", basicLv: 10, moral: 20 },
    ult: [
      {
        id: "hongLianShengGuang",
        name: "红莲圣光",
        lv: 60,
        cost: 30,
        mult: 1.0,
        kind: "heal",
        desc: "以教义正气净化自身，恢复伤势。",
        text: "红莲圣光自你周身绽放，伤势肉眼可见地愈合！"
      }
    ]
  },
  puTianTongJi: {
    id: "puTianTongJi",
    name: "普天同济心法",
    type: "neigong",
    max: 150,
    sect: "honglian",
    desc: "取兼济天下之意，胸襟博大，最大限度提升潜能。",
    learn: { basic: "jibenNeiGong", basicLv: 20, exp: 300 },
    ult: [
      {
        id: "hongLianChuShi",
        name: "红莲出世",
        lv: 60,
        cost: 35,
        mult: 1.0,
        kind: "buff",
        desc: "发挥人体潜在能力，大幅提高攻击力。",
        text: "你默念教义，去残除恶唯我光明——攻击力暴涨！",
        buff: { stat: "atk", value: 45, turns: 4 }
      },
      {
        id: "leiDongJiuTian",
        name: "雷动九天",
        lv: 90,
        cost: 55,
        mult: 3.0,
        kind: "attack",
        desc: "求强求狠，雷动九天，势不可挡。",
        text: "你暴喝一声，拳杖并施，如雷动九天，万物辟易！"
      }
    ]
  },
  heXiangShenFa: {
    id: "heXiangShenFa",
    name: "鹤翔身法",
    type: "lightness",
    max: 100,
    sect: "honglian",
    desc: "模仿白鹤飞翔姿态，舒展自如。",
    learn: { basic: "jibenQingGong", basicLv: 20, exp: 300 }
  },

  /* ---------- 丐帮 ---------- */
  xiangLongShiBaZhang: {
    id: "xiangLongShiBaZhang",
    name: "降龙十八掌",
    type: "fist",
    max: 150,
    sect: "gaibang",
    weapon: "fist",
    desc: "天下至刚至猛的掌法，一掌既出，如龙吟九霄。",
    learn: { basic: "jibenQuan", basicLv: 30, exp: 1000, moral: 10 },
    ult: [
      {
        id: "jianLongZaiYe",
        name: "见龙在野",
        lv: 60,
        cost: 35,
        mult: 1.0,
        kind: "defense",
        desc: "潜龙勿用，见龙在野。以掌力护身，防御大增。",
        text: "你双掌回环，降龙掌力化作无形的护壁！",
        buff: { stat: "def", value: 45, turns: 3 }
      },
      {
        id: "feiLongZaiTian",
        name: "飞龙在天",
        lv: 80,
        cost: 45,
        mult: 2.6,
        kind: "attack",
        desc: "掌力自天而降，如巨龙当空。",
        text: "你纵身而起，双掌如龙首昂然，自天而降！"
      },
      {
        id: "kangLongYouHui",
        name: "亢龙有悔",
        lv: 100,
        cost: 60,
        mult: 3.3,
        kind: "attack",
        desc: "降龙十八掌最后一式，威力无穷，留有余不尽之意。",
        text: "亢龙有悔！你掌力如怒龙回卷，天地间仿佛只剩这一掌！"
      }
    ]
  },
  daGouGunFa: {
    id: "daGouGunFa",
    name: "打狗棍法",
    type: "staff",
    max: 150,
    sect: "gaibang",
    weapon: "staff",
    desc: "丐帮帮主代代相传的绝学，棒影纷飞，专打恶犬恶人。",
    learn: { basic: "jibenZhang", basicLv: 30, exp: 1000, moral: 10 },
    ult: [
      {
        id: "tianXiaWuGou",
        name: "天下无狗",
        lv: 80,
        cost: 50,
        mult: 2.8,
        kind: "attack",
        desc: "棒势铺天盖地，纵有恶犬千条亦无所遁形。",
        text: "你棒势一展，铺天盖地，天下无狗！"
      }
    ]
  },
  hunTianGong: {
    id: "hunTianGong",
    name: "混天功",
    type: "neigong",
    max: 150,
    sect: "gaibang",
    desc: "丐帮秘传，混元一气，落魄江湖亦有惊雷之力。",
    learn: { basic: "jibenNeiGong", basicLv: 20, exp: 300 }
  },
  siFangYou: {
    id: "siFangYou",
    name: "四方游",
    type: "lightness",
    max: 100,
    sect: "gaibang",
    desc: "行乞天下，四海为家，走得多了，脚下自然有风。",
    learn: { basic: "jibenQingGong", basicLv: 20, exp: 300 }
  },

  /* ---------- 逍遥派（散修奇遇） ---------- */
  mengHuQuan: {
    id: "mengHuQuan",
    name: "猛虎拳",
    type: "fist",
    max: 150,
    weapon: "fist",
    desc: "拳经中的特殊拳法，出手较快，变化无常，威力极大。",
    hidden: true,
    learn: { basic: "jibenQuan", basicLv: 30 },
    ult: [
      {
        id: "eHuPuShi",
        name: "饿虎扑食",
        lv: 70,
        cost: 35,
        mult: 2.3,
        kind: "attack",
        desc: "如饿虎下山，一扑一撕，势不可当。",
        text: "你身形一纵，如饿虎扑食，拳爪齐施！"
      }
    ]
  },
  jingTianDaoFa: {
    id: "jingTianDaoFa",
    name: "惊天刀法",
    type: "blade",
    max: 150,
    weapon: "blade",
    desc: "惊天刀谱所载刀法，刀势一起，惊雷隐隐。",
    hidden: true,
    learn: { basic: "jibenDao", basicLv: 30 },
    ult: [
      {
        id: "daoPoCangQiong",
        name: "刀破苍穹",
        lv: 90,
        cost: 50,
        mult: 3.0,
        kind: "attack",
        desc: "一刀既出，仿佛要劈开整片天穹。",
        text: "你一刀劈出，刀光如裂帛，仿佛将苍穹一分为二！"
      }
    ]
  },
  zuiQuan: {
    id: "zuiQuan",
    name: "醉拳",
    type: "fist",
    max: 150,
    weapon: "fist",
    desc: "东倒西歪，似醉非醉，看似破绽百出，实则招招暗藏杀机。",
    hidden: true,
    learn: { basic: "jibenQuan", basicLv: 30 },
    ult: [
      {
        id: "zuiDaShanMen",
        name: "醉打山门",
        lv: 80,
        cost: 40,
        mult: 2.5,
        kind: "attack",
        desc: "醉眼朦胧间拳脚齐飞，连山门也打得开。",
        text: "你脚步踉跄，忽然一拳一脚如醉打山门，密不透风！"
      }
    ]
  },
  xiaoyaoXinfa: {
    id: "xiaoyaoXinfa",
    name: "逍遥心法",
    type: "neigong",
    max: 150,
    desc: "无名老者晚年所悟，取「无所待而游于无穷」之意。身随意转，气逐云生。",
    hidden: true,
    learn: { basic: "jibenNeiGong", basicLv: 30 },
    ult: [
      {
        id: "xiaoyaoYou",
        name: "逍遥游",
        lv: 80,
        cost: 40,
        mult: 1.0,
        kind: "buff",
        desc: "御风而行，无所待也——身法与闪避大增，持续三回合。",
        text: "你长笑一声，身形如大鹏扶摇而上，天地之间，再无一物可羁！",
        buff: { stat: "spd", value: 25, turns: 3 },
        buff2: { stat: "dodge", value: 0.15, turns: 3 }
      }
    ]
  }
};

export const BASIC_SKILLS = [
  "jibenQuan",
  "jibenJian",
  "jibenDao",
  "jibenZhang",
  "jibenBian",
  "jibenNeiGong",
  "jibenQingGong",
  "jibenZhaoJia",
  "duShu"
];

export function skillDef(id: string): SkillDef {
  const def = SKILLS[id];
  if (!def) throw new Error("未知武功: " + id);
  return def;
}
