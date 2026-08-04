import type { AreaDef, RoomDef } from "./types";

export const AREAS: Record<string, AreaDef> = {
  town: {
    id: "town",
    name: "平安镇",
    width: 3450,
    theme: "town",
    desc: "中原偏西的一座小镇，依山傍水，牌坊上的「平安」二字已经漆落了大半。镇上的人各怀心事，却都照常过日子。",
    npcs: ["laozhe", "axiu", "yuexia", "heiren", "tiaofu", "xiaoqigai", "shuoshu", "langzhong"],
    fixedEnemies: [{ enemy: "zhouSan", x: 1560, walk: 90 }],
    buildings: [
      { id: "gate", name: "镇口牌坊", x: 70, w: 180, kind: "gate" },
      { id: "inn", name: "悦来客栈", x: 430, w: 170, kind: "inn", doorX: 510, room: "inn" },
      { id: "hall", name: "振威武馆", x: 760, w: 180, kind: "hall", doorX: 850, room: "hall" },
      { id: "smith", name: "张记铁匠铺", x: 1090, w: 150, kind: "smith", doorX: 1165, room: "smith" },
      { id: "drug", name: "回春药铺", x: 1390, w: 150, kind: "drug", doorX: 1465, room: "drug" },
      { id: "study", name: "明德书院", x: 1680, w: 180, kind: "study", doorX: 1770, room: "study" },
      { id: "yamen", name: "县衙", x: 1990, w: 180, kind: "yamen", doorX: 2080, room: "yamen" },
      { id: "cunzhang", name: "村长家", x: 2300, w: 140, kind: "home", doorX: 2370, room: "cunzhangHome" },
      { id: "popo", name: "老婆婆家", x: 2540, w: 140, kind: "home", doorX: 2610, room: "popoHome" },
      { id: "funv", name: "马大哈家", x: 2780, w: 140, kind: "home", doorX: 2850, room: "funvHome" },
      { id: "zahuo", name: "杂货铺", x: 3010, w: 140, kind: "shop", doorX: 3080, room: "zahuo" },
      { id: "houshan", name: "后山入口", x: 3250, w: 160, kind: "hill", doorX: 3330 }
    ],
    exits: [
      { x: 10, w: 90, area: "wudang", label: "西行武当山" },
      { x: 3250, w: 100, area: "houshan", label: "北入后山" },
      { x: 3380, w: 60, area: "shangjia", label: "东去商家堡" }
    ],
    interactables: [
      { x: 240, w: 60, label: "镇口老井", action: "well" },
      { x: 330, w: 70, label: "歪脖树", action: "tree" },
      { x: 150, w: 80, label: "出镇告示", action: "sign" }
    ]
  },
  wudang: {
    id: "wudang",
    name: "武当山",
    width: 1500,
    theme: "mountain",
    desc: "山道曲折，松柏苍翠。三清观藏在云雾之间，晨钟暮鼓，声传十里。",
    npcs: ["gusong", "cangyue", "daotong"],
    buildings: [
      { id: "sanqing", name: "三清观", x: 430, w: 260, kind: "shrine", doorX: 560, room: "sanqing" },
      { id: "taohua", name: "桃花源小筑", x: 1050, w: 180, kind: "home", doorX: 1140, room: "taohua" }
    ],
    exits: [{ x: 10, w: 90, area: "town", label: "东归平安镇" }],
    interactables: [{ x: 700, w: 80, label: "山间石碑", action: "shrine" }]
  },
  shangjia: {
    id: "shangjia",
    name: "商家堡",
    width: 1300,
    theme: "town",
    desc: "商家堡依河而建，堡墙高耸，门外刀枪架子排了两排，肃杀之气扑面而来。",
    npcs: ["shangJianMing"],
    buildings: [{ id: "shangjiaHall", name: "商家堡正厅", x: 500, w: 260, kind: "hall", doorX: 630, room: "shangjiaHall" }],
    exits: [
      { x: 10, w: 90, area: "town", label: "西归平安镇" },
      { x: 1210, w: 90, area: "guandao", label: "东去官道" }
    ]
  },
  guandao: {
    id: "guandao",
    name: "官道",
    width: 2400,
    theme: "mountain",
    desc: "一条黄土官道贯穿东西，车辙里嵌着往年的落叶。道旁茶棚热气腾腾，路碑上的字被风雨磨得只剩半边。",
    npcs: ["chapeng", "luopo", "xingjiao", "taohun"],
    buildings: [{ id: "chapeng", name: "路边茶棚", x: 980, w: 150, kind: "shop" }],
    exits: [
      { x: 10, w: 90, area: "shangjia", label: "西回商家堡" },
      { x: 640, w: 90, area: "lianhua", label: "北上莲花山" },
      { x: 1500, w: 90, area: "baihua", label: "南入百花谷" },
      { x: 1900, w: 90, area: "dukou", label: "东南下渡口" },
      { x: 2300, w: 90, area: "wuzhi", label: "东往五指山" }
    ],
    interactables: [{ x: 1200, w: 70, label: "官道路牌", action: "sign" }]
  },
  houshan: {
    id: "houshan",
    name: "后山",
    width: 2100,
    theme: "forest",
    desc: "平安镇后的荒山。山路越走越深，林木遮天，鸟兽绝迹之后，便是黑风寨的地界。",
    npcs: ["liehu"],
    fixedEnemies: [
      { enemy: "yezhu", x: 280, walk: 130 },
      { enemy: "elang", x: 680, walk: 110 },
      { enemy: "jianjing", x: 1080, walk: 90 },
      { enemy: "dushe", x: 1420, walk: 60 },
      { enemy: "shanzei", x: 1560, walk: 60 }
    ],
    exits: [
      { x: 10, w: 90, area: "town", label: "南归平安镇" },
      { x: 1700, w: 90, area: "shiku", label: "东北山隙·无名石窟" },
      { x: 1840, w: 90, area: "heifeng", label: "西北密林·黑风寨" },
      { x: 2010, w: 90, area: "xueshan", label: "北往大雪山" }
    ],
    interactables: [
      { x: 900, w: 80, label: "废弃矿洞", action: "mine" },
      { x: 1350, w: 80, label: "药草丛", action: "herb" }
    ]
  },
  shiku: {
    id: "shiku",
    name: "无名石窟",
    width: 1600,
    theme: "cave",
    desc: "后山深处的无名石窟，钟乳垂垂，滴水声在黑暗里一圈圈荡开。传说有高人曾在此避世，石壁上还留着半阙残词。",
    npcs: ["shoumu"],
    exits: [{ x: 10, w: 90, area: "houshan", label: "洞口天光·回后山" }],
    interactables: [
      { x: 480, w: 80, label: "废弃矿脉", action: "mine" },
      { x: 880, w: 80, label: "阴生药草", action: "herb" },
      { x: 1420, w: 110, label: "深不见底的裂缝", action: "crack" }
    ]
  },
  xueshan: {
    id: "xueshan",
    name: "大雪山",
    width: 1500,
    theme: "snow",
    desc: "千里冰封，万木披素。凌霄城矗立在雪线之上，梅树环城而植，花开如血。",
    npcs: ["xuewei", "xueshanDizi"],
    fixedEnemies: [{ enemy: "xueLang", x: 700, walk: 120 }],
    buildings: [{ id: "lingxiao", name: "凌霄城", x: 600, w: 260, kind: "hall", doorX: 730, room: "lingxiao" }],
    exits: [{ x: 10, w: 90, area: "houshan", label: "南归后山" }]
  },
  baihua: {
    id: "baihua",
    name: "百花谷",
    width: 1400,
    theme: "forest",
    desc: "谷中百花掩映，溪水潺潺。玉女峰上散花亭，年年落花，岁岁有人。",
    npcs: ["tangWanCi", "huaPopo", "huajianShinv"],
    buildings: [{ id: "sanhua", name: "散花亭", x: 520, w: 240, kind: "shrine", doorX: 640, room: "sanhua" }],
    exits: [{ x: 1300, w: 90, area: "guandao", label: "北出谷口·上官道" }],
    interactables: [{ x: 950, w: 80, label: "花丛", action: "herb" }]
  },
  dukou: {
    id: "dukou",
    name: "渡口",
    width: 1200,
    theme: "island",
    desc: "芦苇荡里的小小渡口，木船系在石上，缆绳被海水浸得发亮。船夫说，过了这片海，便是冰火两重天的地界。",
    npcs: ["chuanFu"],
    exits: [
      { x: 10, w: 90, area: "guandao", label: "上岸·西回官道" },
      { x: 1100, w: 90, area: "binghuo", label: "摆渡·冰火岛" }
    ],
    interactables: [{ x: 560, w: 80, label: "渡口石碑", action: "sign" }]
  },
  binghuo: {
    id: "binghuo",
    name: "冰火岛",
    width: 1400,
    theme: "island",
    desc: "岛上一半冰雪，一半熔岩。风雪与硫磺之气交汇，是东瀛武者远渡重洋后的落脚之处。",
    npcs: ["langren", "yinheXuetu"],
    fixedEnemies: [{ enemy: "xueLang", x: 300, walk: 100 }],
    buildings: [{ id: "renguan", name: "花讽院", x: 560, w: 240, kind: "hall", doorX: 680, room: "renguan" }],
    exits: [{ x: 10, w: 90, area: "dukou", label: "渡口·摆渡归岸" }]
  },
  wuzhi: {
    id: "wuzhi",
    name: "五指山",
    width: 1500,
    theme: "mountain",
    desc: "五座山峰如五指张开，红莲总坛藏在掌心般的山谷中，教众依岩穴而居，日夜燃着灯火。",
    npcs: ["xiangzhu", "honglianJiaotu"],
    buildings: [{ id: "honglianTang", name: "红莲总坛", x: 580, w: 260, kind: "shrine", doorX: 710, room: "honglianTang" }],
    exits: [{ x: 10, w: 90, area: "guandao", label: "西下官道" }]
  },
  lianhua: {
    id: "lianhua",
    name: "莲花山",
    width: 1400,
    theme: "mountain",
    desc: "莲花山山势如莲，丐帮总舵就设在半山腰的破庙里。庙虽破，香火却旺，天下的叫花子都认得这条路。",
    npcs: ["zhanglao", "gaibangDizi"],
    buildings: [{ id: "gaibangTang", name: "莲花山总舵", x: 540, w: 240, kind: "hall", doorX: 660, room: "gaibangTang" }],
    exits: [{ x: 10, w: 90, area: "guandao", label: "南归官道" }]
  },
  heifeng: {
    id: "heifeng",
    name: "黑风寨",
    width: 1700,
    theme: "dark",
    desc: "黑风寨依峭壁而建，木栅与铁蒺藜层层叠叠。寨中的汉子杀人放火，也养猪种菜——日子总归是要过的。",
    fixedEnemies: [
      { enemy: "shanzei", x: 320, walk: 100 },
      { enemy: "zhaiTou", x: 760, walk: 90 },
      { enemy: "qingLongJingWei", x: 1180, walk: 70 }
    ],
    buildings: [{ id: "juyi", name: "聚义厅", x: 1280, w: 240, kind: "hall", doorX: 1400, room: "juyi" }],
    exits: [{ x: 10, w: 90, area: "houshan", label: "密林之外·后山" }]
  },
  end: {
    id: "end",
    name: "时空尽头",
    width: 1600,
    theme: "dark",
    desc: "六块石板在虚空中旋转、拼合，世界忽然安静下来。前方没有路，只有一面巨大的、映不出人影的镜子。",
    exits: [{ x: 1500, w: 90, area: "town", label: "返回平安镇" }],
    interactables: [{ x: 600, w: 240, label: "巨大的铜镜", action: "shrine" }]
  }
};

