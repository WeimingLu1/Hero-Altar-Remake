import {
  originalTables,
  originalSystem,
  originalTasks,
  originalText,
  type OriginalRecord,
} from "./original-data";

export type SceneEventCall = { type: number; id?: number; extra?: number };
export type SceneActorState = {
  name?: string;
  inventory: Record<string, number>;
  gold: number;
  hp: number;
  maxHp: number;
  fp: number;
  maxFp: number;
  food: number;
  water: number;
  exp: number;
  potential: number;
  morals: number;
  tanId: number;
  teacherId: number;
  classId: number;
  gender: number;
  face: number;
  mp: number;
  maxMp: number;
  age: number;
  baseBon: number;
  baseInt: number;
  baseAgi: number;
  baseStr: number;
  bon: number;
  int: number;
  agi: number;
  str: number;
  luck: number;
  skills: Record<string, { level: number; points: number }>;
  weaponId: number;
  armorIds: number[];
  skillUse: number[];
  fpPlus: number;
  mpPlus: number;
  xue6: boolean;
  playTime?: number;
  killList?: number[];
  badmanKill?: number;
  taskKill?: number;
  killNum?: number;
  roomLevel?: number;
  dance?: number;
  ball?: number;
  swordBattle?: boolean;
  swordName?: string;
  swordType?: number;
  sword1?: number;
  sword2?: number;
  sword3?: number;
  swordTimes?: number;
  forgeChallengeStep?: number;
  haveNewHome?: boolean;
  jiajuList?: number[];
  stoneList?: number[];
};
export type SceneResolution = {
  lines: string[];
  gain?: { kind: 1 | 2 | 3; id: number; amount: number };
  transfer?: { mapId: number; x: number; y: number };
  hpDelta?: number;
  waterDelta?: number;
  consume?: { kind: 1 | 2 | 3; id: number; amount: number };
  playTimeDelta?: number;
  battleEnemyId?: number;
  tag: string;
};

const asRecord = (value: unknown) => (value || {}) as Record<string, unknown>;
const asLines = (value: unknown) =>
  Array.isArray(value)
    ? value.map(String)
    : value == null
      ? []
      : [String(value)];
const nameAt = (table: Array<OriginalRecord | null>, id: number) =>
  String(table[id]?.name || `编号 ${id}`);
const deterministic = (lines: string[], seed: number) =>
  lines.length ? lines[Math.abs(seed) % lines.length] : "……";

