"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  activePage,
  getOriginalMap,
  originalStart,
  passable,
  tileAt,
  triggerEvent,
  type WorldPosition,
} from "../game-core/original-world";
import {
  applySceneResolution,
  resolveSceneEvent,
  type SceneActorState,
} from "../game-core/scene-event";
import { selectSceneEvent } from "../game-core/rmxp-events";
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
  specialRound,
  type OriginalBattle,
} from "../game-core/original-battle";
import {
  bagEntries,
  derivedStats,
  maxFood,
  maxWater,
  activateEntry,
  type BagEntry,
} from "../game-core/inventory-system";
import {
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
  healWounds,
  meditateForce,
  meditateMagic,
  recoverHp,
  setForcePower,
  setMagicPower,
  practiceOnce,
  practiceOptions,
} from "../game-core/cultivation-system";
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
const newActor = (): SceneActorState => ({
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
  dance: 100,
  ball: 100,
});
const fresh = (): WorldSave => ({
  format: "rmxp-hero-original-world-save",
  version: 1,
  savedAt: new Date().toISOString(),
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
const loadSave = (): WorldSave => {
  if (typeof window === "undefined") return fresh();
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
  const [state, setState] = useState<WorldSave>(loadSave),
    [notice, setNotice] = useState("原版地图数据已载入"),
    [eventText, setEventText] = useState("");
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
  const [specialMenu, setSpecialMenu] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ tab: number; index: number } | null>(null);
  const [cultivation, setCultivation] = useState<number | null>(null);
  const [cultivationActive, setCultivationActive] = useState(false);
  const [caihua, setCaihua] = useState<{
    step: 1 | 2;
    index: number;
  } | null>(null);
  const [arcade, setArcade] = useState<ArcadeState | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    file = useRef<HTMLInputElement>(null),
    stateRef = useRef<WorldSave>(state),
    keys = useRef(new Set<string>()),
    held = useRef<Record<string, number>>({});
  const sync = useCallback((next: WorldSave) => {
    stateRef.current = next;
    setState(structuredClone(next));
  }, []);
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
        arcade
      )
        return;
      const s = structuredClone(stateRef.current),
        map = getOriginalMap(s.position.mapId);
      const direction = dx < 0 ? 4 : dx > 0 ? 6 : dy < 0 ? 8 : 2,
        nx = s.position.x + dx,
        ny = s.position.y + dy;
      s.position.direction = direction;
      if (!passable(map, nx, ny, direction)) {
        sync(s);
        return;
      }
      const blocking = map.events.find(
        (e) =>
          e.x === nx &&
          e.y === ny &&
          String(activePage(e).graphic?.character_name || "") &&
          !activePage(e).through,
      );
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
    const p = stateRef.current.position,
      d =
        p.direction === 2
          ? [0, 1]
          : p.direction === 4
            ? [-1, 0]
            : p.direction === 6
              ? [1, 0]
              : [0, -1];
    if (!runAt(p.x + d[0], p.y + d[1])) setNotice("这里没有可以触发的事件");
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
          const result = acceptFreeWork(next.actor, tasks, random);
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
        const r = resolveSceneEvent(
          { type: 0, id },
          next.actor,
          id + next.position.mapId,
        );
        setEventText(`${npcRecord(id).name}\n${r.lines.join("\n")}`);
      } else if (option === "status") setEventText(npcStatus(id).join("\n"));
      else if (option === "battle")
        setBattle(beginOriginalBattle(id, id + next.position.mapId));
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
  const leaveBattle = useCallback(() => {
    if (!battle) return;
    const next = structuredClone(stateRef.current);
    let altarText = "";
    if (battle.finished === "win") {
      if (battle.enemyId === 198 && next.tasks.wantedPlace > 0) {
        altarText = finishWantedTask(next.actor, next.tasks).text;
      }
      if (next.tasks.killId === battle.enemyId) next.tasks.killId = -1;
      const altarId = battle.enemyId - 162;
      if (altarId === next.actor.tanId && altarId >= 1 && altarId <= 8) {
        const mapKey = `1:${20 + altarId}`;
        if ((next.actor.inventory[mapKey] || 0) > 0) {
          next.actor.inventory[mapKey]--;
          if (next.actor.inventory[mapKey] <= 0)
            delete next.actor.inventory[mapKey];
        }
        next.actor.killList = Array.from(
          new Set([...(next.actor.killList || []), battle.enemyId]),
        );
        altarText = giveTanReward(next.actor).text;
      }
    }
    endSpar(next.actor, battle);
    sync(next);
    setBattle(null);
    setSpecialMenu(null);
    setNotice(
      battle.finished === "win"
        ? altarText
          ? `切磋得胜 · ${altarText}`
          : "切磋得胜"
        : battle.finished === "lose"
          ? "切磋结束，已恢复少量气血"
          : "你退出了切磋",
    );
  }, [battle, sync]);
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
  const cultivate = useCallback(
    (index: number) => {
      const next = structuredClone(stateRef.current);
      let text = "";
      if (index === 0) {
        const result = meditateForce(next.actor);
        text = !result.ok
          ? "尚未装备内功。"
          : result.capped
            ? "内功修为不足，内力上限无法继续提高。"
            : result.increased
              ? "打坐周天完成，内力上限提高一点。"
              : "你凝神打坐，内息渐长。";
      } else if (index === 1) {
        const result = meditateMagic(next.actor);
        text = !result.ok
          ? "尚未装备法术。"
          : result.capped
            ? "法术修为不足，法力上限无法继续提高。"
            : result.increased
              ? "冥思完成，法力上限提高一点。"
              : "你闭目冥思，法力渐长。";
      } else if (index === 2) {
        text = recoverHp(next.actor)
          ? "吸气调息，气血已经恢复。"
          : "当前无法吸气恢复。";
      } else if (index === 3) {
        text = healWounds(next.actor)
          ? "运功疗伤，伤势有所恢复。"
          : "当前条件不足以疗伤。";
      } else if (index === 4) {
        text = `当前加力设为 ${setForcePower(next.actor, next.actor.fpPlus + 10)}。`;
      } else {
        const options = practiceOptions(next.actor);
        if (index >= 6) {
          text = practiceOnce(next.actor, options[index - 6]?.id || 0).text;
        } else {
          text = `当前法点设为 ${setMagicPower(next.actor, next.actor.mpPlus + 10)}。`;
        }
      }
      sync(next);
      setNotice(text);
    },
    [sync],
  );
  const rememberArcadeScore = useCallback(
    (kind: "dance" | "ball", score: number) => {
      const next = structuredClone(stateRef.current);
      next.actor[kind] = Math.max(next.actor[kind] || 100, score);
      sync(next);
    },
    [sync],
  );
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        if (
          [
            "arrowup",
            "arrowdown",
            "arrowleft",
            "arrowright",
            " ",
            "tab",
          ].includes(k)
        )
          e.preventDefault();
        keys.current.add(k);
        const confirm = ["z", "enter", " "].includes(k),
          cancel = ["x", "escape"].includes(k);
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
          else if (confirm) fight();
          else if (cancel) leaveBattle();
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
        if (cultivation !== null) {
          const length = 6 + practiceOptions(stateRef.current.actor).length;
          if (cultivationActive) {
            if (cancel) setCultivationActive(false);
            return;
          }
          if (k === "arrowup" || k === "w")
            setCultivation((cultivation + length - 1) % length);
          else if (k === "arrowdown" || k === "s")
            setCultivation((cultivation + 1) % length);
          else if (confirm) {
            if (cultivation <= 1 || cultivation >= 6)
              setCultivationActive(true);
            else cultivate(cultivation);
          } else if (cancel || k === "r") setCultivation(null);
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
            activateBagEntry(entries[menu.index]);
          else if (confirm && menu.tab === 2)
            activateSkill(skills[menu.index]?.id);
          else if ((k === "c" || k === "r") && menu.tab === 2)
            activateSkill(skills[menu.index]?.id, true);
          else if (cancel || k === "m" || k === "e") setMenu(null);
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
            if (cancel) setStudyActive(false);
            return;
          }
          if (k === "arrowup" || k === "w")
            setStudy({
              ...study,
              index: (study.index + list.length - 1) % list.length,
            });
          else if (k === "arrowdown" || k === "s")
            setStudy({ ...study, index: (study.index + 1) % list.length });
          else if (confirm) setStudyActive(true);
          else if (cancel) setStudy(null);
          return;
        }
        if (confirm) interact();
        else if (k === "f") save();
        else if (k === "r") setCultivation(0);
        else if (k === "t")
          setEventText(
            `任务簿\n${taskJournal(stateRef.current.tasks).join("\n")}`,
          );
        else if (["m", "e", "tab"].includes(k)) setMenu({ tab: 0, index: 0 });
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
    buySelected,
    caihua,
    chooseNpc,
    cultivate,
    cultivation,
    cultivationActive,
    eventText,
    fight,
    interact,
    leaveBattle,
    menu,
    npcMenu,
    save,
    shop,
    study,
    studyActive,
    studySelected,
    activateBagEntry,
    activateSkill,
    arcade,
    specialMenu,
    fightSpecial,
    rememberArcadeScore,
    sync,
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
  }, [move]);
  useEffect(() => {
    if (battle) return;
    const id = window.setInterval(() => {
      const next = structuredClone(stateRef.current);
      digestActor(next.actor);
      next.tasks.clock += 15;
      sync(next);
    }, 15000);
    return () => window.clearInterval(id);
  }, [battle, sync]);
  useEffect(() => {
    if (!cultivationActive || cultivation === null) return;
    const id = window.setInterval(() => cultivate(cultivation), 1000 / 120);
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
    URL.revokeObjectURL(a.href);
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
      setNotice("JSON 读取成功");
    } catch {
      setNotice("存档格式无效");
    }
  };
  const map = getOriginalMap(state.position.mapId);
  return (
    <main className="world-shell">
      <header>
        <Link href="/">← 云游志</Link>
        <div>
          <b>原版世界</b>
          <span>69 MAP DATA RUNTIME</span>
        </div>
        <button onClick={save}>
          保存 <kbd>F</kbd>
        </button>
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
            title={studyActive ? "研习中 · X 停止" : "请教何种功夫"}
            items={(study.book
              ? bookStudyOptions(study.id)
              : studyOptions(study.id)
            ).map((g) => `${g.name} · 上限${g.maxLevel}`)}
            index={study.index}
            choose={(i) => {
              setStudy({ ...study, index: i });
              studyAt(study.id, i);
            }}
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
            activate={activateBagEntry}
            activateKf={activateSkill}
          />
        )}
        {cultivation !== null && (
          <Choice
            title={cultivationActive ? "修炼中 · X 停止" : "修炼调息"}
            items={[
              "打坐 · 提升内力",
              "冥思 · 提升法力",
              "吸气 · 恢复气血",
              "疗伤 · 恢复伤势",
              `加力 +10 · 当前 ${state.actor.fpPlus}`,
              `法点 +10 · 当前 ${state.actor.mpPlus}`,
              ...practiceOptions(state.actor).map(
                (skill) => `练习 ${skill.name} · ${skill.level} 级`,
              ),
            ]}
            index={cultivation}
            choose={cultivate}
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
        <div>
          <small>当前位置</small>
          <b>{map.name}</b>
          <em>
            Map {map.id} · {map.width}×{map.height}
          </em>
        </div>
        <div>
          <small>气血 / 内力</small>
          <b>
            {state.actor.hp} / {state.actor.fp}
          </b>
        </div>
        <div>
          <small>银两 / 潜能</small>
          <b>
            {state.actor.gold} / {state.actor.potential}
          </b>
        </div>
        <p>{notice}</p>
        <nav>
          <button onClick={() => setMenu({ tab: 0, index: 0 })}>
            行囊 <kbd>M</kbd>
          </button>
          <button onClick={() => setCultivation(0)}>
            修炼 <kbd>R</kbd>
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
        <kbd>方向键</kbd> · 互动 <kbd>Z</kbd>
        <kbd>Enter</kbd> · 菜单 <kbd>M</kbd>
        <kbd>Tab</kbd> · 修炼 <kbd>R</kbd> · 返回 <kbd>Esc</kbd>
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
        <small>W/S 选择 · Z/Enter 确认 · X/Esc 返回</small>
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
        Z/Enter 开始游标，再按一次投球 · 命中区 110–128 · X/Esc 离开
      </small>
    </section>
  );
}

