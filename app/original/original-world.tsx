"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  activePage,
  friendlyEventName,
  getOriginalMap,
  originalStart,
  tileAt,
  triggerEvent,
  type MapEvent,
  type WorldPosition,
} from "../game-core/original-world";
import {
  applySceneResolution,
  resolveSceneEvent,
  type SceneActorState,
} from "../game-core/scene-event";
import { executeMapCommands, selectSceneEvent } from "../game-core/rmxp-events";
import {
  originalSystem,
  originalTables,
  originalText,
} from "../game-core/original-data";
import {
  attemptJoin,
  bookStudyOptions,
  buyGood,
  canReadBook,
  npcOptionLabel,
  npcOptions,
  npcRecord,
  npcStatus,
  shopGoods,
  studyOnce,
  studyOptions,
  type NpcOption,
} from "../game-core/npc-system";
import {
  battleRound,
  beginOriginalBattle,
  endSpar,
  attemptEscape,
  specialRound,
  type OriginalBattle,
} from "../game-core/original-battle";
import {
  bagEntries,
  derivedStats,
  fullHp,
  maxFood,
  maxWater,
  activateEntry,
  activateBattleEntry,
  type BagEntry,
} from "../game-core/inventory-system";
import {
  effectiveLevel,
  equipSkill,
  learnedSkills,
  toggleParry,
} from "../game-core/skill-system";
import { battleSpecials } from "../game-core/special-system";
import { digestActor } from "../game-core/survival-system";
import {
  acceptFreeWork,
  acceptMainTask,
  acceptWantedTask,
  claimMainReward,
  completeHiddenQuest,
  finishFreeWork,
  finishMainTask,
  finishStoneTask,
  finishWantedTask,
  freshTaskState,
  giveTanReward,
  startStoneTask,
  startTanQuest,
  taskJournal,
  wantedEnemyRecord,
  type TaskState,
} from "../game-core/task-system";
import {
  cultivationAvailability,
  healWounds,
  meditateForce,
  meditateMagic,
  recoverHp,
  setForcePower,
  setMagicPower,
  practiceOnce,
  practiceOptions,
} from "../game-core/cultivation-system";
import {
  buyFurniture,
  clearFurniture,
  createSword,
  furnitureNames,
  reforgeSword,
  swordTypes,
  upgradeRoom,
} from "../game-core/life-system";
import { settleVictoryLoot } from "../game-core/battle-settlement";
import {
  adjustCheatSkill,
  adjustCheatStat,
  applyCheatQuick,
  cheatQuickOptions,
  cheatSkillRows,
  cheatStats,
  maxCheatSkill,
  maxCheatStat,
  type CheatQuickAction,
} from "../game-core/cheat-system";
import {
  actorStatusProfile,
  levelTier,
  levelTitle,
} from "../game-core/status-system";
import "./world.css";
import "./choice.css";
import "./battle.css";
import "./special.css";
import "./menu.css";

const W = 640,
  H = 480,
  T = 32;
type WorldSave = {
  format: "rmxp-hero-original-world-save";
  version: 1;
  savedAt: string;
  position: WorldPosition;
  flags: Record<string, boolean>;
  variables: Record<string, number>;
  actor: SceneActorState;
  tasks: TaskState;
};
type ArcadeState =
  | { kind: "select"; index: number }
  | { kind: "dance"; dir: number; count: number; score: number }
  | {
      kind: "ball";
      step: 1 | 2 | 3;
      x: number;
      dir: 1 | 2;
      score: number;
      fail: number;
      flight: number;
    };
type LifeState = { kind: "forge" | "home"; index: number };
type LaunchScreen = "title" | "intro" | "create" | "help" | "play";
type CreatorState = {
  step: 1 | 2;
  index: number;
  name: string;
  gender: number;
  attrs: [number, number, number, number];
};
const newActor = (): SceneActorState => ({
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
  skillUse: [0, 0, 0, 0, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
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
  forgeChallengeStep: 0,
  haveNewHome: false,
  roomLevel: 0,
  jiajuList: [0, 0, 0, 0, 0],
});
const fresh = (): WorldSave => ({
  format: "rmxp-hero-original-world-save",
  version: 1,
  savedAt: "",
  position: { ...originalStart },
  flags: {},
  variables: {},
  actor: newActor(),
  tasks: freshTaskState(),
});
const normalize = (value: WorldSave): WorldSave => ({
  ...value,
  actor: {
    ...newActor(),
    ...(value.actor || {}),
    skills: value.actor?.skills || {},
    inventory: value.actor?.inventory || {},
  },
  flags: value.flags || {},
  variables: value.variables || {},
  tasks: { ...freshTaskState(), ...(value.tasks || {}) },
});
const loadLocalSave = (): WorldSave => {
  try {
    const raw = localStorage.getItem("rmxp-original-world-v1");
    return raw ? normalize(JSON.parse(raw)) : fresh();
  } catch {
    return fresh();
  }
};
const seeded = (seed: number) => {
  let value = seed >>> 0;
  return (max: number) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return Math.floor((value / 4294967296) * Math.max(1, max));
  };
};

