import { MAX_PLAYER_EXP } from "./progression-limits";
import { SAVE_FORMAT, SAVE_VERSION } from "./save-constants";
import type { SceneActorState } from "./scene-event";
import { freshTaskState, type TaskState } from "./task-system";
import {
  normalizeGeneratedQuest,
  normalizeGeneratedQuestHistory,
} from "./generated-task-system";
import { originalTables } from "./original-data";
import { effectiveLevel } from "./skill-system";
import {
  getOriginalMap,
  hasOriginalMap,
  originalStart,
  type WorldPosition,
} from "./original-world";
import {
  normalizeTriangleStoneList,
  resizeTriangleStoneList,
  TRIANGLE_STONE_ITEM_ID,
} from "./triangle-stone";

export { LOCAL_SAVE_KEY, SAVE_FORMAT, SAVE_VERSION } from "./save-constants";

// 导入信任边界：存档 JSON 明确允许玩家查看和手改后再导入(README 承诺)，
// 因此每个数值字段都必须按游戏规则夹取——非有限数回落默认值，防止 NaN
// 经公式传染后损毁存档；越界数值按作弊系统同一套上限收口。
const finiteInt = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
};
const clampField = (value: unknown, min: number, max: number, fallback = min) =>
  Math.min(max, Math.max(min, finiteInt(value, fallback)));
// 任务里的 NPC 引用只允许 0(无)、-1(已完成)或真实人物编号。
const sanitizeNpcRef = (value: unknown) => {
  const id = finiteInt(value);
  return id === -1 || id === 0
    ? id
    : id > 0 && originalTables.enemies[id]
      ? id
      : 0;
};

function normalizeSkillTable(value: unknown): SceneActorState["skills"] {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const skills: SceneActorState["skills"] = {};
  for (const [raw, entry] of Object.entries(source)) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0 || !originalTables.kungfus[id]) continue;
    const record =
      entry && typeof entry === "object" ? (entry as { level?: unknown; points?: unknown }) : {};
    skills[String(id)] = {
      level: clampField(record.level, 0, 255),
      points: clampField(record.points, 0, 1_000_000_000),
    };
  }
  return skills;
}

export type WorldSave = {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  savedAt: string;
  position: WorldPosition;
  flags: Record<string, boolean>;
  variables: Record<string, number>;
  actor: SceneActorState;
  tasks: TaskState;
  [key: string]: unknown;
};

type LegacySave = Partial<Omit<WorldSave, "actor" | "position">> & {
  actor?: Partial<SceneActorState>;
  position?: Partial<WorldPosition>;
  [key: string]: unknown;
};

