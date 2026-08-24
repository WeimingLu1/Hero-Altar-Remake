"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  canMoveBetween,
  getOriginalMap,
  triggerEvent,
} from "../game-core/original-world";
import { ambientNpcAt } from "../game-core/ambient-npc";
import {
  applySceneResolution,
  resolveSceneEvent,
} from "../game-core/scene-event";
import {
  parseSceneGate,
  selectSceneEvent,
} from "../game-core/rmxp-events";
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
  canStudyWithNpc,
  npcOptionLabel,
  npcOptions,
  npcRecord,
  npcStatus,
  resolveSpecialNpcTalk,
  shopGoods,
  studyOnce,
  studyOptions,
  type NpcOption,
} from "../game-core/npc-system";
import {
  battleRound,
  battleItemRound,
  beginOriginalBattle,
  endSpar,
  attemptEscape,
  specialRound,
  type OriginalBattle,
} from "../game-core/original-battle";
import {
  bagEntries,
  activateEntry,
  activateBattleEntry,
  battleBagEntries,
  discardEntry,
  type BagEntry,
} from "../game-core/inventory-system";
import {
  effectiveLevel,
  equipSkill,
  learnedSkills,
  toggleParry,
} from "../game-core/skill-system";
import {
  autoEquipSpecialRequirements,
  battleSpecials,
} from "../game-core/special-system";
import { digestActor } from "../game-core/survival-system";
import {
  acceptFreeWork,
  acceptMainTask,
  acceptWantedTask,
  claimMainReward,
  completeHiddenQuest,
  finishFreeWork,
  finishMainTask,
  hiddenQuestOffer,
  finishStoneTask,
  finishWantedTask,
  giveTanReward,
  startStoneTask,
  startTanQuest,
  taskJournal,
  wantedEnemyRecord,
} from "../game-core/task-system";
import {
  abandonGeneratedQuest,
  acceptGeneratedQuest,
  advanceGeneratedQuestAfterDialogue,
  appendGeneratedQuestTranscript,
  claimGeneratedQuestReward,
  createGeneratedQuestDraft,
  declineGeneratedQuest,
  failGeneratedQuest,
  generatedQuestFallbackText,
  generatedQuestEligibleKinds,
  generatedQuestInteraction,
  generatedQuestObjective,
  generatedQuestParticipant,
  generatedQuestPrompt,
  markGeneratedQuestBattleWin,
  shouldOfferGeneratedQuest,
  type GeneratedQuestDraft,
  type GeneratedQuestNpcRef,
} from "../game-core/generated-task-system";
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
  cheatStats,
  maxCheatSkill,
  maxCheatStat,
  setCheatSkill,
  type CheatQuickAction,
} from "../game-core/cheat-system";
import { actorStatusProfile } from "../game-core/status-system";
import { buildNpcSystemPrompt, npcLore } from "../game-core/npc-lore";
import {
  battleEffectKind,
  buildBattleNarrationFallback,
  buildBattleNarrationFacts,
  buildBattleNarrationPrompt,
  type BattleNarrative,
  type BattleNarrationEvent,
} from "../game-core/battle-narration";
import {
  probeLlmHealth,
  streamNpcReply,
  type ChatMessage,
} from "../game-core/lm-studio";
import { cleanActiveDialogue, parseNpcDialogue } from "../game-core/ambient-dialogue";
import { FixedStepClock } from "../game-core/fixed-step-clock";
import {
  normalizeGameKey,
  resolveGameKey,
  type InputContext,
} from "../game-core/game-input";
import { readJsonStorage, writeJsonStorage } from "../game-core/safe-storage";
import { MAX_PLAYER_EXP } from "../game-core/progression-limits";
import {
  fresh,
  LOCAL_SAVE_KEY,
  newActor,
  parseSave,
  type WorldSave,
} from "../game-core/save-system";
import { canObtainCaihua } from "../game-core/actor-conditions";
import {
  isCancelKey,
  isConfirmKey,
  isMainMenuKey,
  isMenuTabKey,
  menuTabFromKey,
} from "./keybindings";
import {
  CharacterPortrait,
  drawWorld,
  eventVisual,
  loadWorldArt,
  npcDisplayName,
  WORLD_HEIGHT as H,
  WORLD_WIDTH as W,
} from "./world-renderer";
import {
  allCheatSkills,
  Arcade,
  BattleView,
  BattleBagPicker,
  BattleSkillPicker,
  Choice,
  GameMenu,
  LifeMenu,
  organizedBagEntries,
  organizedSkills,
  SpecialPicker,
  StatusBar,
  type ArcadeState,
  type LifeState,
} from "./world-ui";
import {
  buildAutoPlayerPrompt,
  useAmbientRuntime,
} from "./use-ambient-runtime";
import "./world.css";
import "./choice.css";
import "./battle.css";
import "./special.css";
import "./menu.css";

// 标题页与操作说明统一由首页 OriginalEntry 呈现，世界内只剩序章/创建/游玩。
export type LaunchScreen = "intro" | "create" | "play";
type CreatorState = {
  step: 1 | 2;
  index: number;
  name: string;
  gender: number;
  attrs: [number, number, number, number];
};
type NpcQuestReplyMode =
  | "issuer-reminder"
  | "visit-target"
  | "battle-target"
  | "post-battle"
  | "report"
  | "accept-close"
  | "accept-battle"
  | "decline-close"
  | null;
type NpcChatState = {
  id: number;
  mapId: number;
  eventId: number;
  phase: "original" | "llm";
  originalLines: string[];
  originalIndex: number;
  messages: NpcDialogueMessage[];
  loading: boolean;
  auto: boolean;
  error: string;
  replyCount: number;
  offeredThisSession: boolean;
  plannedQuest: GeneratedQuestDraft | null;
  pendingQuest: GeneratedQuestDraft | null;
  questChoice: 0 | 1;
  questReady: boolean;
  questReplyMode: NpcQuestReplyMode;
  terminal: "close" | "battle" | null;
  started: boolean;
  shownAt: number;
};
// 自动交谈一次开启最多推进的步数(约 12 轮往返)；到达后自动关闭，
// 避免挂机时无限消耗本地模型资源。
const NPC_AUTO_TURN_LIMIT = 24;

const npcChatRef = (chat: Pick<NpcChatState, "id" | "mapId" | "eventId">): GeneratedQuestNpcRef => ({
  npcId: chat.id,
  mapId: chat.mapId,
  eventId: chat.eventId,
});
type NpcDialogueMessage =
  | { role: "user"; speech: string; action: string }
  | {
      role: "assistant";
      state: string;
      action: string;
      speech: string;
      raw: string;
      npcId?: number;
    };
const startFixedStepLoop = (onStep: () => boolean | void) => {
  const clock = new FixedStepClock({
    onStep: () => {
      if (onStep() === false) clock.pause();
    },
  });
  const syncVisibility = () => {
    if (document.hidden) clock.pause();
    else if (clock.state === "paused") clock.resume();
    else if (clock.state === "idle") clock.start();
  };
  document.addEventListener("visibilitychange", syncVisibility);
  syncVisibility();
  return () => {
    document.removeEventListener("visibilitychange", syncVisibility);
    clock.dispose();
  };
};
const storageFailureNotice = (reason: "missing" | "unavailable" | "invalid" | "quota") => {
  if (reason === "quota") return "浏览器存储空间已满，请立即导出 JSON 备份。";
  if (reason === "invalid") return "存档无法序列化，请立即导出 JSON 备份。";
  return "浏览器存储不可用，请立即导出 JSON 备份。";
};
const seeded = (seed: number) => {
  let value = seed >>> 0;
  return (max: number) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return Math.floor((value / 4294967296) * Math.max(1, max));
  };
};