export default function OriginalWorld() {
  const [state, setState] = useState<WorldSave>(fresh),
    [notice, setNotice] = useState("原版地图数据已载入"),
    [eventText, setEventText] = useState("");
  const [screen, setScreen] = useState<LaunchScreen>("title");
  const [titleIndex, setTitleIndex] = useState(0);
  const [hasSave, setHasSave] = useState(false);
  const [creator, setCreator] = useState<CreatorState>({
    step: 1,
    index: 0,
    name: "",
    gender: 0,
    attrs: [20, 20, 20, 20],
  });
  const [npcMenu, setNpcMenu] = useState<{ id: number; index: number } | null>(
      null,
    ),
    [shop, setShop] = useState<{ id: number; index: number } | null>(null),
    [study, setStudy] = useState<{
      id: number;
      index: number;
      book?: boolean;
    } | null>(null);
  const [studyActive, setStudyActive] = useState(false);
  const [battle, setBattle] = useState<OriginalBattle | null>(null);
  const [battleOutcome, setBattleOutcome] = useState<number | null>(null);
  const [battleItem, setBattleItem] = useState<number | null>(null);
  const [specialMenu, setSpecialMenu] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ tab: number; index: number } | null>(null);
  const [cheatMenu, setCheatMenu] = useState<{
    tab: number;
    index: number;
  } | null>(null);
  const [cheatConfirm, setCheatConfirm] = useState<{
    action: CheatQuickAction;
    index: number;
  } | null>(null);
  const [itemConfirm, setItemConfirm] = useState<{
    entry: BagEntry;
    index: number;
  } | null>(null);
  const [cultivation, setCultivation] = useState<number | null>(null);
  const [cultivationActive, setCultivationActive] = useState(false);
  const [flyMenu, setFlyMenu] = useState<number | null>(null);
  const [caihua, setCaihua] = useState<{
    step: 1 | 2;
    index: number;
  } | null>(null);
  const [arcade, setArcade] = useState<ArcadeState | null>(null);
  const [life, setLife] = useState<LifeState | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    file = useRef<HTMLInputElement>(null),
    nameInput = useRef<HTMLInputElement>(null),
    stateRef = useRef<WorldSave>(state),
    keys = useRef(new Set<string>()),
    held = useRef<Record<string, number>>({});
  const sync = useCallback((next: WorldSave) => {
    stateRef.current = next;
    setState(structuredClone(next));
  }, []);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const exists = localStorage.getItem("rmxp-original-world-v1") !== null;
      setHasSave(exists);
      if (exists) sync(loadLocalSave());
    }, 0);
    return () => window.clearTimeout(id);
  }, [sync]);
  const save = useCallback(() => {
    const next = { ...stateRef.current, savedAt: new Date().toISOString() };
    sync(next);
    localStorage.setItem("rmxp-original-world-v1", JSON.stringify(next));
    setNotice("原版世界进度已保存");
  }, [sync]);
  const runAt = useCallback(
    (x: number, y: number, automatic = false) => {
      const s = stateRef.current,
        isWanted =
          s.tasks.wantedPlace === s.position.mapId &&
          s.tasks.wantedX === x &&
          s.tasks.wantedY === y,
        map = getOriginalMap(s.position.mapId),
        hook = triggerEvent(map, x, y);
      if (isWanted && !automatic) {
        setBattle(
          beginOriginalBattle(
            198,
            s.tasks.clock + x * 31 + y,
            wantedEnemyRecord(s.actor, s.tasks),
            "lethal",
          ),
        );
        return true;
      }
      if (!hook) return false;
      const { result, event, page } = hook;
      if (result.transfer) {
        const next = structuredClone(s);
        next.position = {
          mapId: result.transfer.mapId,
          x: result.transfer.x,
          y: result.transfer.y,
          direction: result.transfer.direction || s.position.direction,
        };
        sync(next);
        setNotice(`抵达 · ${getOriginalMap(next.position.mapId).name}`);
        return true;
      }
      const sceneCall = selectSceneEvent(result.source, {
        inventory: s.actor.inventory,
        tanId: s.actor.tanId,
        freeWork: s.tasks.freeWork,
        canGetItem: true,
        canGetCaihua: true,
      });
      if (sceneCall && !automatic) {
        if (sceneCall.type === 0 && sceneCall.id !== undefined) {
          setNpcMenu({ id: sceneCall.id, index: 0 });
          return true;
        }
        const next = structuredClone(s),
          resolution = resolveSceneEvent(
            sceneCall,
            next.actor,
            event.id + s.position.mapId,
          );
        if (sceneCall.type === 6) {
          setArcade({ kind: "select", index: 0 });
          return true;
        }
        if (sceneCall.type === 14) {
          if (!s.actor.swordBattle) {
            if (s.actor.exp < 150000) {
              setEventText("干匠\n你的江湖阅历还不足以接受铸剑挑战。");
              return true;
            }
            const nextForge = structuredClone(s),
              required = [8, 15, 25, 21];
            nextForge.actor.forgeChallengeStep = 0;
            nextForge.actor.inventory[`2:${required[0]}`] = 1;
            nextForge.actor.weaponId = required[0];
            sync(nextForge);
            setBattle(
              beginOriginalBattle(149, s.tasks.clock + 149, undefined, "story"),
            );
          } else setLife({ kind: "forge", index: 0 });
          return true;
        }
        if (sceneCall.type === 15) {
          if (s.actor.haveNewHome) {
            const nextHome = structuredClone(s);
            nextHome.position = { mapId: 57, x: 9, y: 13, direction: 8 };
            sync(nextHome);
          } else if (
            seeded(s.tasks.clock + s.actor.luck)(30 + s.actor.luck) >= 30
          )
            setBattle(
              beginOriginalBattle(162, s.tasks.clock + 162, undefined, "story"),
            );
          else setEventText("桃花源\n你在山路上失足跌落，只得休养后再来。 ");
          return true;
        }
        if (sceneCall.type === 7) {
          const work = finishFreeWork(
            next.actor,
            next.tasks,
            sceneCall.id || 0,
          );
          sync(next);
          setEventText(`${event.name || "义工"}\n${work.text}`);
          setNotice(work.ok ? "义工完成" : "义工未完成");
          return true;
        }
        applySceneResolution(next.actor, resolution);
        next.tasks.clock += resolution.playTimeDelta || 0;
        if (resolution.transfer)
          next.position = {
            ...resolution.transfer,
            direction: next.position.direction,
          };
        sync(next);
        if (resolution.battleEnemyId)
          setBattle(
            beginOriginalBattle(
              resolution.battleEnemyId,
              resolution.battleEnemyId + s.position.mapId,
              undefined,
              resolution.battleEnemyId >= 195 ? "story" : "lethal",
            ),
          );
        else
          setEventText(
            `${event.name || "地图事件"}\n${resolution.lines.join("\n")}`,
          );
        setNotice(`原版事件 · ${resolution.tag}`);
        return true;
      }
      if (!automatic && result.source && !sceneCall) {
        setNotice("尚未满足该事件的原版触发条件");
        return true;
      }
      return page.trigger > 0;
    },
    [sync],
  );
  const move = useCallback(
    (dx: number, dy: number) => {
      if (
        eventText ||
        npcMenu ||
        shop ||
        study ||
        battle ||
        menu ||
        caihua ||
        cultivation !== null ||
        arcade ||
        life
      )
        return;
      const s = structuredClone(stateRef.current),
        map = getOriginalMap(s.position.mapId);
      const direction = dx < 0 ? 4 : dx > 0 ? 6 : dy < 0 ? 8 : 2,
        nx = s.position.x + dx,
        ny = s.position.y + dy;
      s.position.direction = direction;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) {
        sync(s);
        return;
      }
      const blocking = map.events.find((e) => {
        const visual = eventVisual(e, s);
        return (
          e.x === nx &&
          e.y === ny &&
          visual.kind === "npc" &&
          !activePage(e).through
        );
      });
      const wantedBlocking =
        s.tasks.wantedPlace === s.position.mapId &&
        s.tasks.wantedX === nx &&
        s.tasks.wantedY === ny;
      if (!blocking && !wantedBlocking) {
        s.position.x = nx;
        s.position.y = ny;
        sync(s);
        runAt(nx, ny, true);
      } else sync(s);
    },
    [
      battle,
      caihua,
      cultivation,
      arcade,
      life,
      eventText,
      menu,
      npcMenu,
      runAt,
      shop,
      study,
      sync,
    ],
  );
  const interact = useCallback(() => {
    const s = stateRef.current,
      p = s.position,
      d =
        p.direction === 2
          ? [0, 1]
          : p.direction === 4
            ? [-1, 0]
            : p.direction === 6
              ? [1, 0]
              : [0, -1];
    const map = getOriginalMap(p.mapId),
      candidates = [
        [p.x + d[0], p.y + d[1]],
        [p.x, p.y],
        [p.x, p.y + 1],
        [p.x - 1, p.y],
        [p.x + 1, p.y],
        [p.x, p.y - 1],
      ],
      npc = candidates.find(([x, y]) => {
        const event = map.events.find((e) => e.x === x && e.y === y);
        return event && eventVisual(event, s).kind === "npc";
      }),
      interactive = candidates.find(([x, y]) => {
        const event = map.events.find((e) => e.x === x && e.y === y);
        const kind = event ? eventVisual(event, s).kind : "none";
        return event && kind !== "none" && kind !== "corpse";
      });
    if (npc) {
      runAt(npc[0], npc[1]);
      return;
    }
    if (interactive) {
      runAt(interactive[0], interactive[1]);
      return;
    }
    if (!runAt(p.x + d[0], p.y + d[1]))
      setNotice("靠近人物并按 E / Enter 互动");
  }, [runAt]);
  const chooseNpc = useCallback(
    (id: number, option: NpcOption) => {
      const next = structuredClone(stateRef.current);
      if (option === "talk") {
        const tasks = next.tasks,
          random = seeded(next.position.mapId + id + tasks.clock);
        if (tasks.visitId === id) {
          tasks.visitId = -1;
          sync(next);
          setEventText(`${npcRecord(id).name}\n拜访已经完成，回村长处复命吧。`);
          setNpcMenu(null);
          return;
        }
        if (id === 25) {
          const result = acceptFreeWork(next.actor, tasks, (max) =>
            Math.floor(Math.random() * Math.max(1, max)),
          );
          sync(next);
          setEventText(`${npcRecord(id).name}\n${result.text}`);
          setNpcMenu(null);
          return;
        }
        if (id === 14 || id === 15) {
          const result =
            id === 14
              ? startStoneTask(next.actor, tasks)
              : finishStoneTask(next.actor, tasks);
          sync(next);
          setEventText(`${npcRecord(id).name}\n${result.text}`);
          setNpcMenu(null);
          return;
        }
        if (id === 3) {
          const result = acceptWantedTask(next.actor, tasks, random);
          sync(next);
          setEventText(`${npcRecord(id).name}\n${result.text}`);
          setNpcMenu(null);
          return;
        }
        if (id === 6) {
          const altar = startTanQuest(next.actor);
          if (altar.ok) {
            sync(next);
            setEventText(`${npcRecord(id).name}\n${altar.text}`);
            setNpcMenu(null);
            return;
          }
        }
        const taskType = id === 6 ? 1 : id === 10 ? 2 : id === 26 ? 3 : 0;
        if (taskType) {
          let text = "";
          if (id === 26 && next.actor.morals >= 128)
            text = "你并非邪道中人，我这里没有适合你的杀人任务。";
          else if (tasks.finishFlag)
            text = "你已有任务奖励待领，先去找顾炎武。";
          else if (finishMainTask(next.actor, tasks, taskType as 1 | 2 | 3))
            text = "任务完成，去找顾炎武领取奖励。";
          else {
            const active =
              taskType === 1
                ? tasks.visitId
                : taskType === 2
                  ? tasks.findId
                  : tasks.killId;
            text = active
              ? `任务尚未完成：${taskType === 1 ? tasks.visitName : taskType === 2 ? tasks.findName : tasks.killName}。`
              : acceptMainTask(next.actor, tasks, taskType as 1 | 2 | 3, random)
                  .text;
          }
          sync(next);
          setEventText(`${npcRecord(id).name}\n${text}`);
          setNpcMenu(null);
          return;
        }
        if (id === 31 && tasks.finishFlag) {
          const result = claimMainReward(next.actor, tasks, random);
          sync(next);
          setEventText(`${npcRecord(id).name}\n${result.text}`);
          setNpcMenu(null);
          return;
        }
        const hidden = completeHiddenQuest(next.actor, id);
        if (hidden.ok || hidden.text) {
          sync(next);
          setEventText(`${npcRecord(id).name}\n${hidden.text}`);
          setNpcMenu(null);
          return;
        }
        if (id === 172 && next.actor.haveNewHome) {
          setLife({ kind: "home", index: 0 });
          setNpcMenu(null);
          return;
        }
        const r = resolveSceneEvent(
          { type: 0, id },
          next.actor,
          id + next.position.mapId,
        );
        setEventText(`${npcRecord(id).name}\n${r.lines.join("\n")}`);
      } else if (option === "status") setEventText(npcStatus(id).join("\n"));
      else if (option === "battle")
        setBattle(
          beginOriginalBattle(
            id,
            id + next.position.mapId,
            undefined,
            "lethal",
          ),
        );
      else if (option === "trade") setShop({ id, index: 0 });
      else if (option === "join") {
        const r = attemptJoin(id, next.actor);
        sync(next);
        setEventText(`${npcRecord(id).name}\n${r.text}`);
      } else setStudy({ id, index: 0 });
      setNpcMenu(null);
    },
    [sync],
  );
  const fight = useCallback(() => {
    if (!battle || battle.finished) return;
    const next = structuredClone(stateRef.current),
      round = battleRound(battle, next.actor);
    sync(next);
    setBattle(round);
  }, [battle, sync]);
  const fightSpecial = useCallback(
    (id?: number) => {
      if (!battle || !id) return;
      const next = structuredClone(stateRef.current),
        round = specialRound(battle, next.actor, id);
      sync(next);
      setBattle(round);
      setSpecialMenu(null);
    },
    [battle, sync],
  );
  const settleBattle = useCallback(
    (kill: boolean) => {
      if (!battle) return;
      const next = structuredClone(stateRef.current);
      let altarText = "",
        nextBattle: OriginalBattle | null = null;
      if (battle.finished === "win") {
        if (battle.mode === "lethal") {
          const loot = settleVictoryLoot(next.actor, battle.enemyId, kill);
          altarText = loot.text;
        }
        if (battle.enemyId === 149) {
          const required = [8, 15, 25, 21],
            step = next.actor.forgeChallengeStep || 0,
            requiredId = required[step],
            key = `2:${requiredId}`;
          if (next.actor.weaponId !== requiredId) {
            delete next.actor.inventory[key];
            next.actor.weaponId = 0;
            next.actor.forgeChallengeStep = 0;
            altarText = "兵器与本轮要求不符，铸剑挑战失败。";
          } else {
            delete next.actor.inventory[key];
            next.actor.weaponId = 0;
            if (step < required.length - 1) {
              const following = required[step + 1];
              next.actor.forgeChallengeStep = step + 1;
              next.actor.inventory[`2:${following}`] = 1;
              next.actor.weaponId = following;
              nextBattle = beginOriginalBattle(
                149,
                battle.seed + step + 1,
                undefined,
                "story",
              );
              altarText = `第 ${step + 1} 轮通过，换用指定兵器继续挑战。`;
            } else {
              next.actor.swordBattle = true;
              next.actor.forgeChallengeStep = 0;
              altarText = "四轮铸剑挑战全部通过，铸剑谷已经开放。";
            }
          }
        }
        if (battle.enemyId === 162) {
          next.actor.haveNewHome = true;
          next.actor.roomLevel = 1;
          next.actor.jiajuList = [0, 0, 0, 0, 0];
          altarText = "击败山大王，桃花源从此归你所有。";
        }
        if (kill && battle.enemyId === 198 && next.tasks.wantedPlace > 0) {
          altarText += ` ${finishWantedTask(next.actor, next.tasks).text}`;
        }
        if (kill && next.tasks.killId === battle.enemyId) {
          next.tasks.killId = -1;
          next.actor.taskKill = (next.actor.taskKill || 0) + 1;
          altarText += ` 杀手任务目标已经伏诛，累计完成 ${next.actor.taskKill} 次；回任务发布人处复命。`;
        }
        const altarId = battle.enemyId - 162;
        if (
          kill &&
          altarId === next.actor.tanId &&
          altarId >= 1 &&
          altarId <= 8
        ) {
          const mapKey = `1:${20 + altarId}`;
          if ((next.actor.inventory[mapKey] || 0) > 0) {
            next.actor.inventory[mapKey]--;
            if (next.actor.inventory[mapKey] <= 0)
              delete next.actor.inventory[mapKey];
          }
          next.actor.killList = Array.from(
            new Set([...(next.actor.killList || []), battle.enemyId]),
          );
          altarText += ` ${giveTanReward(next.actor).text}`;
        }
        if (kill) {
          const lines = (originalText.die_text as string[]) || [],
            lastWords = lines.length
              ? lines[Math.abs(battle.seed + battle.turn) % lines.length]
              : "对手倒在了你的刀下。";
          altarText = `「${lastWords}」 ${altarText}`;
        }
      }
      if (battle.enemyId === 149 && battle.finished !== "win") {
        for (const id of [8, 15, 25, 21])
          delete next.actor.inventory[`2:${id}`];
        next.actor.weaponId = 0;
        next.actor.forgeChallengeStep = 0;
      }
      if (
        battle.finished === "lose" &&
        battle.mode !== "spar" &&
        battle.enemyId !== 149
      ) {
        const enemyMorals = Number(
            (battle.enemyOverride || originalTables.enemies[battle.enemyId])
              ?.morals || 0,
          ),
          spared = next.actor.morals >= 128 && enemyMorals > 0;
        if (spared) {
          next.actor.hp = 1;
          sync(next);
          setBattle(null);
          setNotice(`${battle.enemyName}收手道：“承让了。”`);
        } else {
          sync(loadLocalSave());
          setBattle(null);
          setScreen("title");
          setNotice("你已身死，未保存的进度已经失去。 ");
        }
        setBattleOutcome(null);
        setBattleItem(null);
        setSpecialMenu(null);
        return;
      }
      endSpar(next.actor, battle);
      sync(next);
      setBattle(nextBattle);
      setBattleOutcome(null);
      setBattleItem(null);
      setSpecialMenu(null);
      setNotice(
        battle.finished === "win"
          ? altarText
            ? `${kill ? "战斗得胜" : "手下留情"} · ${altarText}`
            : kill
              ? "战斗得胜"
              : "手下留情"
          : battle.finished === "lose"
            ? battle.mode === "spar"
              ? "切磋结束，已恢复少量气血"
              : "挑战失败"
            : battle.mode === "spar"
              ? "你退出了切磋"
              : "你脱离了战斗",
      );
    },
    [battle, sync],
  );
  const leaveBattle = useCallback(() => {
    if (battle?.finished === "win" && battle.mode === "lethal") {
      setBattleOutcome(0);
      return;
    }
    settleBattle(false);
  }, [battle, settleBattle]);
  const fleeBattle = useCallback(() => {
    if (!battle || battle.finished) return;
    const next = structuredClone(stateRef.current),
      result = attemptEscape(battle, next.actor);
    sync(next);
    if (result.escaped) {
      setBattle(null);
      setNotice("成功脱离战斗");
    } else setBattle(result.battle);
  }, [battle, sync]);
  const consumeBattleItem = useCallback(
    (entry?: BagEntry) => {
      if (!entry) return;
      const next = structuredClone(stateRef.current),
        result = activateBattleEntry(next.actor, entry);
      sync(next);
      setNotice(result.text);
      if (result.ok) setBattleItem(null);
    },
    [sync],
  );
  const activateBagEntry = useCallback(
    (entry?: BagEntry) => {
      if (!entry) return;
      const next = structuredClone(stateRef.current),
        result = activateEntry(next.actor, entry);
      if ("bookId" in result && result.bookId) {
        if (result.bookId === 20 && next.actor.gender === 0) {
          setCaihua({ step: 1, index: 0 });
          sync(next);
          setMenu(null);
          return;
        }
        const readable = canReadBook(next.actor, result.bookId);
        if (readable.ok) setStudy({ id: result.bookId, index: 0, book: true });
        sync(next);
        setNotice(readable.text);
        setMenu(null);
        return;
      }
      sync(next);
      setNotice(result.text);
      const count = bagEntries(next.actor).length;
      setMenu((current) =>
        current
          ? {
              ...current,
              index: Math.min(current.index, Math.max(0, count - 1)),
            }
          : current,
      );
    },
    [sync],
  );
  const activateSkill = useCallback(
    (id?: number, parry = false) => {
      if (!id) return;
      const next = structuredClone(stateRef.current),
        result = parry
          ? toggleParry(next.actor, id)
          : equipSkill(next.actor, id);
      sync(next);
      setNotice(result.text);
    },
    [sync],
  );
  const buyAt = useCallback(
    (id: number, index: number) => {
      const good = shopGoods(id)[index];
      if (!good) return;
      const next = structuredClone(stateRef.current),
        r = buyGood(next.actor, good);
      sync(next);
      setNotice(r.text);
    },
    [sync],
  );
  const buySelected = useCallback(() => {
    if (shop) buyAt(shop.id, shop.index);
  }, [buyAt, shop]);
  const studyAt = useCallback(
    (id: number, index: number) => {
      const item = (study?.book ? bookStudyOptions(id) : studyOptions(id))[
        index
      ];
      if (!item) return undefined;
      const next = structuredClone(stateRef.current),
        r = studyOnce(next.actor, item.id, item.maxLevel);
      sync(next);
      setNotice(r.text);
      if (!r.ok || r.leveled) setStudyActive(false);
      return r;
    },
    [study?.book, sync],
  );
  const studySelected = useCallback(() => {
    if (study) studyAt(study.id, study.index);
  }, [study, studyAt]);
  const beginStudyAt = useCallback(
    (index: number) => {
      if (!study) return;
      setStudy({ ...study, index });
      const result = studyAt(study.id, index);
      setStudyActive(Boolean(result?.ok && !result.leveled));
    },
    [study, studyAt],
  );
  const cultivate = useCallback(
    (index: number) => {
      const next = structuredClone(stateRef.current);
      let text = "",
        keepGoing = true;
      if (index === 0) {
        const available = cultivationAvailability(next.actor, "meditate");
        if (!available.ok) {
          setNotice(available.text);
          return false;
        }
        const result = meditateForce(next.actor);
        text = !result.ok
          ? "尚未装备内功。"
          : result.capped
            ? "内力已达当前内功修为上限，已自动停止打坐。"
            : result.increased
              ? "打坐周天完成，内力上限提高一点。"
              : "你凝神打坐，内息渐长。";
        keepGoing = result.ok && !result.capped;
      } else if (index === 1) {
        const available = cultivationAvailability(next.actor, "magic");
        if (!available.ok) {
          setNotice(available.text);
          return false;
        }
        const result = meditateMagic(next.actor);
        text = !result.ok
          ? "尚未装备法术。"
          : result.capped
            ? "法力已达当前法术修为上限，已自动停止冥思。"
            : result.increased
              ? "冥思完成，法力上限提高一点。"
              : "你闭目冥思，法力渐长。";
        keepGoing = result.ok && !result.capped;
      } else if (index === 2) {
        const available = cultivationAvailability(next.actor, "recover");
        if (!available.ok) {
          setNotice(available.text);
          return false;
        }
        text = recoverHp(next.actor)
          ? "吸气调息，气血已经恢复。"
          : "当前无法吸气恢复。";
      } else if (index === 3) {
        const available = cultivationAvailability(next.actor, "heal");
        if (!available.ok) {
          setNotice(available.text);
          return false;
        }
        text = healWounds(next.actor)
          ? "运功疗伤，伤势有所恢复。"
          : "当前条件不足以疗伤。";
      } else if (index === 4) {
        const available = cultivationAvailability(next.actor, "force");
        if (!available.ok) {
          setNotice(available.text);
          return false;
        }
        text = `当前加力设为 ${setForcePower(next.actor, next.actor.fpPlus + 10)}。`;
      } else {
        const options = practiceOptions(next.actor);
        if (index >= 6) {
          const result = practiceOnce(next.actor, options[index - 6]?.id || 0);
          text = result.text;
          if (!result.ok) {
            setNotice(text);
            return false;
          }
        } else {
          const available = cultivationAvailability(next.actor, "spell");
          if (!available.ok) {
            setNotice(available.text);
            return false;
          }
          text = `当前法点设为 ${setMagicPower(next.actor, next.actor.mpPlus + 10)}。`;
        }
      }
      sync(next);
      setNotice(text);
      return keepGoing;
    },
    [sync],
  );
  const beginCultivation = useCallback(
    (index: number) => {
      setCultivation(index);
      if (index <= 1 || index >= 6) {
        setCultivationActive(cultivate(index));
      } else cultivate(index);
    },
    [cultivate],
  );
  const confirmBagAction = useCallback(
    (index: number) => {
      if (!itemConfirm) return;
      if (index === 0) activateBagEntry(itemConfirm.entry);
      setItemConfirm(null);
    },
    [activateBagEntry, itemConfirm],
  );
  const openFlyMenu = useCallback(() => {
    const current = stateRef.current,
      dodgeId = current.actor.skillUse[2] || 9,
      outside = (originalSystem.outside_map as number[] | undefined) || [];
    if (effectiveLevel(current.actor, dodgeId) < 30) {
      setNotice("轻功有效等级达到 30 级后才能施展轻功。 ");
      return;
    }
    if (!outside.includes(current.position.mapId)) {
      setNotice("原作只允许在室外施展轻功。 ");
      return;
    }
    if (current.actor.fp < 200) {
      setNotice("你内力不足，无法施展轻功。 ");
      return;
    }
    setFlyMenu(0);
  }, []);
  const flyTo = useCallback(
    (index: number) => {
      const target = ((originalSystem.fly_position as number[][] | undefined) ||
        [])[index];
      if (!target || stateRef.current.actor.fp < 200) {
        setFlyMenu(null);
        setNotice("你内力不足，无法施展轻功。 ");
        return;
      }
      const next = structuredClone(stateRef.current);
      next.actor.fp -= 200;
      next.position = {
        mapId: target[0],
        x: target[1],
        y: target[2],
        direction: target[3],
      };
      sync(next);
      setFlyMenu(null);
      setNotice(
        `施展轻功抵达${getOriginalMap(target[0]).name}，消耗 200 内力。`,
      );
    },
    [sync],
  );
  const beginCreation = useCallback(() => {
    setCreator({
      step: 1,
      index: 0,
      name: "",
      gender: 0,
      attrs: [20, 20, 20, 20],
    });
    setScreen("intro");
  }, []);
  const titleAction = useCallback(
    (index: number) => {
      if (index === 0) {
        if (hasSave) setScreen("play");
        else beginCreation();
      } else if (index === 1) beginCreation();
      else if (index === 2) file.current?.click();
      else setScreen("help");
    },
    [beginCreation, hasSave],
  );
  const finishCreation = useCallback(() => {
    const name = creator.name.trim(),
      total = creator.attrs.reduce((sum, value) => sum + value, 0),
      duplicate = originalTables.enemies.some(
        (record) => String(record?.name || "") === name,
      );
    if (!name || [...name].length > 8) {
      setNotice("姓名须为 1–8 个字符。 ");
      return;
    }
    if (duplicate) {
      setNotice("姓名与江湖人物重名，请重新输入。 ");
      return;
    }
    if (total !== 80) {
      setNotice(`四项先天属性之和必须正好为 80（当前 ${total}）。`);
      return;
    }
    const next = fresh(),
      [baseStr, baseAgi, baseInt, baseBon] = creator.attrs;
    next.actor = {
      ...newActor(),
      name,
      gender: creator.gender,
      baseStr,
      baseAgi,
      baseInt,
      baseBon,
      str: baseStr,
      agi: baseAgi,
      int: baseInt,
      bon: baseBon,
      face: Math.floor(Math.random() * 20) + 30 - baseStr,
      luck: Math.floor(Math.random() * 20) + 10,
      inventory: { "3:4": 1 },
    };
    next.savedAt = new Date().toISOString();
    sync(next);
    localStorage.setItem("rmxp-original-world-v1", JSON.stringify(next));
    setHasSave(true);
    setNotice(`${name}踏入江湖。`);
    setScreen("play");
  }, [creator, sync]);
  const rememberArcadeScore = useCallback(
    (kind: "dance" | "ball", score: number) => {
      const next = structuredClone(stateRef.current);
      next.actor[kind] = Math.max(next.actor[kind] || 100, score);
      sync(next);
    },
    [sync],
  );
  const useCheat = useCallback(
    (action: CheatQuickAction, confirmed = false) => {
      const option = cheatQuickOptions.find((item) => item.id === action);
      if (option?.dangerous && !confirmed) {
        setCheatConfirm({ action, index: 1 });
        return;
      }
      const next = structuredClone(stateRef.current),
        text = applyCheatQuick(next.actor, action);
      sync(next);
      setCheatConfirm(null);
      setNotice(`${text} 点击右上角“保存”可保存进度。`);
    },
    [sync],
  );
  const changeCheatStat = useCallback(
    (index: number, direction: -1 | 1) => {
      const next = structuredClone(stateRef.current),
        text = adjustCheatStat(next.actor, index, direction);
      sync(next);
      setNotice(`${text} 点击右上角“保存”可保存进度。`);
    },
    [sync],
  );
  const changeCheatSkill = useCallback(
    (index: number, direction: -1 | 1) => {
      const next = structuredClone(stateRef.current),
        row = cheatSkillRows(next.actor)[index];
      if (!row) return;
      const text = adjustCheatSkill(next.actor, row.id, direction);
      sync(next);
      setNotice(`${text} 点击右上角“保存”可保存进度。`);
    },
    [sync],
  );
  const maximizeCheatStat = useCallback(
    (index: number) => {
      const next = structuredClone(stateRef.current),
        text = maxCheatStat(next.actor, index);
      sync(next);
      setNotice(`${text} 点击右上角“保存”可保存进度。`);
    },
    [sync],
  );
  const maximizeCheatSkill = useCallback(
    (index: number) => {
      const next = structuredClone(stateRef.current),
        row = cheatSkillRows(next.actor)[index];
      if (!row) return;
      const text = maxCheatSkill(next.actor, row.id);
      sync(next);
      setNotice(`${text} 点击右上角“保存”可保存进度。`);
    },
    [sync],
  );
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (e.isComposing || e.keyCode === 229) return;
        if (
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.isContentEditable
        ) {
          if (e.key === "Escape") target.blur();
          return;
        }
        const k = e.key.toLowerCase();
        if (
          ["arrowup", "arrowdown", "arrowleft", "arrowright", "tab"].includes(k)
        )
          e.preventDefault();
        keys.current.add(k);
        const confirm = ["e", "enter"].includes(k),
          cancel = ["x", "escape"].includes(k);
        if (screen !== "play") {
          if (screen === "title") {
            if (k === "arrowup" || k === "w")
              setTitleIndex((titleIndex + 3) % 4);
            else if (k === "arrowdown" || k === "s")
              setTitleIndex((titleIndex + 1) % 4);
            else if (confirm) titleAction(titleIndex);
            return;
          }
          if (screen === "intro") {
            if (confirm || cancel) setScreen("create");
            return;
          }
          if (screen === "help") {
            if (confirm || cancel) setScreen("title");
            return;
          }
          if (creator.step === 1) {
            if (k === "arrowup" || k === "w")
              setCreator({ ...creator, index: (creator.index + 2) % 3 });
            else if (k === "arrowdown" || k === "s")
              setCreator({ ...creator, index: (creator.index + 1) % 3 });
            else if (
              creator.index === 0 &&
              ["arrowleft", "arrowright", "a", "d"].includes(k)
            )
              setCreator({ ...creator, gender: (creator.gender + 1) % 2 });
            else if (confirm && creator.index === 1) nameInput.current?.focus();
            else if (confirm && creator.index === 2) {
              if (!creator.name.trim()) setNotice("请先输入姓名。 ");
              else setCreator({ ...creator, step: 2, index: 0 });
            } else if (cancel) setScreen("title");
            return;
          }
          if (k === "arrowup" || k === "w")
            setCreator({ ...creator, index: (creator.index + 4) % 5 });
          else if (k === "arrowdown" || k === "s")
            setCreator({ ...creator, index: (creator.index + 1) % 5 });
          else if (
            creator.index < 4 &&
            ["arrowleft", "arrowright", "a", "d"].includes(k)
          ) {
            const attrs = [...creator.attrs] as CreatorState["attrs"],
              delta = ["arrowright", "d"].includes(k) ? 1 : -1,
              total = attrs.reduce((sum, value) => sum + value, 0),
              value = attrs[creator.index] + delta;
            if (value >= 10 && value <= 30 && (delta < 0 || total < 80)) {
              attrs[creator.index] = value;
              setCreator({ ...creator, attrs });
            }
          } else if (confirm && creator.index === 4) finishCreation();
          else if (cancel) setCreator({ ...creator, step: 1, index: 0 });
          return;
        }
        if (cheatConfirm) {
          if (["arrowup", "arrowdown", "w", "s"].includes(k))
            setCheatConfirm({
              ...cheatConfirm,
              index: (cheatConfirm.index + 1) % 2,
            });
          else if (confirm) {
            if (cheatConfirm.index === 0) useCheat(cheatConfirm.action, true);
            else setCheatConfirm(null);
          } else if (cancel) setCheatConfirm(null);
          return;
        }
        if (cheatMenu) {
          const skills = cheatSkillRows(stateRef.current.actor),
            length =
              cheatMenu.tab === 0
                ? cheatQuickOptions.length
                : cheatMenu.tab === 1
                  ? cheatStats.length
                  : Math.max(1, skills.length);
          if (k === "q")
            setCheatMenu({ tab: (cheatMenu.tab + 2) % 3, index: 0 });
          else if (k === "tab")
            setCheatMenu({ tab: (cheatMenu.tab + 1) % 3, index: 0 });
          else if (k === "arrowup" || k === "w")
            setCheatMenu({
              ...cheatMenu,
              index: (cheatMenu.index + length - 1) % length,
            });
          else if (k === "arrowdown" || k === "s")
            setCheatMenu({
              ...cheatMenu,
              index: (cheatMenu.index + 1) % length,
            });
          else if (["arrowleft", "a"].includes(k) && cheatMenu.tab === 1)
            changeCheatStat(cheatMenu.index, -1);
          else if (["arrowright", "d"].includes(k) && cheatMenu.tab === 1)
            changeCheatStat(cheatMenu.index, 1);
          else if (["arrowleft", "a"].includes(k) && cheatMenu.tab === 2)
            changeCheatSkill(cheatMenu.index, -1);
          else if (["arrowright", "d"].includes(k) && cheatMenu.tab === 2)
            changeCheatSkill(cheatMenu.index, 1);
          else if (confirm && cheatMenu.tab === 0)
            useCheat(cheatQuickOptions[cheatMenu.index].id);
          else if (confirm && cheatMenu.tab === 1)
            changeCheatStat(cheatMenu.index, 1);
          else if (confirm && cheatMenu.tab === 2)
            changeCheatSkill(cheatMenu.index, 1);
          else if (k === "m" && cheatMenu.tab === 1)
            maximizeCheatStat(cheatMenu.index);
          else if (k === "m" && cheatMenu.tab === 2)
            maximizeCheatSkill(cheatMenu.index);
          else if (cancel || k === "k") setCheatMenu(null);
          return;
        }
        if (life) {
          const length =
            life.kind === "forge"
              ? (stateRef.current.actor.swordType ?? -1) < 0
                ? 4
                : 2
              : 8;
          if (k === "arrowup" || k === "w")
            setLife({ ...life, index: (life.index + length - 1) % length });
          else if (k === "arrowdown" || k === "s")
            setLife({ ...life, index: (life.index + 1) % length });
          else if (cancel) setLife(null);
          else if (confirm) {
            const next = structuredClone(stateRef.current);
            let result: { ok: boolean; text: string };
            if (life.kind === "forge") {
              if ((next.actor.swordType ?? -1) < 0)
                result = createSword(
                  next.actor,
                  life.index,
                  `无名${swordTypes[life.index]}`,
                );
              else if (life.index === 0)
                result = reforgeSword(
                  next.actor,
                  seeded(next.tasks.clock + (next.actor.swordTimes || 0)),
                );
              else {
                setLife(null);
                return;
              }
            } else if (life.index === 0) result = upgradeRoom(next.actor);
            else if (life.index <= 5)
              result = buyFurniture(next.actor, life.index - 1);
            else if (life.index === 6) result = clearFurniture(next.actor);
            else {
              setLife(null);
              return;
            }
            sync(next);
            setNotice(result.text);
            if (
              result.ok &&
              life.kind === "forge" &&
              (next.actor.swordType ?? -1) >= 0
            )
              setLife(null);
          }
          return;
        }
        if (arcade) {
          if (arcade.kind === "select") {
            if (["arrowup", "arrowdown", "w", "s"].includes(k))
              setArcade({ ...arcade, index: (arcade.index + 1) % 3 });
            else if (confirm) {
              if (arcade.index === 0)
                setArcade({
                  kind: "dance",
                  dir: Math.floor(Math.random() * 4) + 1,
                  count: 40,
                  score: 0,
                });
              else if (arcade.index === 1)
                setArcade({
                  kind: "ball",
                  step: 1,
                  x: 119,
                  dir: 1,
                  score: 0,
                  fail: 0,
                  flight: 0,
                });
              else setArcade(null);
            } else if (cancel) setArcade(null);
            return;
          }
          if (arcade.kind === "dance") {
            const dir =
              k === "arrowup" || k === "w"
                ? 1
                : k === "arrowleft" || k === "a"
                  ? 2
                  : k === "arrowdown" || k === "s"
                    ? 3
                    : k === "arrowright" || k === "d"
                      ? 4
                      : 0;
            if (cancel) {
              rememberArcadeScore("dance", arcade.score);
              setArcade(null);
            } else if (dir && arcade.count > 4) {
              if (dir === arcade.dir)
                setArcade({ ...arcade, score: arcade.score + 3, count: 4 });
              else {
                rememberArcadeScore("dance", arcade.score);
                setArcade(null);
                setNotice(`踏错节拍，最终得分 ${arcade.score}`);
              }
            }
            return;
          }
          if (cancel) {
            rememberArcadeScore("ball", arcade.score);
            setArcade(null);
          } else if (confirm && arcade.step === 1)
            setArcade({ ...arcade, step: 2 });
          else if (confirm && arcade.step === 2) {
            if (arcade.x > 110 && arcade.x < 128)
              setArcade({
                ...arcade,
                step: 3,
                score: arcade.score + 10,
                flight: 0,
              });
            else {
              const fail = arcade.fail + 1;
              if (fail >= 7) {
                rememberArcadeScore("ball", arcade.score);
                setArcade(null);
                setNotice(`七次投失，最终得分 ${arcade.score}`);
              } else setArcade({ ...arcade, step: 1, x: 119, fail, flight: 0 });
            }
          }
          return;
        }
        if (battle) {
          const specials = battleSpecials(
            stateRef.current.actor,
            battle.cooldowns,
          );
          const combatItems = bagEntries(stateRef.current.actor).filter(
            (entry) => {
              if (entry.kind !== 1) return false;
              const item = originalTables.items[entry.id] || {};
              return (
                !item.is_book && [0, 1].includes(Number(item.occasion || 0))
              );
            },
          );
          if (battleOutcome !== null) {
            if (["arrowup", "arrowdown", "w", "s"].includes(k))
              setBattleOutcome((battleOutcome + 1) % 2);
            else if (confirm) settleBattle(battleOutcome === 0);
            else if (cancel) setBattleOutcome(null);
            return;
          }
          if (battleItem !== null) {
            if (k === "arrowup" || k === "w")
              setBattleItem(
                (battleItem + combatItems.length - 1) %
                  Math.max(1, combatItems.length),
              );
            else if (k === "arrowdown" || k === "s")
              setBattleItem((battleItem + 1) % Math.max(1, combatItems.length));
            else if (confirm) consumeBattleItem(combatItems[battleItem]);
            else if (cancel || k === "i") setBattleItem(null);
            return;
          }
          if (specialMenu !== null) {
            if (k === "arrowup" || k === "w")
              setSpecialMenu(
                (specialMenu + specials.length - 1) %
                  Math.max(1, specials.length),
              );
            else if (k === "arrowdown" || k === "s")
              setSpecialMenu((specialMenu + 1) % Math.max(1, specials.length));
            else if (confirm) fightSpecial(specials[specialMenu]?.id);
            else if (cancel) setSpecialMenu(null);
            return;
          }
          if (k === "q" || k === "c") setSpecialMenu(0);
          else if (k === "i") setBattleItem(0);
          else if (k === "g") fleeBattle();
          else if (confirm) {
            if (battle.finished) leaveBattle();
            else fight();
          } else if (cancel) {
            if (battle.mode === "spar") leaveBattle();
            else fleeBattle();
          }
          return;
        }
        if (caihua) {
          if (["arrowup", "arrowdown", "w", "s"].includes(k))
            setCaihua({ ...caihua, index: (caihua.index + 1) % 2 });
          else if (confirm) {
            if (caihua.index === 1) setCaihua(null);
            else if (caihua.step === 1) setCaihua({ step: 2, index: 0 });
            else {
              const next = structuredClone(stateRef.current);
              next.actor.gender = 2;
              const readable = canReadBook(next.actor, 20);
              sync(next);
              setCaihua(null);
              if (readable.ok) setStudy({ id: 20, index: 0, book: true });
              setNotice(readable.text);
            }
          } else if (cancel) setCaihua(null);
          return;
        }
        if (flyMenu !== null) {
          const length = ((originalSystem.fly_menu as string[]) || []).length;
          if (k === "arrowup" || k === "w")
            setFlyMenu((flyMenu + length - 1) % length);
          else if (k === "arrowdown" || k === "s")
            setFlyMenu((flyMenu + 1) % length);
          else if (confirm) flyTo(flyMenu);
          else if (cancel || k === "h") setFlyMenu(null);
          return;
        }
        if (itemConfirm) {
          if (["arrowup", "arrowdown", "w", "s"].includes(k))
            setItemConfirm({
              ...itemConfirm,
              index: (itemConfirm.index + 1) % 2,
            });
          else if (confirm) confirmBagAction(itemConfirm.index);
          else if (cancel) setItemConfirm(null);
          return;
        }
        if (cultivation !== null) {
          const length = 6 + practiceOptions(stateRef.current.actor).length;
          if (cultivationActive) {
            if (k === "arrowup" || k === "w") {
              setCultivationActive(false);
              setCultivation((cultivation + length - 1) % length);
            } else if (k === "arrowdown" || k === "s") {
              setCultivationActive(false);
              setCultivation((cultivation + 1) % length);
            } else if (confirm || cancel) setCultivationActive(false);
            return;
          }
          if (k === "arrowup" || k === "w")
            setCultivation((cultivation + length - 1) % length);
          else if (k === "arrowdown" || k === "s")
            setCultivation((cultivation + 1) % length);
          else if (confirm) beginCultivation(cultivation);
          else if (cancel || k === "r") setCultivation(null);
          return;
        }
        if (menu) {
          const entries = bagEntries(stateRef.current.actor),
            skills = learnedSkills(stateRef.current.actor),
            length =
              menu.tab === 0
                ? Math.max(1, entries.length)
                : menu.tab === 2
                  ? Math.max(1, skills.length)
                  : 1;
          if (k === "arrowleft" || k === "a")
            setMenu({ tab: (menu.tab + 2) % 3, index: 0 });
          else if (k === "arrowright" || k === "d" || k === "tab")
            setMenu({ tab: (menu.tab + 1) % 3, index: 0 });
          else if (k === "arrowup" || k === "w")
            setMenu({ ...menu, index: (menu.index + length - 1) % length });
          else if (k === "arrowdown" || k === "s")
            setMenu({ ...menu, index: (menu.index + 1) % length });
          else if (confirm && menu.tab === 0)
            entries[menu.index] &&
              setItemConfirm({ entry: entries[menu.index], index: 0 });
          else if (confirm && menu.tab === 2)
            activateSkill(skills[menu.index]?.id);
          else if ((k === "c" || k === "r") && menu.tab === 2)
            activateSkill(skills[menu.index]?.id, true);
          else if (cancel || k === "m") setMenu(null);
          return;
        }
        if (eventText && (confirm || cancel)) {
          setEventText("");
          return;
        }
        if (npcMenu) {
          const opts = npcOptions(npcMenu.id, stateRef.current.actor);
          if (k === "arrowup" || k === "w")
            setNpcMenu({
              ...npcMenu,
              index: (npcMenu.index + opts.length - 1) % opts.length,
            });
          else if (k === "arrowdown" || k === "s")
            setNpcMenu({
              ...npcMenu,
              index: (npcMenu.index + 1) % opts.length,
            });
          else if (confirm) chooseNpc(npcMenu.id, opts[npcMenu.index]);
          else if (cancel) setNpcMenu(null);
          return;
        }
        if (shop) {
          const list = shopGoods(shop.id);
          if (k === "arrowup" || k === "w")
            setShop({
              ...shop,
              index: (shop.index + list.length - 1) % list.length,
            });
          else if (k === "arrowdown" || k === "s")
            setShop({ ...shop, index: (shop.index + 1) % list.length });
          else if (confirm) buySelected();
          else if (cancel) setShop(null);
          return;
        }
        if (study) {
          const list = study.book
            ? bookStudyOptions(study.id)
            : studyOptions(study.id);
          if (studyActive) {
            if (k === "arrowup" || k === "w") {
              setStudyActive(false);
              setStudy({
                ...study,
                index: (study.index + list.length - 1) % list.length,
              });
            } else if (k === "arrowdown" || k === "s") {
              setStudyActive(false);
              setStudy({ ...study, index: (study.index + 1) % list.length });
            } else if (confirm || cancel) setStudyActive(false);
            return;
          }
          if (k === "arrowup" || k === "w")
            setStudy({
              ...study,
              index: (study.index + list.length - 1) % list.length,
            });
          else if (k === "arrowdown" || k === "s")
            setStudy({ ...study, index: (study.index + 1) % list.length });
          else if (confirm) beginStudyAt(study.index);
          else if (cancel) setStudy(null);
          return;
        }
        if (confirm) interact();
        else if (k === "k") setCheatMenu({ tab: 0, index: 0 });
        else if (k === "r") setCultivation(0);
        else if (k === "h") openFlyMenu();
        else if (k === "t")
          setEventText(
            `任务簿\n${taskJournal(stateRef.current.tasks).join("\n")}`,
          );
        else if (["m", "tab"].includes(k)) setMenu({ tab: 0, index: 0 });
        else if (cancel) location.href = "/";
      },
      up = (e: KeyboardEvent) => {
        keys.current.delete(e.key.toLowerCase());
        delete held.current[e.key.toLowerCase()];
      };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    return () => {
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
    };
  }, [
    battle,
    battleItem,
    battleOutcome,
    beginCultivation,
    beginStudyAt,
    buySelected,
    caihua,
    changeCheatSkill,
    changeCheatStat,
    cheatConfirm,
    cheatMenu,
    chooseNpc,
    confirmBagAction,
    cultivate,
    cultivation,
    cultivationActive,
    eventText,
    fight,
    flyMenu,
    flyTo,
    interact,
    leaveBattle,
    menu,
    maximizeCheatSkill,
    maximizeCheatStat,
    itemConfirm,
    npcMenu,
    openFlyMenu,
    save,
    shop,
    study,
    studyActive,
    studySelected,
    activateBagEntry,
    activateSkill,
    arcade,
    life,
    specialMenu,
    fightSpecial,
    fleeBattle,
    rememberArcadeScore,
    settleBattle,
    sync,
    consumeBattleItem,
    creator,
    finishCreation,
    screen,
    titleAction,
    titleIndex,
    useCheat,
  ]);
  const arcadeKind = arcade?.kind;
  useEffect(() => {
    if (!arcadeKind || arcadeKind === "select") return;
    const id = window.setInterval(() => {
      setArcade((current) => {
        if (!current || current.kind === "select") return current;
        if (current.kind === "dance") {
          if (current.count > 0)
            return { ...current, count: current.count - 1 };
          let dir = current.dir;
          while (dir === current.dir) dir = Math.floor(Math.random() * 4) + 1;
          return { ...current, dir, count: 40 };
        }
        if (current.step === 2) {
          const delta = Math.floor(Math.random() * 4) + 1,
            x = current.x + (current.dir === 1 ? delta : -delta),
            dir: 1 | 2 = x >= 186 ? 2 : x <= 52 ? 1 : current.dir;
          return { ...current, x: Math.max(52, Math.min(186, x)), dir };
        }
        if (current.step === 3) {
          const flight = current.flight + 1;
          return flight >= 112
            ? { ...current, step: 1, x: 119, flight: 0 }
            : { ...current, flight };
        }
        return current;
      });
    }, 1000 / 120);
    return () => window.clearInterval(id);
  }, [arcadeKind]);
  useEffect(() => {
    if (screen !== "play") return;
    const id = setInterval(() => {
      const now = Date.now(),
        moves: Array<[string[], number, number]> = [
          [["w", "arrowup"], 0, -1],
          [["s", "arrowdown"], 0, 1],
          [["a", "arrowleft"], -1, 0],
          [["d", "arrowright"], 1, 0],
        ];
      for (const [list, dx, dy] of moves) {
        const k = list.find((v) => keys.current.has(v));
        if (k && (!held.current[k] || now - held.current[k] > 120)) {
          held.current[k] = now;
          move(dx, dy);
          break;
        }
      }
    }, 30);
    return () => clearInterval(id);
  }, [move, screen]);
  useEffect(() => {
    if (battle || screen !== "play") return;
    const id = window.setInterval(() => {
      const next = structuredClone(stateRef.current);
      digestActor(next.actor);
      next.tasks.clock += 15;
      sync(next);
    }, 15000);
    return () => window.clearInterval(id);
  }, [battle, screen, sync]);
  useEffect(() => {
    if (!cultivationActive || cultivation === null) return;
    const id = window.setInterval(() => {
      if (!cultivate(cultivation)) setCultivationActive(false);
    }, 1000 / 120);
    return () => window.clearInterval(id);
  }, [cultivate, cultivation, cultivationActive]);
  useEffect(() => {
    if (!studyActive || !study) return;
    const id = window.setInterval(() => studySelected(), 1000 / 120);
    return () => window.clearInterval(id);
  }, [study, studyActive, studySelected]);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const ctx = canvas.current?.getContext("2d");
      if (ctx) draw(ctx, stateRef.current);
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, []);
  const exportJson = () => {
    save();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(stateRef.current, null, 2)], {
        type: "application/json",
      }),
    );
    a.download = "英雄坛说-原版世界.json";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try {
      const x = JSON.parse(await f.text());
      if (
        x.format !== "rmxp-hero-original-world-save" ||
        !getOriginalMap(x.position.mapId)
      )
        throw 0;
      sync(normalize(x));
      localStorage.setItem(
        "rmxp-original-world-v1",
        JSON.stringify(normalize(x)),
      );
      setHasSave(true);
      setScreen("play");
      setNotice("JSON 读取成功");
    } catch {
      setNotice("存档格式无效");
    }
  };
  const map = getOriginalMap(state.position.mapId),
    profile = actorStatusProfile(state.actor);
  const battleConsumables = bagEntries(state.actor).filter((entry) => {
    if (entry.kind !== 1) return false;
    const item = originalTables.items[entry.id] || {};
    return !item.is_book && [0, 1].includes(Number(item.occasion || 0));
  });
  const cultivationInfo = [
    cultivationAvailability(state.actor, "meditate"),
    cultivationAvailability(state.actor, "magic"),
    cultivationAvailability(state.actor, "recover"),
    cultivationAvailability(state.actor, "heal"),
    cultivationAvailability(state.actor, "force"),
    cultivationAvailability(state.actor, "spell"),
  ];
  const studyList = study
      ? study.book
        ? bookStudyOptions(study.id)
        : studyOptions(study.id)
      : [],
    selectedStudy = study ? studyList[study.index] : undefined,
    selectedStudyState = selectedStudy
      ? state.actor.skills[String(selectedStudy.id)] || { level: 0, points: 0 }
      : undefined,
    studyProgress = selectedStudyState
      ? {
          label: `${selectedStudy?.name} · ${selectedStudyState.level} 级${studyActive ? " · 自动研习中" : ""}`,
          value: selectedStudyState.points,
          max: (selectedStudyState.level + 1) ** 2,
          detail: `潜能 ${state.actor.potential.toLocaleString("zh-CN")} · 银两 ${state.actor.gold.toLocaleString("zh-CN")}`,
        }
      : undefined,
    practice =
      cultivation !== null && cultivation >= 6
        ? practiceOptions(state.actor)[cultivation - 6]
        : undefined,
    practiceState = practice
      ? state.actor.skills[String(practice.id)]
      : undefined,
    cultivationProgress =
      cultivation === 0
        ? {
            label: `打坐${cultivationActive ? "中" : "准备"} · 内力上限 ${state.actor.maxFp}`,
            value: state.actor.fp,
            max: Math.max(1, Math.min(state.actor.maxFp * 2, 65535)),
            detail: `当前内力 ${state.actor.fp.toLocaleString("zh-CN")}；周天完成后上限 +1`,
          }
        : cultivation === 1
          ? {
              label: `冥思${cultivationActive ? "中" : "准备"} · 法力上限 ${state.actor.maxMp}`,
              value: state.actor.mp,
              max: Math.max(1, Math.min(state.actor.maxMp * 2, 65535)),
              detail: `当前法力 ${state.actor.mp.toLocaleString("zh-CN")}；周天完成后上限 +1`,
            }
          : practice && practiceState
            ? {
                label: `${practice.name} · ${practice.level} 级${cultivationActive ? " · 练习中" : ""}`,
                value: practiceState.points,
                max: (practiceState.level + 1) ** 2,
                detail: `经验 ${state.actor.exp.toLocaleString("zh-CN")} · 当前内力 ${state.actor.fp.toLocaleString("zh-CN")}`,
              }
            : undefined;
  if (screen === "title") {
    const titleItems = [
      hasSave ? "继续游戏" : "开始游戏",
      "开始新游戏",
      "读取 JSON 存档",
      "操作说明",
    ];
    return (
      <main className="launch-screen title-screen">
        <div className="title-mountains" aria-hidden="true" />
        <section className="title-card">
          <small>RMXP 原版规则网页重制</small>
          <h1>英雄坛说</h1>
          <p>云游志</p>
          <nav>
            {titleItems.map((item, index) => (
              <button
                className={titleIndex === index ? "active" : ""}
                key={item}
                onMouseEnter={() => setTitleIndex(index)}
                onClick={() => titleAction(index)}
              >
                {item}
              </button>
            ))}
          </nav>
          <em>W/S 或方向键选择 · E/Enter 确认</em>
        </section>
        <input
          hidden
          ref={file}
          type="file"
          accept=".json,application/json"
          onChange={(e) => void importJson(e.target.files?.[0])}
        />
      </main>
    );
  }
  if (screen === "intro")
    return (
      <main className="launch-screen intro-screen">
        <h1>序 · 时空转换</h1>
        <div className="intro-viewport">
          <p>{String(originalText.scroll_start || "").trim()}</p>
        </div>
        <button onClick={() => setScreen("create")}>跳过序章，创建人物</button>
        <small>E/Enter 或 X/Esc 跳过</small>
      </main>
    );
  if (screen === "help")
    return (
      <main className="launch-screen help-screen">
        <section>
          <h1>操作说明</h1>
          <p>移动：WASD / 方向键　互动与确认：E / Enter</p>
          <p>行囊与人物：M / Tab　修炼：R　轻功：H</p>
          <p>任务簿：T　保存：点击右上角按钮　战斗绝招：Q　战斗物品：I</p>
          <p>秘技菜单：K（可直接强化资源、数值和已学功夫）</p>
          <p>返回与逃跑：X / Esc；生死战也可用 G 尝试逃跑。</p>
          <button onClick={() => setScreen("title")}>返回标题</button>
        </section>
      </main>
    );
  if (screen === "create") {
    const attrNames = ["膂力", "敏捷", "悟性", "根骨"],
      total = creator.attrs.reduce((sum, value) => sum + value, 0);
    return (
      <main className="launch-screen create-screen">
        <section className="creator-card">
          <header>
            <small>创建人物 · {creator.step}/2</small>
            <h1>{creator.step === 1 ? "决定你的身份" : "分配先天属性"}</h1>
          </header>
          {creator.step === 1 ? (
            <div className="creator-fields">
              <button
                className={creator.index === 0 ? "active" : ""}
                onClick={() =>
                  setCreator({
                    ...creator,
                    index: 0,
                    gender: (creator.gender + 1) % 2,
                  })
                }
              >
                性别 <b>{creator.gender === 0 ? "男" : "女"}</b>
                <small>A/D 或左右键切换</small>
              </button>
              <label className={creator.index === 1 ? "active" : ""}>
                姓名
                <input
                  ref={nameInput}
                  maxLength={8}
                  value={creator.name}
                  placeholder="输入 1–8 个字符"
                  onFocus={() => setCreator({ ...creator, index: 1 })}
                  onChange={(e) =>
                    setCreator({ ...creator, name: e.target.value, index: 1 })
                  }
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                      setCreator({ ...creator, index: 2 });
                    } else if (e.key === "Escape") e.currentTarget.blur();
                  }}
                />
              </label>
              <button
                className={creator.index === 2 ? "active" : ""}
                onClick={() => {
                  if (!creator.name.trim()) setNotice("请先输入姓名。 ");
                  else setCreator({ ...creator, step: 2, index: 0 });
                }}
              >
                下一步
              </button>
            </div>
          ) : (
            <div className="creator-fields attributes">
              {attrNames.map((name, index) => (
                <button
                  className={creator.index === index ? "active" : ""}
                  key={name}
                  onClick={() => setCreator({ ...creator, index })}
                >
                  {name}
                  <b>{creator.attrs[index]}</b>
                  <small>范围 10–30 · A/D 调整</small>
                </button>
              ))}
              <strong className={total === 80 ? "ready" : ""}>
                已分配 {total}/80
              </strong>
              <button
                className={creator.index === 4 ? "active" : ""}
                onClick={finishCreation}
              >
                踏入江湖
              </button>
            </div>
          )}
          <p>{notice}</p>
          <footer>W/S 选择 · A/D 调整 · E/Enter 确认 · X/Esc 返回</footer>
        </section>
      </main>
    );
  }
  return (
    <main className="world-shell">
      <header>
        <strong>英雄坛说</strong>
        <div>
          <b>云游志</b>
          <span>正式版 · 69 MAPS</span>
        </div>
        <div className="header-actions">
          <button onClick={save}>保存</button>
          <button onClick={() => setScreen("title")}>主菜单</button>
        </div>
      </header>
      <section className="world-frame">
        <canvas ref={canvas} width={W} height={H} />
        {eventText && (
          <button className="world-dialog" onClick={() => setEventText("")}>
            {eventText.split("\n").map((line, i) => (
              <span key={i}>{line || " "}</span>
            ))}
            <i>▼</i>
          </button>
        )}
        {arcade && <Arcade game={arcade} actor={state.actor} />}
        {life && <LifeMenu menu={life} actor={state.actor} />}
        {npcMenu && (
          <Choice
            title={String(npcRecord(npcMenu.id).name)}
            items={npcOptions(npcMenu.id, state.actor).map(
              (n) => npcOptionLabel[n],
            )}
            index={npcMenu.index}
            choose={(i) =>
              chooseNpc(npcMenu.id, npcOptions(npcMenu.id, state.actor)[i])
            }
          />
        )}{" "}
        {shop && (
          <Choice
            title={`${npcRecord(shop.id).name} · ${state.actor.gold}两`}
            items={shopGoods(shop.id).map((g) => `${g.name} · ${g.price}两`)}
            index={shop.index}
            choose={(i) => {
              setShop({ ...shop, index: i });
              buyAt(shop.id, i);
            }}
          />
        )}{" "}
        {study && (
          <Choice
            title={
              studyActive ? "研习中 · E/X 停止 · W/S 换项" : "请教何种功夫"
            }
            items={studyList.map((g) => `${g.name} · 可教至 ${g.maxLevel} 级`)}
            index={study.index}
            choose={beginStudyAt}
            progress={studyProgress}
            message={notice}
            wide
          />
        )}
        {battle && (
          <BattleView
            battle={battle}
            hp={state.actor.hp}
            maxHp={state.actor.maxHp}
            fight={fight}
            leave={leaveBattle}
            openSpecial={() => setSpecialMenu(0)}
            openItem={() => setBattleItem(0)}
            flee={fleeBattle}
          />
        )}{" "}
        {battle && battleOutcome !== null && (
          <Choice
            title="是否取其性命？"
            items={["砍头", "手下留情"]}
            index={battleOutcome}
            choose={(index) => settleBattle(index === 0)}
          />
        )}{" "}
        {battle && battleItem !== null && (
          <Choice
            title="战斗物品"
            items={
              battleConsumables.length
                ? battleConsumables.map(
                    (entry) => `${entry.name} ×${entry.amount}`,
                  )
                : ["无可用物品"]
            }
            index={battleItem}
            choose={(index) => consumeBattleItem(battleConsumables[index])}
          />
        )}{" "}
        {battle && specialMenu !== null && (
          <SpecialPicker
            actor={state.actor}
            battle={battle}
            index={specialMenu}
            choose={fightSpecial}
          />
        )}{" "}
        {menu && (
          <GameMenu
            actor={state.actor}
            menu={menu}
            setMenu={setMenu}
            activate={(entry) => setItemConfirm({ entry, index: 0 })}
            activateKf={activateSkill}
            openCheat={() => {
              setMenu(null);
              setCheatMenu({ tab: 0, index: 0 });
            }}
          />
        )}
        {cheatMenu && (
          <CheatMenu
            actor={state.actor}
            menu={cheatMenu}
            setMenu={setCheatMenu}
            useQuick={useCheat}
            changeStat={changeCheatStat}
            changeSkill={changeCheatSkill}
            maxStat={maximizeCheatStat}
            maxSkill={maximizeCheatSkill}
          />
        )}
        {cheatConfirm && (
          <Choice
            title={`「${cheatQuickOptions.find((item) => item.id === cheatConfirm.action)?.name}」会大幅改变成长数值，确定施展？`}
            items={["确定施展", "暂不使用"]}
            index={cheatConfirm.index}
            choose={(index) => {
              setCheatConfirm({ ...cheatConfirm, index });
              if (index === 0) useCheat(cheatConfirm.action, true);
              else setCheatConfirm(null);
            }}
          />
        )}
        {itemConfirm && (
          <Choice
            title={`${itemConfirm.entry.equipped ? "卸下" : itemConfirm.entry.kind === 1 ? "使用" : "装备"}「${itemConfirm.entry.name}」？`}
            items={["确定", "取消"]}
            index={itemConfirm.index}
            choose={confirmBagAction}
          />
        )}
        {flyMenu !== null && (
          <Choice
            title="轻功 · 消耗 200 内力"
            items={((originalSystem.fly_menu as string[]) || []).map(
              (name) => `飞往${name}`,
            )}
            index={flyMenu}
            choose={flyTo}
          />
        )}
        {cultivation !== null && (
          <Choice
            title={
              cultivationActive ? "修炼中 · E/X 停止 · W/S 换项" : "修炼调息"
            }
            items={[
              `打坐 · ${cultivationInfo[0].requirement}${cultivationInfo[0].ok ? "" : "〔不可用〕"}`,
              `冥思 · ${cultivationInfo[1].requirement}${cultivationInfo[1].ok ? "" : "〔不可用〕"}`,
              `吸气 · ${cultivationInfo[2].requirement}${cultivationInfo[2].ok ? "" : "〔不可用〕"}`,
              `疗伤 · ${cultivationInfo[3].requirement}${cultivationInfo[3].ok ? "" : "〔不可用〕"}`,
              `加力 +10 · 当前 ${state.actor.fpPlus} · ${cultivationInfo[4].requirement}${cultivationInfo[4].ok ? "" : "〔不可用〕"}`,
              `法点 +10 · 当前 ${state.actor.mpPlus} · ${cultivationInfo[5].requirement}${cultivationInfo[5].ok ? "" : "〔不可用〕"}`,
              ...practiceOptions(state.actor).map(
                (skill) =>
                  `自行练习 ${skill.name} · ${skill.level} 级${skill.equipped ? " · 已运用" : ""}`,
              ),
            ]}
            index={cultivation}
            choose={beginCultivation}
            progress={cultivationProgress}
            message={notice}
            wide
          />
        )}
        {caihua && (
          <Choice
            title={
              caihua.step === 1
                ? "欲练此功，必先净身。是否继续？"
                : "此举不可逆转，当真决定继续？"
            }
            items={["确定", "放弃"]}
            index={caihua.index}
            choose={(index) => setCaihua({ ...caihua, index })}
          />
        )}
      </section>
      <aside>
        <div className="world-location">
          <small>当前位置</small>
          <b>{map.name}</b>
          <em>
            Map {map.id} · {map.width}×{map.height}
          </em>
        </div>
        <div className="actor-identity">
          <small>{profile.school}</small>
          <b>{state.actor.name || "江湖少侠"}</b>
          <em>
            {state.actor.age} 岁 · {profile.gender} · 师承 {profile.teacher}
          </em>
          <strong>
            武艺「{profile.realm}」 · 出手「{profile.attackWeight}」
          </strong>
        </div>
        <div className="vital-stack">
          <StatusBar
            label="气血"
            value={state.actor.hp}
            max={state.actor.maxHp}
          />
          <StatusBar
            label="内力"
            value={state.actor.fp}
            max={state.actor.maxFp}
          />
          <StatusBar
            label="法力"
            value={state.actor.mp}
            max={state.actor.maxMp}
          />
          <StatusBar
            label="饱食"
            value={state.actor.food}
            max={profile.maxFood}
          />
          <StatusBar
            label="饮水"
            value={state.actor.water}
            max={profile.maxWater}
          />
        </div>
        <div className="actor-numbers">
          <span>
            膂力 <b>{profile.stats.str}</b>
          </span>
          <span>
            敏捷 <b>{profile.stats.agi}</b>
          </span>
          <span>
            悟性 <b>{profile.stats.int}</b>
          </span>
          <span>
            根骨 <b>{profile.stats.bon}</b>
          </span>
          <span>
            攻击 <b>{profile.stats.atk}</b>
          </span>
          <span>
            防御 <b>{profile.stats.pdef}</b>
          </span>
          <span>
            命中 <b>{profile.stats.hit}</b>
          </span>
          <span>
            闪避 <b>{profile.stats.eva}</b>
          </span>
        </div>
        <div className="actor-resources">
          <span title={`银两：${state.actor.gold.toLocaleString("zh-CN")}`}>
            银两 <b>{compactNumber(state.actor.gold)}</b>
          </span>
          <span title={`经验：${state.actor.exp.toLocaleString("zh-CN")}`}>
            经验 <b>{compactNumber(state.actor.exp)}</b>
          </span>
          <span
            title={`潜能：${state.actor.potential.toLocaleString("zh-CN")}`}
          >
            潜能 <b>{compactNumber(state.actor.potential)}</b>
          </span>
          <span>
            名声 <b>{state.actor.morals}</b>
          </span>
        </div>
        <p>{notice}</p>
        <nav>
          <button onClick={() => setMenu({ tab: 0, index: 0 })}>
            行囊 <kbd>M</kbd>
          </button>
          <button onClick={() => setCultivation(0)}>
            修炼 <kbd>R</kbd>
          </button>
          <button onClick={() => setCheatMenu({ tab: 0, index: 0 })}>
            秘技 <kbd>K</kbd>
          </button>
          <button onClick={openFlyMenu}>
            轻功 <kbd>H</kbd>
          </button>
          <button
            onClick={() =>
              setEventText(`任务簿\n${taskJournal(state.tasks).join("\n")}`)
            }
          >
            任务 <kbd>T</kbd>
          </button>
          <button onClick={exportJson}>下载 JSON</button>
          <button onClick={() => file.current?.click()}>读取 JSON</button>
        </nav>
      </aside>
      <footer>
        移动 <kbd>WASD</kbd>
        <kbd>方向键</kbd> · 互动 <kbd>E</kbd>
        <kbd>Enter</kbd> · 菜单 <kbd>M</kbd>
        <kbd>Tab</kbd> · 修炼 <kbd>R</kbd> · 轻功 <kbd>H</kbd>· 任务{" "}
        <kbd>T</kbd> · 保存（右上角） · 返回 <kbd>Esc</kbd> · 秘技
        <kbd>K</kbd>
      </footer>
      <input
        hidden
        ref={file}
        type="file"
        accept=".json,application/json"
        onChange={(e) => void importJson(e.target.files?.[0])}
      />
    </main>
  );
}

