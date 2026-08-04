import type { NpcDef } from "./types";
import { ITEMS } from "./items";

export const NPCS: Record<string, NpcDef> = {
  laozhe: {
    id: "laozhe",
    name: "无名老者",
    title: "镇口晒太阳的老人",
    area: "town",
    x: 250,
    color: "#b9b2a4",
    desc: "镇口晒太阳的老人，据说年轻时走过很远的路。他说的话，没人知道哪句是真的，哪句是假的。"
  },
  heiren: {
    id: "heiren",
    name: "神秘人",
    title: "黑衣客",
    area: "town",
    x: 3080,
    color: "#3b4152",
    desc: "一个披着斗篷的黑衣人，帽子压得极低。他像是专程在镇里等你。"
  },
  axiu: {
    id: "axiu",
    name: "阿绣",
    title: "卖花姑娘",
    area: "town",
    x: 640,
    walk: 80,
    hours: [5, 22],
    color: "#d9829f",
    gender: "female",
    age: 18,
    looks: "眉目如画，颊边两个浅浅的酒窝；鬓边常簪一朵山茶，笑起来的时候，整个平安镇的春光都像是她的。",
    martial: "不会武功，身法却轻巧，跑起来像一阵风。",
    desc: "挎着花篮的小姑娘，笑起来有两个酒窝。镇上的人都喜欢她。"
  },
  yuexia: {
    id: "yuexia",
    name: "月下老人",
    title: "牵红线的人",
    area: "town",
    x: 2430,
    color: "#d9b3d0",
    desc: "一个笑眯眯的白胡子老人，腰间挂满了红绳。他总说：红线这东西，说断就断，说牢也牢。",
    marriage: true
  },
  xiaoer: {
    id: "xiaoer",
    name: "店小二",
    title: "悦来客栈伙计",
    area: "town",
    room: "inn",
    x: 430,
    color: "#c46a4a",
    desc: "嘴快腿勤，消息灵通。平安镇的风吹草动，他都知道。",
    shop: ["mantou", "baozi", "shaoji", "jingcha", "qingcha", "huangjiu"]
  },
  liZhenWei: {
    id: "liZhenWei",
    name: "李振威",
    title: "振威武馆教头",
    area: "town",
    room: "hall",
    x: 340,
    color: "#8a4a2b",
    age: 38,
    looks: "虎背熊腰，眉骨如刀，络腮胡刮得干干净净，一双手上全是茧子。",
    martial: "太祖长拳七分火候，一拳下去能打断半根木桩。",
    desc: "一身太祖长拳已有七分火候，教武馆的徒弟从不含糊。",
    learnBasic: ["jibenQuan", "jibenJian", "jibenDao", "jibenZhang", "jibenBian", "jibenNeiGong", "jibenQingGong", "jibenZhaoJia"]
  },
  guYanWu: {
    id: "guYanWu",
    name: "顾炎武",
    title: "当世大儒",
    area: "town",
    room: "hall",
    x: 620,
    color: "#6f7f96",
    desc: "天下读书人的祖师爷，隐居在武馆后院。他说武馆清净，读书练拳，都是一回事。",
    learn: ["duShu"]
  },
  tiejiang: {
    id: "tiejiang",
    name: "铁匠张",
    title: "张记铁匠",
    area: "town",
    room: "smith",
    x: 430,
    color: "#6a6a72",
    desc: "膀大腰圆，打铁三十年。最恨别人说他打的刀卷口。",
    shop: ["mudao", "mujian", "tiejian", "yanlingDao", "tiefu", "ruanbian", "qingfeng", "jinDaHuanDao", "dagouBang", "xuantieJian", "yitian", "tulong", "pijia", "jingbuyi", "suozijia", "jinSuoZi", "liangyin", "heiyi", "pifeng", "sahuaXie", "niupiDai", "heiyanZhao", "tiekuang", "xuantie"],
    buyAll: true,
    forge: true
  },
  pingYiZhi: {
    id: "pingYiZhi",
    name: "平一指",
    title: "杀人名医",
    area: "town",
    room: "drug",
    x: 430,
    color: "#5d7a4a",
    desc: "医术如神，性子却怪。他号称杀一人、医一人，赔本买卖绝不做。",
    shop: ["jinchuang", "huichun", "daHuan", "jieDu"],
    questGiver: "qSha"
  },
  xiucai: {
    id: "xiucai",
    name: "穷秀才",
    title: "屡试不第的读书人",
    area: "town",
    room: "study",
    x: 430,
    color: "#7a8aa0",
    desc: "在书院抄书糊口，学问极好，就是运气太差。",
    shop: ["maobi", "shouChaoBen"],
    buyAll: true
  },
  xunbu: {
    id: "xunbu",
    name: "捕快",
    title: "六扇门巡捕",
    area: "town",
    room: "yamen",
    x: 340,
    color: "#37415a",
    desc: "腰悬铁尺，眼神像鹰。他盯着镇上每一个陌生人。",
    questGiver: "qChuE"
  },
  xianling: {
    id: "xianling",
    name: "县令",
    title: "平安县尊",
    area: "town",
    room: "yamen",
    x: 620,
    color: "#5f5a76",
    desc: "胆小怕事的父母官，除了悬赏，什么都不会。"
  },
  cunzhang: {
    id: "cunzhang",
    name: "村长",
    title: "平安镇之长",
    area: "town",
    room: "cunzhangHome",
    x: 430,
    color: "#8d7a5a",
    desc: "温和的中年人，眉头却总锁着。他知道暗处有东西在逼近平安镇。",
    questGiver: "qMain"
  },
  popo: {
    id: "popo",
    name: "老婆婆",
    title: "镇里的老祖宗",
    area: "town",
    room: "popoHome",
    x: 430,
    color: "#9a8f7d",
    desc: "镇上年纪最大的人，手脚不利索了，脑子却比谁都清楚。",
    questGiver: "qYigong"
  },
  funv: {
    id: "funv",
    name: "马大哈",
    title: "爱丢东西的妇人",
    area: "town",
    room: "funvHome",
    x: 430,
    color: "#c49a8a",
    gender: "female",
    desc: "全镇出了名的马大哈，不是丢了这就是少了那，偏生记性差，又酷爱收藏。",
    questGiver: "qXunWu"
  },
  huoji: {
    id: "huoji",
    name: "杂货铺掌柜",
    title: "什么都有得卖",
    area: "town",
    room: "zahuo",
    x: 430,
    color: "#9a7d50",
    desc: "他的铺子什么都卖，连麻绳都卖。他总劝人想开点。",
    shop: ["mantou", "baozi", "jingcha", "qingcha", "huangjiu", "mafeng", "yaocai"],
    buyAll: true
  },
  qingXu: {
    id: "qingXu",
    name: "清虚道长",
    title: "三清三圣之首",
    area: "wudang",
    room: "sanqing",
    x: 430,
    color: "#8fa8c8",
    desc: "仙风道骨，白须垂胸。太极神功圆转如意，深不可测。",
    master: true,
    enemy: "qingXu",
    learn: ["taiJiQuan", "xuanXuDao", "taiJiJian", "taiJiShenGong", "wanLiuGuiYi"]
  },
  gusong: {
    id: "gusong",
    name: "古松道长",
    title: "三清三圣之一",
    area: "wudang",
    x: 260,
    color: "#7f9a7f",
    desc: "性如古松，话少，剑却快。",
    learn: ["taiJiQuan", "taiJiShenGong"]
  },
  cangyue: {
    id: "cangyue",
    name: "苍月道长",
    title: "三清三圣之一",
    area: "wudang",
    x: 640,
    color: "#a5a8c9",
    desc: "常在山头看月亮，据说他的剑法也与月亮有关。"
  },
  wangWeiYang: {
    id: "wangWeiYang",
    name: "王维扬",
    title: "八卦门掌门「威震河朔」",
    area: "shangjia",
    room: "shangjiaHall",
    x: 430,
    color: "#b0894f",
    desc: "虎背熊腰，一双眼睛精光四射。他带的两个儿子，一个比一个能打。",
    master: true,
    enemy: "wangWeiYang",
    learn: ["baGuaYouShenZhang", "baGuaDao", "baZhenBaGuaZhang", "hunTianQiGong", "youLongShenFa"]
  },
  shangJianMing: {
    id: "shangJianMing",
    name: "商剑鸣",
    title: "八卦门弟子",
    area: "shangjia",
    x: 820,
    color: "#a8844f",
    age: 24,
    looks: "浓眉大眼，腰间常年挂着一把旧刀；笑起来坦荡，骂起人来也坦荡。",
    martial: "八卦游身掌已得师父七分真传，脚踩八卦，寻常三五人近不了身。",
    desc: "王维扬的外姓弟子，拳脚功夫已得了师父七分真传。",
    learn: ["baGuaYouShenZhang", "hunTianQiGong"]
  },
  baiRuiDe: {
    id: "baiRuiDe",
    name: "白瑞德",
    title: "雪山剑派掌门「威德先生」",
    area: "xueshan",
    room: "lingxiao",
    x: 430,
    color: "#cfe3ef",
    desc: "鹤发童颜，常年一袭白衣。他说大雪山上的日子，正好练剑。",
    master: true,
    enemy: "baiRuiDe",
    learn: ["ruMenShiSanShi", "xueShanJianFa", "xueYingQinNaShou", "xueShanNeiGong", "taXueWuHen"]
  },
  xuewei: {
    id: "xuewei",
    name: "雪卫",
    title: "凌霄城守卫",
    area: "xueshan",
    x: 1150,
    color: "#a8c2d4",
    desc: "抱剑而立，眉梢结着霜。他不说话，只是盯着每一个来客。"
  },
  liQingZhao: {
    id: "liQingZhao",
    name: "李青照",
    title: "花间派掌门「千庵居士」",
    area: "baihua",
    room: "sanhua",
    x: 380,
    color: "#e3a0bd",
    gender: "female",
    desc: "文采飞扬，出手如诗。她收徒极严：容貌不佳不收，悟性不高不收，文采不够不收。",
    master: true,
    enemy: "liQingZhao",
    learn: ["yiJianMeiHuaShou", "liuYeDaoFa", "huaTuanBianFa", "sanHuaJuDing", "feiDieShenFa", "zhuYanShu"]
  },
  tangWanCi: {
    id: "tangWanCi",
    name: "唐晚词",
    title: "花间派弟子",
    area: "baihua",
    room: "sanhua",
    x: 680,
    color: "#d98fa8",
    gender: "female",
    age: 19,
    looks: "眉眼清冷，像谷中三月未化的薄雪；长发只用一根桃木簪绾着，练刀时衣袂翻飞，很好看。",
    martial: "柳叶刀法轻灵迅捷，一刀既出，落叶分成两半。",
    desc: "李青照的高足，刀法轻灵。谷中的花开了又谢，她的刀也学了快十年。",
    learn: ["yiJianMeiHuaShou", "liuYeDaoFa"]
  },
  heZhongYang: {
    id: "heZhongYang",
    name: "和仲阳",
    title: "尹贺谷谷主「花讽院主」",
    area: "binghuo",
    room: "renguan",
    x: 430,
    color: "#a98ec4",
    desc: "举止如古武士，出手却诡奇难测。他说：武功一道，中土为正，扶桑为奇。",
    master: true,
    enemy: "heZhongYang",
    learn: ["wuFaQuan", "chuanFengYiDaoLiu", "fuSangRenShu", "wuYingDunXing"]
  },
  langren: {
    id: "langren",
    name: "扶桑浪人",
    title: "漂泊的剑客",
    area: "binghuo",
    x: 950,
    color: "#8f7fa8",
    desc: "独自面海而坐，刀横膝上。他说他在等一场雪，也等一个人。",
    learn: ["chuanFengYiDaoLiu"]
  },
  yuHongRu: {
    id: "yuHongRu",
    name: "余鸿儒",
    title: "红莲教教主",
    area: "wuzhi",
    room: "honglianTang",
    x: 430,
    color: "#d96a5d",
    desc: "一介书生模样，出手却如怒雷。他说光明终将战胜黑暗，只是要有人去烧这把火。",
    master: true,
    enemy: "yuHongRu",
    learn: ["taiZuChangQuan", "luanPiFengZhangFa", "hongLianJiaoYi", "puTianTongJi", "heXiangShenFa"]
  },
  xiangzhu: {
    id: "xiangzhu",
    name: "红衣香主",
    title: "红莲教香主",
    area: "wuzhi",
    x: 260,
    color: "#c05a4d",
    desc: "教中香主，寡言少语，衣裳却永远红得耀眼。",
    learn: ["taiZuChangQuan", "puTianTongJi"]
  },
  qiaoSiHai: {
    id: "qiaoSiHai",
    name: "乔四海",
    title: "丐帮帮主",
    area: "lianhua",
    room: "gaibangTang",
    x: 430,
    color: "#c79a63",
    desc: "背着九个口袋的天下第一大帮帮主，笑呵呵的，像只晒太阳的老猫。",
    master: true,
    enemy: "qiaoSiHai",
    learn: ["xiangLongShiBaZhang", "daGouGunFa", "hunTianGong", "siFangYou"]
  },
  zhanglao: {
    id: "zhanglao",
    name: "九袋长老",
    title: "丐帮长老",
    area: "lianhua",
    x: 760,
    color: "#b08a58",
    desc: "衣衫褴褛，腰间却结结实实缀着九个口袋。他正在教小乞丐打狗棒。",
    learn: ["daGouGunFa"]
  },
  lengTieYi: {
    id: "lengTieYi",
    name: "冷铁衣",
    title: "青龙坛坛主「青面兽」",
    area: "heifeng",
    room: "juyi",
    x: 430,
    color: "#4d7a6b",
    gender: "male",
    age: 44,
    looks: "面如青铁，一道旧疤从额角斜到下颌；一身铁衣从不离身，灯光下泛着幽冷的光。",
    martial: "铁衣功与毒功并修，寻常兵刃近不了身。",
    desc: "面如青铁，一件铁衣从不离身。总瓢把子手下三大坛主之一，聚义厅里常年只有他一个人。"
  },
  tiaofu: {
    id: "tiaofu",
    name: "挑夫",
    title: "送货的汉子",
    area: "town",
    x: 780,
    walk: 70,
    hours: [6, 18],
    color: "#9a7a55",
    gender: "male",
    age: 33,
    looks: "古铜色的皮肤，肩上常年压着一根油亮的扁担，笑起来露出一口白牙。",
    martial: "力气极大，挑着两担货还能健步如飞，寻常毛贼不敢惹。",
    desc: "靠两条腿吃饭的挑夫，走南闯北，满肚子的路上见闻。"
  },
  xiaoqigai: {
    id: "xiaoqigai",
    name: "小乞丐",
    title: "铁匠铺墙根下的孩子",
    area: "town",
    x: 1100,
    walk: 90,
    hours: [6, 21],
    color: "#b49a6f",
    gender: "male",
    age: 12,
    looks: "蓬头垢面，一双眼睛却亮得像野猫，手里攥着半块硬馒头。",
    martial: "不会武功，但跑起来连狗都追不上。",
    desc: "在张记铁匠铺的墙根下长大的孩子，嘴甜，消息也灵。夜里回镇外的破庙睡觉。"
  },
  shuoshu: {
    id: "shuoshu",
    name: "说书先生",
    title: "夜话江湖的闲人",
    area: "town",
    x: 2620,
    hours: [19, 23],
    color: "#7d8498",
    gender: "male",
    age: 47,
    looks: "一袭洗得发白的青衫，醒木一拍，眉飞色舞；灯影里像个半仙。",
    martial: "不会武功，但江湖掌故比谁都多。",
    desc: "只在夜里出摊说书，讲的都是真真假假的江湖旧事。"
  },
  liehu: {
    id: "liehu",
    name: "猎户老柴",
    title: "后山的猎人",
    area: "houshan",
    x: 520,
    walk: 50,
    color: "#7d6a52",
    gender: "male",
    age: 41,
    looks: "左眉一道旧疤，腰间挂着兽皮袋，背上的弓弦磨得发亮。",
    martial: "箭法极准，能在百步外射中奔跑的野兔。",
    desc: "后山的猎户，认得每一棵树的年轮，也认得山里的每一阵风。"
  },
  huaPopo: {
    id: "huaPopo",
    name: "花婆婆",
    title: "百花谷的守花人",
    area: "baihua",
    x: 960,
    walk: 40,
    color: "#b98ca8",
    gender: "female",
    age: 62,
    looks: "满头银丝，脸上皱纹里却总藏着笑意，手上永远沾着洗不掉的花泥。",
    martial: "不会武功，但谷里的花都听她的话。",
    desc: "百花谷的守花人，种了一辈子花，也看了一辈子人来人往。"
  },
  chuanFu: {
    id: "chuanFu",
    name: "船夫",
    title: "冰火岛摆渡人",
    area: "dukou",
    x: 980,
    walk: 40,
    color: "#8f8a72",
    gender: "male",
    age: 40,
    looks: "皮肤被海风吹得粗糙，一双眼睛却亮得能看穿雾。",
    martial: "一身摇橹的力气，浪里来去自如。",
    desc: "渡口的摆渡人，白天渡人过海，夜里听潮枕浪。"
  },
  chapeng: {
    id: "chapeng",
    name: "茶棚老板",
    title: "官道茶棚掌柜",
    area: "guandao",
    x: 1000,
    walk: 20,
    hours: [6, 21],
    color: "#a8845a",
    gender: "male",
    age: 46,
    looks: "圆脸红膛，肩上搭一条汗巾，笑起来眼睛眯成两条缝，嗓门能盖过半条官道。",
    martial: "年轻时跑过镖，等闲三两个人近不了他的茶灶。",
    desc: "官道边摆茶棚的老实人，茶壶里永远滚着，耳朵里也永远装着南来北往的新鲜事。",
    shop: ["qingcha", "jingcha", "mantou", "baozi", "huangjiu"]
  },
  xingjiao: {
    id: "xingjiao",
    name: "行脚商人",
    title: "走南闯北的货郎",
    area: "guandao",
    x: 1430,
    walk: 70,
    hours: [6, 19],
    color: "#8f7a4a",
    gender: "male",
    age: 36,
    looks: "精瘦利落，一副货担压得扁担弯成弓，走起步来却比谁都快。",
    martial: "走江湖的人，都会两下防身的把式。",
    desc: "一副货担走四方的行脚商，针头线脑到伤药文玩，他担子里总能摸出你想要的。",
    shop: ["jinchuang", "huichun", "jieDu", "maobi", "shiliao", "mafeng"],
    buyAll: true
  },
  langzhong: {
    id: "langzhong",
    name: "游方郎中",
    title: "摇串铃的江湖医生",
    area: "town",
    x: 1520,
    walk: 60,
    color: "#6a8a72",
    gender: "male",
    age: 52,
    looks: "三绺山羊胡，背一只旧药箱，手里的串铃摇得叮当响，人未到声先到。",
    martial: "手无缚鸡之力，一根银针却能叫人半身发麻。",
    desc: "摇着串铃走四方的游方郎中，医术时灵时不灵，嘴上的功夫从没输过。",
    shop: ["jinchuang", "huichun", "jieDu"]
  },
  luopo: {
    id: "luopo",
    name: "落魄刀客",
    title: "醉卧茶棚的刀客",
    area: "guandao",
    x: 1105,
    walk: 20,
    color: "#5d5a6a",
    gender: "male",
    age: 34,
    looks: "胡茬满面，一件旧袍洗得发白，腰间那口刀却擦得雪亮，亮得与这身行头格格不入。",
    martial: "刀法曾是登堂入室的路数，只是如今手常抖——不是怕，是馋酒。",
    desc: "整日醉卧茶棚的落魄刀客。老板说他是好人，就是欠了一屁股酒账。"
  },
  taohun: {
    id: "taohun",
    name: "逃婚少女阿沅",
    title: "逃出花轿的姑娘",
    area: "guandao",
    x: 1620,
    walk: 30,
    color: "#d9a0a8",
    gender: "female",
    age: 17,
    looks: "荆钗布裙，眼睛哭得微肿，怀里紧紧抱着一个小包袱，像抱着她全部的家当。",
    martial: "不会武功，跑起来却像受惊的小鹿。",
    desc: "从富商花轿里逃出来的姑娘，一路南奔，只想逃到百花盛开的地方去。",
    questGiver: "qTaoHun"
  },
  shoumu: {
    id: "shoumu",
    name: "守墓老人",
    title: "石窟守墓人",
    area: "shiku",
    x: 1050,
    color: "#8a8a95",
    gender: "male",
    age: 71,
    looks: "背驼得像张弓，满脸沟壑，一双眼睛却在黑暗里亮得惊人，仿佛常年与石壁对坐练出来的。",
    martial: "年轻时据说也是一号人物，如今只剩一把老骨头和满肚子的旧事。",
    desc: "无名石窟深处的守墓人，守着几座没有名字的先人墓碑，一守就是一辈子。",
    questGiver: "qShiKu"
  },
  daotong: {
    id: "daotong",
    name: "武当道童",
    title: "三清观洒扫道童",
    area: "wudang",
    x: 460,
    walk: 30,
    color: "#7f9ab8",
    gender: "male",
    age: 15,
    looks: "梳着丫髻，脸蛋晒得红扑扑的，道袍袖口磨得发亮，怀里总揣着半块干饼。",
    martial: "洒扫之余偷看道长们练剑，比划起来有模有样，就是底盘不稳。",
    desc: "三清观里年纪最小的道童，管洒扫、管烧火、也管偷看师父练剑。话比山道上的松子还多。",
    questGiver: "qWudangDaily"
  },
  gaibangDizi: {
    id: "gaibangDizi",
    name: "丐帮弟子",
    title: "莲花山叫花子",
    area: "lianhua",
    x: 300,
    walk: 50,
    color: "#a8895f",
    gender: "male",
    age: 21,
    looks: "破衣烂衫却浆洗得干干净净，腰间三个口袋，笑起来露出一口白牙。",
    martial: "打狗棒法学了五六分，打真的恶狗已经绰绰有余。",
    desc: "莲花山总舵的年轻弟子，讨饭讨得理直气壮，帮人帮得也理直气壮。",
    questGiver: "qGaibangDaily"
  },
  xueshanDizi: {
    id: "xueshanDizi",
    name: "雪山弟子",
    title: "凌霄城弟子",
    area: "xueshan",
    x: 920,
    walk: 30,
    color: "#b8d0de",
    gender: "male",
    age: 22,
    looks: "眉目冷峻，白衣胜雪，呼出的白气比说的话多。",
    martial: "入门十三式练了八年，剑上的寒气比雪线还高三寸。",
    desc: "凌霄城的年轻弟子，在雪里站成了另一尊雪像。"
  },
  huajianShinv: {
    id: "huajianShinv",
    name: "花间侍女",
    title: "散花亭侍女",
    area: "baihua",
    x: 700,
    walk: 25,
    color: "#dda3b8",
    gender: "female",
    age: 18,
    looks: "眉眼温婉，鬓边簪一朵新摘的蔷薇，提着花篮走过，裙角都沾着香。",
    martial: "不会武功，谷里的路却闭着眼都走得。",
    desc: "散花亭的侍女，替掌门照看满谷花草，也替来访的人引路答话。"
  },
  honglianJiaotu: {
    id: "honglianJiaotu",
    name: "红莲教徒",
    title: "红莲教众",
    area: "wuzhi",
    x: 420,
    walk: 40,
    color: "#c4665a",
    gender: "male",
    age: 26,
    looks: "一身红衣洗得发旧，眼神却烧得发亮，说起话来双手总像捧着一团火。",
    martial: "教中粗浅把式，胜在不怕疼、不怕死。",
    desc: "五指山下的虔诚教徒，逢人便讲光明教义，讲到兴起处自己先红了眼眶。"
  },
  yinheXuetu: {
    id: "yinheXuetu",
    name: "尹贺学徒",
    title: "花讽院学徒",
    area: "binghuo",
    x: 760,
    walk: 40,
    color: "#9a8ab8",
    gender: "male",
    age: 19,
    looks: "束发的样式与中原不同，说话前总要先鞠半个躬，站起来时常常撞到东西。",
    martial: "忍术学了三年，隐身术没学会，藏起来的饭团倒是经常被找到。",
    desc: "花讽院的年轻学徒，东瀛话说得比中原话顺，正在努力学说中原话，努力得让人心疼。"
  }
};