function Choice({
  title,
  items,
  index,
  choose,
}: {
  title: string;
  items: string[];
  index: number;
  choose: (index: number) => void;
}) {
  return (
    <div className="world-choice">
      <b>{title}</b>
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
      <small>W/S 选择 · Z 确认 · X 返回</small>
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
}: {
  battle: OriginalBattle;
  hp: number;
  maxHp: number;
  fight: () => void;
  leave: () => void;
  openSpecial: () => void;
}) {
  return (
    <div className="battle">
      <div className="battle-stage">
        <div className="fighter hero">
          <i />
          <span>少侠</span>
        </div>
        <b>切磋 · 第 {battle.turn + 1} 回合</b>
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
          {battle.finished ? "结束切磋" : "普通攻击"} <kbd>Z</kbd>
        </button>
        <button onClick={openSpecial}>
          绝招 <kbd>Q</kbd>
        </button>
        <button onClick={leave}>
          退出 <kbd>X</kbd>
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
      <footer>W/S 选择 · Z 施展 · X 返回</footer>
    </div>
  );
}
function GameMenu({
  actor,
  menu,
  setMenu,
  activate,
  activateKf,
}: {
  actor: SceneActorState;
  menu: { tab: number; index: number };
  setMenu: (value: { tab: number; index: number } | null) => void;
  activate: (entry?: BagEntry) => void;
  activateKf: (id?: number, parry?: boolean) => void;
}) {
  const tabs = ["行囊", "状态", "功夫"],
    entries = bagEntries(actor),
    stats = derivedStats(actor);
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
        <section className="status-grid">
          <b>江湖少侠 · {actor.age} 岁</b>
          <span>
            气血 {actor.hp}/{actor.maxHp}
          </span>
          <span>
            内力 {actor.fp}/{actor.maxFp}
          </span>
          <span>膂力 {stats.str}</span>
          <span>敏捷 {stats.agi}</span>
          <span>悟性 {stats.int}</span>
          <span>根骨 {stats.bon}</span>
          <span>攻击 {stats.atk}</span>
          <span>防御 {stats.pdef}</span>
          <span>
            饱食 {actor.food}/{maxFood(actor)}
          </span>
          <span>
            饮水 {actor.water}/{maxWater(actor)}
          </span>
          <span>经验 {actor.exp}</span>
          <span>潜能 {actor.potential}</span>
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
        A/D 或 Tab 切页 · W/S 选择 · Z 装配 · C/R 设为招架 · X 关闭
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
    <section className="skill-list">
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
            <em>{skill.points} 点</em>
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
    const page = activePage(e),
      g = page.graphic || {},
      name = String(g.character_name || "");
    if (name)
      drawActor(
        ctx,
        (e.x - sx) * T + 16,
        (e.y - sy) * T + 23,
        hash(e.name),
        false,
      );
    else if (page.commands.some((c) => c.code === 201)) {
      ctx.fillStyle = "rgba(210,177,92,.65)";
      ctx.fillRect((e.x - sx) * T + 12, (e.y - sy) * T + 12, 8, 8);
    }
  }
  if (
    state.tasks.wantedPlace === pos.mapId &&
    state.tasks.wantedX >= sx &&
    state.tasks.wantedY >= sy &&
    state.tasks.wantedX < sx + 20 &&
    state.tasks.wantedY < sy + 15
  )
    drawActor(
      ctx,
      (state.tasks.wantedX - sx) * T + 16,
      (state.tasks.wantedY - sy) * T + 23,
      state.tasks.wantedGender ? "#a94b57" : "#80403b",
      false,
    );
  drawActor(ctx, (pos.x - sx) * T + 16, (pos.y - sy) * T + 23, "#dce8ec", true);
  ctx.fillStyle = "rgba(5,10,7,.75)";
  ctx.fillRect(0, 0, W, 30);
  ctx.fillStyle = "#eadcae";
  ctx.font = "bold 15px serif";
  ctx.textAlign = "left";
  ctx.fillText(map.name, 14, 20);
  ctx.textAlign = "right";
  ctx.font = "10px monospace";
  ctx.fillStyle = "#9aaa9e";
  ctx.fillText(`MAP ${map.id}  ${pos.x},${pos.y}`, W - 14, 19);
}
function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: number,
  layer: number,
) {
  if (!id) return;
  const h = (id * 47) % 360;
  if (layer === 0) {
    ctx.fillStyle = `hsl(${80 + (id % 35)} 22% ${24 + (id % 5) * 3}%)`;
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "rgba(255,255,255,.035)";
    ctx.fillRect(x + ((id * 7) % 25), y + ((id * 11) % 25), 3, 3);
  } else {
    ctx.fillStyle = `hsl(${h} ${28 + layer * 8}% ${31 + layer * 7}%)`;
    const kind = id % 7;
    if (kind < 2) {
      ctx.fillRect(x + 3, y + 4, T - 6, T - 7);
      ctx.fillStyle = "rgba(15,18,15,.32)";
      ctx.fillRect(x + 3, y + 22, T - 6, 7);
    } else if (kind < 4) {
      ctx.fillRect(x + 13, y + 3, 6, 27);
      ctx.fillRect(x + 7, y + 5, 18, 12);
    } else {
      ctx.fillRect(x + 4, y + 10, 24, 18);
      ctx.fillStyle = "rgba(240,220,170,.15)";
      ctx.fillRect(x + 7, y + 13, 18, 3);
    }
  }
}
function drawActor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  hero: boolean,
) {
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(x - 9, y + 5, 18, 4);
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
function hash(text: string) {
  let n = 0;
  for (const c of text) n = (n * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${n} 45% 58%)`;
}