export const ROOMS: Record<string, RoomDef> = {
  inn: {
    id: "inn",
    name: "悦来客栈",
    width: 900,
    theme: "inn",
    npcs: ["xiaoer"],
    exits: [{ x: 820, w: 80, area: "town", label: "出门" }],
    interactables: [
      { x: 120, w: 90, label: "柜台·食宿", action: "rest" },
      { x: 320, w: 90, label: "客房", action: "rest" }
    ]
  },
  hall: {
    id: "hall",
    name: "振威武馆",
    width: 900,
    theme: "hall",
    npcs: ["liZhenWei", "guYanWu"],
    exits: [{ x: 820, w: 80, area: "town", label: "出门" }],
    interactables: [{ x: 430, w: 110, label: "木人桩", action: "meditate" }]
  },
  smith: {
    id: "smith",
    name: "张记铁匠铺",
    width: 900,
    theme: "smith",
    npcs: ["tiejiang"],
    exits: [{ x: 820, w: 80, area: "town", label: "出门" }],
    interactables: [{ x: 300, w: 120, label: "铁砧", action: "desk" }]
  },
  drug: {
    id: "drug",
    name: "回春药铺",
    width: 900,
    theme: "drug",
    npcs: ["pingYiZhi"],
    exits: [{ x: 820, w: 80, area: "town", label: "出门" }]
  },
  study: {
    id: "study",
    name: "明德书院",
    width: 900,
    theme: "study",
    npcs: ["xiucai"],
    exits: [{ x: 820, w: 80, area: "town", label: "出门" }],
    interactables: [{ x: 220, w: 130, label: "书架", action: "desk" }]
  },
  yamen: {
    id: "yamen",
    name: "县衙",
    width: 900,
    theme: "yamen",
    npcs: ["xunbu", "xianling"],
    exits: [{ x: 820, w: 80, area: "town", label: "出门" }]
  },
  cunzhangHome: {
    id: "cunzhangHome",
    name: "村长家",
    width: 900,
    theme: "home",
    npcs: ["cunzhang"],
    exits: [{ x: 820, w: 80, area: "town", label: "出门" }]
  },
  popoHome: {
    id: "popoHome",
    name: "老婆婆家",
    width: 900,
    theme: "home",
    npcs: ["popo"],
    exits: [{ x: 820, w: 80, area: "town", label: "出门" }],
    interactables: [
      { x: 180, w: 90, label: "水缸", action: "well" },
      { x: 360, w: 90, label: "柴堆", action: "desk" },
      { x: 540, w: 90, label: "院子", action: "meditate" }
    ]
  },
  funvHome: {
    id: "funvHome",
    name: "马大哈家",
    width: 900,
    theme: "home",
    npcs: ["funv"],
    exits: [{ x: 820, w: 80, area: "town", label: "出门" }],
    interactables: [{ x: 260, w: 120, label: "杂物箱", action: "chest" }]
  },
  zahuo: {
    id: "zahuo",
    name: "杂货铺",
    width: 900,
    theme: "shop",
    npcs: ["huoji"],
    exits: [{ x: 820, w: 80, area: "town", label: "出门" }]
  },
  sanqing: {
    id: "sanqing",
    name: "三清观",
    width: 900,
    theme: "shrine",
    npcs: ["qingXu"],
    exits: [{ x: 820, w: 80, area: "wudang", label: "出门" }]
  },
  shangjiaHall: {
    id: "shangjiaHall",
    name: "商家堡正厅",
    width: 900,
    theme: "hall",
    npcs: ["wangWeiYang"],
    exits: [{ x: 820, w: 80, area: "shangjia", label: "出门" }]
  },
  lingxiao: {
    id: "lingxiao",
    name: "凌霄城",
    width: 900,
    theme: "shrine",
    npcs: ["baiRuiDe"],
    exits: [{ x: 820, w: 80, area: "xueshan", label: "出门" }]
  },
  sanhua: {
    id: "sanhua",
    name: "散花亭",
    width: 900,
    theme: "shrine",
    npcs: ["liQingZhao", "tangWanCi"],
    exits: [{ x: 820, w: 80, area: "baihua", label: "出门" }]
  },
  renguan: {
    id: "renguan",
    name: "花讽院",
    width: 900,
    theme: "hall",
    npcs: ["heZhongYang"],
    exits: [{ x: 820, w: 80, area: "binghuo", label: "出门" }]
  },
  honglianTang: {
    id: "honglianTang",
    name: "红莲总坛",
    width: 900,
    theme: "shrine",
    npcs: ["yuHongRu"],
    exits: [{ x: 820, w: 80, area: "wuzhi", label: "出门" }]
  },
  gaibangTang: {
    id: "gaibangTang",
    name: "莲花山总舵",
    width: 900,
    theme: "hall",
    npcs: ["qiaoSiHai", "zhanglao"],
    exits: [{ x: 820, w: 80, area: "lianhua", label: "出门" }]
  },
  taohua: {
    id: "taohua",
    name: "桃花源小筑",
    width: 900,
    theme: "home",
    exits: [{ x: 820, w: 80, area: "wudang", label: "出门" }],
    interactables: [
      { x: 170, w: 120, label: "卧榻", action: "house-rest" },
      { x: 400, w: 120, label: "存物柜", action: "chest" }
    ]
  },
  juyi: {
    id: "juyi",
    name: "聚义厅",
    width: 900,
    theme: "hall",
    npcs: ["lengTieYi"],
    exits: [{ x: 820, w: 80, area: "heifeng", label: "出门" }],
    interactables: [{ x: 300, w: 140, label: "寨主宝座", action: "desk" }]
  }
};

export function areaDef(id: string): AreaDef {
  const def = AREAS[id];
  if (!def) throw new Error("未知区域: " + id);
  return def;
}

export function roomDef(id: string): RoomDef {
  const def = ROOMS[id];
  if (!def) throw new Error("未知房间: " + id);
  return def;
}