export const newActor = (): SceneActorState => ({
  name: "江湖少侠",
  inventory: {},
  gold: 100,
  hp: 100,
  maxHp: 100,
  fp: 0,
  maxFp: 0,
  food: 100,
  water: 100,
  exp: 0,
  potential: 100,
  morals: 128,
  tanId: 0,
  teacherId: 0,
  classId: 0,
  gender: 0,
  face: 20,
  mp: 0,
  maxMp: 0,
  age: 14,
  baseBon: 20,
  baseInt: 20,
  baseAgi: 20,
  baseStr: 20,
  bon: 20,
  int: 20,
  agi: 20,
  str: 20,
  luck: 20,
  skills: {},
  weaponId: 0,
  armorIds: [],
  skillUse: [0, 0, 0, 0, 0, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
  donateTimes: 0,
  killList: [],
  stoneList: [],
  badmanKill: 0,
  taskKill: 0,
  killNum: 0,
  dance: 100,
  ball: 100,
  swordBattle: false,
  swordName: "",
  swordType: -1,
  sword1: 0,
  sword2: 0,
  sword3: 0,
  swordTimes: 0,
  swords: Array.from({ length: 4 }, () => ({
    forged: false,
    name: "",
    atk: 0,
    mid: 0,
    suf: 0,
    times: 0,
  })),
  forgeChallengeStep: 0,
  haveNewHome: false,
  roomLevel: 0,
  jiajuList: [0, 0, 0, 0, 0],
});

export const fresh = (): WorldSave => ({
  format: SAVE_FORMAT,
  version: SAVE_VERSION,
  savedAt: "",
  position: { ...originalStart },
  flags: {},
  variables: {},
  actor: newActor(),
  tasks: freshTaskState(),
});

export function normalize(value: unknown): WorldSave {
  const source = (value && typeof value === "object" ? value : {}) as LegacySave;
  const oldActor = source.actor || {};
  const oldTasks = (source.tasks || {}) as Partial<TaskState>;
  const swords = [...(oldActor.swords || [])];
  const inventory = { ...(oldActor.inventory || {}) };
  const legacyTriangleStoneCount = inventory[`1:${TRIANGLE_STONE_ITEM_ID}`];
  delete inventory[`1:${TRIANGLE_STONE_ITEM_ID}`];

  if (
    swords.length === 0 &&
    typeof oldActor.swordType === "number" &&
    oldActor.swordType >= 0 &&
    oldActor.swordType < 4 &&
    oldActor.swordName
  ) {
    for (let type = 0; type < 4; type += 1) {
      swords.push(
        type === oldActor.swordType
          ? {
              forged: true,
              name: String(oldActor.swordName),
              atk: Number(oldActor.sword1 || 0),
              mid: Number(oldActor.sword2 || 0),
              suf: Number(oldActor.sword3 || 0),
              times: Number(oldActor.swordTimes || 0),
            }
          : { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
      );
    }
    const target = `2:${31 + oldActor.swordType}`;
    if (inventory["2:31"]) {
      inventory[target] = Math.max(1, inventory[target] || 0);
      delete inventory["2:31"];
    }
  }
  while (swords.length < 4)
    swords.push({ forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 });
  // v4 的流星飞掷曾可能只删除自制武器的 inventory 入口；实体仍在
  // swords 时自动补回，避免玩家无法装备或重铸。
  for (let type = 0; type < 4; type += 1)
    if (swords[type]?.forged) {
      const key = `2:${31 + type}`;
      inventory[key] = Math.max(1, inventory[key] || 0);
    }

  const requestedMapId = Number(source.position?.mapId);
  const mapId = hasOriginalMap(requestedMapId) ? requestedMapId : originalStart.mapId;
  const map = getOriginalMap(mapId);
  const x = Math.max(0, Math.min(map.width - 1, Number(source.position?.x ?? originalStart.x) || 0));
  const y = Math.max(0, Math.min(map.height - 1, Number(source.position?.y ?? originalStart.y) || 0));
  const direction = [2, 4, 6, 8].includes(Number(source.position?.direction))
    ? Number(source.position?.direction)
    : 2;

  const skills = normalizeSkillTable((oldActor as Partial<SceneActorState>).skills);
  const base = { ...newActor(), ...(oldActor as Partial<SceneActorState>), skills };
  const validTriangleStoneList = normalizeTriangleStoneList(base.stoneList);
  const stoneList = resizeTriangleStoneList(
    validTriangleStoneList,
    Math.max(
      validTriangleStoneList.length,
      finiteInt(legacyTriangleStoneCount),
    ),
  );
  const baseStr = clampField(base.baseStr, 1, 30, 20);
  const baseAgi = clampField(base.baseAgi, 1, 30, 20);
  const baseInt = clampField(base.baseInt, 1, 30, 20);
  const baseBon = clampField(base.baseBon, 1, 30, 20);
  const age = clampField(base.age, 1, 255, 14);
  const maxFp = clampField(base.maxFp, 0, 65535);
  const maxMp = clampField(base.maxMp, 0, 65535);
  // 气血上限的规则可达极值：内力 65535/4 + 年龄项 + 易筋经加成，留足余量。
  const maxHp = clampField(base.maxHp, 1, 20_000, 100);
  const skillUse = [...(base.skillUse || []), 0, 0, 0, 0, 0, 0, 0]
    .slice(0, 7)
    .map((id) =>
      Number.isInteger(id) && id >= 0 && originalTables.kungfus[id] ? id : 0,
    );
  const armorIds = Array.from(
    new Set(
      (Array.isArray(base.armorIds) ? base.armorIds : [])
        .map((id) => Number(id))
        .filter(
          (id) => Number.isInteger(id) && id > 0 && Boolean(originalTables.armors[id]),
        ),
    ),
  );
  const weaponId =
    Number.isInteger(base.weaponId) &&
    base.weaponId > 0 &&
    originalTables.weapons[base.weaponId]
      ? base.weaponId
      : 0;
  // 加力/法点沿用战斗边界的口径：不超过对应内功/法术有效等级的一半。
  const fpPlusCap = Math.floor(effectiveLevel({ ...base, skillUse }, skillUse[3] || 1) / 2);
  const mpPlusCap = Math.floor(effectiveLevel({ ...base, skillUse }, skillUse[5] || 8) / 2);

  const flags: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(
    (source.flags && typeof source.flags === "object" ? source.flags : {}) as Record<string, unknown>,
  ))
    flags[key.slice(0, 64)] = Boolean(value);
  const variables: Record<string, number> = {};
  for (const [key, value] of Object.entries(
    (source.variables && typeof source.variables === "object" ? source.variables : {}) as Record<string, unknown>,
  )) {
    const num = Number(value);
    if (Number.isFinite(num)) variables[key.slice(0, 64)] = Math.floor(num);
  }

  return {
    ...source,
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: typeof source.savedAt === "string" ? source.savedAt : "",
    position: { mapId, x, y, direction },
    actor: {
      ...base,
      name: String(base.name || "江湖少侠").slice(0, 24),
      gold: clampField(base.gold, 0, 4_294_967_295, 100),
      hp: clampField(base.hp, 0, maxHp, maxHp),
      maxHp,
      fp: clampField(base.fp, 0, maxFp),
      maxFp,
      mp: clampField(base.mp, 0, maxMp),
      maxMp,
      food: clampField(base.food, 0, (baseStr + 5) * 15, 100),
      water: clampField(base.water, 0, (baseStr + 4) * 15, 100),
      exp: clampField(base.exp, 0, MAX_PLAYER_EXP),
      potential: clampField(base.potential, 0, 4_294_967_295, 100),
      morals: clampField(base.morals, 0, 255, 128),
      face: clampField(base.face, 0, 255, 20),
      luck: clampField(base.luck, 0, 255, 20),
      age,
      tanId: clampField(base.tanId, 0, 9),
      classId: clampField(base.classId, 0, 9),
      teacherId: Math.max(0, finiteInt(base.teacherId)),
      gender: clampField(base.gender, 0, 1),
      baseStr,
      str: baseStr,
      baseAgi,
      agi: baseAgi,
      baseInt,
      int: baseInt,
      baseBon,
      bon: baseBon,
      fpPlus: clampField(base.fpPlus, 0, fpPlusCap),
      mpPlus: clampField(base.mpPlus, 0, mpPlusCap),
      xue6: Boolean(base.xue6),
      donateTimes: clampField(base.donateTimes, 0, 65_535),
      killList: Array.from(
        new Set(
          (Array.isArray(base.killList) ? base.killList : [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0),
        ),
      ),
      stoneList,
      badmanKill: clampField(base.badmanKill, 0, 65_535),
      taskKill: clampField(base.taskKill, 0, 65_535),
      killNum: clampField(base.killNum, 0, 10),
      dance: clampField(base.dance, 0, 65_535, 100),
      ball: clampField(base.ball, 0, 65_535, 100),
      swordBattle: Boolean(base.swordBattle),
      swordName: String(base.swordName || "").slice(0, 60),
      swordType: clampField(base.swordType, -1, 3, -1),
      sword1: clampField(base.sword1, 0, 65_535),
      sword2: clampField(base.sword2, 0, 65_535),
      sword3: clampField(base.sword3, 0, 65_535),
      swordTimes: clampField(base.swordTimes, 0, 65_535),
      inventory,
      weaponId,
      armorIds,
      skillUse,
      swords: swords.slice(0, 4),
      forgeChallengeStep: clampField(base.forgeChallengeStep, 0, 4),
      haveNewHome: Boolean(base.haveNewHome),
      roomLevel: clampField(base.roomLevel, 0, 3),
      jiajuList: [0, 1, 2, 3, 4].map((index) =>
        clampField((base.jiajuList || [])[index], 0, 65_535),
      ),
    },
    flags,
    variables,
    tasks: {
      ...freshTaskState(),
      ...oldTasks,
      clock: Math.max(0, finiteInt(oldTasks.clock)),
      freeWork: clampField(oldTasks.freeWork, 0, 3),
      visitId: sanitizeNpcRef(oldTasks.visitId),
      killId: sanitizeNpcRef(oldTasks.killId),
      visitDeadline: Math.max(0, finiteInt(oldTasks.visitDeadline)),
      visitReward: clampField(oldTasks.visitReward, 0, 1_000_000_000),
      findId: sanitizeNpcRef(oldTasks.findId),
      findType: Math.max(0, finiteInt(oldTasks.findType)),
      findDeadline: Math.max(0, finiteInt(oldTasks.findDeadline)),
      findReward: clampField(oldTasks.findReward, 0, 1_000_000_000),
      killDeadline: Math.max(0, finiteInt(oldTasks.killDeadline)),
      killReward: clampField(oldTasks.killReward, 0, 1_000_000_000),
      finishFlag: Boolean(oldTasks.finishFlag),
      guReward: clampField(oldTasks.guReward, 0, 1_000_000_000),
      wantedPlace: Math.max(0, finiteInt(oldTasks.wantedPlace)),
      wantedStarted: clampField(oldTasks.wantedStarted, -1e9, 1e9, -300),
      wantedReward: clampField(oldTasks.wantedReward, 0, 1_000_000_000),
      wantedCount: clampField(oldTasks.wantedCount, 0, 65_535),
      wantedTurn: Math.max(1, finiteInt(oldTasks.wantedTurn, 1)),
      wantedX: Math.max(0, finiteInt(oldTasks.wantedX)),
      wantedY: Math.max(0, finiteInt(oldTasks.wantedY)),
      wantedGender: clampField(oldTasks.wantedGender, 0, 1),
      wantedClass: clampField(oldTasks.wantedClass, 0, 9, 1),
      wantedLevel: clampField(oldTasks.wantedLevel, 1, 50, 1),
      wantedPercent: clampField(oldTasks.wantedPercent, 1, 10_000, 80),
      stoneStarted: Boolean(oldTasks.stoneStarted),
      stoneStartedAt: clampField(oldTasks.stoneStartedAt, -1e9, 1e9, -180),
      generatedQuestNextOfferAt: Math.max(0, finiteInt(oldTasks.generatedQuestNextOfferAt)),
      generatedQuestSerial: Math.max(0, finiteInt(oldTasks.generatedQuestSerial)),
      generatedQuestOfferMisses: Math.max(
        0,
        Math.floor(Number(oldTasks.generatedQuestOfferMisses || 0)),
      ),
      generatedQuestHistory: normalizeGeneratedQuestHistory(
        oldTasks.generatedQuestHistory,
      ),
      generatedQuest:
        oldTasks.generatedQuest && typeof oldTasks.generatedQuest === "object"
          ? normalizeGeneratedQuest(oldTasks.generatedQuest)
          : null,
    },
  };
}

export type SaveParseResult =
  | { ok: true; value: WorldSave }
  | { ok: false; error: string };

export function parseSave(value: unknown): SaveParseResult {
  if (!value || typeof value !== "object")
    return { ok: false, error: "存档不是有效对象" };
  const source = value as LegacySave;
  if (source.format !== SAVE_FORMAT)
    return { ok: false, error: "存档格式不匹配" };
  const version = Number(source.version);
  // 只拒绝"更新的版本"：更高版本可能包含本程序无法理解的新字段，
  // 静默降级导入会丢数据；低于当前版本才走 normalize 迁移。
  if (Number.isFinite(version) && version > SAVE_VERSION)
    return {
      ok: false,
      error: `存档版本(${version})比当前程序(${SAVE_VERSION})更新，请先升级游戏再导入`,
    };
  const mapId = Number(source.position?.mapId);
  if (!Number.isInteger(mapId) || !hasOriginalMap(mapId))
    return { ok: false, error: "存档地图编号无效" };
  if (!source.actor || typeof source.actor !== "object")
    return { ok: false, error: "存档缺少人物数据" };
  return { ok: true, value: normalize(source) };
}