const MOVE_POOL = [
  "落英掌", "清风剑", "断水刀", "碎玉拳", "游龙鞭", "撼山杖", "穿云指", "伏虎爪",
  "惊鸿步", "回风拂柳", "寒梅三弄", "孤雁回巢", "金蛇缠丝", "破军一击", "白鹤亮翅",
  "黑虎掏心", "灵猿摘果", "苍鹰扑兔", "野马分鬃", "云手三叠", "单鞭救主", "十字手",
  "玉女穿梭", "揽雀尾", "如封似闭", "抱虎归山", "手挥琵琶", "进步搬拦锤", "左蹬脚",
  "双峰贯耳", "闪通背", "海底针", "扇通背", "转身撇身捶", "高探马", "斜飞式",
  "金鸡独立", "倒卷肱", "青龙出水", "旋风扫叶", "燕子抄水", "夜叉探海", "罗汉撞钟",
  "韦陀献杵", "金刚伏魔", "拈花指", "大摔碑手", "小擒拿", "缠丝劲", "震山靠",
  "追风逐月", "踏雪无痕", "寒江独钓", "月下听箫", "竹影横斜", "一苇渡江", "袖里乾坤",
  "乾坤一掷", "无影脚", "碎星斩"
];

function hashNpcId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function npcMoves(npcId: string): string[] {
  const n = NPCS[npcId];
  if (n?.moves?.length) return n.moves;
  const h = hashNpcId(npcId);
  const a = MOVE_POOL[h % MOVE_POOL.length];
  const b = MOVE_POOL[Math.floor(h / 7) % MOVE_POOL.length];
  return a === b ? [a, MOVE_POOL[(h + 11) % MOVE_POOL.length]] : [a, b];
}