const compactNumber = (value: number) =>
  new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
function StatusBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <label>
      <span>
        {label}{" "}
        <em>
          {value.toLocaleString("zh-CN")}/{max.toLocaleString("zh-CN")}
        </em>
      </span>
      <i>
        <b style={{ width: `${percent}%` }} />
      </i>
    </label>
  );
}
function Arcade({
  game,
  actor,
}: {
  game: ArcadeState;
  actor: SceneActorState;
}) {
  if (game.kind === "select")
    return (
      <section className="arcade-panel">
        <h2>平安镇游戏厅</h2>
        {["跳舞毯", "投铅球", "离开"].map((name, index) => (
          <b className={game.index === index ? "active" : ""} key={name}>
            {name}
          </b>
        ))}
        <small>W/S 选择 · E/Enter 确认 · X/Esc 返回</small>
      </section>
    );
  if (game.kind === "dance") {
    const arrows = ["", "↑", "←", "↓", "→"];
    return (
      <section className="arcade-panel dance-panel">
        <h2>跳舞毯</h2>
        <div className="arcade-score">
          SCORE {String(game.score).padStart(5, "0")} · TOP{" "}
          {String(actor.dance || 100).padStart(5, "0")}
        </div>
        <strong>{arrows[game.dir]}</strong>
        <div className="dance-pad">
          ↑<i>← →</i>↓
        </div>
        <small>按对应方向或 WASD；踏错即结束 · X/Esc 离开</small>
      </section>
    );
  }
  const shotX = game.step === 3 ? 155 + Math.min(224, game.flight * 2) : 155,
    shotY =
      game.step === 3
        ? 105 + Math.floor((379 - shotX) ** 2 * 0.004162330905)
        : 290;
  return (
    <section className="arcade-panel ball-panel">
      <h2>投铅球</h2>
      <div className="arcade-score">
        SCORE {String(game.score).padStart(5, "0")} · TOP{" "}
        {String(actor.ball || 100).padStart(5, "0")} · MISS {game.fail}/7
      </div>
      <div className="aim-track">
        <i style={{ left: game.x - 52 }} />
      </div>
      <div className="hoop">
        ┐<span style={{ left: shotX - 90, top: shotY - 80 }}>●</span>
      </div>
      <small>
        E/Enter 开始游标，再按一次投球 · 命中区 110–128 · X/Esc 离开
      </small>
    </section>
  );
}