export default function OriginalWorld({
  initialScreen = "intro",
  initialSave,
  restoreLocalSave = true,
  exitToTitle,
}: {
  initialScreen?: LaunchScreen;
  initialSave?: WorldSave;
  restoreLocalSave?: boolean;
  /** 返回统一标题页：由宿主（OriginalEntry）提供，缺省回退首页路由。 */
  exitToTitle?: () => void;
} = {}) {
  const [state, setState] = useState<WorldSave>(() => initialSave || fresh()),
    [notice, setNotice] = useState("原版地图数据已载入"),
    [eventText, setEventText] = useState(""),
    [eventNpcId, setEventNpcId] = useState<number | null>(null);
  const [screen, setScreen] = useState<LaunchScreen>(initialScreen);
  const [creator, setCreator] = useState<CreatorState>({
    step: 1,
    index: 0,
    name: "",
    gender: 0,
    attrs: [20, 20, 20, 20],
  });
  const [npcMenu, setNpcMenu] = useState<{
    id: number;
    mapId: number;
    eventId: number;
    index: number;
  } | null>(
      null,
    ),
    [npcChat, setNpcChat] = useState<NpcChatState | null>(null),
    [shop, setShop] = useState<{ id: number; index: number } | null>(null),
    [study, setStudy] = useState<{
      id: number;
      index: number;
      book?: boolean;
    } | null>(null);
  const [studyActive, setStudyActive] = useState(false);
  const [battle, setBattle] = useState<OriginalBattle | null>(null);
  // 铸剑挑战首轮：先显示文字说明，玩家确认后再进入战斗。
  const [pendingSwordBattle, setPendingSwordBattle] =
    useState<OriginalBattle | null>(null);
  const [battleNarratives, setBattleNarratives] = useState<BattleNarrative[]>([]);
  const [battleOutcome, setBattleOutcome] = useState<number | null>(null);
  const [battleItem, setBattleItem] = useState<number | null>(null);
  const [specialMenu, setSpecialMenu] = useState<number | null>(null);
  const [battleSkill, setBattleSkill] = useState<number | null>(null);
  // 主菜单：tab 0=行囊 1=状态 2=功夫 3=秘技；sub 为秘技子页签(0-5)。
  const [menu, setMenu] = useState<{
    tab: number;
    index: number;
    sub: number;
  } | null>(null);
  const [cheatConfirm, setCheatConfirm] = useState<{
    action: CheatQuickAction;
    index: number;
  } | null>(null);
  const [itemConfirm, setItemConfirm] = useState<{
    entry: BagEntry;
    index: number;
    source: "menu" | "battle";
  } | null>(null);
  // 隐藏交换的确认弹窗。
  const [hiddenConfirm, setHiddenConfirm] = useState<{
    npcId: number;
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
  const [taskBook, setTaskBook] = useState<{ index: number; confirmAbandon: boolean } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    file = useRef<HTMLInputElement>(null),
    nameInput = useRef<HTMLInputElement>(null),
    chatAbort = useRef<AbortController | null>(null),
    battleNarrationAbort = useRef<AbortController | null>(null),
    battleNarrativesRef = useRef<BattleNarrative[]>([]),
    llmHealthCache = useRef<{ checkedAt: number; ok: boolean } | null>(null),
    runtimeMounted = useRef(true),
    stateRef = useRef<WorldSave>(state),
    keys = useRef(new Set<string>()),
    held = useRef<Record<string, number>>({}),
    // 自动交谈已推进的步数；防止挂机时主角与 NPC 无限互相接话耗尽本地模型。
    autoTurnsRef = useRef(0);
  const ambientShouldPause =
      screen !== "play" ||
      Boolean(
        eventText ||
          npcMenu ||
          npcChat ||
          shop ||
          study ||
          battle ||
          menu ||
          cheatConfirm ||
          itemConfirm ||
          hiddenConfirm ||
          cultivation !== null ||
          flyMenu !== null ||
          caihua ||
          arcade ||
          life ||
          taskBook,
      ),
    {
      ambientWorld,
      ambientPlayer,
      interruptAmbientPlayerConversation,
    } = useAmbientRuntime({
      active: screen === "play",
      shouldPause: ambientShouldPause,
      mapId: state.position.mapId,
      killList: state.actor.killList,
      inventory: state.actor.inventory,
      stateRef,
    });
  useEffect(() => {
    runtimeMounted.current = true;
    return () => {
      runtimeMounted.current = false;
      const activeChat = chatAbort.current,
        activeNarration = battleNarrationAbort.current;
      chatAbort.current = null;
      battleNarrationAbort.current = null;
      activeChat?.abort();
      activeNarration?.abort();
    };
  }, []);
  const sync = useCallback((next: WorldSave) => {
    // 调用方传入的 next 一律是刚 structuredClone 出来的私有副本(或新解析的
    // 导入对象)，此处原地归一化即可；只为 React 再克隆一份，避免每次操作
    // 对整档做三次深拷贝。
    const normalized = next;
    normalized.actor.exp = Math.min(normalized.actor.exp, MAX_PLAYER_EXP);
    const quest = normalized.tasks.generatedQuest;
    if (
      quest &&
      quest.stage !== "failed" &&
      ((normalized.actor.killList || []).includes(quest.issuer.npcId) ||
        (normalized.actor.killList || []).includes(quest.target.npcId) ||
        normalized.tasks.killId === quest.issuer.npcId ||
        normalized.tasks.killId === quest.target.npcId)
    )
      failGeneratedQuest(
        normalized.tasks,
        "原作任务或人物存亡已经与这条奇遇冲突，原作流程优先，奇遇宣告失败。",
      );
    stateRef.current = normalized;
    setState(structuredClone(normalized));
  }, []);
  useEffect(() => loadWorldArt(), []);
  useEffect(() => {
    if (!restoreLocalSave) return;
    const id = window.setTimeout(() => {
      const stored = readJsonStorage(LOCAL_SAVE_KEY);
      if (!stored.ok) {
        if (stored.reason === "invalid")
          setNotice("本地存档 JSON 已损坏，原数据未删除；请读取备份或开始新游戏。");
        else if (stored.reason === "unavailable")
          setNotice("浏览器无法读取本地存档；仍可游玩，请及时导出 JSON 备份。");
        return;
      }
      const parsed = parseSave(stored.value);
      if (!parsed.ok) {
        setNotice("本地存档格式无效，原数据未删除；请读取备份或开始新游戏。");
        return;
      }
      sync(parsed.value);
    }, 0);
    return () => window.clearTimeout(id);
  }, [restoreLocalSave, sync]);
  const save = useCallback(() => {
    const next = { ...stateRef.current, savedAt: new Date().toISOString() };
    const written = writeJsonStorage(LOCAL_SAVE_KEY, next);
    if (written.ok) {
      sync(next);
      setNotice("原版世界进度已保存");
    } else {
      setNotice(`保存失败：${storageFailureNotice(written.reason)}`);
    }
  }, [sync]);
  // 铸剑挑战：未通过则先打四轮墨邪(149)；已通过则打开铸剑界面。
  const startSwordChallenge = useCallback(() => {
    const s = stateRef.current;
    if (s.actor.swordBattle) {
      setLife({ kind: "forge", index: 0 });
      return;
    }
    if (s.actor.exp < 150000) {
      setEventText("干匠\n你的江湖阅历还不足以接受铸剑挑战。");
      return;
    }
    // 原版：墨邪被击杀后干匠不再提供铸剑挑战。
    if ((s.actor.killList || []).includes(149)) {
      setEventText("干匠\n墨邪已不在人世，无人再能试你的功夫了。");
      return;
    }
    const nextForge = structuredClone(s),
      required = [8, 15, 25, 21],
      weaponNames = ["钢刀", "长剑", "钢杖", "长鞭"];
    nextForge.actor.forgeChallengeStep = 0;
    nextForge.actor.inventory[`2:${required[0]}`] = 1;
    nextForge.actor.weaponId = required[0];
    sync(nextForge);
    // 首轮先给文字说明，玩家确认后再进入战斗。
    setEventText(
      `干匠\n先让我的夫人墨邪试试你对${weaponNames[0]}的掌握吧。这是铸剑挑战第 1/4 轮，装备${weaponNames[0]}击败墨邪。`,
    );
    setPendingSwordBattle(
      beginOriginalBattle(149, s.tasks.clock + 149, undefined, "story"),
    );
  }, [sync]);
  const advanceEventText = useCallback(() => {
    const pending = pendingSwordBattle;
    setPendingSwordBattle(null);
    setEventText("");
    setEventNpcId(null);
    if (pending) setBattle(pending);
  }, [pendingSwordBattle]);
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
        canGetCaihua: canObtainCaihua(s.actor),
      });
      if (sceneCall && !automatic) {
        if (sceneCall.type === 0 && sceneCall.id !== undefined) {
          setNpcMenu({
            id: sceneCall.id,
            mapId: s.position.mapId,
            eventId: event.id,
            index: 0,
          });
          return true;
        }
        const next = structuredClone(s),
          resolution = resolveSceneEvent(
            sceneCall,
            next.actor,
            event.id + s.position.mapId,
            {
              wantedPlace: s.tasks.wantedPlace,
              wantedName: s.tasks.wantedName,
              mapName: map.name,
            },
          );
        if (sceneCall.type === 6) {
          setArcade({ kind: "select", index: 0 });
          return true;
        }
        if (sceneCall.type === 14) {
          startSwordChallenge();
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
        if (resolution.taskTimeDelta) {
          // 喝酒只加速通缉/石料循环，不推进主任务期限时钟。
          next.tasks.wantedStarted += resolution.taskTimeDelta;
          next.tasks.stoneStartedAt += resolution.taskTimeDelta;
        } else next.tasks.clock += resolution.playTimeDelta || 0;
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
        const gate = parseSceneGate(result.source);
        if (
          gate?.itemId !== undefined &&
          gate.scene &&
          [8, 13, 15, 16].includes(gate.scene.type)
        ) {
          const itemName = String(
            originalTables.items[gate.itemId]?.name || `物品${gate.itemId}`,
          );
          const stoneProgress =
            gate.itemId === 19
              ? `，当前 ${s.actor.stoneList?.length || 0}/${gate.itemCount ?? 6}`
              : "";
          setNotice(`需要「${itemName}」才能进入${stoneProgress}`);
        } else setNotice("尚未满足该事件的原版触发条件");
        return true;
      }
      return page.trigger > 0;
    },
    [sync, startSwordChallenge],
  );
  const move = useCallback(
    (dx: number, dy: number) => {
      interruptAmbientPlayerConversation();
      if (
        eventText ||
        npcMenu ||
        shop ||
        study ||
        battle ||
        menu ||
        cheatConfirm ||
        itemConfirm ||
        hiddenConfirm ||
        caihua ||
        cultivation !== null ||
        flyMenu !== null ||
        arcade ||
        life ||
        taskBook
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
      const ambientBlocking = ambientNpcAt(ambientWorld.current, nx, ny);
      const wantedBlocking =
        s.tasks.wantedPlace === s.position.mapId &&
        s.tasks.wantedX === nx &&
        s.tasks.wantedY === ny;
      if (
        !ambientBlocking &&
        !wantedBlocking &&
        canMoveBetween(map, s.position.x, s.position.y, direction)
      ) {
        if (npcChat) {
          chatAbort.current?.abort();
          chatAbort.current = null;
          setNpcChat(null);
        }
        s.position.x = nx;
        s.position.y = ny;
        sync(s);
        runAt(nx, ny, true);
      } else sync(s);
    },
    [
      ambientWorld,
      battle,
      caihua,
      cheatConfirm,
      cultivation,
      arcade,
      life,
      taskBook,
      eventText,
      flyMenu,
      hiddenConfirm,
      interruptAmbientPlayerConversation,
      itemConfirm,
      menu,
      npcMenu,
      npcChat,
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
      npc = candidates.map(([x, y]) => ambientNpcAt(ambientWorld.current, x, y)).find(Boolean),
      interactive = candidates.find(([x, y]) => {
        const event = map.events.find((e) => e.x === x && e.y === y);
        const kind = event ? eventVisual(event, s).kind : "none";
        return event && kind !== "none" && kind !== "corpse" && kind !== "npc";
      });
    if (npc) {
      runAt(npc.homeX, npc.homeY);
      return;
    }
    if (interactive) {
      runAt(interactive[0], interactive[1]);
      return;
    }
    if (!runAt(p.x + d[0], p.y + d[1]))
      setNotice("靠近人物并按 E / Enter 互动");
  }, [ambientWorld, runAt]);
  const openOriginalNpcConversation = useCallback((
    id: number,
    source: string | string[],
    ref?: GeneratedQuestNpcRef,
  ) => {
    const identity = ref || {
      npcId: id,
      mapId: stateRef.current.position.mapId,
      eventId: -1,
    };
    const lines = (Array.isArray(source) ? source : source.split("\n"))
      .map((line) => line.trim())
      .filter((line) => line && line !== npcDisplayName(id));
    const first = lines[0] || "……";
    chatAbort.current?.abort();
    chatAbort.current = null;
    setEventText("");
    setEventNpcId(null);
    setNpcChat({
      id,
      mapId: identity.mapId,
      eventId: identity.eventId,
      phase: "original",
      originalLines: lines.length ? lines : [first],
      originalIndex: 0,
      messages: [{
        role: "assistant",
        npcId: id,
        state: "",
        action: "",
        speech: first,
        raw: first,
      }],
      loading: false,
      auto: false,
      error: "",
      replyCount: 0,
      offeredThisSession: false,
      plannedQuest: null,
      pendingQuest: null,
      questChoice: 0,
      questReady: false,
      questReplyMode: null,
      terminal: null,
      started: true,
      shownAt: Date.now(),
    });
  }, []);
  const fixedNpcDialogue = useCallback((id: number) => {
    const current = stateRef.current,
      resolution = resolveSceneEvent(
        { type: 0, id },
        current.actor,
        id + current.position.mapId,
      );
    openOriginalNpcConversation(id, resolution.lines);
  }, [openOriginalNpcConversation]);
  const questTranscriptMessages = useCallback((ref: GeneratedQuestNpcRef): NpcDialogueMessage[] => {
    const quest = stateRef.current.tasks.generatedQuest;
    if (!quest || generatedQuestInteraction(quest, ref) === null) return [];
    return quest.transcript.flatMap((entry): NpcDialogueMessage[] => {
      if (entry.speaker === "system") return [];
      if (entry.speaker === "player")
        return [{ role: "user", action: entry.action || "", speech: entry.speech }];
      return [{
        role: "assistant",
        npcId: entry.npcId,
        state: entry.state || "",
        action: entry.action || "",
        speech: entry.speech,
        raw: entry.speech,
      }];
    });
  }, []);
  const openNpcConversation = useCallback(async (
    id: number,
    fallbackToFixed = true,
    ref?: GeneratedQuestNpcRef,
  ) => {
    autoTurnsRef.current = 0;
    const identity = ref || {
      npcId: id,
      mapId: stateRef.current.position.mapId,
      eventId: -1,
    };
    const controller = new AbortController();
    chatAbort.current?.abort();
    chatAbort.current = controller;
    setEventNpcId(null);
    setNpcChat({
      id,
      mapId: identity.mapId,
      eventId: identity.eventId,
      phase: "llm",
      originalLines: [],
      originalIndex: 0,
      messages: [],
      loading: true,
      auto: false,
      error: "",
      replyCount: 0,
      offeredThisSession: false,
      plannedQuest: null,
      pendingQuest: null,
      questChoice: 0,
      questReady: false,
      questReplyMode: null,
      terminal: null,
      started: false,
      shownAt: Date.now(),
    });
    const cached = llmHealthCache.current,
      now = Date.now();
    let healthy = cached && now - cached.checkedAt < 30_000 ? cached.ok : false;
    if (!cached || now - cached.checkedAt >= 30_000) {
      healthy = await probeLlmHealth(controller.signal);
      llmHealthCache.current = { checkedAt: Date.now(), ok: healthy };
    }
    if (!runtimeMounted.current || controller.signal.aborted || chatAbort.current !== controller)
      return;
    chatAbort.current = null;
    const current = stateRef.current,
      quest = current.tasks.generatedQuest,
      interaction = quest ? generatedQuestInteraction(quest, identity) : null,
      participant = interaction !== null,
      questReplyMode: NpcQuestReplyMode = interaction === "issuer-reminder"
        ? "issuer-reminder"
        : interaction === "visit-target"
          ? "visit-target"
          : interaction === "challenge-target" || interaction === "battle-ready"
            ? "battle-target"
            : interaction === "post-battle"
              ? "post-battle"
              : interaction === "report"
                ? "report"
                : null;
    if (!healthy && !participant) {
      setNpcChat(null);
      if (fallbackToFixed) {
        setNotice("LM Studio 当前不可用，已回退为原作固定对白。");
        fixedNpcDialogue(id);
      } else setNotice("LM Studio 当前不可用，本次交谈到此结束。");
      return;
    }
    const messages = questTranscriptMessages(identity);
    if (!healthy && quest && participant) {
      const fallback = generatedQuestFallbackText(quest, identity),
        next = structuredClone(current);
      appendGeneratedQuestTranscript(next.tasks, {
        speaker: "npc",
        npcId: id,
        speech: fallback,
      });
      if (interaction === "challenge-target") {
        appendGeneratedQuestTranscript(next.tasks, {
          speaker: "npc",
          npcId: id,
          speech: "既然你已经寻到这里，缘由便已说开。若准备好了，我们就开始切磋。",
        });
      }
      if (["visit-target", "challenge-target", "post-battle"].includes(interaction || ""))
        advanceGeneratedQuestAfterDialogue(next.tasks, identity);
      sync(next);
      messages.push({
        role: "assistant",
        npcId: id,
        state: "",
        action: "",
        speech: fallback,
        raw: fallback,
      });
    }
    setNpcChat({
      id,
      mapId: identity.mapId,
      eventId: identity.eventId,
      phase: "llm",
      originalLines: [],
      originalIndex: 0,
      messages,
      loading: false,
      auto: false,
      error: "",
      replyCount: messages.filter((message) => message.role === "assistant").length,
      offeredThisSession: false,
      plannedQuest: null,
      pendingQuest: null,
      questChoice: 0,
      questReady: Boolean(
        stateRef.current.tasks.generatedQuest &&
        ["battle-ready", "report"].includes(
          generatedQuestInteraction(stateRef.current.tasks.generatedQuest, identity) || "",
        )
      ),
      questReplyMode,
      terminal: !healthy && questReplyMode
        ? questReplyMode === "battle-target"
          ? "battle"
          : questReplyMode === "report"
            ? null
            : "close"
        : null,
      started: !healthy,
      shownAt: Date.now(),
    });
  }, [fixedNpcDialogue, questTranscriptMessages, sync]);
  const chooseNpc = useCallback(
    (id: number, option: NpcOption) => {
      const identity: GeneratedQuestNpcRef = npcMenu?.id === id
        ? { npcId: id, mapId: npcMenu.mapId, eventId: npcMenu.eventId }
        : { npcId: id, mapId: stateRef.current.position.mapId, eventId: -1 };
      setEventNpcId(["talk", "status", "join"].includes(option) ? id : null);
      if (option === "forge") {
        setNpcMenu(null);
        if (stateRef.current.actor.swordBattle) {
          // 已通过铸剑挑战：直接传送到铸剑谷。
          const passed = structuredClone(stateRef.current);
          passed.position = { mapId: 67, x: 9, y: 11, direction: 8 };
          sync(passed);
          setNotice("干匠：铸剑谷已开放，去打造趁手的武器吧。");
        } else startSwordChallenge();
        return;
      }
      const next = structuredClone(stateRef.current);
      if (option === "talk") {
        const tasks = next.tasks,
          random = seeded(next.position.mapId + id + tasks.clock);
        if (tasks.visitId === id) {
          tasks.visitId = -1;
          sync(next);
          openOriginalNpcConversation(id, "拜访已经完成，回村长处复命吧。", identity);
          setNpcMenu(null);
          return;
        }
        if (id === 25) {
          const result = acceptFreeWork(next.actor, tasks, (max) =>
            Math.floor(Math.random() * Math.max(1, max)),
          );
          sync(next);
          openOriginalNpcConversation(id, result.text, identity);
          setNpcMenu(null);
          return;
        }
        if (id === 14 || id === 15) {
          const result =
            id === 14
              ? startStoneTask(next.actor, tasks)
              : finishStoneTask(next.actor, tasks);
          sync(next);
          openOriginalNpcConversation(id, result.text, identity);
          setNpcMenu(null);
          return;
        }
        if (id === 3) {
          const result = acceptWantedTask(
            next.actor,
            tasks,
            random,
            false,
            next.position,
          );
          sync(next);
          openOriginalNpcConversation(id, result.text, identity);
          setNpcMenu(null);
          return;
        }
        if (id === 6) {
          const altar = startTanQuest(next.actor);
          if (altar.ok) {
            sync(next);
            openOriginalNpcConversation(id, altar.text, identity);
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
          openOriginalNpcConversation(id, text, identity);
          setNpcMenu(null);
          return;
        }
        if (id === 31 && tasks.finishFlag) {
          const result = claimMainReward(next.actor, tasks, random);
          sync(next);
          openOriginalNpcConversation(id, result.text, identity);
          setNpcMenu(null);
          return;
        }
        const specialTalk = resolveSpecialNpcTalk(id, next.actor);
        if (specialTalk.handled) {
          sync(next);
          openOriginalNpcConversation(id, specialTalk.text, identity);
          setNpcMenu(null);
          return;
        }
        if (id === 172 && next.actor.haveNewHome) {
          setLife({ kind: "home", index: 0 });
          setNpcMenu(null);
          return;
        }
        // 原版：普通对话后再检查隐藏交换，可交换时弹确认窗口。
        if (hiddenQuestOffer(next.actor, id).ok) {
          const r = resolveSceneEvent(
            { type: 0, id },
            next.actor,
            id + next.position.mapId,
          );
          openOriginalNpcConversation(id, r.lines, identity);
          setHiddenConfirm({ npcId: id, index: 0 });
        } else void openNpcConversation(id, true, identity);
      } else if (option === "status") setEventText(npcStatus(id).join("\n"));
      else if (option === "battle") {
        const quest = next.tasks.generatedQuest,
          interaction = quest ? generatedQuestInteraction(quest, identity) : null;
        if (quest && interaction !== null) {
          if (interaction === "battle-ready")
            setBattle(beginOriginalBattle(id, id + next.position.mapId, undefined, "spar", {
              questId: quest.id,
              enemyId: id,
            }));
          else void openNpcConversation(id, false, identity);
        } else
          setBattle(beginOriginalBattle(id, id + next.position.mapId, undefined, "lethal"));
      }
      else if (option === "trade") setShop({ id, index: 0 });
      else if (option === "join") {
        const r = attemptJoin(id, next.actor);
        sync(next);
        setEventText(`${npcDisplayName(id)}\n${r.text}`);
      } else {
        const allowed = canStudyWithNpc(id, next.actor);
        if (allowed.ok) setStudy({ id, index: 0 });
        else setEventText(`${npcDisplayName(id)}\n${allowed.text}`);
      }
      setNpcMenu(null);
    },
    [npcMenu, openNpcConversation, openOriginalNpcConversation, sync, startSwordChallenge],
  );
  const closeNpcChat = useCallback(() => {
    chatAbort.current?.abort();
    chatAbort.current = null;
    setNpcChat(null);
    setEventNpcId(null);
  }, []);
  // 主菜单返回统一标题页：与首页同一套界面；未保存进度按既有退出语义丢弃。
  const returnToTitle = useCallback(() => {
    closeNpcChat();
    battleNarrationAbort.current?.abort();
    if (exitToTitle) exitToTitle();
    else location.href = "/";
  }, [closeNpcChat, exitToTitle]);
  const prepareGeneratedQuestOffer = useCallback((chat: NpcChatState) => {
    const current = stateRef.current,
      issuer = generatedQuestParticipant(chat.id, chat.mapId, chat.eventId);
    if (
      chat.offeredThisSession ||
      current.tasks.generatedQuest ||
      !issuer ||
      !generatedQuestEligibleKinds(issuer, current.actor, current.tasks).length
    ) return { draft: null, planned: null, preludeRound: 0 };
    const random = seeded(
        Math.imul(chat.id + 1, 0x9e3779b1) ^
          Math.imul(current.tasks.generatedQuestSerial + 1, 0xc2b2ae35) ^
          Math.floor(current.tasks.clock),
      ),
      planned = chat.plannedQuest || createGeneratedQuestDraft({
        issuer,
        actor: current.actor,
        tasks: current.tasks,
        random,
      });
    if (!planned) return { draft: null, planned: null, preludeRound: 0 };
    if (!shouldOfferGeneratedQuest({
      completedNpcReplies: chat.replyCount,
      offeredThisSession: chat.offeredThisSession,
      tasks: current.tasks,
    })) return { draft: null, planned, preludeRound: chat.replyCount + 1 };
    return { draft: planned, planned, preludeRound: 0 };
  }, []);
  const requestNpcReply = useCallback(async (
    ref: GeneratedQuestNpcRef,
    dialogueHistory: NpcDialogueMessage[],
    offerDraft: GeneratedQuestDraft | null = null,
    questReplyMode: NpcQuestReplyMode = null,
    contextDraft: GeneratedQuestDraft | null = null,
    plannedDraft: GeneratedQuestDraft | null = null,
    preludeRound = 0,
  ) => {
    const id = ref.npcId,
      actorName = stateRef.current.actor.name || "主角";
    const history: ChatMessage[] = dialogueHistory.slice(-10).map((message) => ({
      role: message.role,
      content: message.speech,
      speaker: message.role === "user"
        ? actorName
        : npcLore(message.npcId || id).name,
    }));
    const controller = new AbortController();
    chatAbort.current?.abort();
    chatAbort.current = controller;
    setNpcChat((chat) => chat?.id === id ? {
      ...chat, phase: "llm", started: true,
      messages: [...dialogueHistory, { role: "assistant", npcId: id, state: "", action: "", speech: "", raw: "" }],
      loading: true,
      error: "",
      pendingQuest: questReplyMode ? null : chat.pendingQuest,
      plannedQuest: plannedDraft || chat.plannedQuest,
      questReplyMode,
      terminal: null,
      offeredThisSession: chat.offeredThisSession || Boolean(offerDraft),
    } : chat);
    // 流式 token 缓冲声明在 try 外，catch 里也需要取消挂起的 rAF。
    let tokenBuffer = "",
      tokenFlush: number | null = null;
    try {
      const current = stateRef.current;
      const activeQuest = current.tasks.generatedQuest,
        activeInteraction = activeQuest ? generatedQuestInteraction(activeQuest, ref) : null,
        questContext = activeQuest && activeInteraction !== null
          ? `\n\n${generatedQuestPrompt(activeQuest, id, { includeTranscript: false })}`
          : "",
        offerContext = offerDraft
          ? `\n\n${generatedQuestPrompt(offerDraft, id, { includeTranscript: false, disclosure: "offer" })}\n【本轮任务提议】你必须在本轮回复中自然提出上述委托，把目标人物和地点说清楚，但不要提及任务系统、概率、字段或规则。玩家之后会通过界面明确接受或婉拒；你不能替玩家接受。`
          : contextDraft
            ? `\n\n${generatedQuestPrompt(contextDraft, id, { includeTranscript: false, disclosure: "offer" })}`
            : plannedDraft
              ? `\n\n${generatedQuestPrompt(plannedDraft, id, { includeTranscript: false, disclosure: "prelude" })}\n【同一委托的铺垫 · 第${preludeRound}轮】引擎已经确定了这桩事件，但现在还不能正式下达任务，也不能询问玩家是否接受。你和玩家此前及本轮的谈话必须始终围绕这同一件事，不得另起闲聊话题。${preludeRound === 1 ? "先从近期发生的异状、你的顾虑或你为何留意此事说起，给出具体细节，但暂时保留最终请求。" : preludeRound === 2 ? "承接上一轮，补充相关人物关系、旧因或这件事对当地与当事人的影响，让玩家理解利害。" : "承接前两轮，讲清迫切风险与为何需要玩家相助，自然把话头引向下一轮的正式委派，但本轮仍不得要求玩家表态。"}`
            : "",
        forcedInstruction = questReplyMode === "issuer-reminder"
          ? "\n\n【本轮唯一任务】你是发布人。只说一句催办对白，必须清楚重申目标人物、任务内容和地图位置；不要寒暄、提问或继续闲聊。"
          : questReplyMode === "visit-target"
            ? "\n\n【本轮唯一任务】你是拜访目标。只说一句承接委托缘由的对白，并明确让玩家回发布人处复命；不要展开第二轮。"
            : questReplyMode === "battle-target"
              ? "\n\n【本轮唯一任务】你是切磋目标。只说一句承接发布人、缘由和来意的开战对白，结尾明确现在开始点到为止的切磋；不要提问。"
              : questReplyMode === "post-battle"
                ? "\n\n【本轮唯一任务】战斗已经结束。只说一句认下胜负并让玩家回发布人所在地图复命的战后对白；不要继续闲聊。"
                : questReplyMode === "report"
                  ? "\n\n【本轮唯一任务】你是发布人。只说一句确认玩家已经办妥并请其领取约定报酬的收尾对白。"
                  : questReplyMode === "accept-close"
                    ? "\n\n【本轮唯一任务】玩家刚刚明确接受委托。只说一句交代任务内容、目标和地图位置的送行对白，然后结束交谈。"
                    : questReplyMode === "accept-battle"
                      ? "\n\n【本轮唯一任务】玩家刚刚明确接受当面切磋。只说一句承接缘由的开战对白，结尾明确现在开始，然后结束交谈并开战。"
                      : questReplyMode === "decline-close"
                        ? "\n\n【本轮唯一任务】玩家刚刚婉拒委托。只说一句符合人物性格的收尾对白，接受其决定，不得重新劝说，然后结束交谈。"
                        : "";
      // 流式 token 先缓冲、按 rAF 批量提交，避免每个 token 都重渲整棵世界树。
      const flushTokens = () => {
        tokenFlush = null;
        if (!tokenBuffer) return;
        // 已中止/卸载后丢弃缓冲，避免旧请求的尾巴写进新会话。
        if (!runtimeMounted.current || chatAbort.current !== controller) {
          tokenBuffer = "";
          return;
        }
        const chunk = tokenBuffer;
        tokenBuffer = "";
        setNpcChat((chat) => {
          if (!chat || chat.id !== id) return chat;
          const messages = [...chat.messages], last = messages.length - 1;
          const currentReply = messages[last];
          if (currentReply.role !== "assistant") return chat;
          const raw = currentReply.raw + chunk;
          messages[last] = {
            role: "assistant",
            npcId: id,
            raw,
            state: "",
            action: "",
            speech: cleanActiveDialogue(raw, npcLore(id).name),
          };
          return { ...chat, messages };
        });
      };
      const answer = await streamNpcReply({
        system: `${buildNpcSystemPrompt(id, current.actor, current.tasks, getOriginalMap(current.position.mapId).name)}${questContext}${offerContext}${forcedInstruction}`,
        messages: history,
        nextSpeaker: npcLore(id).name,
        maxOutputTokens: questReplyMode ? 120 : offerDraft ? 280 : 220,
        temperature: questReplyMode ? 0.5 : offerDraft || plannedDraft ? 0.65 : 0.8,
        topP: questReplyMode ? 0.8 : 0.9,
        signal: controller.signal,
        onToken: (token) => {
          if (!runtimeMounted.current || chatAbort.current !== controller) return;
          tokenBuffer += token;
          if (tokenFlush === null)
            tokenFlush = window.requestAnimationFrame(flushTokens);
        },
      });
      if (tokenFlush !== null) window.cancelAnimationFrame(tokenFlush);
      tokenFlush = null;
      tokenBuffer = "";
      if (!runtimeMounted.current || chatAbort.current !== controller) return;
      const parsed = {
        ...parseNpcDialogue(answer),
        state: "",
        action: "",
        speech: cleanActiveDialogue(answer, npcLore(id).name),
      };
      const next = structuredClone(stateRef.current),
        quest = next.tasks.generatedQuest,
        participant = Boolean(quest && generatedQuestInteraction(quest, ref) !== null),
        lastUser = [...dialogueHistory].reverse().find((message) => message.role === "user");
      if (quest && participant) {
        if (lastUser?.role === "user")
          appendGeneratedQuestTranscript(next.tasks, {
            speaker: "player",
            action: lastUser.action,
            speech: lastUser.speech || "……",
          });
        appendGeneratedQuestTranscript(next.tasks, {
          speaker: "npc",
          npcId: id,
          state: parsed.state,
          action: parsed.action,
          speech: parsed.speech,
        });
        const interaction = generatedQuestInteraction(quest, ref);
        if (["visit-target", "challenge-target", "post-battle"].includes(interaction || ""))
          advanceGeneratedQuestAfterDialogue(next.tasks, ref);
        sync(next);
      } else if (offerDraft) {
        declineGeneratedQuest(next.tasks);
        sync(next);
      }
      setNpcChat((chat) => {
        if (!chat || chat.id !== id) return chat;
        const messages = [...chat.messages];
        messages[messages.length - 1] = { role: "assistant", npcId: id, raw: answer, ...parsed };
        const progressedQuest = stateRef.current.tasks.generatedQuest,
          progressedInteraction = progressedQuest
            ? generatedQuestInteraction(progressedQuest, ref)
            : null;
        return {
          ...chat,
          messages,
          loading: false,
          replyCount: chat.replyCount + 1,
          pendingQuest: offerDraft,
          plannedQuest: plannedDraft || chat.plannedQuest,
          questChoice: 0,
          questReady: progressedInteraction === "battle-ready" || progressedInteraction === "report",
          questReplyMode,
          terminal: questReplyMode === "battle-target" || questReplyMode === "accept-battle"
            ? "battle"
            : questReplyMode && questReplyMode !== "report"
              ? "close"
              : null,
          auto: offerDraft ? false : chat.auto,
          shownAt: Date.now(),
        };
      });
    } catch {
      if (tokenFlush !== null) window.cancelAnimationFrame(tokenFlush);
      tokenFlush = null;
      tokenBuffer = "";
      if (controller.signal.aborted) {
        if (runtimeMounted.current && chatAbort.current === controller)
          setNpcChat((chat) =>
            chat?.id === id ? { ...chat, loading: false, auto: false } : chat,
          );
        return;
      }
      if (!runtimeMounted.current || chatAbort.current !== controller) return;
      llmHealthCache.current = { checkedAt: Date.now(), ok: false };
      const current = stateRef.current,
        quest = current.tasks.generatedQuest,
        participant = Boolean(quest && generatedQuestInteraction(quest, ref) !== null);
      if (questReplyMode === "decline-close" && contextDraft) {
        const fallback = "既然你不愿接下此事，我也不再强求，今日便谈到这里。";
        setNpcChat((chat) => {
          if (!chat || chat.id !== id) return chat;
          const messages = chat.messages.filter((message) => message.role === "user" || message.raw);
          messages.push({ role: "assistant", npcId: id, state: "", action: "", speech: fallback, raw: fallback });
          return { ...chat, messages, loading: false, auto: false, error: "", questReplyMode, terminal: "close", shownAt: Date.now() };
        });
        return;
      }
      if (!quest || !participant) {
        setNpcChat(null);
        setNotice("LLM 对话生成失败，已回退为原作固定对白。");
        fixedNpcDialogue(id);
        return;
      }
      const fallback = generatedQuestFallbackText(quest, ref),
        next = structuredClone(current),
        lastUser = [...dialogueHistory].reverse().find((message) => message.role === "user");
      if (lastUser?.role === "user")
        appendGeneratedQuestTranscript(next.tasks, {
          speaker: "player",
          action: lastUser.action,
          speech: lastUser.speech || "……",
        });
      appendGeneratedQuestTranscript(next.tasks, { speaker: "npc", npcId: id, speech: fallback });
      const interaction = generatedQuestInteraction(quest, ref);
      if (["visit-target", "challenge-target", "post-battle"].includes(interaction || ""))
        advanceGeneratedQuestAfterDialogue(next.tasks, ref);
      sync(next);
      setNpcChat((chat) => {
        if (!chat || chat.id !== id) return chat;
        const messages = chat.messages.filter((message) => message.role === "user" || message.raw);
        messages.push({ role: "assistant", npcId: id, state: "", action: "", speech: fallback, raw: fallback });
        return {
          ...chat,
          messages,
          loading: false,
          auto: false,
          error: "",
          questReady: true,
          questReplyMode,
          terminal: questReplyMode === "battle-target" || questReplyMode === "accept-battle"
            ? "battle"
            : questReplyMode === "report"
              ? null
              : "close",
          shownAt: Date.now(),
        };
      });
    } finally {
      if (chatAbort.current === controller) chatAbort.current = null;
    }
  }, [fixedNpcDialogue, sync]);
  const acceptNpcQuest = useCallback(() => {
    const chat = npcChat, draft = chat?.pendingQuest;
    if (!chat || !draft) return;
    const next = structuredClone(stateRef.current),
      accepted = acceptGeneratedQuest(next.tasks, draft);
    if (!accepted) return;
    for (const message of chat.messages) {
      if (message.role === "user")
        appendGeneratedQuestTranscript(next.tasks, {
          speaker: "player",
          action: message.action,
          speech: message.speech || "……",
        });
      else if (message.raw)
        appendGeneratedQuestTranscript(next.tasks, {
          speaker: "npc",
          npcId: message.npcId || chat.id,
          state: message.state,
          action: message.action,
          speech: message.speech,
        });
    }
    appendGeneratedQuestTranscript(next.tasks, {
      speaker: "system",
      speech: `${next.actor.name}明确接受了这桩委托。`,
    });
    sync(next);
    const acceptedLine: NpcDialogueMessage = { role: "user", action: "", speech: "这件事我接下了。" },
      messages = [...chat.messages, acceptedLine],
      mode: NpcQuestReplyMode = draft.kind === "duel" ? "accept-battle" : "accept-close";
    setNpcChat({ ...chat, messages, plannedQuest: null, pendingQuest: null, auto: false, questReady: false, questReplyMode: mode, terminal: null });
    setNotice(`已接受「${draft.title}」 · ${generatedQuestObjective(next.tasks.generatedQuest!)}`);
    void requestNpcReply(npcChatRef(chat), messages, null, mode);
  }, [npcChat, requestNpcReply, sync]);
  const declineNpcQuest = useCallback(() => {
    const chat = npcChat, draft = chat?.pendingQuest;
    if (!chat || !draft) return;
    const declinedLine: NpcDialogueMessage = { role: "user", action: "", speech: "此事我不便答应。" },
      messages = [...chat.messages, declinedLine];
    setNpcChat({ ...chat, messages, plannedQuest: null, pendingQuest: null, auto: false, questReplyMode: "decline-close", terminal: null });
    setNotice("你婉拒了这次委托。");
    void requestNpcReply(npcChatRef(chat), messages, null, "decline-close", draft);
  }, [npcChat, requestNpcReply]);
  const startGeneratedQuestBattle = useCallback(() => {
    if (!npcChat) return;
    const quest = stateRef.current.tasks.generatedQuest;
    if (!quest || generatedQuestInteraction(quest, npcChatRef(npcChat)) !== "battle-ready") return;
    setNpcChat(null);
    setBattle(beginOriginalBattle(npcChat.id, stateRef.current.tasks.clock + npcChat.id, undefined, "spar", {
      questId: quest.id,
      enemyId: npcChat.id,
    }));
  }, [npcChat]);
  const claimNpcQuestReward = useCallback(() => {
    if (!npcChat?.questReady) return;
    const next = structuredClone(stateRef.current),
      result = claimGeneratedQuestReward(next.actor, next.tasks, npcChatRef(npcChat));
    if (!result.ok) return;
    const persisted = { ...next, savedAt: new Date().toISOString() },
      written = writeJsonStorage(LOCAL_SAVE_KEY, persisted);
    sync(written.ok ? persisted : next);
    openOriginalNpcConversation(npcChat.id, result.text);
    setNotice(written.ok
      ? "奇遇任务完成并已自动保存；完整任务对话已清除，摘要已写入日志。"
      : `奇遇任务完成，但自动保存失败：${storageFailureNotice(written.reason)}`);
  }, [npcChat, openOriginalNpcConversation, sync]);
  const confirmAbandonGeneratedQuest = useCallback(() => {
    const next = structuredClone(stateRef.current), title = next.tasks.generatedQuest?.title;
    if (!abandonGeneratedQuest(next.tasks)) return;
    sync(next);
    setTaskBook(null);
    setNotice(title ? `已放弃「${title}」。` : "已清除当前奇遇任务。");
  }, [sync]);
  const generateAutoPlayerTurn = useCallback(async (chat: NpcChatState) => {
    const id = chat.id,
      ref = npcChatRef(chat),
      controller = new AbortController(),
      history: ChatMessage[] = chat.messages.slice(-10).map((message) => ({
        role: message.role,
        content: message.speech,
        speaker: message.role === "user"
          ? stateRef.current.actor.name || "主角"
          : npcLore(message.npcId || id).name,
      }));
    chatAbort.current?.abort();
    chatAbort.current = controller;
    setNpcChat((current) => current?.id === id ? { ...current, loading: true, error: "" } : current);
    try {
      const current = stateRef.current,
        activeQuest = current.tasks.generatedQuest,
        activeInteraction = activeQuest ? generatedQuestInteraction(activeQuest, ref) : null,
        questContext = activeQuest && activeInteraction !== null
          ? `\n\n${generatedQuestPrompt(activeQuest, id, { includeTranscript: false, perspective: "player" })}`
          : chat.plannedQuest
            ? `\n\n${generatedQuestPrompt(chat.plannedQuest, id, { includeTranscript: false, disclosure: "prelude", perspective: "player" })}\n【当前谈话主线】NPC正围绕这桩尚未正式提出的委托逐层说明背景。你必须像身在现场的主角一样，只回应这件事：追问细节、判断利害或回应其中的人情，不得突然换话题，也不得替NPC提前说出正式请求。`
            : "",
        answer = await streamNpcReply({
          system: `${buildAutoPlayerPrompt(id, current.actor, getOriginalMap(current.position.mapId).name)}${questContext}`,
          messages: history.length ? history : [{ role: "assistant", speaker: "现场情境", content: `${npcLore(id).name}正打量着你，等你先开口。挑一个具体话题——江湖近况、门派见闻、一个传闻或一桩旧事——自然开启交谈，不要只是寒暄。` }],
          signal: controller.signal,
          nextSpeaker: "主角",
          maxOutputTokens: 160,
          temperature: 0.75,
          topP: 0.9,
          onToken: () => {},
        }),
        speech = cleanActiveDialogue(answer, current.actor.name || "主角");
      if (!runtimeMounted.current || chatAbort.current !== controller) return;
      setNpcChat((active) => active?.id === id ? {
        ...active,
        messages: [...active.messages, { role: "user", action: "", speech }],
        loading: false,
        shownAt: Date.now(),
      } : active);
    } catch {
      if (controller.signal.aborted) {
        if (runtimeMounted.current && chatAbort.current === controller)
          setNpcChat((active) =>
            active?.id === id
              ? { ...active, loading: false, auto: false }
              : active,
          );
        return;
      }
      if (!runtimeMounted.current || chatAbort.current !== controller) return;
      llmHealthCache.current = { checkedAt: Date.now(), ok: false };
      const quest = stateRef.current.tasks.generatedQuest,
        participant = Boolean(quest && generatedQuestInteraction(quest, ref) !== null);
      if (participant)
        setNpcChat((active) => active?.id === id
          ? { ...active, loading: false, auto: false, error: "" }
          : active);
      else {
        setNpcChat(null);
        setNotice("LLM 主角接话生成失败，已回退为原作固定对白。");
        fixedNpcDialogue(id);
      }
    } finally {
      if (chatAbort.current === controller) chatAbort.current = null;
    }
  }, [fixedNpcDialogue]);
  const advanceNpcConversation = useCallback(() => {
    if (!npcChat || npcChat.loading || npcChat.pendingQuest || npcChat.questReplyMode || npcChat.terminal) return;
    // 自动模式达到轮数上限后自动收尾；手动推进不受影响。
    if (npcChat.auto && ++autoTurnsRef.current > NPC_AUTO_TURN_LIMIT) {
      setNpcChat({ ...npcChat, auto: false });
      return;
    }
    if (npcChat.phase === "original") {
      const nextIndex = npcChat.originalIndex + 1;
      if (nextIndex < npcChat.originalLines.length) {
        const speech = npcChat.originalLines[nextIndex];
        setNpcChat({
          ...npcChat,
          originalIndex: nextIndex,
          messages: [...npcChat.messages, {
            role: "assistant",
            npcId: npcChat.id,
            state: "",
            action: "",
            speech,
            raw: speech,
          }],
          shownAt: Date.now(),
        });
      } else {
        const auto = npcChat.auto;
        void openNpcConversation(npcChat.id, false, npcChatRef(npcChat)).then(() => {
          if (auto)
            setNpcChat((active) => active?.id === npcChat.id
              ? { ...active, auto: true }
              : active);
        });
      }
      return;
    }
    const last = npcChat.messages[npcChat.messages.length - 1];
    if (!last || last.role === "user") {
      const offer = prepareGeneratedQuestOffer(npcChat);
      void requestNpcReply(
        npcChatRef(npcChat),
        npcChat.messages,
        offer.draft,
        null,
        null,
        offer.planned,
        offer.preludeRound,
      );
    } else void generateAutoPlayerTurn(npcChat);
  }, [generateAutoPlayerTurn, npcChat, openNpcConversation, prepareGeneratedQuestOffer, requestNpcReply]);
  const toggleNpcConversationAuto = useCallback(() => {
    if (!npcChat || npcChat.pendingQuest || npcChat.questReady || npcChat.questReplyMode || npcChat.terminal) return;
    if (!npcChat.auto) autoTurnsRef.current = 0;
    setNpcChat({ ...npcChat, auto: !npcChat.auto });
  }, [npcChat]);
  useEffect(() => {
    if (!npcChat || npcChat.loading || npcChat.started) return;
    const id = window.setTimeout(() => {
      if (npcChat.questReplyMode) {
        void requestNpcReply(
          npcChatRef(npcChat),
          npcChat.messages,
          null,
          npcChat.questReplyMode,
        );
        return;
      }
      const offer = prepareGeneratedQuestOffer(npcChat);
      void requestNpcReply(
        npcChatRef(npcChat),
        npcChat.messages,
        offer.draft,
        null,
        null,
        offer.planned,
        offer.preludeRound,
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, [npcChat, prepareGeneratedQuestOffer, requestNpcReply]);
  useEffect(() => {
    if (!npcChat?.auto || npcChat.loading || npcChat.error || npcChat.pendingQuest || npcChat.questReplyMode || npcChat.terminal) return;
    const latest = npcChat.messages[npcChat.messages.length - 1],
      length = latest?.speech.length || 0,
      dwell = Math.min(6500, Math.max(2500, 1800 + length * 45)),
      elapsed = Date.now() - npcChat.shownAt,
      timer = window.setTimeout(advanceNpcConversation, Math.max(0, dwell - elapsed));
    return () => window.clearTimeout(timer);
  }, [advanceNpcConversation, npcChat]);
  useEffect(() => {
    if (!npcChat?.terminal || npcChat.loading) return;
    const latest = npcChat.messages[npcChat.messages.length - 1],
      length = latest?.speech.length || 0,
      dwell = Math.min(5200, Math.max(2200, 1500 + length * 55)),
      elapsed = Date.now() - npcChat.shownAt,
      timer = window.setTimeout(() => {
        if (npcChat.terminal === "battle") startGeneratedQuestBattle();
        else closeNpcChat();
      }, Math.max(0, dwell - elapsed));
    return () => window.clearTimeout(timer);
  }, [closeNpcChat, npcChat, startGeneratedQuestBattle]);
  useEffect(() => {
    if (battle && battle.turn > 0) return;
    battleNarrationAbort.current?.abort();
    battleNarrationAbort.current = null;
    battleNarrativesRef.current = [];
    const id = window.setTimeout(() => setBattleNarratives([]), 0);
    return () => window.clearTimeout(id);
  }, [battle]);
  const narrateBattleRound = useCallback(async (event: BattleNarrationEvent) => {
    if (!event.facts.length) return;
    const controller = new AbortController();
    battleNarrationAbort.current?.abort();
    battleNarrationAbort.current = controller;
    const entry: BattleNarrative = {
      turn: event.battle.turn,
      facts: event.facts,
      text: "",
      effect: battleEffectKind(event),
      loading: true,
      error: "",
    };
    const previous = battleNarrativesRef.current;
    battleNarrativesRef.current = [...previous, entry];
    setBattleNarratives(battleNarrativesRef.current);
    const history: ChatMessage[] = [
      ...previous.filter((item) => item.text).slice(-6).map((item) => ({
        role: "assistant" as const,
        content: item.text,
        speaker: `战斗叙事·第${item.turn}回合`,
      })),
      { role: "user", speaker: "战斗引擎事实", content: buildBattleNarrationFacts(event) } as const,
    ];
    const updateEntry = (change: (item: BattleNarrative) => BattleNarrative) => {
      if (!runtimeMounted.current) return;
      const next = battleNarrativesRef.current.map((item) =>
        item === entry || (item.turn === entry.turn && item.loading) ? change(item) : item,
      );
      battleNarrativesRef.current = next;
      setBattleNarratives(next);
    };
    // 流式 token 逐个 setState 会让整棵世界树以每秒几十次的频率重渲染；
    // 先缓冲、按 requestAnimationFrame 批量提交。
    let tokenBuffer = "",
      tokenFlush: number | null = null;
    const flushTokens = () => {
      tokenFlush = null;
      if (!tokenBuffer) return;
      const chunk = tokenBuffer;
      tokenBuffer = "";
      updateEntry((item) => ({ ...item, text: item.text + chunk }));
    };
    try {
      const answer = await streamNpcReply({
        system: buildBattleNarrationPrompt(event),
        messages: history,
        nextSpeaker: "战斗叙事",
        maxOutputTokens: Math.min(4096, Math.max(512, event.facts.length * 180)),
        timeoutMs: Math.min(90_000, Math.max(30_000, event.facts.length * 4_000)),
        temperature: 0.62,
        topP: 0.85,
        signal: controller.signal,
        onToken: (token) => {
          tokenBuffer += token;
          if (tokenFlush === null)
            tokenFlush = window.requestAnimationFrame(flushTokens);
        },
      });
      if (tokenFlush !== null) window.cancelAnimationFrame(tokenFlush);
      tokenFlush = null;
      tokenBuffer = "";
      updateEntry((item) => ({
        ...item,
        text: answer,
        loading: false,
        error: "",
      }));
    } catch (error) {
      if (tokenFlush !== null) window.cancelAnimationFrame(tokenFlush);
      tokenFlush = null;
      flushTokens();
      if (controller.signal.aborted) {
        if (battleNarrationAbort.current)
          updateEntry((item) => ({
            ...item,
            text: item.text || buildBattleNarrationFallback(event),
            loading: false,
          }));
        return;
      }
      const detail = error instanceof Error ? error.message : "战报生成失败";
      updateEntry((item) => ({
        ...item,
        text: item.text || buildBattleNarrationFallback(event),
        loading: false,
        error: detail,
      }));
    } finally {
      if (battleNarrationAbort.current === controller)
        battleNarrationAbort.current = null;
    }
  }, []);
  const fight = useCallback(() => {
    if (!battle || battle.finished) return;
    const playerHpBefore = stateRef.current.actor.hp,
      enemyHpBefore = battle.enemyHp,
      logLength = battle.log.length,
      next = structuredClone(stateRef.current),
      round = battleRound(battle, next.actor);
    sync(next);
    setBattle(round);
    void narrateBattleRound({
      battle: round,
      actor: next.actor,
      mapName: getOriginalMap(next.position.mapId).name,
      facts: round.log.slice(logLength),
      playerHpBefore,
      enemyHpBefore,
    });
  }, [battle, narrateBattleRound, sync]);
  const fightSpecial = useCallback(
    (id?: number) => {
      if (!battle || !id) return;
      const next = structuredClone(stateRef.current);
      // 绝招要求的功夫只要已学会，就临阵自动换装后直接施展；
      // 换装后仍不满足(内力/冷却/兵器不符/没学过)则提示且不改存档。
      autoEquipSpecialRequirements(next.actor, id);
      const special = battleSpecials(next.actor, battle.cooldowns).find(
        (item) => item.id === id,
      );
      if (!special?.enabled) {
        setNotice(
          special
            ? `${special.name}暂无法施展：${special.reason}`
            : "无法施展这项绝招。",
        );
        return;
      }
      const playerHpBefore = stateRef.current.actor.hp,
        enemyHpBefore = battle.enemyHp,
        logLength = battle.log.length,
        playerTechnique = special.name,
        round = specialRound(battle, next.actor, id);
      sync(next);
      setBattle(round);
      setSpecialMenu(null);
      void narrateBattleRound({
        battle: round,
        actor: next.actor,
        mapName: getOriginalMap(next.position.mapId).name,
        facts: round.log.slice(logLength),
        playerHpBefore,
        enemyHpBefore,
        playerTechnique,
        effectHint: "special",
      });
    },
    [battle, narrateBattleRound, sync],
  );
  const settleBattle = useCallback(
    (kill: boolean) => {
      if (!battle) return;
      const next = structuredClone(stateRef.current);
      let altarText = "",
        nextBattle: OriginalBattle | null = null,
        postBattleTarget: GeneratedQuestNpcRef | null = null;
      if (battle.finished === "win") {
        if (battle.mode === "lethal") {
          const loot = settleVictoryLoot(
            next.actor,
            battle.enemyId,
            kill,
            battle.enemyWeaponId,
          );
          altarText = loot.text;
        }
        if (battle.enemyId === 149) {
          const required = [8, 15, 25, 21],
            weaponNames = ["钢刀", "长剑", "钢杖", "长鞭"],
            step = next.actor.forgeChallengeStep || 0,
            requiredId = required[step],
            key = `2:${requiredId}`;
          if (next.actor.weaponId !== requiredId) {
            delete next.actor.inventory[key];
            next.actor.weaponId = 0;
            next.actor.forgeChallengeStep = 0;
            altarText = `墨邪：我们考的是${weaponNames[step]}，你这算什么？铸剑挑战失败，需要找干匠重新开始。`;
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
              altarText = `第 ${step + 1}/4 轮通过！干匠递给你${weaponNames[step + 1]}：第 ${step + 2}/4 轮，用${weaponNames[step + 1]}再战墨邪。`;
            } else {
              next.actor.swordBattle = true;
              next.actor.forgeChallengeStep = 0;
              // 与原版一致：通过后传送进铸剑谷(67)。
              next.position = { mapId: 67, x: 9, y: 11, direction: 8 };
              altarText = "四轮铸剑挑战全部通过！干匠：去我的铸剑谷自己打造趁手的武器吧。";
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
        // 原版：砍头任意坛主(163-170)即结算当前阶段奖励并推进坛进度。
        // 地图链(每坛主掉落下一张)引导顺序；奖励按坛阶段(tanId)给。
        if (
          kill &&
          battle.enemyId >= 163 &&
          battle.enemyId <= 170 &&
          next.actor.tanId >= 1 &&
          next.actor.tanId <= 8
        ) {
          // 消耗当前阶段地图，与原版 lose_item(1, 20+tan_id) 一致。
          const mapKey = `1:${20 + next.actor.tanId}`;
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
        battle.finished === "win" &&
        battle.mode === "spar" &&
        battle.questContext &&
        markGeneratedQuestBattleWin(
          next.tasks,
          battle.questContext.questId,
          battle.enemyId,
        )
      ) {
        const quest = next.tasks.generatedQuest;
        postBattleTarget = quest ? {
          npcId: quest.target.npcId,
          mapId: quest.target.mapId,
          eventId: quest.target.eventId,
        } : null;
        altarText = quest
          ? `任务切磋获胜；${quest.target.name}将作战后交代。`
          : "任务切磋获胜。";
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
          const stored = readJsonStorage(LOCAL_SAVE_KEY),
            saved = stored.ok ? parseSave(stored.value) : null;
          sync(saved?.ok ? saved.value : fresh());
          setBattle(null);
          closeNpcChat();
          battleNarrationAbort.current?.abort();
          if (exitToTitle) exitToTitle();
          else location.href = "/";
        }
        setBattleOutcome(null);
        setBattleItem(null);
        setSpecialMenu(null);
        setBattleSkill(null);
        return;
      }
      endSpar(next.actor, battle);
      sync(next);
      setBattle(nextBattle);
      setBattleOutcome(null);
      setBattleItem(null);
      setSpecialMenu(null);
      setBattleSkill(null);
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
      if (postBattleTarget && !nextBattle) {
        const target = postBattleTarget;
        window.setTimeout(() => void openNpcConversation(target.npcId, false, target), 0);
      }
    },
    [battle, closeNpcChat, exitToTitle, openNpcConversation, sync],
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
      setBattleItem(null);
      setSpecialMenu(null);
      setBattleSkill(null);
      setNotice("成功脱离战斗");
    } else setBattle(result.battle);
  }, [battle, sync]);
  const consumeBattleItem = useCallback(
    (entry?: BagEntry) => {
      if (!entry || !battle) return;
      const next = structuredClone(stateRef.current),
        result = activateBattleEntry(next.actor, entry);
      if (!result.ok) {
        setNotice(result.text);
        return;
      }
      const playerHpBefore = stateRef.current.actor.hp,
        enemyHpBefore = battle.enemyHp,
        logLength = battle.log.length,
        round = battleItemRound(battle, next.actor, result.text);
      sync(next);
      setBattle(round);
      setNotice(result.text);
      setBattleItem(null);
      void narrateBattleRound({
        battle: round,
        actor: next.actor,
        mapName: getOriginalMap(next.position.mapId).name,
        facts: round.log.slice(logLength),
        playerHpBefore,
        enemyHpBefore,
        playerTechnique: entry.name,
        effectHint: "item",
      });
    },
    [battle, narrateBattleRound, sync],
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
  // 武器防具与武学运用一致：点击/确认即直接切换，不再弹确认框；
  // 使用消耗品或研读秘籍仍先进同一确认流程。
  const openBagEntry = useCallback(
    (entry?: BagEntry) => {
      if (!entry) return;
      if (entry.kind !== 1) {
        activateBagEntry(entry);
        return;
      }
      setItemConfirm({ entry, index: 0, source: "menu" });
    },
    [activateBagEntry],
  );
  const activateBattleEquipment = useCallback(
    (entry?: BagEntry) => {
      if (!entry) return;
      const next = structuredClone(stateRef.current),
        result = activateBattleEntry(next.actor, entry);
      sync(next);
      setNotice(`${result.text} 临阵换装不消耗回合。`);
      const entries = battleBagEntries(next.actor);
      setBattleItem((current) =>
        current === null
          ? current
          : Math.min(current, Math.max(0, entries.length - 1)),
      );
    },
    [sync],
  );
  // 战斗行囊同样只对消耗品保留确认；换装直接生效且不耗回合。
  const openBattleBagEntry = useCallback(
    (entry?: BagEntry) => {
      if (!entry) return;
      if (entry.kind !== 1) {
        activateBattleEquipment(entry);
        return;
      }
      setItemConfirm({ entry, index: 0, source: "battle" });
    },
    [activateBattleEquipment],
  );
  // 隐藏交换确认。
  const confirmHiddenQuest = useCallback(
    (doExchange: boolean) => {
      if (!hiddenConfirm) return;
      const npcId = hiddenConfirm.npcId;
      setHiddenConfirm(null);
      if (!doExchange) return;
      const next = structuredClone(stateRef.current),
        result = completeHiddenQuest(next.actor, npcId);
      sync(next);
      openOriginalNpcConversation(npcId, result.text);
    },
    [hiddenConfirm, openOriginalNpcConversation, sync],
  );
  // 丢弃行囊条目。
  const discardBagEntry = useCallback(
    (entry?: BagEntry) => {
      if (!entry) return;
      const next = structuredClone(stateRef.current),
        result = discardEntry(next.actor, entry);
      sync(next);
      setNotice(result.text);
      setMenu((current) =>
        current
          ? {
              ...current,
              index: Math.min(
                current.index,
                Math.max(0, bagEntries(next.actor).length - 1),
              ),
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
    return study ? studyAt(study.id, study.index) : undefined;
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
  // 纯推进一步：原地修改传入存档的 actor，不克隆不提交不发提示。
  const advanceCultivation = useCallback(
    (
      save: WorldSave,
      index: number,
    ): { text: string; keepGoing: boolean; changed: boolean } => {
      const actor = save.actor;
      if (index === 0) {
        const available = cultivationAvailability(actor, "meditate");
        if (!available.ok)
          return { text: available.text, keepGoing: false, changed: false };
        const result = meditateForce(actor);
        return {
          text: !result.ok
            ? "尚未装备内功。"
            : result.capped
              ? "内力已达当前内功修为上限，已自动停止打坐。"
              : result.increased
                ? "打坐周天完成，内力上限提高一点。"
                : "你凝神打坐，内息渐长。",
          keepGoing: result.ok && !result.capped,
          changed: true,
        };
      }
      if (index === 1) {
        const available = cultivationAvailability(actor, "magic");
        if (!available.ok)
          return { text: available.text, keepGoing: false, changed: false };
        const result = meditateMagic(actor);
        return {
          text: !result.ok
            ? "尚未装备法术。"
            : result.capped
              ? "法力已达当前法术修为上限，已自动停止冥思。"
              : result.increased
                ? "冥思完成，法力上限提高一点。"
                : "你闭目冥思，法力渐长。",
          keepGoing: result.ok && !result.capped,
          changed: true,
        };
      }
      if (index === 2) {
        const available = cultivationAvailability(actor, "recover");
        if (!available.ok)
          return { text: available.text, keepGoing: false, changed: false };
        return {
          text: recoverHp(actor)
            ? "吸气调息，气血已经恢复。"
            : "当前无法吸气恢复。",
          keepGoing: true,
          changed: true,
        };
      }
      if (index === 3) {
        const available = cultivationAvailability(actor, "heal");
        if (!available.ok)
          return { text: available.text, keepGoing: false, changed: false };
        return {
          text: healWounds(actor)
            ? "运功疗伤，伤势有所恢复。"
            : "当前条件不足以疗伤。",
          keepGoing: true,
          changed: true,
        };
      }
      if (index === 4) {
        const available = cultivationAvailability(actor, "force");
        if (!available.ok)
          return { text: available.text, keepGoing: false, changed: false };
        return {
          text: `当前加力设为 ${setForcePower(actor, actor.fpPlus + 10)}。`,
          keepGoing: true,
          changed: true,
        };
      }
      if (index >= 6) {
        const options = practiceOptions(actor),
          result = practiceOnce(actor, options[index - 6]?.id || 0);
        return { text: result.text, keepGoing: result.ok, changed: result.ok };
      }
      const available = cultivationAvailability(actor, "spell");
      if (!available.ok)
        return { text: available.text, keepGoing: false, changed: false };
      return {
        text: `当前法点设为 ${setMagicPower(actor, actor.mpPlus + 10)}。`,
        keepGoing: true,
        changed: true,
      };
    },
    [],
  );
  const cultivate = useCallback(
    (index: number) => {
      const next = structuredClone(stateRef.current),
        outcome = advanceCultivation(next, index);
      if (!outcome.changed) {
        setNotice(outcome.text);
        return false;
      }
      sync(next);
      setNotice(outcome.text);
      return outcome.keepGoing;
    },
    [advanceCultivation, sync],
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
      if (index === 0) {
        if (itemConfirm.source === "battle") {
          if (itemConfirm.entry.kind === 1)
            consumeBattleItem(itemConfirm.entry);
          else activateBattleEquipment(itemConfirm.entry);
        } else activateBagEntry(itemConfirm.entry);
      }
      setItemConfirm(null);
    },
    [activateBagEntry, activateBattleEquipment, consumeBattleItem, itemConfirm],
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
    const written = writeJsonStorage(LOCAL_SAVE_KEY, next);
    setNotice(
      written.ok
        ? `${name}踏入江湖。`
        : `${name}踏入江湖，但自动保存失败：${storageFailureNotice(written.reason)}`,
    );
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
  const applyCheatAction = useCallback(
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
        row = allCheatSkills[index];
      if (!row) return;
      const text = next.actor.skills[String(row.id)]
        ? adjustCheatSkill(next.actor, row.id, direction)
        : setCheatSkill(next.actor, row.id, 1);
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
        row = allCheatSkills[index];
      if (!row) return;
      const text = next.actor.skills[String(row.id)]
        ? maxCheatSkill(next.actor, row.id)
        : setCheatSkill(next.actor, row.id, 255);
      sync(next);
      setNotice(`${text} 点击右上角“保存”可保存进度。`);
    },
    [sync],
  );
  const mutateCheatSave = useCallback(
    (mutation: (draft: WorldSave) => string) => {
      const next = structuredClone(stateRef.current), text = mutation(next);
      sync(next);
      setNotice(`${text} 点击右上角“保存”可保存进度。`);
    },
    [sync],
  );
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
        // OS 按键自动重复只应作用于移动长按(trackHeld 集合在首次 keydown 已登记)；
        // 确认/取消类离散命令若不拦 repeat，按住 E 会连买商品、连打战斗回合。
        if (e.repeat) return;
        const target = e.target as HTMLElement | null,
          inputContext: InputContext = {
            screen,
            confirmation: cheatConfirm
              ? "cheat"
              : hiddenConfirm
                ? "hidden-quest"
                : itemConfirm
                  ? "item"
                  : null,
            dialogue: npcChat
              ? "npc-talk"
              : eventText
                ? "event-text"
                : null,
            battle: battle
              ? {
                  view:
                    battleOutcome !== null
                      ? "outcome"
                      : battleItem !== null
                        ? "items"
                        : specialMenu !== null
                          ? "specials"
                          : battleSkill !== null
                            ? "skills"
                          : "action",
                }
              : null,
            arcade: arcade?.kind || null,
            modal: taskBook
              ? { kind: "task-journal" }
              : life
                ? { kind: "life" }
              : caihua
                ? { kind: "appearance" }
                : flyMenu !== null
                  ? { kind: "fly" }
                  : cultivation !== null
                    ? { kind: "cultivation", active: cultivationActive }
                    : npcMenu
                      ? { kind: "npc" }
                      : shop
                        ? { kind: "shop" }
                        : study
                          ? { kind: "study", active: studyActive }
                          : null,
            menu: menu
              ? {
                  tab: menu.tab as 0 | 1 | 2 | 3,
                  cheatSubtab: menu.sub,
                }
              : null,
          },
          resolved = resolveGameKey(
            {
              key: e.key,
              isComposing: e.isComposing,
              keyCode: e.keyCode,
              target,
            },
            inputContext,
          );
        if (resolved.layer === "composition") return;
        if (resolved.layer === "editor") {
          if (resolved.command?.type === "blur-editor") target?.blur();
          return;
        }
        if (resolved.blocked || !resolved.command) return;
        if (resolved.preventDefault) e.preventDefault();
        const k = resolved.key;
        if (resolved.trackHeld) keys.current.add(k);
        const confirm = isConfirmKey(k),
          cancel = isCancelKey(k);
        if (screen !== "play") {
          if (screen === "intro") {
            if (confirm || cancel) setScreen("create");
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
            } else if (cancel) {
              closeNpcChat();
              battleNarrationAbort.current?.abort();
              if (exitToTitle) exitToTitle();
              else location.href = "/";
            }
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
        if (resolved.layer === "dialogue" && npcChat) {
          if (resolved.command.type === "dialogue-auto-toggle") {
            toggleNpcConversationAuto();
          } else if (npcChat.pendingQuest) {
            if (["arrowup", "arrowdown", "w", "s"].includes(k))
              setNpcChat({ ...npcChat, questChoice: npcChat.questChoice === 0 ? 1 : 0 });
            else if (confirm) {
              if (npcChat.questChoice === 0) acceptNpcQuest();
              else declineNpcQuest();
            } else if (cancel) declineNpcQuest();
          } else if (confirm && npcChat.questReady) {
            const interaction = stateRef.current.tasks.generatedQuest
              ? generatedQuestInteraction(stateRef.current.tasks.generatedQuest, npcChatRef(npcChat))
              : null;
            if (interaction === "battle-ready") startGeneratedQuestBattle();
            else if (interaction === "report") claimNpcQuestReward();
          } else if (confirm) advanceNpcConversation();
          else if (cancel) closeNpcChat();
          return;
        }
        if (resolved.layer === "confirmation" && cheatConfirm) {
          if (["arrowup", "arrowdown", "w", "s"].includes(k))
            setCheatConfirm({
              ...cheatConfirm,
              index: (cheatConfirm.index + 1) % 2,
            });
          else if (confirm) {
            if (cheatConfirm.index === 0) applyCheatAction(cheatConfirm.action, true);
            else setCheatConfirm(null);
          } else if (cancel) setCheatConfirm(null);
          return;
        }
        if (resolved.layer === "modal" && taskBook) {
          if (taskBook.confirmAbandon) {
            if (confirm) confirmAbandonGeneratedQuest();
            else if (cancel) setTaskBook({ ...taskBook, confirmAbandon: false });
            return;
          }
          const hasGeneratedQuest = Boolean(stateRef.current.tasks.generatedQuest),
            length = hasGeneratedQuest ? 2 : 1;
          if (["arrowup", "arrowdown", "w", "s"].includes(k))
            setTaskBook({ ...taskBook, index: (taskBook.index + 1) % length });
          else if (cancel) setTaskBook(null);
          else if (confirm) {
            if (taskBook.index === 0) setTaskBook(null);
            else setTaskBook({ ...taskBook, confirmAbandon: true });
          }
          return;
        }
        if (resolved.layer === "modal" && life) {
          const length = life.kind === "forge" ? 5 : 8;
          if (k === "arrowup" || k === "w")
            setLife({ ...life, index: (life.index + length - 1) % length });
          else if (k === "arrowdown" || k === "s")
            setLife({ ...life, index: (life.index + 1) % length });
          else if (cancel) setLife(null);
          else if (confirm) {
            const next = structuredClone(stateRef.current);
            let result: { ok: boolean; text: string };
            if (life.kind === "forge") {
              if (life.index < 4) {
                const type = life.index,
                  sword = next.actor.swords?.[type];
                result = sword?.forged
                  ? reforgeSword(
                      next.actor,
                      type,
                      seeded(next.tasks.clock + (sword.times || 0)),
                    )
                  : createSword(next.actor, type, `无名${swordTypes[type]}`);
              } else {
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
          }
          return;
        }
        if (resolved.layer === "arcade" && arcade) {
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
        if (resolved.layer === "battle" && battle) {
          const specials = battleSpecials(
            stateRef.current.actor,
            battle.cooldowns,
          );
          const combatItems = battleBagEntries(stateRef.current.actor);
          // 战斗武学面板与主菜单「功夫」页同一份完整清单。
          const combatSkills = learnedSkills(stateRef.current.actor).sort(
            (a, b) => a.type - b.type || a.id - b.id,
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
            else if (confirm) openBattleBagEntry(combatItems[battleItem]);
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
          if (battleSkill !== null) {
            if (k === "arrowup" || k === "w")
              setBattleSkill(
                (battleSkill + combatSkills.length - 1) %
                  Math.max(1, combatSkills.length),
              );
            else if (k === "arrowdown" || k === "s")
              setBattleSkill(
                (battleSkill + 1) % Math.max(1, combatSkills.length),
              );
            else if (confirm) activateSkill(combatSkills[battleSkill]?.id);
            else if (k === "r")
              activateSkill(combatSkills[battleSkill]?.id, true);
            else if (cancel || k === "m") setBattleSkill(null);
            return;
          }
          if (k === "q" || k === "c") setSpecialMenu(0);
          else if (k === "i") setBattleItem(0);
          else if (k === "m") setBattleSkill(0);
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
        if (resolved.layer === "modal" && caihua) {
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
        if (resolved.layer === "modal" && flyMenu !== null) {
          const length = ((originalSystem.fly_menu as string[]) || []).length,
            cols = 3;
          if (k === "arrowup" || k === "w")
            setFlyMenu((flyMenu - cols + length) % length);
          else if (k === "arrowdown" || k === "s")
            setFlyMenu((flyMenu + cols) % length);
          else if (k === "arrowleft" || k === "a")
            setFlyMenu((flyMenu - 1 + length) % length);
          else if (k === "arrowright" || k === "d")
            setFlyMenu((flyMenu + 1) % length);
          else if (confirm) flyTo(flyMenu);
          else if (cancel || k === "h") setFlyMenu(null);
          return;
        }
        if (resolved.layer === "confirmation" && hiddenConfirm) {
          if (["arrowup", "arrowdown", "w", "s"].includes(k))
            setHiddenConfirm({
              ...hiddenConfirm,
              index: (hiddenConfirm.index + 1) % 2,
            });
          else if (confirm) confirmHiddenQuest(hiddenConfirm.index === 0);
          else if (cancel) setHiddenConfirm(null);
          return;
        }
        if (resolved.layer === "confirmation" && itemConfirm) {
          if (["arrowup", "arrowdown", "w", "s"].includes(k))
            setItemConfirm({
              ...itemConfirm,
              index: (itemConfirm.index + 1) % 2,
            });
          else if (confirm) confirmBagAction(itemConfirm.index);
          else if (cancel) setItemConfirm(null);
          return;
        }
        if (resolved.layer === "modal" && cultivation !== null) {
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
        if (resolved.layer === "menu" && menu) {
          const entries = organizedBagEntries(stateRef.current.actor),
            skills = organizedSkills(stateRef.current.actor),
            cols = 2,
            cheatLen =
              menu.sub === 0
                ? cheatQuickOptions.length
                : menu.sub === 1
                  ? cheatStats.length
                  : menu.sub === 3
                    ? allCheatSkills.length
                    : 1,
            length =
              menu.tab === 0
                ? Math.max(1, entries.length)
                : menu.tab === 2
                  ? Math.max(1, skills.length)
                  : menu.tab === 3
                    ? Math.max(1, cheatLen)
                    : 1,
            gridUp = (i: number) => (i - cols + length) % length,
            gridDown = (i: number) => (i + cols) % length,
            gridLeft = (i: number) => (i - 1 + length) % length,
            gridRight = (i: number) => (i + 1) % length;
          // 页签切换只走 Tab/数字键或鼠标点击，方向键在页签内移动选择(#4)
          if (k === "tab" || isMenuTabKey(k)) {
            const target =
              k === "tab" ? (menu.tab + 1) % 4 : menuTabFromKey(k) ?? 0;
            setMenu({ tab: target, index: 0, sub: menu.sub });
            return;
          }
          if (menu.tab === 3) {
            if (k === "q")
              setMenu({ ...menu, sub: (menu.sub + 5) % 6, index: 0 });
            else if (k === "m" && menu.sub === 1) maximizeCheatStat(menu.index);
            else if (k === "m" && menu.sub === 3) maximizeCheatSkill(menu.index);
            else if (k === "arrowup" || k === "w")
              setMenu({
                ...menu,
                index: (menu.index - 1 + length) % length,
              });
            else if (k === "arrowdown" || k === "s")
              setMenu({ ...menu, index: (menu.index + 1) % length });
            else if ((k === "arrowleft" || k === "a") && menu.sub === 1)
              changeCheatStat(menu.index, -1);
            else if ((k === "arrowright" || k === "d") && menu.sub === 1)
              changeCheatStat(menu.index, 1);
            else if ((k === "arrowleft" || k === "a") && menu.sub === 3)
              changeCheatSkill(menu.index, -1);
            else if ((k === "arrowright" || k === "d") && menu.sub === 3)
              changeCheatSkill(menu.index, 1);
            else if (confirm && menu.sub === 0)
              applyCheatAction(cheatQuickOptions[menu.index].id);
            else if (confirm && menu.sub === 1)
              changeCheatStat(menu.index, 1);
            else if (confirm && menu.sub === 3)
              changeCheatSkill(menu.index, 1);
            else if (cancel || k === "m") setMenu(null);
            return;
          }
          if (k === "arrowup" || k === "w")
            setMenu({ ...menu, index: gridUp(menu.index) });
          else if (k === "arrowdown" || k === "s")
            setMenu({ ...menu, index: gridDown(menu.index) });
          else if (k === "arrowleft" || k === "a")
            setMenu({ ...menu, index: gridLeft(menu.index) });
          else if (k === "arrowright" || k === "d")
            setMenu({ ...menu, index: gridRight(menu.index) });
          else if (confirm && menu.tab === 0) {
            openBagEntry(entries[menu.index]);
          }
          else if (confirm && menu.tab === 2)
            activateSkill(skills[menu.index]?.id);
          else if ((k === "c" || k === "r") && menu.tab === 2)
            activateSkill(skills[menu.index]?.id, true);
          else if (cancel || isMainMenuKey(k)) setMenu(null);
          return;
        }
        if (resolved.layer === "dialogue" && eventText && (confirm || cancel)) {
          advanceEventText();
          return;
        }
        if (resolved.layer === "modal" && npcMenu) {
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
        if (resolved.layer === "modal" && shop) {
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
        if (resolved.layer === "modal" && study) {
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
        if (resolved.layer !== "world") return;
        if (confirm) interact();
        else if (isMainMenuKey(k)) setMenu({ tab: 0, index: 0, sub: 0 });
        else if (isMenuTabKey(k))
          setMenu({ tab: menuTabFromKey(k) ?? 0, index: 0, sub: 0 });
        else if (k === "r") setCultivation(0);
        else if (k === "h") openFlyMenu();
        else if (k === "t") setTaskBook({ index: 0, confirmAbandon: false });
        else if (cancel) location.href = "/";
      },
      up = (e: KeyboardEvent) => {
        const key = normalizeGameKey(e.key);
        keys.current.delete(key);
        delete held.current[key];
      };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    // 切窗口/弹系统对话框会吞掉 keyup，按键状态残留会让角色在失焦后
    // 自己走个不停；blur 与页面隐藏时统一清空。
    const releaseHeldKeys = () => {
      keys.current.clear();
      for (const key of Object.keys(held.current)) delete held.current[key];
    };
    addEventListener("blur", releaseHeldKeys);
    const onVisibility = () => {
      if (document.hidden) releaseHeldKeys();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
      removeEventListener("blur", releaseHeldKeys);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    battle,
    battleItem,
    battleSkill,
    battleOutcome,
    advanceEventText,
    advanceNpcConversation,
    beginCultivation,
    beginStudyAt,
    buySelected,
    caihua,
    changeCheatSkill,
    changeCheatStat,
    cheatConfirm,
    chooseNpc,
    acceptNpcQuest,
    declineNpcQuest,
    startGeneratedQuestBattle,
    claimNpcQuestReward,
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
    hiddenConfirm,
    confirmHiddenQuest,
    confirmAbandonGeneratedQuest,
    npcMenu,
    npcChat,
    closeNpcChat,
    toggleNpcConversationAuto,
    openBagEntry,
    openBattleBagEntry,
    openFlyMenu,
    startSwordChallenge,
    save,
    shop,
    study,
    studyActive,
    studySelected,
    activateBagEntry,
    activateSkill,
    arcade,
    life,
    taskBook,
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
    exitToTitle,
    applyCheatAction,
  ]);
  const arcadeKind = arcade?.kind;
  useEffect(() => {
    if (!arcadeKind || arcadeKind === "select") return;
    return startFixedStepLoop(() => {
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
    });
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
    // 打坐等长时操作按固定增量推进、速率与步进频率耦合；这里在私有副本上
    // 连续推进，每 12 步(约 10Hz)才提交一次并刷新提示——进度节奏不变，
    // 但整档深拷贝与全树重渲染从每秒数百次降到约 30 次。
    let buffer: WorldSave | null = null,
      steps = 0,
      latest = "";
    const flush = () => {
      if (!buffer) return;
      sync(buffer);
      buffer = null;
      steps = 0;
      setNotice(latest);
    };
    const stopLoop = startFixedStepLoop(() => {
      if (!buffer) buffer = structuredClone(stateRef.current);
      const outcome = advanceCultivation(buffer, cultivation);
      latest = outcome.text;
      if (!outcome.keepGoing) {
        flush();
        setCultivationActive(false);
        return false;
      }
      if (++steps >= 12) flush();
      return true;
    });
    return () => {
      stopLoop();
      flush();
    };
  }, [advanceCultivation, cultivation, cultivationActive, sync]);
  useEffect(() => {
    if (!studyActive || !study) return;
    const item = (study.book ? bookStudyOptions(study.id) : studyOptions(study.id))[
      study.index
    ];
    let buffer: WorldSave | null = null,
      steps = 0,
      latest = "";
    const flush = () => {
      if (!buffer) return;
      sync(buffer);
      buffer = null;
      steps = 0;
      setNotice(latest);
    };
    const stopLoop = startFixedStepLoop(() => {
      if (!item) return false;
      if (!buffer) buffer = structuredClone(stateRef.current);
      const result = studyOnce(buffer.actor, item.id, item.maxLevel);
      latest = result.text;
      if (!result.ok || result.leveled) {
        flush();
        setStudyActive(false);
        return false;
      }
      if (++steps >= 12) flush();
      return true;
    });
    return () => {
      stopLoop();
      flush();
    };
  }, [study, studyActive, sync]);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let raf = 0;
    const resizeCanvas = () => {
      const bounds = target.getBoundingClientRect(),
        ratio = Math.min(2.5, Math.max(1, window.devicePixelRatio || 1)),
        width = Math.max(W, Math.round(bounds.width * ratio)),
        height = Math.max(H, Math.round(bounds.height * ratio));
      if (target.width !== width || target.height !== height) {
        target.width = width;
        target.height = height;
      }
      const ctx = target.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(width / W, 0, 0, height / H, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    };
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(target);
    let lastFrame = 0;
    const frame = (now: number) => {
      raf = 0;
      const ctx = target.getContext("2d");
      if (ctx && now - lastFrame >= 1000 / 30) {
        lastFrame = now;
        drawWorld(ctx, stateRef.current, ambientWorld.current, ambientPlayer.current);
      }
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    const syncVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      lastFrame = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ambientPlayer, ambientWorld, screen]);
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
    let source: unknown;
    try {
      source = JSON.parse(await f.text());
    } catch {
      setNotice("无法读取该文件，或文件不是有效的 JSON。");
      return;
    }
    const parsed = parseSave(source);
    if (!parsed.ok) {
      setNotice(`JSON 存档格式无效：${parsed.error}`);
      return;
    }
    // 导入会整体替换存档：战斗、对话、菜单等瞬态界面仍引用旧档数据，
    // 全部关闭后再进入游戏画面。
    chatAbort.current?.abort();
    chatAbort.current = null;
    setBattle(null);
    setBattleNarratives([]);
    setBattleOutcome(null);
    setBattleItem(null);
    setBattleSkill(null);
    setSpecialMenu(null);
    setNpcChat(null);
    setNpcMenu(null);
    setShop(null);
    setStudy(null);
    setStudyActive(false);
    setCultivation(null);
    setCultivationActive(false);
    setMenu(null);
    setCheatConfirm(null);
    setItemConfirm(null);
    setHiddenConfirm(null);
    setTaskBook(null);
    setFlyMenu(null);
    setArcade(null);
    setLife(null);
    setCaihua(null);
    setEventText("");
    setEventNpcId(null);
    sync(parsed.value);
    const written = writeJsonStorage(LOCAL_SAVE_KEY, parsed.value);
    setScreen("play");
    setNotice(
      written.ok
        ? "JSON 读取成功"
        : `JSON 已载入，但本地保存失败：${storageFailureNotice(written.reason)}`,
    );
  };
  const map = getOriginalMap(state.position.mapId),
    profile = actorStatusProfile(state.actor);
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
          <button onClick={returnToTitle}>主菜单</button>
        </div>
      </header>
      <section className="world-frame">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          role="img"
          aria-label={`${map.name}地图，主角位于 ${state.position.x}, ${state.position.y}`}
        >
          当前浏览器不支持 Canvas。你仍可从标题页导入或导出 JSON 存档。
        </canvas>
        {eventText && (
          <button
            className={`world-dialog${eventNpcId ? " with-portrait" : ""}`}
            onClick={advanceEventText}
          >
            {eventNpcId && (
              <CharacterPortrait
                npcId={eventNpcId}
                name={String(npcRecord(eventNpcId).name || "江湖人物")}
                className="dialog-portrait"
              />
            )}
            <span className="world-dialog-copy">
              {eventText.split("\n").map((line, i) => (
                <span key={i}>{line || " "}</span>
              ))}
            </span>
            <i>▼</i>
          </button>
        )}
        {npcChat && (() => {
          const latest = npcChat.messages[npcChat.messages.length - 1],
            speaker = latest?.role === "user" ? state.actor.name : npcLore(npcChat.id).name,
            npcSpeaking = latest?.role !== "user",
            interaction = state.tasks.generatedQuest
              ? generatedQuestInteraction(state.tasks.generatedQuest, npcChatRef(npcChat))
              : null;
          return (
            <section
              className={`npc-talk-dialog${npcChat.auto ? " auto" : ""}${npcChat.pendingQuest ? " has-offer" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-label={`与${npcLore(npcChat.id).name}交谈`}
            >
              <div className={`npc-talk-portrait npc${npcSpeaking ? " active" : " muted"}`}>
                <CharacterPortrait
                  npcId={npcChat.id}
                  name={npcLore(npcChat.id).name}
                  className="dialog-portrait"
                />
                <b>{npcLore(npcChat.id).name}</b>
              </div>
              <div className="npc-talk-center">
                <button
                  type="button"
                  className="npc-talk-copy npc-talk-advance-surface"
                  aria-label="推进下一句对话"
                  disabled={npcChat.auto || npcChat.loading || Boolean(npcChat.pendingQuest) || npcChat.questReady || Boolean(npcChat.questReplyMode) || Boolean(npcChat.terminal)}
                  onClick={advanceNpcConversation}
                >
                  <strong className={npcSpeaking ? "npc-speaker" : "player-speaker"}>{speaker}</strong>
                  <p className={npcChat.loading ? "thinking" : ""}>
                    {latest?.speech || (npcChat.loading ? "正在斟酌如何回应……" : "……")}
                  </p>
                </button>
                {npcChat.pendingQuest && (
                  <div className="npc-talk-offer">
                    <span className="npc-talk-offer-summary">
                      <b>是否接受「{npcChat.pendingQuest.title}」？</b>
                      <small>委托原委保留在上方对白中，可滚动查看。</small>
                    </span>
                    <small className="npc-talk-offer-reward">
                      经验 {npcChat.pendingQuest.reward.exp} · 潜能 {npcChat.pendingQuest.reward.potential} · 银两 {npcChat.pendingQuest.reward.gold}
                      {npcChat.pendingQuest.reward.item ? ` · ${npcChat.pendingQuest.reward.item.name}` : ""}
                    </small>
                    <span className="npc-talk-actions">
                      <button type="button" className={npcChat.questChoice === 0 ? "active" : ""}
                        onClick={(event) => { event.stopPropagation(); acceptNpcQuest(); }}>接受</button>
                      <button type="button" className={npcChat.questChoice === 1 ? "active" : ""}
                        onClick={(event) => { event.stopPropagation(); declineNpcQuest(); }}>婉拒</button>
                    </span>
                  </div>
                )}
                {state.tasks.generatedQuest && npcChat.questReady && interaction === "battle-ready" && (
                  <div className="npc-talk-actions quest-action">
                    <button type="button" onClick={(event) => { event.stopPropagation(); startGeneratedQuestBattle(); }}>开始切磋</button>
                  </div>
                )}
                {state.tasks.generatedQuest && npcChat.questReady && interaction === "report" && (
                  <div className="npc-talk-actions quest-action">
                    <button type="button" onClick={(event) => { event.stopPropagation(); claimNpcQuestReward(); }}>领取奖励</button>
                  </div>
                )}
                {npcChat.terminal && (
                  <div className="npc-talk-terminal" role="status">
                    {npcChat.terminal === "battle" ? "话音落下，切磋即将开始……" : "这段交谈即将结束……"}
                  </div>
                )}
                {!npcChat.questReplyMode && !npcChat.terminal && <div className="npc-talk-controls">
                  <button type="button"
                    disabled={npcChat.loading || npcChat.auto || Boolean(npcChat.pendingQuest) || npcChat.questReady}
                    onClick={(event) => { event.stopPropagation(); advanceNpcConversation(); }}>
                    {npcChat.loading ? "生成中…" : "继续"}
                  </button>
                  <button type="button" className={npcChat.auto ? "active" : ""}
                    disabled={Boolean(npcChat.pendingQuest) || npcChat.questReady}
                    onClick={(event) => { event.stopPropagation(); toggleNpcConversationAuto(); }}>
                    {npcChat.auto ? "暂停发展" : "自由发展"}
                  </button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); closeNpcChat(); }}>结束</button>
                </div>}
                <small className="npc-talk-hint">
                  {npcChat.questReplyMode || npcChat.terminal
                    ? "任务节点会在本句结束后自动推进"
                    : "点击 / E / Enter 继续 · Space 自由发展 · X / Esc 结束"}
                </small>
              </div>
              <div className={`npc-talk-portrait player${npcSpeaking ? " muted" : " active"}`}>
                <CharacterPortrait
                  playerGender={state.actor.gender}
                  name={state.actor.name}
                  className="dialog-portrait"
                />
                <b>{state.actor.name}</b>
              </div>
            </section>
          );
        })()}
        {arcade && <Arcade game={arcade} actor={state.actor} />}
        {life && <LifeMenu menu={life} actor={state.actor} />}
        {taskBook && (
          <section className="task-journal" role="dialog" aria-modal="true" aria-label="任务簿">
            <header>
              <div>
                <small>江湖履约</small>
                <h2>任务簿</h2>
              </div>
              <button type="button" onClick={() => setTaskBook(null)}>关闭</button>
            </header>
            <div className="task-journal-body">
              <section>
                <h3>原作任务</h3>
                <ul>
                  {taskJournal(state.tasks).some((line) => !line.startsWith("奇遇："))
                    ? taskJournal(state.tasks)
                        .filter((line) => !line.startsWith("奇遇："))
                        .map((line) => <li key={line}>{line}</li>)
                    : <li>当前没有进行中的原作任务。</li>}
                </ul>
              </section>
              {state.tasks.generatedQuest ? (
                <section className="task-journal-generated">
                  <small>当前奇遇</small>
                  <h3>{state.tasks.generatedQuest.title}</h3>
                  <p>{state.tasks.generatedQuest.premise}</p>
                  <strong>{generatedQuestObjective(state.tasks.generatedQuest)}</strong>
                  <p>
                    目标地点：{state.tasks.generatedQuest.target.mapName} · 发布人：{state.tasks.generatedQuest.issuer.name}
                  </p>
                  <p>
                    奖励：经验 {state.tasks.generatedQuest.reward.exp} · 潜能 {state.tasks.generatedQuest.reward.potential} · 银两 {state.tasks.generatedQuest.reward.gold}
                    {state.tasks.generatedQuest.reward.item ? ` · ${state.tasks.generatedQuest.reward.item.name}` : ""}
                  </p>
                  <div className="task-transcript">
                    {state.tasks.generatedQuest.transcript.length ?
                      state.tasks.generatedQuest.transcript.map((entry) => (
                        <p key={entry.id}>
                          <b>{entry.speaker === "player" ? state.actor.name : entry.speaker === "npc" ? npcLore(entry.npcId || state.tasks.generatedQuest!.issuer.npcId).name : "任务记录"}</b>
                          <span>{entry.speech}</span>
                        </p>
                      )) : <em>任务刚刚开始，尚无对话记录。</em>}
                  </div>
                </section>
              ) : (
                <section className="task-journal-generated empty">
                  <h3>暂无奇遇委托</h3>
                  <p>与普通江湖人物深入交谈，偶尔会有人自然提出委托。</p>
                </section>
              )}
              <section className="task-journal-history">
                <div className="task-history-heading">
                  <div>
                    <small>江湖足迹</small>
                    <h3>已完成奇遇日志</h3>
                  </div>
                  <b>{state.tasks.generatedQuestHistory.length} 件</b>
                </div>
                {state.tasks.generatedQuestHistory.length ? (
                  <div className="task-history-list">
                    {[...state.tasks.generatedQuestHistory].reverse().map((entry) => (
                      <article key={entry.id}>
                        <header>
                          <b>{entry.title}</b>
                          <time>{formatQuestClock(entry.completedAt)}</time>
                        </header>
                        <p>{entry.summary}</p>
                        <small>{entry.premise}</small>
                        {entry.closingLine && <blockquote>“{entry.closingLine}”</blockquote>}
                        <footer>
                          <span>发布人：{entry.issuerName} · {entry.issuerMapName}</span>
                          <span>
                            奖励：经验 {entry.reward.exp} · 潜能 {entry.reward.potential} · 银两 {entry.reward.gold}
                            {entry.reward.item ? ` · ${entry.reward.item.name}` : ""}
                          </span>
                        </footer>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="task-history-empty">完成并领取第一桩奇遇奖励后，这里会留下故事摘要。</p>
                )}
              </section>
            </div>
            <footer>
              <button type="button" className={taskBook.index === 0 ? "active" : ""} onClick={() => setTaskBook(null)}>返回</button>
              {state.tasks.generatedQuest && (
                <button type="button" className={taskBook.index === 1 ? "active danger" : "danger"}
                  onClick={() => setTaskBook({ ...taskBook, confirmAbandon: true })}>放弃奇遇</button>
              )}
            </footer>
            {taskBook.confirmAbandon && (
              <div className="task-abandon-confirm">
                <h3>确定放弃这条奇遇？</h3>
                <p>当前完整任务对话与进度会被清除；放弃后可立即与 NPC 交谈并接受新委托。</p>
                <div>
                  <button type="button" className="danger" onClick={confirmAbandonGeneratedQuest}>确定放弃</button>
                  <button type="button" onClick={() => setTaskBook({ ...taskBook, confirmAbandon: false })}>继续任务</button>
                </div>
              </div>
            )}
          </section>
        )}
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
            narratives={battleNarratives}
            actor={state.actor}
            hp={state.actor.hp}
            maxHp={state.actor.maxHp}
            fight={fight}
            leave={leaveBattle}
            openSpecial={() => setSpecialMenu(0)}
            openItem={() => setBattleItem(0)}
            openSkill={() => setBattleSkill(0)}
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
          <BattleBagPicker
            actor={state.actor}
            index={battleItem}
            onHover={setBattleItem}
            activate={openBattleBagEntry}
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
        {battle && battleSkill !== null && (
          <BattleSkillPicker
            actor={state.actor}
            index={battleSkill}
            onHover={setBattleSkill}
            activate={activateSkill}
          />
        )}{" "}
        {menu && (
          <GameMenu
            actor={state.actor}
            tasks={state.tasks}
            menu={menu}
            setMenu={setMenu}
            activate={openBagEntry}
            discard={discardBagEntry}
            activateKf={activateSkill}
            quickAction={applyCheatAction}
            changeStat={changeCheatStat}
            changeSkill={changeCheatSkill}
            maxStat={maximizeCheatStat}
            maxSkill={maximizeCheatSkill}
            mutate={mutateCheatSave}
          />
        )}
        {cheatConfirm && (
          <Choice
            title={`「${cheatQuickOptions.find((item) => item.id === cheatConfirm.action)?.name}」会大幅改变成长数值，确定施展？`}
            items={["确定施展", "暂不使用"]}
            index={cheatConfirm.index}
            choose={(index) => {
              setCheatConfirm({ ...cheatConfirm, index });
              if (index === 0) applyCheatAction(cheatConfirm.action, true);
              else setCheatConfirm(null);
            }}
          />
        )}
        {itemConfirm && (
          <Choice
            title={`${itemConfirm.entry.kind === 1 ? (originalTables.items[itemConfirm.entry.id]?.is_book ? "研读" : "使用") : itemConfirm.entry.equipped ? "卸下" : "装备"}「${itemConfirm.entry.name}」？`}
            items={["确定", "取消"]}
            index={itemConfirm.index}
            choose={confirmBagAction}
          />
        )}
        {hiddenConfirm && (
          (() => {
            const offer = hiddenQuestOffer(state.actor, hiddenConfirm.npcId);
            return (
              <Choice
                title={`用「${offer.requestName}×${offer.requestCount}」交换「${offer.prizeName}」？`}
                items={["交换", "取消"]}
                index={hiddenConfirm.index}
                choose={(index) => confirmHiddenQuest(index === 0)}
              />
            );
          })()
        )}
        {flyMenu !== null && (
          <Choice
            title="轻功 · 消耗 200 内力"
            items={((originalSystem.fly_menu as string[]) || []).map(
              (name) => `飞往${name}`,
            )}
            index={flyMenu}
            choose={flyTo}
            columns={3}
            hint="W/A/S/D 或方向键选择 · E/Enter 确认 · X/Esc 返回"
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
        {state.tasks.generatedQuest && (
          <button
            type="button"
            className="generated-quest-sidebar"
            onClick={() => setTaskBook({ index: 0, confirmAbandon: false })}
            title="打开任务簿查看完整奇遇记录"
          >
            <small>当前奇遇 · 下一步</small>
            <b>{state.tasks.generatedQuest.title}</b>
            <span>{generatedQuestObjective(state.tasks.generatedQuest)}</span>
          </button>
        )}
        <p>{notice}</p>
        <nav>
          <button onClick={() => setMenu({ tab: 0, index: 0, sub: 0 })}>
            行囊 <kbd>1</kbd>
          </button>
          <button onClick={() => setMenu({ tab: 1, index: 0, sub: 0 })}>
            状态 <kbd>2</kbd>
          </button>
          <button onClick={() => setMenu({ tab: 2, index: 0, sub: 0 })}>
            功夫 <kbd>3</kbd>
          </button>
          <button onClick={() => setMenu({ tab: 3, index: 0, sub: 0 })}>
            秘技 <kbd>4</kbd>
          </button>
          <button onClick={() => setCultivation(0)}>
            修炼 <kbd>R</kbd>
          </button>
          <button onClick={openFlyMenu}>
            轻功 <kbd>H</kbd>
          </button>
          <button
            onClick={() => setTaskBook({ index: 0, confirmAbandon: false })}
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
        <kbd>Enter</kbd> · 菜单 <kbd>C</kbd> · 行囊 <kbd>1</kbd> · 状态{" "}
        <kbd>2</kbd> · 功夫 <kbd>3</kbd> · 秘技 <kbd>4</kbd> · 修炼 <kbd>R</kbd> ·
        轻功 <kbd>H</kbd> · 任务 <kbd>T</kbd> · 保存（右上角） · 返回{" "}
        <kbd>Esc</kbd>
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

const formatQuestClock = (seconds: number) => {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60)),
    day = Math.floor(totalMinutes / 720) + 1,
    minuteOfDay = totalMinutes % 720,
    hour = Math.floor(minuteOfDay / 60),
    minute = minuteOfDay % 60;
  return `第 ${day} 天 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
