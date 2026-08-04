import type { SectDef } from "./types";

export const SECTS: Record<string, SectDef> = {
  taiji: {
    id: "taiji",
    name: "太极门",
    location: "武当山三清观",
    master: "清虚道长",
    color: "#8fb4e8",
    intro:
      "太极与少林并称武林泰山北斗，功夫讲究阴阳调和、以静制动、后发制人。太极三年不伤人，伤人便是一击必中。",
    skills: ["taiJiQuan", "xuanXuDao", "taiJiJian", "taiJiShenGong", "wanLiuGuiYi"],
    lightness: "wanLiuGuiYi",
    basicReq: { skill: "jibenNeiGong", lv: 10 },
    plate: true
  },
  bagua: {
    id: "bagua",
    name: "八卦门",
    location: "平安镇东商家堡",
    master: "王维扬",
    color: "#d9a05b",
    intro:
      "八卦门自伏羲六十四卦演化而来，走圈转掌、直步横行，刚柔相济，上手容易，威力极强，实是拜师首选。",
    skills: ["baGuaYouShenZhang", "baGuaDao", "baZhenBaGuaZhang", "hunTianQiGong", "youLongShenFa"],
    lightness: "youLongShenFa",
    basicReq: { skill: "jibenQuan", lv: 10 },
    plate: true
  },
  xueshan: {
    id: "xueshan",
    name: "雪山剑派",
    location: "大雪山凌霄城",
    master: "威德先生白瑞德",
    color: "#cfe7f5",
    intro:
      "立派于西北大雪山，剑法精妙独步西域，剑式错落，攻击极强，招招抢攻，以求速战速决。",
    skills: ["ruMenShiSanShi", "xueShanJianFa", "xueYingQinNaShou", "xueShanNeiGong", "taXueWuHen"],
    lightness: "taXueWuHen",
    attrReq: [{ k: "min", v: 22 }],
    basicReq: { skill: "jibenJian", lv: 10 },
    plate: true
  },
  huajian: {
    id: "huajian",
    name: "花间派",
    location: "百花谷玉女峰",
    master: "千庵居士李青照",
    color: "#e79bb5",
    intro:
      "武林中声名赫赫的女儿门派，招式曼妙，于轻歌曼舞顾盼间伤人于无形。只收女徒，收徒极严。",
    gender: "female",
    skills: ["yiJianMeiHuaShou", "liuYeDaoFa", "huaTuanBianFa", "sanHuaJuDing", "feiDieShenFa", "zhuYanShu"],
    lightness: "feiDieShenFa",
    basicReq: { skill: "duShu", lv: 10 },
    plate: true
  },
  yinhe: {
    id: "yinhe",
    name: "尹贺谷",
    location: "平安镇东冰火岛",
    master: "花讽院主和仲阳",
    color: "#c08fd9",
    intro:
      "武功源自东瀛扶桑，奇幻诡变，忍术匪夷所思。招式狠辣有余，防御不足，以诡异补之。",
    skills: ["wuFaQuan", "chuanFengYiDaoLiu", "fuSangRenShu", "wuYingDunXing"],
    lightness: "wuYingDunXing",
    attrReq: [{ k: "li", v: 20 }],
    basicReq: { skill: "jibenQuan", lv: 10 },
    plate: true
  },
  honglian: {
    id: "honglian",
    name: "红莲教",
    location: "五指山",
    master: "教主余鸿儒",
    color: "#e06a5d",
    intro:
      "行事隐秘却以扶危济困为宗旨，崇尚光明，邪不压正。功夫力大招沉，威力极大，防御却弱。",
    skills: ["taiZuChangQuan", "luanPiFengZhangFa", "hongLianJiaoYi", "puTianTongJi", "heXiangShenFa"],
    lightness: "heXiangShenFa",
    attrReq: [{ k: "li", v: 22 }],
    moralMin: 10,
    basicReq: { skill: "jibenNeiGong", lv: 10 },
    plate: true
  },
  gaibang: {
    id: "gaibang",
    name: "丐帮",
    location: "莲花山",
    master: "帮主乔四海",
    color: "#d3a869",
    intro:
      "天下第一大帮，弟子百万，一棒一袋，义薄云天。入帮须先立仁义之志，道德有亏者不收。",
    skills: ["xiangLongShiBaZhang", "daGouGunFa", "hunTianGong", "siFangYou"],
    lightness: "siFangYou",
    moralMin: 20,
    basicReq: { skill: "jibenQuan", lv: 20 },
    plate: false
  }
};

export const PLATE_SECTS = ["taiji", "bagua", "xueshan", "huajian", "yinhe", "honglian"];