export function npcBelongings(npcId: string): string[] {
  return npcDrops(npcId)
    .slice(0, 3)
    .map((d) => ITEMS[d.item]?.name || d.item);
}

const FEMALE_NPC = new Set(["axiu", "tangWanCi", "liQingZhao", "funv"]);

// NPC 年龄/容貌缺省时每次加载必须一致：以 npcId 哈希为种子做确定性伪随机
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (const id of Object.keys(NPCS)) {
  const n = NPCS[id];
  const rand = mulberry32(hashSeed(id));
  n.gender = n.gender || (FEMALE_NPC.has(id) ? "female" : "male");
  n.age = n.age || (n.master ? 50 + Math.floor(rand() * 15) : n.learn || n.learnBasic ? 32 + Math.floor(rand() * 12) : 18 + Math.floor(rand() * 35));
  n.age = Math.max(18, n.age);
  n.looks =
    n.looks ||
    (n.gender === "female"
      ? "眉眼清秀，举止娴静；虽不施脂粉，站在那里却自有一番风致。"
      : "相貌平平，不过眉宇间有一股说不清的江湖气，像是走过许多路的人。");
  n.martial =
    n.martial ||
    (n.master
      ? "一派掌门，武功深不可测。"
      : n.learn || n.learnBasic
        ? "身怀武艺，寻常人近不得身。"
    : "看不出深浅，或许深藏不露。");
}