export function resolveSceneEvent(
  call: SceneEventCall,
  actor: SceneActorState,
  seed = 0,
): SceneResolution {
  const id = call.id || 0,
    type = call.type;
  if (type === 0) {
    const enemy = originalTables.enemies[id],
      name = String(enemy?.name || "江湖中人");
    const special = asRecord(originalText.sp_talk_text)[String(id)];
    const pool = asLines(special ?? originalText.normal_talk);
    return {
      lines: [deterministic(pool, seed).replaceAll("name", name)],
      tag: `npc:${id}`,
    };
  }
  if (type >= 1 && type <= 3) {
    const table =
      type === 1
        ? originalTables.items
        : type === 2
          ? originalTables.weapons
          : originalTables.armors;
    const itemName = nameAt(table, id),
      template = String(originalText.find_item_text || "发现name。").replace(
        "name",
        itemName,
      );
    return {
      lines: [template],
      gain: { kind: type, id, amount: Math.max(1, call.extra || 1) },
      tag: `gain:${type}:${id}`,
    };
  }
  if (type === 4) {
    const hasRod = actor.armorIds.some(
      (armorId) => Number(originalTables.armors[armorId]?.kind || 0) === 6,
    );
    if (!hasRod)
      return {
        lines: [asLines(originalText.fish_no_item)[0] || "你没有装备钓竿。"],
        tag: "fish:no-rod",
      };
    if (actor.hp <= 40)
      return {
        lines: [String(originalText.fish_no_hp || "你太疲倦，已经无力钓鱼。")],
        tag: "fish:tired",
      };
    if (Math.abs(seed) % 100 >= 50)
      return {
        lines: [
          String(originalText.start_fish || "你抛下了鱼线。"),
          String(originalText.fish_fail || "等了许久，鱼儿没有上钩。"),
        ],
        hpDelta: -40,
        tag: "fish:miss",
      };
    if ((actor.inventory["1:18"] || 0) <= 0)
      return {
        lines: [
          String(originalText.start_fish || "你抛下了鱼线。"),
          asLines(originalText.fish_suc)[0] || "鱼儿上钩了！",
          asLines(originalText.fish_no_item)[1] || "可惜你没有鱼篓。",
        ],
        hpDelta: -40,
        tag: "fish:no-basket",
      };
    return {
      lines: [
        String(originalText.start_fish || "你抛下了鱼线。"),
        ...asLines(originalText.fish_suc),
      ],
      hpDelta: -40,
      gain: { kind: 1, id: 17, amount: 1 },
      tag: "fish:catch",
    };
  }
  if (type === 5) {
    const maximum = (actor.baseStr + 4) * 15;
    return actor.water >= maximum
      ? {
          lines: [String(originalText.not_drink_text || "你现在并不口渴。")],
          tag: "drink-water:full",
        }
      : {
          lines: [String(originalText.drink_water_text || "你喝了些水。")],
          waterDelta: 20,
          tag: "drink-water",
        };
  }
  if (type === 6)
    return {
      lines: [String(originalText.play_what_text || "想玩些什么？")],
      tag: "game-hall",
    };
  if (type === 7) {
    const poems = (originalText.work_text as unknown[][]) || [];
    return {
      lines: asLines(poems[Math.max(0, id - 1)] || originalText.give_work_text),
      tag: `work:${id}`,
    };
  }
  if (type === 8) {
    const boss =
      actor.morals >= 160
        ? 196
        : actor.morals < 100 && (actor.killList || []).includes(125)
          ? 197
          : 195;
    return {
      lines: asLines(
        (originalText.boss_text as unknown[][])?.[boss - 195] ||
          "杀气骤然逼近！",
      ).filter((_, i) => i % 2 === 1),
      battleEnemyId: boss,
      tag: `boss:${boss}`,
    };
  }
  if (type === 9)
    return {
      lines: [String(originalText.wanted_text || "告示牌上贴着最新的通缉令。")],
      tag: "wanted",
    };
  if (type === 10)
    return {
      lines: [String(originalText.suicide_ask || "你当真不想活了？")],
      tag: "suicide",
    };
  if (type === 11)
    return (actor.inventory["1:16"] || 0) > 0
      ? {
          lines: [String(originalText.drink_wine_text || "你喝下一杯酒。")],
          consume: { kind: 1, id: 16, amount: 1 },
          playTimeDelta: 10800,
          tag: "drink-wine",
        }
      : { lines: ["你身上没有女儿红。"], tag: "drink-wine:none" };
  if (type === 12)
    return { lines: ["联机对战入口已切换为浏览器房间协议。"], tag: "network" };
  if (type === 13) {
    const routes = asRecord(originalTasks.tan_map_xy)[String(id)] as
        unknown[][] | undefined,
      xy = routes?.[Math.max(0, call.extra || 0)];
    if (xy)
      return {
        lines: [String(originalText.tan_start || "你踏入坛中。")],
        transfer: { mapId: id, x: Number(xy[0]), y: Number(xy[1]) },
        tag: `tan:${id}`,
      };
  }
  if (type === 14)
    return {
      lines: [String(originalText.sword_ask || "是否开始铸剑？")],
      tag: "forge",
    };
  if (type === 15)
    return {
      lines: [String(originalText.new_home_ask || "山路深处似乎另有天地。")],
      tag: "new-home",
    };
  if (type === 16) {
    const homes = (originalSystem.home_position as number[][]) || [],
      home =
        homes[
          Math.max(0, Math.min(homes.length - 1, (actor.roomLevel || 1) - 1))
        ];
    return {
      lines: asLines(originalText.welcome_home),
      transfer: home
        ? { mapId: Number(home[0]), x: Number(home[1]), y: Number(home[2]) }
        : undefined,
      tag: "enter-home",
    };
  }
  void actor;
  return { lines: [`未识别的原版事件类型：${type}`], tag: `unknown:${type}` };
}

export function applySceneResolution(
  actor: SceneActorState,
  resolution: SceneResolution,
) {
  if (resolution.gain) {
    const key = `${resolution.gain.kind}:${resolution.gain.id}`;
    actor.inventory[key] = (actor.inventory[key] || 0) + resolution.gain.amount;
  }
  if (resolution.consume) {
    const key = `${resolution.consume.kind}:${resolution.consume.id}`;
    actor.inventory[key] = Math.max(
      0,
      (actor.inventory[key] || 0) - resolution.consume.amount,
    );
    if (actor.inventory[key] === 0) delete actor.inventory[key];
  }
  actor.hp = Math.max(
    0,
    Math.min(actor.maxHp, actor.hp + (resolution.hpDelta || 0)),
  );
  actor.water = Math.min(
    (actor.baseStr + 4) * 15,
    actor.water + (resolution.waterDelta || 0),
  );
  actor.playTime = (actor.playTime || 0) + (resolution.playTimeDelta || 0);
  return actor;
}
