import { MAX_PLAYER_EXP } from "./progression-limits";
import { SAVE_FORMAT, SAVE_VERSION } from "./save-constants";
import type { SceneActorState } from "./scene-event";
import { freshTaskState, type TaskState } from "./task-system";
import {
  getOriginalMap,
  hasOriginalMap,
  originalStart,
  type WorldPosition,
} from "./original-world";

export { LOCAL_SAVE_KEY, SAVE_FORMAT, SAVE_VERSION } from "./save-constants";

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
  const swords = [...(oldActor.swords || [])];
  const inventory = { ...(oldActor.inventory || {}) };

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

  const requestedMapId = Number(source.position?.mapId);
  const mapId = hasOriginalMap(requestedMapId) ? requestedMapId : originalStart.mapId;
  const map = getOriginalMap(mapId);
  const x = Math.max(0, Math.min(map.width - 1, Number(source.position?.x ?? originalStart.x) || 0));
  const y = Math.max(0, Math.min(map.height - 1, Number(source.position?.y ?? originalStart.y) || 0));
  const direction = [2, 4, 6, 8].includes(Number(source.position?.direction))
    ? Number(source.position?.direction)
    : 2;

  return {
    ...source,
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: typeof source.savedAt === "string" ? source.savedAt : "",
    position: { mapId, x, y, direction },
    actor: {
      ...newActor(),
      ...oldActor,
      skills: oldActor.skills || {},
      inventory,
      exp: Math.min(Number(oldActor.exp || 0), MAX_PLAYER_EXP),
      skillUse: [...(oldActor.skillUse || []), 0, 0, 0, 0, 0, 0, 0].slice(0, 7),
      swords: swords.slice(0, 4),
    },
    flags: (source.flags || {}) as Record<string, boolean>,
    variables: (source.variables || {}) as Record<string, number>,
    tasks: { ...freshTaskState(), ...(source.tasks || {}) },
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
  const mapId = Number(source.position?.mapId);
  if (!Number.isInteger(mapId) || !hasOriginalMap(mapId))
    return { ok: false, error: "存档地图编号无效" };
  if (!source.actor || typeof source.actor !== "object")
    return { ok: false, error: "存档缺少人物数据" };
  return { ok: true, value: normalize(source) };
}