function LifeMenu({
  menu,
  actor,
}: {
  menu: LifeState;
  actor: SceneActorState;
}) {
  const forgeNew = (actor.swordType ?? -1) < 0,
    items =
      menu.kind === "forge"
        ? forgeNew
          ? swordTypes.map((name) => `铸造${name}`)
          : [`重铸「${actor.swordName || "无名兵器"}」`, "离开"]
        : [
            `翻修房屋（当前 ${actor.roomLevel || 0}/3）`,
            ...furnitureNames.map(
              (name, index) =>
                `${name} / 已有 ${actor.jiajuList?.[index] || 0}`,
            ),
            "销毁全部家具",
            "离开",
          ];
  return (
    <section className="arcade-panel life-panel">
      <h2>{menu.kind === "forge" ? "铸剑谷" : "桃花源管家"}</h2>
      {items.map((item, index) => (
        <b className={menu.index === index ? "active" : ""} key={item}>
          {item}
        </b>
      ))}
      <small>
        {menu.kind === "forge"
          ? `经验 ${actor.exp} · 银两 ${actor.gold} · 武器名可在 JSON 中修改`
          : `银两 ${actor.gold} · 家具每件 60000`}
      </small>
    </section>
  );
}

function Choice({
  title,
  items,
  index,
  choose,
  progress,
  message,
  wide = false,
}: {
  title: string;
  items: string[];
  index: number;
  choose: (index: number) => void;
  progress?: { label: string; value: number; max: number; detail: string };
  message?: string;
  wide?: boolean;
}) {
  const density =
    items.length > 18 ? " three-column dense" : items.length > 8 ? " two-column" : "";
  return (
    <div className={`world-choice large${wide ? " wide" : ""}${density}`}>
      <b>{title}</b>
      <div className="choice-items">
        {items.map((item, i) => (
          <button
            className={i === index ? "active" : ""}
            onClick={() => choose(i)}
            key={`${item}-${i}`}
          >
            <span>{item}</span>
            {i === index && <i>◆</i>}
          </button>
        ))}
      </div>
      {progress && (
        <div className="training-progress">
          <span>
            <b>{progress.label}</b>
            <em>
              {progress.value.toLocaleString("zh-CN")} /{" "}
              {progress.max.toLocaleString("zh-CN")}
            </em>
          </span>
          <i>
            <b
              style={{
                width: `${Math.max(0, Math.min(100, (progress.value / Math.max(1, progress.max)) * 100))}%`,
              }}
            />
          </i>
          <small>{progress.detail}</small>
        </div>
      )}
      {message && <p className="training-message">{message}</p>}
      <small>W/S 选择 · E/Enter 确认 · X/Esc 返回</small>
    </div>
  );
}
function BattleView({
  battle,
  hp,
  maxHp,
  fight,
  leave,
  openSpecial,
  openItem,
  flee,
}: {
  battle: OriginalBattle;
  hp: number;
  maxHp: number;
  fight: () => void;
  leave: () => void;
  openSpecial: () => void;
  openItem: () => void;
  flee: () => void;
}) {
  return (
    <div className="battle">
      <div className="battle-stage">
        <div className="fighter hero">
          <i />
          <span>少侠</span>
        </div>
        <b>
          {battle.mode === "spar" ? "切磋" : "生死战"} · 第 {battle.turn + 1}{" "}
          回合
        </b>
        <div className="fighter enemy">
          <i />
          <span>{battle.enemyName}</span>
        </div>
      </div>
      <div className="battle-bars">
        <label>
          你 <meter min="0" max={maxHp} value={hp} />
          <em>
            {hp}/{maxHp}
          </em>
        </label>
        <label>
          {battle.enemyName}{" "}
          <meter min="0" max={battle.enemyMaxHp} value={battle.enemyHp} />
          <em>
            {battle.enemyHp}/{battle.enemyMaxHp}
          </em>
        </label>
      </div>
      <div className="battle-log">
        {battle.log.map((line, i) => (
          <p key={`${i}-${line}`}>{line}</p>
        ))}
      </div>
      <nav>
        <button onClick={battle.finished ? leave : fight}>
          {battle.finished ? "处理战果" : "普通攻击"} <kbd>E</kbd>
        </button>
        <button onClick={openSpecial} disabled={Boolean(battle.finished)}>
          绝招 <kbd>Q</kbd>
        </button>
        <button onClick={openItem} disabled={Boolean(battle.finished)}>
          物品 <kbd>I</kbd>
        </button>
        <button
          onClick={battle.mode === "spar" ? leave : flee}
          disabled={Boolean(battle.finished)}
        >
          {battle.mode === "spar" ? "退出" : "逃跑"}{" "}
          <kbd>{battle.mode === "spar" ? "X" : "G"}</kbd>
        </button>
      </nav>
    </div>
  );
}
function SpecialPicker({
  actor,
  battle,
  index,
  choose,
}: {
  actor: SceneActorState;
  battle: OriginalBattle;
  index: number;
  choose: (id?: number) => void;
}) {
  const list = battleSpecials(actor, battle.cooldowns);
  return (
    <div className="special-picker">
      <b>选择绝招</b>
      {list.length ? (
        list.map((special, i) => (
          <button
            className={index === i ? "active" : ""}
            disabled={!special.enabled}
            onClick={() => choose(special.id)}
            key={special.id}
          >
            <span>
              {special.name}
              <small>{special.description}</small>
            </span>
            <em>
              {special.enabled
                ? `内力 ${special.fpCost}${special.mpCost ? ` · 法力 ${special.mpCost}` : ""}`
                : special.reason}
            </em>
          </button>
        ))
      ) : (
        <p>当前装配的功夫没有可用绝招。</p>
      )}
      <footer>W/S 选择 · E/Enter 施展 · X/Esc 返回</footer>
    </div>
  );
}
function GameMenu({
  actor,
  menu,
  setMenu,
  activate,
  activateKf,
  openCheat,
}: {
  actor: SceneActorState;
  menu: { tab: number; index: number };
  setMenu: (value: { tab: number; index: number } | null) => void;
  activate: (entry?: BagEntry) => void;
  activateKf: (id?: number, parry?: boolean) => void;
  openCheat: () => void;
}) {
  const tabs = ["行囊", "状态", "功夫"],
    entries = bagEntries(actor),
    stats = derivedStats(actor),
    profile = actorStatusProfile(actor);
  return (
    <div className="game-menu">
      <nav>
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={menu.tab === i ? "active" : ""}
            onClick={() => setMenu({ tab: i, index: 0 })}
          >
            {tab}
          </button>
        ))}
        <button className="cheat-entry" onClick={openCheat}>
          秘技
        </button>
      </nav>
      {menu.tab === 0 ? (
        <section className="bag-list">
          {entries.length ? (
            entries.map((entry, i) => (
              <button
                key={entry.key}
                className={menu.index === i ? "active" : ""}
                onMouseEnter={() => setMenu({ tab: 0, index: i })}
                onClick={() => activate(entry)}
              >
                <i className={`item-pixel kind-${entry.kind}`} />
                <span>
                  <b>
                    {entry.name}
                    {entry.equipped ? "〔装备中〕" : ""}
                  </b>
                  <small>{entry.description}</small>
                </span>
                <em>×{entry.amount}</em>
              </button>
            ))
          ) : (
            <p>行囊空空如也。</p>
          )}
        </section>
      ) : menu.tab === 1 ? (
        <section className="actor-status-panel">
          <header>
            <b>
              {profile.school} · {actor.name || "江湖少侠"}
            </b>
            <small>
              {actor.age} 岁 · {profile.gender} · 师承 {profile.teacher}
            </small>
            <strong>
              武艺看起来「{profile.realm}」，出手似乎「{profile.attackWeight}」
            </strong>
            <em>{profile.appearance}</em>
            <div className="ladder-summary">
              <span>
                综合武境 <b>{profile.realmTier}/50 阶</b>
              </span>
              <span>
                出手劲道 <b>{profile.attackTier}/6 阶</b>
              </span>
              <span>
                容貌评价 <b>{profile.appearanceTier}/8 阶</b>
              </span>
            </div>
          </header>
          <div className="status-cards">
          <fieldset>
            <legend>精气状态</legend>
            <span>
              气血{" "}
              <b>
                {actor.hp}/{actor.maxHp}
              </b>
            </span>
            <span>
              伤势上限{" "}
              <b>
                {actor.maxHp}/{fullHp(actor)}
              </b>
            </span>
            <span>
              内力{" "}
              <b>
                {actor.fp}/{actor.maxFp}（加力 {actor.fpPlus}）
              </b>
            </span>
            <span>
              法力{" "}
              <b>
                {actor.mp}/{actor.maxMp}（法点 {actor.mpPlus}）
              </b>
            </span>
            <span>
              饱食{" "}
              <b>
                {actor.food}/{maxFood(actor)}
              </b>
            </span>
            <span>
              饮水{" "}
              <b>
                {actor.water}/{maxWater(actor)}
              </b>
            </span>
          </fieldset>
          <fieldset>
            <legend>先天与实战属性</legend>
            <span>
              膂力{" "}
              <b>
                {stats.str}/{actor.baseStr}
              </b>
            </span>
            <span>
              敏捷{" "}
              <b>
                {stats.agi}/{actor.baseAgi}
              </b>
            </span>
            <span>
              悟性{" "}
              <b>
                {stats.int}/{actor.baseInt}
              </b>
            </span>
            <span>
              根骨{" "}
              <b>
                {stats.bon}/{actor.baseBon}
              </b>
            </span>
            <span>
              装备攻击 <b>{stats.atk}</b>
            </span>
            <span>
              装备防御 <b>{stats.pdef}</b>
            </span>
            <span>
              装备命中 <b>{stats.hit}</b>
            </span>
            <span>
              装备闪避 <b>{stats.eva}</b>
            </span>
          </fieldset>
          <fieldset>
            <legend>江湖履历</legend>
            <span>
              经验 <b>{actor.exp.toLocaleString("zh-CN")}</b>
            </span>
            <span>
              潜能 <b>{actor.potential.toLocaleString("zh-CN")}</b>
            </span>
            <span>
              银两 <b>{actor.gold.toLocaleString("zh-CN")}</b>
            </span>
            <span>
              名声/道德 <b>{actor.morals}</b>
            </span>
            <span className="status-explain">
              <span>
                福缘<small>请教速度、任务奖励、铸剑词缀与随机事件</small>
              </span>
              <b>{actor.luck}</b>
            </span>
            <span className="status-explain">
              <span>
                容貌<small>人物评价、部分拜师条件与结局判定</small>
              </span>
              <b>{actor.face}</b>
            </span>
            <span>
              击杀 NPC <b>{actor.killList?.length || 0}</b>
            </span>
            <span>
              追杀恶人 <b>{actor.badmanKill || 0}</b>
            </span>
            <span>
              杀手任务 <b>{actor.taskKill || 0}</b>
            </span>
            <span>
              坛位 <b>{actor.tanId}/8</b>
            </span>
          </fieldset>
          <fieldset>
            <legend>装备与战斗功夫</legend>
            <span>
              兵刃 <b>{profile.weapon}</b>
            </span>
            <span>
              防具 <b>{profile.armor}</b>
            </span>
            <span>
              攻击功夫 <b>{profile.combat.attack}</b>
            </span>
            <span>
              轻功 <b>{profile.combat.dodge}</b>
            </span>
            <span>
              招架 <b>{profile.combat.parry}</b>
            </span>
            <span>
              已学功夫 <b>{Object.keys(actor.skills).length}/20</b>
            </span>
            <span>
              综合武境进度 <b>{profile.realmValue}/245</b>
            </span>
          </fieldset>
          </div>
        </section>
      ) : (
        <SkillRows
          actor={actor}
          index={menu.index}
          setMenu={setMenu}
          activate={activateKf}
        />
      )}
      <footer>
        A/D 或 Tab 切页 · W/S 选择 · E/Enter 装配 · C/R 设为招架 · X/Esc 关闭
      </footer>
    </div>
  );
}
function CheatMenu({
  actor,
  menu,
  setMenu,
  useQuick,
  changeStat,
  changeSkill,
  maxStat,
  maxSkill,
}: {
  actor: SceneActorState;
  menu: { tab: number; index: number };
  setMenu: (value: { tab: number; index: number } | null) => void;
  useQuick: (action: CheatQuickAction) => void;
  changeStat: (index: number, direction: -1 | 1) => void;
  changeSkill: (index: number, direction: -1 | 1) => void;
  maxStat: (index: number) => void;
  maxSkill: (index: number) => void;
}) {
  const tabs = ["快捷强化", "数值修改", "功夫提升"],
    skills = cheatSkillRows(actor);
  return (
    <div className="cheat-menu">
      <header>
        <div>
          <small>江湖秘卷 · 修改立即生效</small>
          <h2>秘技</h2>
        </div>
        <button onClick={() => setMenu(null)}>关闭 ×</button>
      </header>
      <aside>秘技会改变正常成长节奏，建议先下载 JSON 备份。</aside>
      <nav>
        {tabs.map((tab, index) => (
          <button
            key={tab}
            className={menu.tab === index ? "active" : ""}
            onClick={() => setMenu({ tab: index, index: 0 })}
          >
            {tab}
          </button>
        ))}
      </nav>
      <section className="cheat-list">
        {menu.tab === 0 &&
          cheatQuickOptions.map((option, index) => (
            <button
              key={option.id}
              className={`${menu.index === index ? "active" : ""} ${option.dangerous ? "danger" : ""}`}
              onMouseEnter={() => setMenu({ tab: 0, index })}
              onClick={() => useQuick(option.id)}
            >
              <span>
                <b>{option.name}</b>
                <small>{option.detail}</small>
              </span>
              <em>{option.dangerous ? "需确认" : "施展"}</em>
            </button>
          ))}
        {menu.tab === 1 &&
          cheatStats.map((stat, index) => (
            <div
              key={stat.key}
              className={menu.index === index ? "active" : ""}
              onMouseEnter={() => setMenu({ tab: 1, index })}
            >
              <span>
                <b>{stat.name}</b>
                <small>
                  步进 {stat.step.toLocaleString("zh-CN")} · 理论上限{" "}
                  {stat.max.toLocaleString("zh-CN")}
                </small>
              </span>
              <strong>{Number(actor[stat.key]).toLocaleString("zh-CN")}</strong>
              <div>
                <button onClick={() => changeStat(index, -1)}>−</button>
                <button onClick={() => changeStat(index, 1)}>＋</button>
                <button className="max" onClick={() => maxStat(index)}>
                  MAX
                </button>
              </div>
            </div>
          ))}
        {menu.tab === 2 &&
          (skills.length ? (
            skills.map((skill, index) => (
              <div
                key={skill.id}
                className={menu.index === index ? "active" : ""}
                onMouseEnter={() => setMenu({ tab: 2, index })}
              >
                <span>
                  <b>{skill.name}</b>
                  <small>每次调整 5 级 · 上限 255</small>
                </span>
                <strong>{skill.level} 级</strong>
                <div>
                  <button onClick={() => changeSkill(index, -1)}>−</button>
                  <button onClick={() => changeSkill(index, 1)}>＋</button>
                  <button className="max" onClick={() => maxSkill(index)}>
                    MAX
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>尚未学会任何功夫。先拜师学艺，再来提升等级。</p>
          ))}
      </section>
      <footer>
        W/S 选择 · Q/Tab 切页 · A/D 调整 · E/Enter 增加/施展 · M 当前项 MAX ·
        K/Esc 关闭
      </footer>
    </div>
  );
}
function SkillRows({
  actor,
  index,
  setMenu,
  activate,
}: {
  actor: SceneActorState;
  index: number;
  setMenu: (value: { tab: number; index: number }) => void;
  activate: (id?: number, parry?: boolean) => void;
}) {
  const skills = learnedSkills(actor);
  return (
    <section className="kungfu-list">
      {skills.length ? (
        skills.map((skill, i) => (
          <button
            className={index === i ? "active" : ""}
            key={skill.id}
            onMouseEnter={() => setMenu({ tab: 2, index: i })}
            onClick={() => activate(skill.id)}
          >
            <b>
              {skill.name}
              {skill.equipped ? "〔运用〕" : ""}
              {skill.parrying ? "〔招架〕" : ""}
            </b>
            <span>{skill.level} 级</span>
            <em>
              {levelTitle(skill.level)} · 第 {levelTier(skill.level)}/50 阶 ·{" "}
              {skill.points} 点
            </em>
          </button>
        ))
      ) : (
        <p>尚未学会任何功夫，可向江湖人物拜师请教。</p>
      )}
    </section>
  );
}

function draw(ctx: CanvasRenderingContext2D, state: WorldSave) {
  const pos = state.position,
    map = getOriginalMap(pos.mapId),
    ox = Math.floor(W / 2 / T),
    oy = Math.floor(H / 2 / T),
    sx = Math.max(0, Math.min(map.width - 20, pos.x - ox)),
    sy = Math.max(0, Math.min(map.height - 15, pos.y - oy));
  ctx.fillStyle = "#0c1410";
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < 15; y++)
    for (let x = 0; x < 20; x++) {
      const mx = sx + x,
        my = sy + y;
      if (mx >= map.width || my >= map.height) continue;
      drawTile(ctx, x * T, y * T, tileAt(map, mx, my, 0), 0);
      drawTile(ctx, x * T, y * T, tileAt(map, mx, my, 1), 1);
      drawTile(ctx, x * T, y * T, tileAt(map, mx, my, 2), 2);
    }
  for (const e of map.events) {
    if (e.x < sx || e.y < sy || e.x >= sx + 20 || e.y >= sy + 15) continue;
    const visual = eventVisual(e, state),
      near = Math.abs(e.x - pos.x) + Math.abs(e.y - pos.y) <= 2;
    if (visual.kind === "npc") {
      drawActor(
        ctx,
        (e.x - sx) * T + 16,
        (e.y - sy) * T + 23,
        hash(visual.label),
        false,
      );
      drawNpcMarker(
        ctx,
        (e.x - sx) * T + 16,
        (e.y - sy) * T + 23,
        visual.label,
        near,
      );
    } else if (visual.kind === "door")
      drawDoorMarker(
        ctx,
        (e.x - sx) * T + 16,
        (e.y - sy) * T + 21,
        visual.label,
        near,
      );
    else if (visual.kind === "object")
      drawObjectMarker(
        ctx,
        (e.x - sx) * T + 16,
        (e.y - sy) * T + 21,
        visual.label,
        near,
      );
    else if (visual.kind === "corpse")
      drawCorpseMarker(
        ctx,
        (e.x - sx) * T + 16,
        (e.y - sy) * T + 23,
        visual.label,
        near,
      );
  }
  if (
    state.tasks.wantedPlace === pos.mapId &&
    state.tasks.wantedX >= sx &&
    state.tasks.wantedY >= sy &&
    state.tasks.wantedX < sx + 20 &&
    state.tasks.wantedY < sy + 15
  ) {
    const wx = (state.tasks.wantedX - sx) * T + 16,
      wy = (state.tasks.wantedY - sy) * T + 23,
      near =
        Math.abs(state.tasks.wantedX - pos.x) +
          Math.abs(state.tasks.wantedY - pos.y) <=
        2;
    drawActor(
      ctx,
      wx,
      wy,
      state.tasks.wantedGender ? "#e45d6d" : "#c44f45",
      false,
    );
    drawNpcMarker(ctx, wx, wy, "通缉犯", near, true);
  }
  drawActor(ctx, (pos.x - sx) * T + 16, (pos.y - sy) * T + 23, "#dce8ec", true);
  const shade = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 430);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(2,7,4,.34)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(5,10,7,.72)";
  ctx.fillRect(8, 7, Math.min(150, map.name.length * 18 + 24), 25);
  ctx.fillStyle = "#eadcae";
  ctx.font = "bold 14px serif";
  ctx.textAlign = "left";
  ctx.fillText(map.name, 17, 24);
  ctx.fillStyle = "rgba(5,10,7,.62)";
  ctx.fillRect(W - 107, 8, 99, 22);
  ctx.textAlign = "right";
  ctx.font = "10px monospace";
  ctx.fillStyle = "#9aaa9e";
  ctx.fillText(`MAP ${map.id} · ${pos.x},${pos.y}`, W - 15, 23);
}
type EventVisual = {
  kind: "npc" | "object" | "door" | "corpse" | "none";
  label: string;
};
const sceneLabels: Record<number, string> = {
  1: "菜花宝典",
  2: "可拾取物",
  3: "宝物",
  4: "钓鱼点",
  5: "水源",
  6: "游戏设施",
  7: "工作点",
  8: "挑战入口",
  9: "告示牌",
  10: "绳索",
  11: "酒坛",
  12: "对战入口",
  13: "坛入口",
  14: "铸剑台",
  15: "桃花源",
  16: "房间入口",
};
function eventVisual(event: MapEvent, state: WorldSave): EventVisual {
  const page = activePage(event),
    result = executeMapCommands(page.commands),
    scene = selectSceneEvent(result.source, {
      inventory: state.actor.inventory,
      tanId: state.actor.tanId,
      freeWork: state.tasks.freeWork,
      canGetItem: true,
      canGetCaihua: true,
    }),
    graphic = String(page.graphic?.character_name || ""),
    cleanName = friendlyEventName(event.name, result.transfer?.mapId);
  if (scene?.type === 0 && scene.id !== undefined) {
    if ((state.actor.killList || []).includes(scene.id))
      return scene.id >= 173 && scene.id <= 194
        ? { kind: "none", label: "" }
        : {
            kind: "corpse",
            label: `${String(npcRecord(scene.id).name || cleanName || "江湖人物")}遗骸`,
          };
    return {
      kind: "npc",
      label: String(npcRecord(scene.id).name || cleanName || "江湖人物"),
    };
  }
  if (graphic) return { kind: "npc", label: cleanName || "江湖人物" };
  if (result.transfer || (scene && [13, 15, 16].includes(scene.type)))
    return {
      kind: "door",
      label: cleanName || (scene ? sceneLabels[scene.type] : "通往别处"),
    };
  if (scene)
    return {
      kind: "object",
      label: cleanName || sceneLabels[scene.type] || "可互动",
    };
  return { kind: "none", label: "" };
}
function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: number,
  layer: number,
) {
  if (!id) return;
  if (layer === 0) {
    const family = id % 6,
      palettes = [
        [103, 25, 27],
        [88, 24, 31],
        [43, 24, 34],
        [188, 27, 28],
        [25, 22, 31],
        [122, 18, 25],
      ],
      [h, s, l] = palettes[family];
    ctx.fillStyle = `hsl(${h + (id % 11) - 5} ${s}% ${l + (id % 4)}%)`;
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "rgba(255,244,195,.055)";
    ctx.fillRect(x + 3 + ((id * 7) % 22), y + 4 + ((id * 11) % 20), 2, 2);
    ctx.fillStyle = "rgba(3,12,7,.12)";
    ctx.fillRect(x, y + T - 2, T, 2);
    ctx.fillRect(x + T - 2, y, 2, T);
    if (family === 0 || family === 1) {
      ctx.fillStyle = "rgba(157,190,111,.15)";
      const px = x + 5 + ((id * 3) % 20),
        py = y + 9 + ((id * 5) % 15);
      ctx.fillRect(px, py, 2, 6);
      ctx.fillRect(px - 2, py + 2, 2, 2);
      ctx.fillRect(px + 2, py + 1, 2, 3);
    } else if (family === 3) {
      ctx.strokeStyle = "rgba(157,215,220,.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 10 + (id % 8));
      ctx.lineTo(x + 29, y + 10 + (id % 8));
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(235,216,168,.1)";
      ctx.fillRect(x + 5 + (id % 14), y + 7 + (id % 12), 4, 2);
    }
  } else {
    // Higher RMXP layers are flattened into low-profile ground detail. This
    // preserves map identity without letting walls or roofs hide interaction.
    ctx.strokeStyle = `hsla(${(id * 47) % 360} 35% 68% / ${layer === 1 ? ".16" : ".1"})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4 + (id % 3), y + 5 + (id % 4), 22, 18);
    ctx.fillStyle = "rgba(235,220,178,.07)";
    ctx.fillRect(x + 9, y + 13, 14, 3);
  }
}
function drawActor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  hero: boolean,
) {
  ctx.fillStyle = "rgba(0,0,0,.5)";
  ctx.fillRect(x - 10, y + 5, 20, 5);
  ctx.fillStyle = hero ? "#d8f3ff" : "#fff0b0";
  ctx.fillRect(x - 8, y - 14, 16, 10);
  ctx.fillRect(x - 9, y - 8, 18, 16);
  ctx.fillStyle = "#26221d";
  ctx.fillRect(x - 7, y - 13, 14, 8);
  ctx.fillStyle = "#dfb78d";
  ctx.fillRect(x - 5, y - 15, 10, 9);
  ctx.fillStyle = color;
  ctx.fillRect(x - 8, y - 7, 16, 14);
  ctx.fillStyle = hero ? "#657f97" : "#40362e";
  ctx.fillRect(x - 8, y + 7, 6, 7);
  ctx.fillRect(x + 2, y + 7, 6, 7);
}
function drawNpcMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  near: boolean,
  hostile = false,
) {
  const pulse = Math.sin(Date.now() / 180) > 0,
    accent = hostile ? "#ff6a63" : "#ffd866";
  ctx.strokeStyle = near ? accent : "rgba(255,216,102,.72)";
  ctx.lineWidth = near ? 3 : 2;
  ctx.strokeRect(x - 11, y + 8, 22, near ? 5 : 3);
  ctx.fillStyle = accent;
  ctx.fillRect(x - 2, y - 27 - (pulse ? 1 : 0), 5, 7);
  ctx.fillRect(x - 2, y - 18 - (pulse ? 1 : 0), 5, 3);
  if (!near) return;
  const label = name.length > 7 ? `${name.slice(0, 7)}…` : name;
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  const width = Math.ceil(ctx.measureText(label).width) + 8;
  ctx.fillStyle = "rgba(7,12,9,.92)";
  ctx.fillRect(x - width / 2, y - 43, width, 13);
  ctx.fillStyle = accent;
  ctx.fillText(label, x, y - 33);
}
function drawObjectMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  near: boolean,
) {
  const pulse = Math.sin(Date.now() / 220) > 0,
    accent = "#70e0d0";
  ctx.fillStyle = "rgba(7,22,20,.85)";
  ctx.fillRect(x - 10, y - 8, 20, 15);
  ctx.strokeStyle = near ? accent : "rgba(112,224,208,.72)";
  ctx.lineWidth = near ? 3 : 2;
  ctx.strokeRect(x - 11, y - 9, 22, 17);
  ctx.fillStyle = accent;
  ctx.fillRect(x - 3, y - 5, 6, 6);
  ctx.fillRect(x - 1, y - 9 - (pulse ? 2 : 0), 2, 2);
  drawMarkerLabel(ctx, x, y - 18, name, accent, near);
}
function drawCorpseMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  near: boolean,
) {
  const accent = "#9d9481";
  ctx.fillStyle = "rgba(12,10,8,.78)";
  ctx.fillRect(x - 10, y + 1, 20, 7);
  ctx.fillStyle = "#d6cfba";
  ctx.fillRect(x - 5, y - 4, 10, 8);
  ctx.fillStyle = "#342e28";
  ctx.fillRect(x - 3, y - 1, 2, 2);
  ctx.fillRect(x + 2, y - 1, 2, 2);
  ctx.strokeStyle = accent;
  ctx.strokeRect(x - 11, y, 22, 9);
  drawMarkerLabel(ctx, x, y - 12, name, accent, near);
}
function drawDoorMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  near: boolean,
) {
  const pulse = Math.sin(Date.now() / 250) > 0,
    accent = "#8ee28f";
  ctx.fillStyle = "rgba(6,20,12,.84)";
  ctx.fillRect(x - 11, y - 14, 22, 23);
  ctx.strokeStyle = near ? accent : "rgba(142,226,143,.72)";
  ctx.lineWidth = near ? 3 : 2;
  ctx.strokeRect(x - 12, y - 15, 24, 25);
  ctx.fillStyle = accent;
  ctx.fillRect(x - 7, y - 10, 14, 3);
  ctx.fillRect(x - 7, y - 7, 3, 12);
  ctx.fillRect(x + 4, y - 7, 3, 12);
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 20 - (pulse ? 1 : 0));
  ctx.lineTo(x + 4, y - 20 - (pulse ? 1 : 0));
  ctx.lineTo(x, y - 16 - (pulse ? 1 : 0));
  ctx.fill();
  drawMarkerLabel(ctx, x, y - 27, name, accent, near, true);
}
function drawMarkerLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  accent: string,
  visible: boolean,
  always = false,
) {
  if (!visible && !always) return;
  const label = name.length > 8 ? `${name.slice(0, 8)}…` : name;
  ctx.font = `bold ${visible ? 10 : 9}px sans-serif`;
  ctx.textAlign = "center";
  const width = Math.ceil(ctx.measureText(label).width) + 8;
  ctx.fillStyle = visible ? "rgba(6,13,9,.94)" : "rgba(6,13,9,.78)";
  ctx.fillRect(x - width / 2, y - 11, width, 13);
  ctx.fillStyle = accent;
  ctx.fillText(label, x, y - 1);
}
function hash(text: string) {
  let n = 0;
  for (const c of text) n = (n * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${n} 45% 58%)`;
}