const LOW_DROPS: { item: string; chance: number }[] = [
  { item: "mantou", chance: 45 },
  { item: "jingcha", chance: 35 },
  { item: "yaocai", chance: 25 }
];

const MID_DROPS: { item: string; chance: number }[] = [
  { item: "jinchuang", chance: 45 },
  { item: "huichun", chance: 20 },
  { item: "tiekuang", chance: 25 },
  { item: "pijia", chance: 10 }
];

const HIGH_DROPS: { item: string; chance: number }[] = [
  { item: "daHuan", chance: 22 },
  { item: "huichun", chance: 55 },
  { item: "xuantie", chance: 35 },
  { item: "jinSuoZi", chance: 12 },
  { item: "heiyanZhao", chance: 20 }
];

// 显式随身物品：符合各自身份；未列出的 NPC 按身份兜底生成
const NPC_DROPS: Record<string, { item: string; chance: number }[]> = {
  axiu: [
    { item: "shanChaHua", chance: 70 },
    { item: "jingcha", chance: 25 }
  ],
  xiaoer: [
    { item: "baozi", chance: 55 },
    { item: "huangjiu", chance: 40 },
    { item: "mantou", chance: 30 }
  ],
  liZhenWei: [
    { item: "jinchuang", chance: 50 },
    { item: "mudao", chance: 20 },
    { item: "pijia", chance: 15 }
  ],
  guYanWu: [
    { item: "maobi", chance: 60 },
    { item: "shouChaoBen", chance: 30 }
  ],
  tiejiang: [
    { item: "tiekuang", chance: 60 },
    { item: "xuantie", chance: 25 },
    { item: "tiejian", chance: 10 }
  ],
  pingYiZhi: [
    { item: "huichun", chance: 50 },
    { item: "jieDu", chance: 45 },
    { item: "daHuan", chance: 15 }
  ],
  xiucai: [
    { item: "maobi", chance: 60 },
    { item: "shouChaoBen", chance: 35 }
  ],
  xunbu: [
    { item: "jinchuang", chance: 40 },
    { item: "jingcha", chance: 30 },
    { item: "mafeng", chance: 20 }
  ],
  xianling: [
    { item: "jingcha", chance: 50 },
    { item: "maobi", chance: 30 },
    { item: "jinchuang", chance: 20 }
  ],
  cunzhang: [
    { item: "yaocai", chance: 45 },
    { item: "mantou", chance: 35 },
    { item: "jingcha", chance: 25 }
  ],
  popo: [
    { item: "mantou", chance: 55 },
    { item: "yaocai", chance: 25 }
  ],
  funv: [
    { item: "maobi", chance: 45 },
    { item: "mantou", chance: 30 },
    { item: "jingcha", chance: 20 }
  ],
  huoji: [
    { item: "mantou", chance: 45 },
    { item: "mafeng", chance: 30 },
    { item: "huangjiu", chance: 25 }
  ],
  heiren: [
    { item: "shouChaoBen", chance: 40 },
    { item: "heiyanZhao", chance: 25 },
    { item: "jinchuang", chance: 30 }
  ],
  yuexia: [
    { item: "jingcha", chance: 50 },
    { item: "shanChaHua", chance: 25 }
  ],
  shuoshu: [
    { item: "jingcha", chance: 50 },
    { item: "huangjiu", chance: 30 }
  ],
  tiaofu: [
    { item: "mantou", chance: 50 },
    { item: "baozi", chance: 35 }
  ],
  xiaoqigai: [
    { item: "mantou", chance: 60 },
    { item: "baozi", chance: 20 }
  ],
  langzhong: [
    { item: "jieDu", chance: 50 },
    { item: "jinchuang", chance: 45 },
    { item: "huichun", chance: 25 }
  ],
  chapeng: [
    { item: "qingcha", chance: 55 },
    { item: "mantou", chance: 35 },
    { item: "huangjiu", chance: 25 }
  ],
  xingjiao: [
    { item: "shiliao", chance: 45 },
    { item: "mafeng", chance: 30 },
    { item: "jinchuang", chance: 30 }
  ],
  luopo: [
    { item: "huangjiu", chance: 40 },
    { item: "mudao", chance: 20 },
    { item: "jinchuang", chance: 30 }
  ],
  taohun: [
    { item: "shanChaHua", chance: 35 },
    { item: "mantou", chance: 30 }
  ],
  shoumu: [
    { item: "shiliao", chance: 55 },
    { item: "mantou", chance: 30 }
  ],
  daotong: [
    { item: "yaocai", chance: 55 },
    { item: "mantou", chance: 30 }
  ],
  gaibangDizi: [
    { item: "mantou", chance: 55 },
    { item: "baozi", chance: 30 }
  ],
  xueshanDizi: [
    { item: "jinchuang", chance: 40 },
    { item: "jingcha", chance: 25 }
  ],
  huajianShinv: [
    { item: "shanChaHua", chance: 50 },
    { item: "jingcha", chance: 25 }
  ],
  honglianJiaotu: [
    { item: "mantou", chance: 40 },
    { item: "jinchuang", chance: 25 },
    { item: "jieDu", chance: 20 }
  ],
  yinheXuetu: [
    { item: "jingcha", chance: 40 },
    { item: "mantou", chance: 30 }
  ],
  gusong: [
    { item: "jinchuang", chance: 45 },
    { item: "maobi", chance: 25 },
    { item: "shouChaoBen", chance: 20 }
  ],
  cangyue: [
    { item: "jingcha", chance: 40 },
    { item: "maobi", chance: 25 }
  ],
  shangJianMing: [
    { item: "jinchuang", chance: 50 },
    { item: "huangjiu", chance: 30 },
    { item: "pijia", chance: 15 }
  ],
  xuewei: [
    { item: "jinchuang", chance: 45 },
    { item: "jingcha", chance: 25 }
  ],
  langren: [
    { item: "huangjiu", chance: 40 },
    { item: "jinchuang", chance: 30 }
  ],
  xiangzhu: [
    { item: "jinchuang", chance: 40 },
    { item: "jieDu", chance: 25 }
  ],
  zhanglao: [
    { item: "mantou", chance: 45 },
    { item: "baozi", chance: 30 },
    { item: "jinchuang", chance: 20 }
  ],
  qingXu: [
    { item: "daHuan", chance: 28 },
    { item: "huichun", chance: 55 },
    { item: "xuantie", chance: 40 },
    { item: "jinSuoZi", chance: 15 },
    { item: "heiyanZhao", chance: 20 }
  ],
  wangWeiYang: [
    { item: "daHuan", chance: 28 },
    { item: "huichun", chance: 55 },
    { item: "xuantie", chance: 40 },
    { item: "jinSuoZi", chance: 15 },
    { item: "heiyanZhao", chance: 20 }
  ],
  baiRuiDe: [
    { item: "daHuan", chance: 30 },
    { item: "huichun", chance: 55 },
    { item: "xuantie", chance: 40 },
    { item: "qingfeng", chance: 15 },
    { item: "heiyanZhao", chance: 20 }
  ],
  liQingZhao: [
    { item: "daHuan", chance: 30 },
    { item: "huichun", chance: 55 },
    { item: "xuantie", chance: 40 },
    { item: "sahuaXie", chance: 15 },
    { item: "heiyanZhao", chance: 20 }
  ],
  heZhongYang: [
    { item: "daHuan", chance: 30 },
    { item: "huichun", chance: 55 },
    { item: "xuantie", chance: 40 },
    { item: "ruanbian", chance: 15 },
    { item: "heiyanZhao", chance: 20 }
  ],
  yuHongRu: [
    { item: "daHuan", chance: 30 },
    { item: "huichun", chance: 55 },
    { item: "xuantie", chance: 40 },
    { item: "jinSuoZi", chance: 15 },
    { item: "heiyanZhao", chance: 20 }
  ],
  qiaoSiHai: [
    { item: "daHuan", chance: 30 },
    { item: "huichun", chance: 55 },
    { item: "dagouBang", chance: 10 },
    { item: "heiyanZhao", chance: 20 }
  ]
};

export function npcDrops(npcId: string): { item: string; chance: number }[] {
  const explicit = NPC_DROPS[npcId];
  if (explicit) return explicit;
  const n = NPCS[npcId];
  if (!n) return LOW_DROPS;
  if (n.master) return HIGH_DROPS;
  if (n.shop?.length) {
    return n.shop
      .slice(0, 4)
      .map((item, i) => ({ item, chance: Math.max(15, 50 - i * 10) }));
  }
  if (n.learn || n.learnBasic) return MID_DROPS;
  return LOW_DROPS;
}

export function npcDef(id: string): NpcDef {
  const def = NPCS[id];
  if (!def) throw new Error("未知NPC: " + id);
  return def;
}
