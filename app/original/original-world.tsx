"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  activePage,
  canMoveBetween,
  friendlyEventName,
  getOriginalMap,
  originalStart,
  passable,
  triggerEvent,
  type MapEvent,
  type OriginalMap,
  type WorldPosition,
} from "../game-core/original-world";
import {
  ambientNpcAt,
  ambientCanHear,
  ambientNpcInViewport,
  ambientViewportBounds,
  createAmbientWorld,
  resetAmbientSessions,
  tickAmbientWorld,
  type AmbientBubbleKind,
  type AmbientNpc,
  type AmbientWorld,
} from "../game-core/ambient-npc";
import {
  drawAmbientBubble,
  drawConversationCard,
  layoutConversationCard,
  resolveAmbientBubbleLayout,
} from "../game-core/ambient-bubble-layout";
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
  cheatInventoryCatalog,
  cheatQuickOptions,
  cheatSchools,
  cheatStats,
  cheatStatMaximum,
  cheatTeachers,
  maxCheatSkill,
  maxCheatStat,
  removeCheatSkill,
  reviveCheatNpc,
  setCheatIdentity,
  setCheatInventory,
  setCheatSkill,
  setCheatStat,
  type CheatInventoryKind,
  type CheatQuickAction,
} from "../game-core/cheat-system";
import {
  actorStatusProfile,
  levelTier,
  levelTitle,
} from "../game-core/status-system";
import { buildNpcSystemPrompt, npcConversationFacts, npcLore } from "../game-core/npc-lore";
import {
  buildBattleNarrationFacts,
  buildBattleNarrationPrompt,
  type BattleNarrative,
  type BattleNarrationEvent,
} from "../game-core/battle-narration";
import {
  streamNpcReply,
  type ChatMessage,
} from "../game-core/lm-studio";
import { MAX_PLAYER_EXP } from "../game-core/progression-limits";
import "./world.css";
import "./choice.css";
import "./battle.css";
import "./special.css";
import "./menu.css";

const W = 640,
  H = 480,
  T = 32;

type WuxiaArt = {
  characters: Array<HTMLImageElement | null>;
  natureOverlays: HTMLImageElement | null;
  interiorOverlays: HTMLImageElement | null;
};
type CharacterSprite = { sheet: number; row: number; portrait?: number };
const wuxiaArt: WuxiaArt = {
  characters: [null, null, null, null, null, null, null],
  natureOverlays: null,
  interiorOverlays: null,
};

function loadWuxiaArt() {
  const load = (src: string, ready: (image: HTMLImageElement) => void) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => ready(image);
    image.src = src;
  };
  [
    "wuxia-characters-v1.png",
    "wuxia-characters-ages-v1.png",
    "wuxia-characters-townsfolk-v1.png",
    "wuxia-characters-factions-v1.png",
    "wuxia-characters-women-v1.png",
    "wuxia-characters-faction-signatures-v1.png",
    "wuxia-characters-flower-variants-v1.png",
  ].forEach((name, index) =>
    load(`/game-assets/generated/${name}`, (image) => {
      wuxiaArt.characters[index] = image;
    }),
  );
  load("/game-assets/redrawn/overlay-nature-v3.png", (image) => {
    wuxiaArt.natureOverlays = image;
  });
  load("/game-assets/redrawn/overlay-interior-v3.png", (image) => {
    wuxiaArt.interiorOverlays = image;
  });
}

function npcCharacterSprite(id: number, fallbackName = ""): CharacterSprite {
  const npc = id > 0 ? npcRecord(id) : {},
    name = String(npc.name || fallbackName),
    description = ((npc.des_text as string[]) || []).join(""),
    text = `${name}${description}`,
    age = Number(npc.age || 30),
    female = Number(npc.gender || 0) === 1,
    merchant = Number(npc.type || 0) === -1 || /老板|掌柜|商人|店|贩|卖/.test(text);
  // Age is a physical identity constraint, not a styling hint. Keep children and
  // elders recognisable even when their descriptions also mention a faction.
  if (age < 18) return { sheet: 1, row: female ? 1 : 0 };
  if (age >= 55) return { sheet: 1, row: female ? 3 : 2 };
  const specialPortraits: Record<string, number> = {
    阿绣: 20, 李青照: 21, 柳如是: 22, 聂隐娘: 23, 入画: 24,
    唐晚词: 25, 李师师: 26, 薛涛: 27, 王璁儿: 28, 唐思儿: 29,
    薛千柔: 32, 白瑞德: 33,
  };
  if (specialPortraits[name] !== undefined) {
    if (/王璁儿|唐思儿/.test(name)) return { sheet: 5, row: 1, portrait: specialPortraits[name] };
    if (name === "薛千柔") return { sheet: 5, row: 3, portrait: 32 };
    if (name === "白瑞德") return { sheet: 0, row: 2, portrait: 33 };
    const flowerRows: Record<string, number> = { 阿绣: 0, 李青照: 1, 柳如是: 2, 聂隐娘: 3 };
    return { sheet: 6, row: flowerRows[name] ?? hashIndex(name, 4), portrait: specialPortraits[name] };
  }
  if (/花间派|李青照|名妓|侍女|剑器之舞|红拂女/.test(text) && female)
    return { sheet: 6, row: hashIndex(name, 4), portrait: 20 + hashIndex(name, 8) };
  if (/红莲教/.test(text))
    return female
      ? { sheet: 5, row: 1, portrait: 28 + hashIndex(name, 2) }
      : { sheet: 3, row: 0, portrait: 31 };
  if (/武当/.test(text)) return { sheet: 5, row: 2, portrait: 30 };
  if (/雪山/.test(text))
    return female ? { sheet: 5, row: 3, portrait: 32 } : { sheet: 0, row: 2, portrait: 33 };
  if (/冰火岛/.test(text))
    return female ? { sheet: 4, row: 0, portrait: 34 } : { sheet: 3, row: 0, portrait: 35 };
  if (female) {
    if (/师太|尼姑|女尼|居士/.test(text)) return { sheet: 4, row: 2 };
    if (/女侠|掌门|剑|杀手|教主|寨主|护法|武功/.test(text))
      return { sheet: 4, row: 0 };
    if (merchant) return { sheet: 4, row: 1 };
    if (/厨|妇人|婆|工|婶|嫂/.test(text))
      return { sheet: 4, row: 3 };
    return { sheet: 0, row: hashIndex(name, 2) ? 1 : 3 };
  }
  if (/和尚|大师|方丈|禅师|罗汉|僧/.test(text)) return { sheet: 3, row: 2 };
  if (/道长|真人|道士|天师|武当|茅山/.test(text)) return { sheet: 3, row: 3 };
  if (/捕快|官|衙门|村长|管事|将军/.test(text)) return { sheet: 2, row: 0 };
  if (merchant) return { sheet: 2, row: 1 };
  if (/公子|书生|秀才|先生|教书|文士|扇/.test(text)) return { sheet: 2, row: 2 };
  if (/厨|工|铁匠|石料|樵夫|伙计|船夫/.test(text)) return { sheet: 2, row: 3 };
  if (/盗|匪|恶|杀手|喽啰|山贼|强人/.test(text)) return { sheet: 3, row: 1 };
  if (/大侠|掌门|剑|刀|教主|寨主|护法|武师|武功/.test(text))
    return { sheet: 3, row: 0 };
  return { sheet: 0, row: hashIndex(name, 2) ? 2 : 0 };
}

function CharacterPortrait({
  npcId,
  name = "",
  playerGender,
  className = "",
}: {
  npcId?: number;
  name?: string;
  playerGender?: number;
  className?: string;
}) {
  const sprite =
      playerGender === undefined
        ? npcCharacterSprite(npcId || 0, name)
        : { sheet: 0, row: playerGender ? 1 : 0 },
    index = sprite.portrait ?? sprite.sheet * 4 + sprite.row,
    factionPortrait = index >= 20,
    localIndex = factionPortrait ? index - 20 : index,
    columns = factionPortrait ? 4 : 5,
    column = localIndex % columns,
    row = Math.floor(localIndex / columns);
  return (
    <div
      className={`character-portrait ${className}`.trim()}
      role="img"
      aria-label={`${name || "人物"}立绘`}
      style={{
        backgroundImage: factionPortrait
          ? 'url("/game-assets/generated/wuxia-faction-portraits-v1.png")'
          : undefined,
        backgroundSize: factionPortrait ? "400% 400%" : undefined,
        backgroundPosition: `${(column / (columns - 1)) * 100}% ${(row / 3) * 100}%`,
      }}
    />
  );
}

const organizedBagEntries = (actor: SceneActorState) =>
  bagEntries(actor).sort(
    (a, b) =>
      a.category.localeCompare(b.category, "zh-CN") ||
      Number(b.equipped) - Number(a.equipped) ||
      a.id - b.id,
  );
const organizedSkills = (actor: SceneActorState) =>
  learnedSkills(actor).sort((a, b) => a.type - b.type || a.id - b.id);
const allCheatSkills = originalTables.kungfus.flatMap((skill, id) =>
  skill ? [{ id, name: String(skill.name || id), type: Number(skill.type || 0) }] : [],
);
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
type NpcChatState = {
  id: number;
  speech: string;
  action: string;
  messages: NpcDialogueMessage[];
  loading: boolean;
  auto: boolean;
  error: string;
};
type NpcDialogueMessage =
  | { role: "user"; speech: string; action: string }
  | {
      role: "assistant";
      state: string;
      action: string;
      speech: string;
      raw: string;
    };
type AmbientPlayerState = {
  npcIds: number[];
  replyToNpcId: number;
  bubble: string;
  bubbleUntil: number;
  bubbleShownAt: number;
  replyAt: number;
  llmRequested: boolean;
  // 群聊时：玩家说完一句后，队列里还等待回应玩家的 NPC eventId(按 eventId 升序)
  responderQueue?: number[];
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
    exp: Math.min(Number(value.actor?.exp || 0), MAX_PLAYER_EXP),
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
const parseNpcDialogue = (raw: string) => {
  const section = (name: string, next?: string) => {
    const end = next ? `(?=\\n(?:${next})[：:])` : "$";
    return raw.match(new RegExp(`(?:^|\\n)${name}[：:]\\s*([\\s\\S]*?)${end}`))?.[1]?.trim() || "";
  };
  return {
    state: section("状态", "动作|语言"),
    action: section("动作", "语言"),
    speech: section("语言") || (!/[状态动作语言][：:]/.test(raw) ? raw.trim() : ""),
  };
};
const cleanAmbientSpeech = (raw: string, forbiddenNames: string[] = []) => {
  const parsed = parseNpcDialogue(raw),
    speechOnly = parsed.speech || raw,
    escapedNames = forbiddenNames.filter(Boolean).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    namePattern = escapedNames.length ? escapedNames.join("|") : "(?!)",
    withoutDirections = speechOnly
      .replace(/(?:^|\n)\s*(?:状态|动作|神态|表情|姿态|旁白)[：:].*(?=\n|$)/g, " ")
      .replace(/[（(【[].*?[）)】\]]/g, " ")
      .replace(/^\s*(?:甲|乙|语言|台词)[：:]\s*/, "")
      .replace(/^[^：\n]{1,20}\s+to\s+[^：\n]{1,20}[：:]\s*/, "")
      .replace(/[^，。！？；：\n“”]{1,16}\s+to\s+[^，。！？；：\n“”]{1,16}/gi, " ")
      .replace(/(?:谁|某人|某某|发言者)\s*(?:对|到|to)\s*(?:谁|某人|某某|接收者)/gi, " ")
      .replace(/(?:发言者|接收者|说话者|对话对象|外层|气泡|格式|路由|标记)[：:]?/g, " ")
      .replace(new RegExp(`^(?:${namePattern})(?:说|说道|问道|答道|道)?[：:,，]?\\s*`, "g"), "")
      .replace(new RegExp(`(?:对|向)(?:${namePattern})(?:说|说道|问道|答道)[：:,，]?\\s*`, "g"), "")
      .replace(new RegExp(`(?:${namePattern})`, "g"), "")
      .replace(/[*_`#]/g, "")
      .replace(/[“”]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
    narration = /(?:风|雨|雪|月光|阳光|雾|云|竹林|树影|花瓣|衣袖|发丝|眼眸|目光|嘴角|声音|回声).{0,14}(?:吹|掠|穿|落|摇|映|响|传|动|起|泛|垂|飘)|(?:微微|轻轻|缓缓|悄然).{0,10}(?:动|笑|抬|垂|转|望|看|吹|走|摇|点|皱)|(?:她|他|其).{0,12}(?:指尖|手指|抬眼|扫过|滑入|缩回|蹭了蹭|盯着|看向|望向|点了点)|(?:站|坐|走|立|倚)在.{0,14}(?:上|下|旁|边|前|后|中)/,
    spokenClauses = withoutDirections.split(/(?<=[，。！？；])/).filter((clause) => !narration.test(clause)).join("").trim();
  return spokenClauses && !/^(?:to|谁|某某|格式|接收者|发言者)+$/i.test(spokenClauses) ? spokenClauses : "……";
};

const cleanAmbientAction = (raw: string, forbiddenNames: string[] = []) => {
  const escapedNames = forbiddenNames.filter(Boolean).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    namePattern = escapedNames.length ? escapedNames.join("|") : "(?!)",
    action = (parseNpcDialogue(raw).action || raw)
      .replace(/(?:^|\n)\s*(?:状态|语言|台词|解释|旁白)[：:].*(?=\n|$)/g, " ")
      .replace(/^\s*(?:动作)[：:]\s*/, "")
      .replace(/[（(【[].*?[）)】\]]/g, " ")
      .replace(new RegExp(`(?:${namePattern})`, "g"), "")
      .replace(/[*_`#“”]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return action && !/^(?:没有动作|无动作|无|暂无|……)$/.test(action) ? action : "……";
};

const buildAutoPlayerPrompt = (
  id: number,
  actor: SceneActorState,
  mapName: string,
) => {
  const lore = npcLore(id),
    profile = actorStatusProfile(actor);
  return `你正在《英雄坛说：云游志》的武侠世界中扮演玩家主角“${actor.name}”，绝不能跳出角色，也不要提及自己是AI或提示词。
【主角不可改写事实】${actor.age}岁，性别${profile.gender}，门派“${profile.school}”，师从“${profile.teacher}”，外貌${profile.appearance}（容貌第${profile.appearanceTier}/8阶），综合武境第${profile.realmTier}/50阶“${profile.realm}”，目前使用${profile.weapon}，道德名声${actor.morals}，气血${actor.hp}/${actor.maxHp}、内力${actor.fp}/${actor.maxFp}、银两${actor.gold}。
【当前场景】你在${mapName}，正在与“${lore.name}”交谈。【对方不可改写事实】${npcConversationFacts(id)}；性情${lore.personality}；说话方式${lore.speech}。你应记住此前双方的动作和话语，自然延续话题。

规则：根据主角已有设定、江湖处境、对方身份和前文，自主推动一轮有意义的互动；双方姓名、年龄、性别、门派、外貌与武境均为硬事实，称谓和代词必须符合明确性别，性别未知时使用中性称呼；可以问询、回应、试探、讲述、调侃、示好、质疑或结束某个话题，但不要替NPC行动；不要凭空取得物品、完成任务、发动正式战斗或修改游戏状态；不要念出编号和属性数字。要围绕当前话题深入：提出新信息、立场、疑问或反驳，给出有血有肉的具体内容，不要“是啊”“不错”这类空泛附和，也不要简单复述对方。

每次必须严格按以下三个字段输出纯文本，不要添加Markdown、姓名或其他标题：
状态：主角此刻可被观察到的神态、情绪或姿态
动作：主角紧接着做出的具体动作；若没有动作写“没有动作”
语言：主角实际说出口的话；若沉默写“……”`;
};

const ambientPlayerFacts = (actor: SceneActorState) => {
  const profile = actorStatusProfile(actor);
  return `${actor.name || "少侠"}：${actor.age}岁，性别${profile.gender}，门派${profile.school}，师父${profile.teacher}，外貌${profile.appearance}（容貌第${profile.appearanceTier}/8阶），综合武境第${profile.realmTier}/50阶“${profile.realm}”，兵刃${profile.weapon}`;
};

export default function OriginalWorld() {
  const [state, setState] = useState<WorldSave>(fresh),
    [notice, setNotice] = useState("原版地图数据已载入"),
    [eventText, setEventText] = useState(""),
    [eventNpcId, setEventNpcId] = useState<number | null>(null);
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
    [npcChat, setNpcChat] = useState<NpcChatState | null>(null),
    [shop, setShop] = useState<{ id: number; index: number } | null>(null),
    [study, setStudy] = useState<{
      id: number;
      index: number;
      book?: boolean;
    } | null>(null);
  const [studyActive, setStudyActive] = useState(false);
  const [battle, setBattle] = useState<OriginalBattle | null>(null);
  const [battleNarratives, setBattleNarratives] = useState<BattleNarrative[]>([]);
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
    chatEnd = useRef<HTMLDivElement>(null),
    chatAbort = useRef<AbortController | null>(null),
    ambientWorld = useRef<AmbientWorld>({ mapId: 0, npcs: [] }),
    ambientPlayer = useRef<AmbientPlayerState>({ npcIds: [], replyToNpcId: 0, bubble: "", bubbleUntil: 0, bubbleShownAt: 0, replyAt: 0, llmRequested: true }),
    ambientPlayerStarts = useRef(false),
    ambientPlayerEpoch = useRef(0),
    lastPlayerMove = useRef(0),
    ambientPlayerCooldown = useRef(0),
    ambientLlmActive = useRef(0),
    ambientEpoch = useRef(0),
    ambientPaused = useRef(false),
    ambientWasPaused = useRef(false),
    ambientControllers = useRef<Map<AbortController, { player: boolean; npcEventId?: number }>>(new Map()),
    battleNarrationAbort = useRef<AbortController | null>(null),
    battleNarrativesRef = useRef<BattleNarrative[]>([]),
    stateRef = useRef<WorldSave>(state),
    keys = useRef(new Set<string>()),
    held = useRef<Record<string, number>>({});
  const sync = useCallback((next: WorldSave) => {
    next.actor.exp = Math.min(next.actor.exp, MAX_PLAYER_EXP);
    stateRef.current = next;
    setState(structuredClone(next));
  }, []);
  useEffect(() => loadWuxiaArt(), []);
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
      lastPlayerMove.current = Date.now();
      const interruptedIds = new Set(ambientPlayer.current.npcIds);
      for (const npc of ambientWorld.current.npcs.filter((item) => interruptedIds.has(item.eventId))) {
        npc.partnerId = 0; npc.groupId = 0; npc.groupMembers = []; npc.groupTurn = -1; npc.groupNextAt = 0;
        npc.bubble = ""; npc.queuedBubble = ""; npc.generationPending = false; npc.llmRequested = true;
        npc.speechTargetName = ""; npc.conversationContext = []; npc.nextBehaviorAt = Date.now() + 700;
      }
      for (const [controller, job] of ambientControllers.current) {
        if (!job.player && (!job.npcEventId || !interruptedIds.has(job.npcEventId))) continue;
        controller.abort();
        ambientControllers.current.delete(controller);
      }
      ambientPlayer.current = { npcIds: [], replyToNpcId: 0, bubble: "", bubbleUntil: 0, bubbleShownAt: 0, replyAt: 0, llmRequested: true };
      ambientPlayerEpoch.current += 1;
      ambientPlayerStarts.current = false;
      ambientPlayerCooldown.current = Date.now() + 450;
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
      battle,
      caihua,
      cultivation,
      arcade,
      life,
      eventText,
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
  }, [runAt]);
  const chooseNpc = useCallback(
    (id: number, option: NpcOption) => {
      setEventNpcId(["talk", "status", "join"].includes(option) ? id : null);
      const next = structuredClone(stateRef.current);
      if (option === "talk") {
        const tasks = next.tasks,
          random = seeded(next.position.mapId + id + tasks.clock);
        if (tasks.visitId === id) {
          tasks.visitId = -1;
          sync(next);
          setEventText(`${npcDisplayName(id)}\n拜访已经完成，回村长处复命吧。`);
          setNpcMenu(null);
          return;
        }
        if (id === 25) {
          const result = acceptFreeWork(next.actor, tasks, (max) =>
            Math.floor(Math.random() * Math.max(1, max)),
          );
          sync(next);
          setEventText(`${npcDisplayName(id)}\n${result.text}`);
          setNpcMenu(null);
          return;
        }
        if (id === 14 || id === 15) {
          const result =
            id === 14
              ? startStoneTask(next.actor, tasks)
              : finishStoneTask(next.actor, tasks);
          sync(next);
          setEventText(`${npcDisplayName(id)}\n${result.text}`);
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
          setEventText(`${npcDisplayName(id)}\n${result.text}`);
          setNpcMenu(null);
          return;
        }
        if (id === 6) {
          const altar = startTanQuest(next.actor);
          if (altar.ok) {
            sync(next);
            setEventText(`${npcDisplayName(id)}\n${altar.text}`);
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
          setEventText(`${npcDisplayName(id)}\n${text}`);
          setNpcMenu(null);
          return;
        }
        if (id === 31 && tasks.finishFlag) {
          const result = claimMainReward(next.actor, tasks, random);
          sync(next);
          setEventText(`${npcDisplayName(id)}\n${result.text}`);
          setNpcMenu(null);
          return;
        }
        const specialTalk = resolveSpecialNpcTalk(id, next.actor);
        if (specialTalk.handled) {
          sync(next);
          setEventText(`${npcDisplayName(id)}\n${specialTalk.text}`);
          setNpcMenu(null);
          return;
        }
        const hidden = completeHiddenQuest(next.actor, id);
        if (hidden.ok || hidden.text) {
          sync(next);
          setEventText(`${npcDisplayName(id)}\n${hidden.text}`);
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
        setEventText(`${npcDisplayName(id)}\n${r.lines.join("\n")}`);
      } else if (option === "chat") {
        setNpcChat({
          id,
          speech: "",
          action: "",
          messages: [],
          loading: false,
          auto: false,
          error: "",
        });
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
        setEventText(`${npcDisplayName(id)}\n${r.text}`);
      } else {
        const allowed = canStudyWithNpc(id, next.actor);
        if (allowed.ok) setStudy({ id, index: 0 });
        else setEventText(`${npcDisplayName(id)}\n${allowed.text}`);
      }
      setNpcMenu(null);
    },
    [sync],
  );
  const closeNpcChat = useCallback(() => {
    chatAbort.current?.abort();
    chatAbort.current = null;
    setNpcChat(null);
  }, []);
  const requestNpcReply = useCallback(async (id: number, dialogueHistory: NpcDialogueMessage[]) => {
    const history: ChatMessage[] = dialogueHistory.map((message) => message.role === "user"
      ? {
          role: "user",
          content: [message.action ? `行动：${message.action}` : "", message.speech ? `语言：${message.speech}` : ""].filter(Boolean).join("\n"),
        }
      : {
          role: "assistant",
          content: `状态：${message.state}\n动作：${message.action}\n语言：${message.speech}`,
        });
    const controller = new AbortController();
    chatAbort.current?.abort();
    chatAbort.current = controller;
    setNpcChat((chat) => chat?.id === id ? {
      ...chat, speech: "", action: "",
      messages: [...dialogueHistory, { role: "assistant", state: "", action: "", speech: "", raw: "" }],
      loading: true, error: "",
    } : chat);
    try {
      const current = stateRef.current;
      const answer = await streamNpcReply({
        system: buildNpcSystemPrompt(id, current.actor, current.tasks, getOriginalMap(current.position.mapId).name),
        messages: history,
        signal: controller.signal,
        onToken: (token) => setNpcChat((chat) => {
          if (!chat || chat.id !== id) return chat;
          const messages = [...chat.messages], last = messages.length - 1;
          const currentReply = messages[last];
          if (currentReply.role !== "assistant") return chat;
          const raw = currentReply.raw + token, parsed = parseNpcDialogue(raw);
          messages[last] = { role: "assistant", raw, ...parsed };
          return { ...chat, messages };
        }),
      });
      const parsed = parseNpcDialogue(answer);
      setNpcChat((chat) => {
        if (!chat || chat.id !== id) return chat;
        const messages = [...chat.messages];
        messages[messages.length - 1] = { role: "assistant", raw: answer, ...parsed };
        return { ...chat, messages, loading: false };
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      const detail = error instanceof Error ? error.message : "连接失败";
      const corsHint = detail === "Failed to fetch"
        ? "请在 LM Studio 的 Developer → Server Settings 打开 Enable CORS，然后重启服务。"
        : "请确认 LM Studio 已启动且模型已加载。";
      setNpcChat((chat) => chat?.id === id ? {
        ...chat,
        messages: chat.messages.filter((message) => message.role === "user" || message.raw),
        loading: false, auto: false,
        error: `${detail}。${corsHint}`,
      } : chat);
    } finally {
      if (chatAbort.current === controller) chatAbort.current = null;
    }
  }, []);
  const sendNpcChat = useCallback(async () => {
    if (!npcChat || npcChat.loading) return;
    const speech = npcChat.speech.trim(), action = npcChat.action.trim();
    if (!speech && !action) return;
    await requestNpcReply(npcChat.id, [...npcChat.messages, { role: "user", speech, action }]);
  }, [npcChat, requestNpcReply]);
  const generateAutoPlayerTurn = useCallback(async (chat: NpcChatState) => {
    const id = chat.id,
      controller = new AbortController(),
      history: ChatMessage[] = chat.messages.map((message) => message.role === "user"
        ? { role: "user", content: `行动：${message.action}\n语言：${message.speech}` }
        : { role: "assistant", content: `状态：${message.state}\n动作：${message.action}\n语言：${message.speech}` });
    chatAbort.current?.abort();
    chatAbort.current = controller;
    setNpcChat((current) => current?.id === id ? { ...current, loading: true, error: "" } : current);
    try {
      const current = stateRef.current,
        answer = await streamNpcReply({
          system: buildAutoPlayerPrompt(id, current.actor, getOriginalMap(current.position.mapId).name),
          messages: history.length ? history : [{ role: "assistant", content: `${npcLore(id).name}正打量着你，等你先开口。挑一个具体话题——江湖近况、门派见闻、一个传闻或一桩旧事——自然开启交谈，不要只是寒暄。` }],
          signal: controller.signal,
          nextSpeaker: "主角",
          onToken: () => {},
        }),
        parsed = parseNpcDialogue(answer);
      setNpcChat((active) => active?.id === id ? {
        ...active,
        messages: [...active.messages, { role: "user", action: parsed.action, speech: parsed.speech }],
        loading: false,
      } : active);
    } catch (error) {
      if (controller.signal.aborted) return;
      const detail = error instanceof Error ? error.message : "连接失败";
      setNpcChat((active) => active?.id === id ? { ...active, loading: false, auto: false, error: `${detail}。自动对话已停止。` } : active);
    } finally {
      if (chatAbort.current === controller) chatAbort.current = null;
    }
  }, []);
  useEffect(() => {
    if (!npcChat?.auto || npcChat.loading || npcChat.error) return;
    const last = npcChat.messages[npcChat.messages.length - 1],
      timer = window.setTimeout(() => {
        if (last?.role === "user") void requestNpcReply(npcChat.id, npcChat.messages);
        else void generateAutoPlayerTurn(npcChat);
      }, 650);
    return () => window.clearTimeout(timer);
  }, [generateAutoPlayerTurn, npcChat, requestNpcReply]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [npcChat?.messages]);
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
      })),
      { role: "user", content: buildBattleNarrationFacts(event) } as const,
    ];
    const updateEntry = (change: (item: BattleNarrative) => BattleNarrative) => {
      const next = battleNarrativesRef.current.map((item) =>
        item === entry || (item.turn === entry.turn && item.loading) ? change(item) : item,
      );
      battleNarrativesRef.current = next;
      setBattleNarratives(next);
    };
    try {
      const answer = await streamNpcReply({
        system: buildBattleNarrationPrompt(event),
        messages: history,
        maxOutputTokens: 260,
        signal: controller.signal,
        onToken: (token) => updateEntry((item) => ({ ...item, text: item.text + token })),
      });
      updateEntry((item) => ({ ...item, text: answer, loading: false }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const detail = error instanceof Error ? error.message : "战报生成失败";
      updateEntry((item) => ({
        ...item,
        text: item.text || item.facts.join("\n"),
        loading: false,
        error: detail,
      }));
    } finally {
      if (battleNarrationAbort.current === controller)
        battleNarrationAbort.current = null;
    }
  }, []);
  const fight = useCallback(() => {
    if (!battle || battle.finished || battleNarrativesRef.current.some((item) => item.loading)) return;
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
      if (!battle || !id || battleNarrativesRef.current.some((item) => item.loading)) return;
      const playerHpBefore = stateRef.current.actor.hp,
        enemyHpBefore = battle.enemyHp,
        logLength = battle.log.length,
        next = structuredClone(stateRef.current),
        playerTechnique = battleSpecials(next.actor, battle.cooldowns).find(
          (special) => special.id === id,
        )?.name,
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
      });
    },
    [battle, narrateBattleRound, sync],
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
        if (npcChat) {
          if (cancel) closeNpcChat();
          return;
        }
        if (cheatConfirm) {
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
        if (cheatMenu) {
          const length =
              cheatMenu.tab === 0
                ? cheatQuickOptions.length
                : cheatMenu.tab === 1
                  ? cheatStats.length
                  : cheatMenu.tab === 3
                    ? allCheatSkills.length
                    : 1;
          if (k === "q")
            setCheatMenu({ tab: (cheatMenu.tab + 5) % 6, index: 0 });
          else if (k === "tab")
            setCheatMenu({ tab: (cheatMenu.tab + 1) % 6, index: 0 });
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
          else if (["arrowleft", "a"].includes(k) && cheatMenu.tab === 3)
            changeCheatSkill(cheatMenu.index, -1);
          else if (["arrowright", "d"].includes(k) && cheatMenu.tab === 3)
            changeCheatSkill(cheatMenu.index, 1);
          else if (confirm && cheatMenu.tab === 0)
            applyCheatAction(cheatQuickOptions[cheatMenu.index].id);
          else if (confirm && cheatMenu.tab === 1)
            changeCheatStat(cheatMenu.index, 1);
          else if (confirm && cheatMenu.tab === 3)
            changeCheatSkill(cheatMenu.index, 1);
          else if (k === "m" && cheatMenu.tab === 1)
            maximizeCheatStat(cheatMenu.index);
          else if (k === "m" && cheatMenu.tab === 3)
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
          if (battleNarrativesRef.current.some((item) => item.loading)) return;
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
          const entries = organizedBagEntries(stateRef.current.actor),
            skills = organizedSkills(stateRef.current.actor),
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
          else if (confirm && menu.tab === 0) {
            if (entries[menu.index])
              setItemConfirm({ entry: entries[menu.index], index: 0 });
          }
          else if (confirm && menu.tab === 2)
            activateSkill(skills[menu.index]?.id);
          else if ((k === "c" || k === "r") && menu.tab === 2)
            activateSkill(skills[menu.index]?.id, true);
          else if (cancel || k === "m") setMenu(null);
          return;
        }
        if (eventText && (confirm || cancel)) {
          setEventText("");
          setEventNpcId(null);
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
    npcChat,
    closeNpcChat,
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
    applyCheatAction,
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
  const ambientPopulationKey = `${state.position.mapId}:${(state.actor.killList || []).join(",")}`,
    ambientShouldPause = screen !== "play" || Boolean(eventText || npcMenu || npcChat || shop || study || battle || menu || cheatMenu || cultivation !== null || arcade || life);
  useEffect(() => {
    ambientPaused.current = ambientShouldPause;
    if (ambientShouldPause && !ambientWasPaused.current) {
      resetAmbientSessions(ambientWorld.current, Date.now() + 700);
      ambientEpoch.current += 1;
      ambientControllers.current.forEach((_job, controller) => controller.abort());
      ambientControllers.current.clear();
      ambientPlayer.current = { npcIds: [], replyToNpcId: 0, bubble: "", bubbleUntil: 0, bubbleShownAt: 0, replyAt: 0, llmRequested: true };
      ambientPlayerEpoch.current += 1;
      ambientPlayerStarts.current = false;
      lastPlayerMove.current = Date.now();
    }
    ambientWasPaused.current = ambientShouldPause;
  }, [ambientShouldPause]);
  useEffect(() => {
    const map = getOriginalMap(state.position.mapId),
      entries = map.events.flatMap((event) => {
        const visual = eventVisual(event, stateRef.current);
        if (visual.kind !== "npc") return [];
        const lore = npcLore(visual.npcId || 0);
        return [{ eventId: event.id, npcId: visual.npcId || 0, name: visual.label, identity: lore.identity, x: event.x, y: event.y }];
      });
    ambientWorld.current = createAmbientWorld(map.id, Date.now(), entries);
    ambientEpoch.current += 1;
    ambientControllers.current.forEach((_job, controller) => controller.abort());
    ambientControllers.current.clear();
    ambientPlayer.current = { npcIds: [], replyToNpcId: 0, bubble: "", bubbleUntil: 0, bubbleShownAt: 0, replyAt: 0, llmRequested: true };
    ambientPlayerEpoch.current += 1;
    ambientPlayerStarts.current = false;
    lastPlayerMove.current = Date.now();
  }, [ambientPopulationKey, state.position.mapId]);
  useEffect(() => {
    if (screen !== "play") return;
    const id = window.setInterval(() => {
      if (ambientPaused.current) return;
      const current = stateRef.current,
        map = getOriginalMap(current.position.mapId),
        world = ambientWorld.current;
      if (world.mapId !== map.id) return;
      const viewport = ambientViewportBounds(map.width, map.height, current.position.x, current.position.y);
      tickAmbientWorld({
        world,
        now: Date.now(),
        playerX: current.position.x,
        playerY: current.position.y,
        indoor: mapTheme(map) === "indoor",
        viewport,
        pausedConversationNpcIds: ambientPlayer.current.npcIds,
        canEnter: (moving, x, y) => {
          const direction = x < moving.x ? 4 : x > moving.x ? 6 : y < moving.y ? 8 : 2;
          if (!passable(map, x, y, direction)) return false;
          return !world.npcs.some((npc) => npc.eventId !== moving.eventId && npc.x === x && npc.y === y);
        },
      });
      const now = Date.now(), playerAmbient = ambientPlayer.current;
      if (playerAmbient.bubble && playerAmbient.bubbleUntil <= now) {
        ambientPlayer.current = { npcIds: [], replyToNpcId: 0, bubble: "", bubbleUntil: 0, bubbleShownAt: 0, replyAt: 0, llmRequested: true };
        ambientPlayerEpoch.current += 1;
        ambientPlayerStarts.current = false;
        ambientPlayerCooldown.current = now + 10000;
      }
      if (now - lastPlayerMove.current >= 450 && now >= ambientPlayerCooldown.current && !ambientPlayer.current.npcIds.length) {
        const nearby = world.npcs.filter((npc) => ambientCanHear(npc, current.position)).sort((a, b) => a.eventId - b.eventId);
        if (nearby.length) {
          const ids = nearby.map((npc) => npc.eventId), groupId = nearby.length > 1 ? ids[0] : 0,
            candidate = nearby[0], playerStarts = (map.id + current.position.x + current.position.y + ids.reduce((sum, id) => sum + id, 0)) % 2 === 0;
          const priorLinks = new Set(nearby.flatMap((npc) => [...npc.groupMembers, npc.partnerId].filter(Boolean)));
          for (const linked of world.npcs.filter((npc) => priorLinks.has(npc.eventId) && !ids.includes(npc.eventId))) {
            linked.partnerId = 0; linked.groupId = 0; linked.groupMembers = []; linked.groupTurn = -1; linked.groupNextAt = 0;
            linked.bubble = ""; linked.queuedBubble = ""; linked.generationPending = false; linked.speechTargetName = "";
            linked.conversationContext = []; linked.nextBehaviorAt = now + 700;
          }
          for (const npc of nearby) {
            npc.partnerId = 0; npc.conversationTurn = 0; npc.conversationRound = 0;
            npc.groupId = groupId; npc.groupMembers = groupId ? ids : []; npc.groupTurn = groupId ? -1 : 0; npc.groupNextAt = 0;
            npc.bubble = ""; npc.queuedBubble = ""; npc.generationPending = false; npc.conversationContext = [];
            npc.nextBehaviorAt = now + 30000;
          }
          if (!playerStarts) {
            candidate.speechTargetName = current.actor.name || "少侠";
            candidate.bubbleKind = "speech"; candidate.bubbleUntil = now + 12000;
            candidate.llmRequested = false; candidate.generationPending = true; candidate.queuedAt = now;
            if (groupId) candidate.groupTurn = 0;
          }
          ambientPlayerStarts.current = playerStarts;
          ambientPlayerEpoch.current += 1;
          ambientPlayer.current = { npcIds: ids, replyToNpcId: candidate.eventId, bubble: "", bubbleUntil: 0, bubbleShownAt: 0, replyAt: now + (playerStarts ? 0 : 1200), llmRequested: false };
        }
      }
    }, 650);
    return () => window.clearInterval(id);
  }, [screen, state.position.mapId]);
  const enrichAmbientPlayer = useCallback(async () => {
    const player = ambientPlayer.current;
    if (player.llmRequested || !player.npcIds.length || Date.now() < player.replyAt || ambientLlmActive.current >= 3) return;
    player.llmRequested = true;
    ambientLlmActive.current += 1;
    const epoch = ambientEpoch.current, playerEpoch = ambientPlayerEpoch.current;
    const controller = new AbortController();
    ambientControllers.current.set(controller, { player: true });
    const current = stateRef.current,
      participants = player.npcIds.map((eventId) => ambientWorld.current.npcs.find((npc) => npc.eventId === eventId)).filter((npc): npc is AmbientNpc => Boolean(npc)),
      // 玩家不必回复上一位发言者：在已开口的人群里随机挑一个人直接搭话
      readyTargets = participants.filter((npc) => !npc.generationPending && npc.bubble),
      targetPool = readyTargets.length ? readyTargets : participants,
      target = targetPool[Math.floor(Math.random() * targetPool.length)] || participants[0];
    if (target) player.replyToNpcId = target.eventId;
    if (!target) {
      if (ambientPlayerEpoch.current === playerEpoch) {
        ambientPlayer.current = { npcIds: [], replyToNpcId: 0, bubble: "", bubbleUntil: 0, bubbleShownAt: 0, replyAt: 0, llmRequested: true };
        ambientPlayerStarts.current = false;
        ambientPlayerEpoch.current += 1;
      }
      ambientControllers.current.delete(controller); ambientLlmActive.current -= 1; return;
    }
    const playerOpening = ambientPlayerStarts.current;
    if (!playerOpening && (target.generationPending || !target.bubble)) {
      player.llmRequested = false;
      ambientControllers.current.delete(controller);
      ambientLlmActive.current -= 1;
      if (!target.generationPending) {
        ambientPlayer.current = { npcIds: [], replyToNpcId: 0, bubble: "", bubbleUntil: 0, bubbleShownAt: 0, replyAt: 0, llmRequested: true };
        ambientPlayerStarts.current = false;
        ambientPlayerEpoch.current += 1;
      }
      return;
    }
    try {
      const answer = await streamNpcReply({
        system: `${buildAutoPlayerPrompt(target.npcId, current.actor, getOriginalMap(current.position.mapId).name)}\n你是被附近NPC主动搭话，或刚刚驻足加入了他们的谈话。请依据主角设定和本轮前文自然接话，不要生硬自我介绍，不要另起无关话题。${participants.length > 1 ? `在场NPC有${participants.map((npc) => npc.name).join("、")}，你这句话是对${target.name}说的。` : ""}\n本次是地图头顶即时会话，覆盖上面的三字段格式：只输出主角实际说出口的一句台词。系统会在正文之外标识说话关系；正文绝对不得输出或讨论 to、谁对谁、发言者、接收者、对话对象、气泡、格式、路由或标记，不得再次出现任何参与者姓名，不得写“某某说/问/答”或“对某某说”。禁止输出状态、动作、神态、表情、姿态、旁白、姓名、字段标题、括号说明或舞台提示。`,
        messages: [{ role: "assistant", content: [...new Set(participants.flatMap((npc) => npc.conversationContext)), ...participants.map((npc) => npc.bubble).filter(Boolean)].slice(-6).join("\n") || (playerOpening ? "你刚刚走近了附近人物，决定自然地开口。" : "附近人物正在看着你。") }],
        nextSpeaker: "主角", maxOutputTokens: 120, signal: controller.signal, onToken: () => {},
      });
      if (ambientEpoch.current !== epoch || ambientPlayerEpoch.current !== playerEpoch || ambientPaused.current || !ambientPlayer.current.npcIds.length) return;
      const playerLine = cleanAmbientSpeech(answer, [current.actor.name, ...participants.map((npc) => npc.name)]);
      if (playerLine === "……") throw new Error("LM Studio returned no usable ambient player line");
      // 群聊时玩家气泡也标「群聊 · 」
      const groupMark = participants.length > 1 ? "群聊 · " : "";
      ambientPlayer.current.bubble = `${groupMark}${current.actor.name || "少侠"} to ${target.name}：“${playerLine}”`;
      ambientPlayer.current.bubbleShownAt = Date.now();
      ambientPlayer.current.bubbleUntil = Date.now() + Math.max(4200, ambientPlayer.current.bubble.length * 180);
      ambientPlayerStarts.current = false;
      participants.forEach((npc) => {
        npc.conversationContext = [...npc.conversationContext, ambientPlayer.current.bubble].slice(-6);
        if (npc.bubbleUntil <= Date.now()) npc.bubble = "";
      });
      // 无论是否开场，都把目标设为回应(可能回应玩家，也可能随机回应群里另一个人)，
      // 并让群聊其余成员随后轮流回应，保证每个群成员都参与，而不是只和玩家或一个人聊。
      const playerName = current.actor.name || "少侠";
      const peer = participants.filter((n) => n.eventId !== target.eventId);
      target.speechTargetName = peer.length && Math.random() < 0.5
        ? peer[Math.floor(Math.random() * peer.length)].name
        : playerName;
      target.bubbleKind = "speech"; target.bubbleUntil = ambientPlayer.current.bubbleUntil + 12000;
      target.llmRequested = false; target.generationPending = true; target.queuedAt = Date.now();
      if (target.groupId) target.groupTurn = 0;
      ambientPlayer.current.responderQueue =
        participants.length > 1
          ? participants
              .filter((n) => n.eventId !== target.eventId)
              .map((n) => n.eventId)
              .sort((a, b) => a - b)
          : [];
    } catch {
      if (ambientEpoch.current === epoch && ambientPlayerEpoch.current === playerEpoch && !ambientPaused.current) {
        ambientPlayer.current = { npcIds: [], replyToNpcId: 0, bubble: "", bubbleUntil: 0, bubbleShownAt: 0, replyAt: 0, llmRequested: true };
        ambientPlayerStarts.current = false;
        ambientPlayerEpoch.current += 1;
      }
    } finally {
      ambientControllers.current.delete(controller);
      ambientLlmActive.current = Math.max(0, ambientLlmActive.current - 1);
    }
  }, []);
  const enrichAmbientNpc = useCallback(async (npc: AmbientNpc) => {
    if (ambientLlmActive.current >= 3) return;
    ambientLlmActive.current += 1;
    const epoch = ambientEpoch.current;
    const controller = new AbortController();
    ambientControllers.current.set(controller, { player: false, npcEventId: npc.eventId });
    npc.llmRequested = true;
    npc.bubbleUntil = Date.now() + 30000;
    const current = stateRef.current,
      map = getOriginalMap(current.position.mapId),
      lore = npcLore(npc.npcId),
      partner = npc.partnerId && !npc.groupId ? ambientWorld.current.npcs.find((item) => item.eventId === npc.partnerId) : undefined,
      partnerLore = partner ? npcLore(partner.npcId) : undefined,
      groupNames = npc.groupId ? npc.groupMembers.map((id) => ambientWorld.current.npcs.find((item) => item.eventId === id)?.name).filter(Boolean).join("、") : "",
      groupNpcs = npc.groupId ? npc.groupMembers.map((id) => ambientWorld.current.npcs.find((item) => item.eventId === id)).filter((item): item is AmbientNpc => Boolean(item)) : [],
      groupLeader = npc.groupId ? ambientWorld.current.npcs.find((item) => item.eventId === npc.groupId) : undefined,
      sessionContext = (groupLeader?.conversationContext || npc.conversationContext).slice(-8),
      // 开场没有前文时，让 NPC 自己现场发散、自然地提起一件具体的事当话题；
      // 之后各轮则承接已聊到的事，把讨论往深里带。
      isOpening = sessionContext.length === 0,
      openingRule = `此刻你在${map.name}，按照你的身份和眼下所见，自然地提起一件具体的、正困扰或正关心的、或刚好撞见的闲事来开场——可以是一个疑虑、一个不满、一个见闻或一个盘算——不要只是寒暄问候。`,
      depthRule =
        "台词必须有具体内容：一个疑问、见闻、立场、经历或反驳，真正推进讨论；" +
        "严禁“是啊”“不错”“确实”“原来如此”“言之有理”这类空泛附和，严禁重复前文或复述对方原话。",
      mode = npc.groupId
        ? `你正参与一场临时讨论，成员有${groupNames}。当前轮只允许${npc.name}发言，${isOpening ? openingRule : `你的话是对${npc.speechTargetName}说的，承接刚才聊到的事并把讨论往前推：提出新事实、立场、经历或反驳。`}${depthRule}系统会在正文外标识关系；正文绝对不得输出或讨论 to、谁对谁、发言者、接收者、对话对象、气泡、格式、路由或标记，不得再次出现任何成员姓名。只输出嘴里实际说出的台词，严禁描写天气、风景、地点、环境、声音、衣物、身体、神态或动作，禁止旁白、括号说明或舞台提示。`
        : partner
        ? `让${lore.name}与${partnerLore?.name || partner.name}展开一场有来有回的交谈。发言顺序严格固定：先由${lore.name}说甲句(${isOpening ? openingRule : "承接前面已经聊起的那件事，给出具体的疑问、见闻或立场"})，再由${partnerLore?.name || partner.name}针对甲句说乙句(承接并推进：补充细节、提出异议或说出自己的经历)。${depthRule}系统会在正文外标识关系；正文绝对不得输出或讨论 to、谁对谁、发言者、接收者、对话对象、气泡、格式、路由或标记，也不得出现双方姓名。只写两人嘴里实际说出的台词，严禁描写天气、风景、地点、环境、声音、衣物、身体、动作或神态，禁止旁白、括号说明或舞台提示。严格只输出两行：\n甲：第一人的一句台词\n乙：第二人针对甲内容的一句台词`
        : npc.speechTargetName
          ? `让${lore.name}${isOpening ? openingRule : `承接前面聊到的那件事，对${npc.speechTargetName}说一句具体的话：提问、表态、分享见闻或反驳。`}${depthRule}只输出嘴里实际说出的台词正文。严禁描写天气、风景、地点、环境、声音、衣物、身体、动作或神态，不输出姓名、关系标记、旁白或格式说明。`
        : npc.bubbleKind === "action"
          ? `由你随机构思${lore.name}此刻做出的一个简短、具体且符合身份与地点的日常动作。必须由模型现场生成，只输出动作本身，不加姓名、引号、解释、台词或默认占位内容。`
          : `写${lore.name}此刻${isOpening ? "在心里琢磨的一件具体的事——一个疑虑、一个盘算、一个发现或一段牵挂，把它说出来" : "接着心里正琢磨的那件事往下想"}的一句简短自言自语，要有具体的内心活动、判断或感慨，不要泛泛。只输出嘴里实际说出的台词，严禁描写天气、风景、地点、环境、声音、衣物、身体、动作或神态，不加姓名、旁白或解释。`;
    try {
      const namedTarget = npc.speechTargetName
        ? ambientWorld.current.npcs.find((item) => item.name === npc.speechTargetName)
        : undefined;
      if (partner && !ambientCanHear(npc, partner)) throw new Error("ambient speakers moved out of hearing range");
      if (namedTarget && !ambientCanHear(npc, namedTarget)) throw new Error("ambient target moved out of hearing range");
      if (npc.speechTargetName === (current.actor.name || "少侠") && !ambientCanHear(npc, current.position))
        throw new Error("player moved out of hearing range");
      const participantFacts = [
        npcConversationFacts(npc.npcId),
        ...groupNpcs.filter((item) => item.eventId !== npc.eventId).map((item) => npcConversationFacts(item.npcId)),
        ...(partner ? [npcConversationFacts(partner.npcId)] : []),
        ...(npc.speechTargetName === (current.actor.name || "少侠") ? [ambientPlayerFacts(current.actor)] : []),
      ].filter((fact, index, facts) => facts.indexOf(fact) === index).join("\n");
      const answer = await streamNpcReply({
        system: `地点是${map.name}。
【参与者不可改写事实】
${participantFacts}
${lore.name}的性情是${lore.personality}，说话方式是${lore.speech}。${partnerLore ? `${partnerLore.name}的性情是${partnerLore.personality}。` : ""}
硬约束：姓名、年龄、性别、门派、外貌和武境必须服从上述事实；称谓与代词必须符合明确性别，绝不能凭姓名、服装、门派、外貌或声音猜测性别；性别未知时只用中性称呼。资料用于理解人物，不要在台词中机械报属性或复述档案。
${mode}输出必须符合古代武侠世界，不推动正式任务，不改变物品或战斗状态。`,
        messages: [{ role: "user", content: `${sessionContext.length ? `本轮仅供理解上下文的已说台词：\n${sessionContext.join("\n")}\n` : ""}${npc.bubbleKind === "action" ? "只生成一个动作。" : "只生成要求的口头台词，不补充任何背景描写。"}` }],
        signal: controller.signal,
        nextSpeaker: npc.bubbleKind === "action" ? "动作" : npc.name,
        // A pair request produces two connected lines; solo and group turns only need one.
        // Keeping the shared context short and budgets asymmetric prevents busy maps from
        // monopolising a small local LM Studio model.
        maxOutputTokens: partner ? 150 : 96,
        onToken: () => {},
      });
      if (ambientEpoch.current !== epoch || ambientPaused.current || ambientWorld.current.mapId !== map.id || !npc.generationPending) return;
      if (partner) {
        const lines = answer.split("\n").map((line) => cleanAmbientSpeech(line, [npc.name, partner.name])).filter((line) => line !== "……");
        if (lines.length < 2) throw new Error("LM Studio returned an incomplete paired exchange");
        npc.bubble = `${npc.name} to ${partner.name}：“${lines[0]}”`;
        npc.bubbleShownAt = Date.now();
        npc.generationPending = false;
        npc.bubbleUntil = Date.now() + Math.max(3400, npc.bubble.length * 180);
        partner.queuedBubble = `${partner.name} to ${npc.name}：“${lines[1]}”`;
        const nextContext = [...npc.conversationContext, npc.bubble, partner.queuedBubble].filter(Boolean).slice(-8);
        npc.conversationContext = partner.conversationContext = nextContext;
      } else {
        const address = npc.speechTargetName ? `${npc.name} to ${npc.speechTargetName}：` : "";
        const participantNames = npc.groupId
          ? [...npc.groupMembers.map((id) => ambientWorld.current.npcs.find((item) => item.eventId === id)?.name || ""), npc.speechTargetName]
          : [npc.name];
        const generatedLine = npc.bubbleKind === "action" ? cleanAmbientAction(answer, participantNames) : cleanAmbientSpeech(answer, participantNames);
        if (generatedLine === "……") throw new Error("LM Studio returned no usable ambient line");
        // 动作标注「正在和环境交互」，无目标的自言自语标注「自言自语」，
        // 定向对话(有 to 路由)保持原有格式；群聊成员的台词前缀「群聊 · 」。
        const groupMark = npc.groupId ? "群聊 · " : "";
        npc.bubble =
          npc.bubbleKind === "action"
            ? `${npc.name}正在和环境交互：${generatedLine}`
            : address
              ? `${groupMark}${address}“${generatedLine}”`
              : `${groupMark}${npc.name}自言自语：“${generatedLine}”`;
        npc.bubbleShownAt = Date.now();
        npc.generationPending = false;
        npc.bubbleUntil = Date.now() + Math.max(4200, npc.bubble.length * 180);
        if (ambientPlayer.current.replyToNpcId === npc.eventId) {
          // 群聊：让队列里下一个成员接着回应(可能回应玩家，也可能随机回应群里另一个人)；
          // 都回完后玩家才能再次开口
          const queue = ambientPlayer.current.responderQueue || [];
          const nextId = queue.shift();
          if (nextId) {
            const next = ambientWorld.current.npcs.find((item) => item.eventId === nextId);
            if (next && ambientCanHear(next, stateRef.current.position)) {
              const playerName = stateRef.current.actor.name || "少侠";
              const peers = ambientPlayer.current.npcIds
                .map((id) => ambientWorld.current.npcs.find((item) => item.eventId === id))
                .filter((item): item is AmbientNpc => Boolean(item) && item.eventId !== next.eventId);
              next.speechTargetName =
                peers.length && Math.random() < 0.5
                  ? peers[Math.floor(Math.random() * peers.length)].name
                  : playerName;
              next.bubbleKind = "speech"; next.bubbleUntil = Date.now() + 12000;
              next.llmRequested = false; next.generationPending = true; next.queuedAt = Date.now();
              if (next.groupId) next.groupTurn = 0;
              ambientPlayer.current.replyToNpcId = next.eventId;
            } else {
              ambientPlayer.current.replyAt = Math.max(Date.now(), npc.bubbleUntil - 200);
            }
          } else {
            ambientPlayer.current.replyAt = Math.max(Date.now(), npc.bubbleUntil - 200);
          }
        }
        if (npc.groupId) {
          const leader = ambientWorld.current.npcs.find((item) => item.eventId === npc.groupId);
          if (leader) {
            leader.groupNextAt = npc.bubbleUntil;
            leader.conversationContext = [...leader.conversationContext, npc.bubble].slice(-8);
          }
        }
      }
    } catch {
      npc.bubble = ""; npc.queuedBubble = ""; npc.generationPending = false;
      npc.bubbleUntil = Date.now(); npc.nextBehaviorAt = Date.now() + 1800;
      if (npc.groupId) {
        for (const member of ambientWorld.current.npcs.filter((item) => npc.groupMembers.includes(item.eventId))) {
          member.bubble = ""; member.queuedBubble = ""; member.generationPending = false;
          member.groupId = 0; member.groupMembers = []; member.groupTurn = -1; member.groupNextAt = 0;
          member.conversationContext = []; member.speechTargetName = ""; member.nextBehaviorAt = Date.now() + 1800;
        }
      }
      if (partner) {
        npc.partnerId = 0; npc.conversationTurn = 0; npc.conversationRound = 0; npc.conversationContext = [];
        partner.bubble = ""; partner.queuedBubble = ""; partner.generationPending = false;
        partner.partnerId = 0; partner.conversationTurn = 0; partner.conversationRound = 0; partner.conversationContext = [];
        partner.bubbleUntil = Date.now(); partner.nextBehaviorAt = Date.now() + 1800;
      }
    } finally {
      ambientControllers.current.delete(controller);
      ambientLlmActive.current = Math.max(0, ambientLlmActive.current - 1);
    }
  }, []);
  useEffect(() => {
    if (screen !== "play") return;
    const id = window.setInterval(() => {
      if (ambientPaused.current) return;
      // This is the sole dispatcher for ambient LLM work. Player work claims capacity
      // first; NPC-only dialogue, monologue and action jobs follow in that order.
      void enrichAmbientPlayer();
      const capacity = Math.max(0, 3 - ambientLlmActive.current),
        position = stateRef.current.position,
        actorName = stateRef.current.actor.name || "少侠",
        playerNpcIds = new Set(ambientPlayer.current.npcIds),
        map = getOriginalMap(position.mapId),
        viewport = ambientViewportBounds(map.width, map.height, position.x, position.y),
        inRange = ambientWorld.current.npcs.filter((item) => ambientNpcInViewport(item, viewport)),
        isPlayerWork = (item: AmbientNpc) => item.speechTargetName === actorName || playerNpcIds.has(item.eventId),
        conversationIsClose = (item: AmbientNpc) => {
          if (item.speechTargetName === actorName) return ambientCanHear(item, position);
          const target = item.partnerId
            ? ambientWorld.current.npcs.find((other) => other.eventId === item.partnerId)
            : item.speechTargetName
              ? ambientWorld.current.npcs.find((other) => other.name === item.speechTargetName)
              : undefined;
          if (item.speechTargetName && !target) return false;
          return !target || ambientCanHear(item, target);
        },
        activeNpcOnlySessions = inRange.filter((item) => !isPlayerWork(item) && (Boolean(item.bubble) || (item.generationPending && item.llmRequested))).length,
        pending = inRange
          .filter((item) => item.generationPending && !item.llmRequested && conversationIsClose(item))
          .sort((first, second) => {
            const priority = (item: AmbientNpc) => isPlayerWork(item) ? 0 : item.partnerId || item.groupId ? 1 : item.bubbleKind === "speech" ? 2 : 3;
            return priority(first) - priority(second) || first.queuedAt - second.queuedAt || first.eventId - second.eventId;
          });
      let npcOnlySlots = Math.max(0, 2 - activeNpcOnlySessions), dispatched = 0;
      for (const npc of pending) {
        if (dispatched >= capacity) break;
        if (!isPlayerWork(npc) && npcOnlySlots <= 0) continue;
        if (!isPlayerWork(npc)) npcOnlySlots -= 1;
        dispatched += 1;
        void enrichAmbientNpc(npc);
      }
    }, 320);
    return () => window.clearInterval(id);
  }, [enrichAmbientNpc, enrichAmbientPlayer, screen, state.position.mapId]);
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
    const frame = () => {
      const ctx = target.getContext("2d");
      if (ctx) draw(ctx, stateRef.current, ambientWorld.current, ambientPlayer.current);
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [screen]);
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
          <p>移动：WASD / 方向键 · 互动与确认：E / Enter</p>
          <p>行囊与人物：M / Tab · 修炼：R · 轻功：H</p>
          <p>任务簿：T · 保存：点击右上角按钮 · 战斗绝招：Q · 战斗物品：I</p>
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
          <button
            className={`world-dialog${eventNpcId ? " with-portrait" : ""}`}
            onClick={() => {
              setEventText("");
              setEventNpcId(null);
            }}
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
        {npcChat && (
          <section className="npc-chat" aria-label={`与${npcLore(npcChat.id).name}自由对话`}>
            <header>
              <div>
                <b>{npcLore(npcChat.id).name}</b>
                <small>{npcLore(npcChat.id).identity} · 当前相遇</small>
              </div>
              <div className="npc-chat-controls">
                <button type="button" className={npcChat.auto ? "active" : ""}
                  disabled={npcChat.auto || npcChat.loading}
                  onClick={() => setNpcChat({ ...npcChat, auto: true, error: "" })}>
                  {npcChat.auto ? "自动对话中" : "自动对话"}
                </button>
                <button type="button" onClick={closeNpcChat}>结束对话</button>
              </div>
            </header>
            <div className="npc-chat-body">
              <aside>
                <CharacterPortrait
                  npcId={npcChat.id}
                  name={npcLore(npcChat.id).name}
                  className="chat-portrait"
                />
                <b>{npcLore(npcChat.id).name}</b>
                <small>{npcLore(npcChat.id).identity}</small>
              </aside>
              <div className="npc-chat-stage">
                <div className="npc-chat-log" aria-live="polite">
                {npcChat.messages.length === 0 && (
                  <p className="npc-chat-hint">{npcLore(npcChat.id).name}就在你面前。你可以开口，也可以先做一个动作。</p>
                )}
                {npcChat.messages.map((message, index) => message.role === "user" ? (
                  <article className="dialogue-bubble user" key={`user-${index}`}>
                    <small>{state.actor.name}</small>
                    {message.action && <i>行动 · {message.action}</i>}
                    {message.speech && <p>{message.speech}</p>}
                  </article>
                ) : (
                  <article className="dialogue-bubble assistant" key={`assistant-${index}`}>
                    <small>{npcLore(npcChat.id).name}</small>
                    {message.state && <em>状态 · {message.state}</em>}
                    {message.action && <i>动作 · {message.action}</i>}
                    {message.speech && <p>{message.speech}</p>}
                    {!message.raw && npcChat.loading && <p className="thinking">正在观察你的反应……</p>}
                  </article>
                ))}
                <div ref={chatEnd} />
                </div>
                {npcChat.error && <p className="npc-chat-error">{npcChat.error}</p>}
                <form onSubmit={(event) => { event.preventDefault(); void sendNpcChat(); }}>
                  <label>
                    <span>行动</span>
                    <textarea maxLength={180} rows={2} placeholder="例如：抱拳行礼、递上一壶酒、拔剑后退……"
                      value={npcChat.action} disabled={npcChat.loading || npcChat.auto}
                      onChange={(event) => setNpcChat({ ...npcChat, action: event.target.value, error: "" })} />
                  </label>
                  <label>
                    <span>语言</span>
                    <textarea maxLength={300} rows={2} placeholder="输入你想对他说的话……"
                      value={npcChat.speech} disabled={npcChat.loading || npcChat.auto}
                      onChange={(event) => setNpcChat({ ...npcChat, speech: event.target.value, error: "" })} />
                  </label>
                  <button type="submit" disabled={npcChat.auto || npcChat.loading || (!npcChat.action.trim() && !npcChat.speech.trim())}>
                    {npcChat.auto ? "自动推进中" : npcChat.loading ? "对方回应中" : "行动并交谈"}
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}
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
            tasks={state.tasks}
            menu={cheatMenu}
            setMenu={setCheatMenu}
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
  narratives,
  actor,
  hp,
  maxHp,
  fight,
  leave,
  openSpecial,
  openItem,
  flee,
}: {
  battle: OriginalBattle;
  narratives: BattleNarrative[];
  actor: SceneActorState;
  hp: number;
  maxHp: number;
  fight: () => void;
  leave: () => void;
  openSpecial: () => void;
  openItem: () => void;
  flee: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const latestNarrative = narratives.at(-1);
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTo({
      top: log.scrollHeight,
      behavior: latestNarrative?.loading ? "auto" : "smooth",
    });
  }, [battle.log.length, latestNarrative?.loading, latestNarrative?.text.length]);
  const generating = Boolean(latestNarrative?.loading);

  return (
    <div className="battle">
      <div className="battle-stage">
        <div className="fighter hero">
          <CharacterPortrait
            playerGender={actor.gender}
            name={actor.name || "少侠"}
            className="battle-portrait"
          />
          <span>{actor.name || "少侠"}</span>
        </div>
        <b>
          {battle.mode === "spar" ? "切磋" : "生死战"} · 第 {battle.turn + 1}{" "}
          回合
        </b>
        <div className="fighter enemy">
          <CharacterPortrait
            npcId={battle.enemyId}
            name={battle.enemyName}
            className="battle-portrait"
          />
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
      <div
        className="battle-log"
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <header><span>战况实录</span><i>LIVE</i></header>
        {!narratives.length && <p className="battle-opening"><span>{battle.log[0]}</span></p>}
        {narratives.map((item, index) => (
          <article className={index === narratives.length - 1 ? "latest" : ""} key={`${item.turn}-${index}`}>
            <header><time>第 {item.turn} 回合</time><small>{item.facts.join(" · ")}</small></header>
            <div>{item.text || "风声骤紧，正在演绎这一回合……"}</div>
            {item.error && <em>小说战报生成中断，已保留真实结算：{item.error}</em>}
          </article>
        ))}
        <div className="battle-log-anchor" aria-hidden="true" />
      </div>
      <nav>
        <button onClick={battle.finished ? leave : fight} disabled={generating}>
          {generating ? "战报演绎中…" : battle.finished ? "处理战果" : "普通攻击"} <kbd>E</kbd>
        </button>
        <button onClick={openSpecial} disabled={Boolean(battle.finished) || generating}>
          绝招 <kbd>Q</kbd>
        </button>
        <button onClick={openItem} disabled={Boolean(battle.finished) || generating}>
          物品 <kbd>I</kbd>
        </button>
        <button
          onClick={battle.mode === "spar" ? leave : flee}
          disabled={Boolean(battle.finished) || generating}
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
    entries = organizedBagEntries(actor),
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
              <div className="inventory-fragment" key={entry.key}>
                {(i === 0 || entries[i - 1].category !== entry.category) && (
                  <header className="equipment-category">
                    <span>{entry.category}</span>
                    <small>
                      {entries.filter((item) => item.category === entry.category).length} 件
                    </small>
                  </header>
                )}
              <button
                className={menu.index === i ? "active" : ""}
                onMouseEnter={() => setMenu({ tab: 0, index: i })}
                onClick={() => activate(entry)}
              >
                <i className={`item-pixel kind-${entry.kind}`} />
                <span>
                  <small className="item-slot">{entry.slot}</small>
                  <b>
                    {entry.name}
                    {entry.equipped ? "〔装备中〕" : ""}
                  </b>
                  <small>{entry.description}</small>
                  <em className="item-bonuses">{entry.bonuses}</em>
                </span>
                <em>×{entry.amount}</em>
              </button>
              </div>
            ))
          ) : (
            <p>行囊空空如也。</p>
          )}
        </section>
      ) : menu.tab === 1 ? (
        <section className="actor-status-panel">
          <header>
            <CharacterPortrait
              playerGender={actor.gender}
              name={actor.name || "江湖少侠"}
              className="status-portrait"
            />
            <div className="status-identity">
              <b>{profile.school} · {actor.name || "江湖少侠"}</b>
              <small>{actor.age} 岁 · {profile.gender} · 师承 {profile.teacher}</small>
              <strong>武艺看起来「{profile.realm}」，出手似乎「{profile.attackWeight}」</strong>
              <em>{profile.appearance}</em>
            </div>
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
              已学功夫 <b>{Object.keys(actor.skills).length}</b>
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
  tasks,
  menu,
  setMenu,
  quickAction,
  changeStat,
  changeSkill,
  maxStat,
  maxSkill,
  mutate,
}: {
  actor: SceneActorState;
  tasks: TaskState;
  menu: { tab: number; index: number };
  setMenu: (value: { tab: number; index: number } | null) => void;
  quickAction: (action: CheatQuickAction) => void;
  changeStat: (index: number, direction: -1 | 1) => void;
  changeSkill: (index: number, direction: -1 | 1) => void;
  maxStat: (index: number) => void;
  maxSkill: (index: number) => void;
  mutate: (mutation: (draft: WorldSave) => string) => void;
}) {
  const tabs = ["快捷", "人物数值", "物品装备", "全部武功", "身份师承", "世界进度"],
    [inventoryKind, setInventoryKind] = useState<CheatInventoryKind>(1),
    [inventoryId, setInventoryId] = useState(1),
    [inventoryAmount, setInventoryAmount] = useState(1),
    catalog = cheatInventoryCatalog(inventoryKind),
    killed = (actor.killList || []).filter((id) => originalTables.enemies[id]);
  const commitNumber = (index: number, value: string) =>
    mutate((draft) => setCheatStat(draft.actor, index, Number(value)));
  return (
    <div className="cheat-menu">
      <header>
        <div>
          <small>江湖秘卷 · 修改立即生效</small>
          <h2>秘技</h2>
        </div>
        <button onClick={() => setMenu(null)}>关闭 ×</button>
      </header>
      <aside>完整存档修改器 · 所有输入均按显示范围约束。修改前建议下载 JSON 备份。</aside>
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
              onClick={() => quickAction(option.id)}
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
                  {stat.group} · 步进 {stat.step.toLocaleString("zh-CN")} · 可修改范围{" "}
                  {("min" in stat ? stat.min : 0).toLocaleString("zh-CN")}–
                  {cheatStatMaximum(actor, index).toLocaleString("zh-CN")}
                </small>
              </span>
              <input
                className="cheat-number"
                type="number"
                min={"min" in stat ? stat.min : 0}
                max={cheatStatMaximum(actor, index)}
                defaultValue={Number(actor[stat.key] || 0)}
                key={`${stat.key}:${Number(actor[stat.key] || 0)}`}
                onBlur={(event) => commitNumber(index, event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              />
              <div>
                <button onClick={() => changeStat(index, -1)}>−</button>
                <button onClick={() => changeStat(index, 1)}>＋</button>
                <button className="max" onClick={() => maxStat(index)}>
                  MAX
                </button>
              </div>
            </div>
          ))}
        {menu.tab === 2 && (
          <div className="cheat-editor-stack">
            <section className="cheat-add-row">
              <label>类别
                <select value={inventoryKind} onChange={(event) => {
                  const kind = Number(event.target.value) as CheatInventoryKind;
                  setInventoryKind(kind);
                  setInventoryId(cheatInventoryCatalog(kind)[0]?.id || 1);
                  setInventoryAmount(1);
                }}>
                  <option value={1}>物品</option><option value={2}>武器</option><option value={3}>防具</option>
                </select>
              </label>
              <label>条目
                <select value={inventoryId} onChange={(event) => setInventoryId(Number(event.target.value))}>
                  {catalog.map((entry) => <option key={entry.id} value={entry.id}>{entry.id} · {entry.name}</option>)}
                </select>
              </label>
              <label>数量 0–{inventoryKind === 1 ? 255 : 1}
                <input type="number" min={0} max={inventoryKind === 1 ? 255 : 1} value={inventoryAmount}
                  onChange={(event) => setInventoryAmount(Number(event.target.value))} />
              </label>
              <button onClick={() => mutate((draft) => setCheatInventory(draft.actor, inventoryKind, inventoryId, inventoryAmount))}>写入行囊</button>
            </section>
            <p className="cheat-capacity">当前 {Object.keys(actor.inventory).length} 种，无种类上限；数量填 0 即移除，移除已装备条目会自动卸下。</p>
            {Object.entries(actor.inventory).filter(([, amount]) => amount > 0).map(([key, amount]) => {
              const [kind, id] = key.split(":").map(Number), table = kind === 1 ? originalTables.items : kind === 2 ? originalTables.weapons : originalTables.armors;
              return <div className="cheat-owned-row" key={key}>
                <span><b>{table[id]?.name || key}</b><small>{kind === 1 ? "物品" : kind === 2 ? "武器" : "防具"} · ID {id}</small></span>
                <strong>× {amount}</strong>
                <button onClick={() => mutate((draft) => setCheatInventory(draft.actor, kind as CheatInventoryKind, id, 0))}>移除</button>
              </div>;
            })}
          </div>
        )}
        {menu.tab === 3 &&
          (allCheatSkills.length ? (
            allCheatSkills.map((skill, index) => {
              const learned = actor.skills[String(skill.id)];
              return (
              <div
                key={skill.id}
                className={menu.index === index ? "active" : ""}
                onMouseEnter={() => setMenu({ tab: 3, index })}
              >
                <span>
                  <b>{skill.name}</b>
                  <small>{learned ? "已习得" : "未习得"} · 可修改范围 1–255 · 类型 {skill.type}</small>
                </span>
                <input className="cheat-number" type="number" min={1} max={255}
                  disabled={!learned} defaultValue={learned?.level || 1}
                  key={`${skill.id}:${learned?.level || 0}`}
                  onBlur={(event) => learned && mutate((draft) => setCheatSkill(draft.actor, skill.id, Number(event.target.value)))}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
                <div>
                  {learned ? <>
                    <button onClick={() => changeSkill(index, -1)}>−</button>
                    <button onClick={() => changeSkill(index, 1)}>＋</button>
                    <button className="max" onClick={() => maxSkill(index)}>MAX</button>
                    <button className="remove" onClick={() => mutate((draft) => removeCheatSkill(draft.actor, skill.id))}>移除</button>
                  </> : <button className="add" onClick={() => mutate((draft) => setCheatSkill(draft.actor, skill.id, 1))}>习得</button>}
                </div>
              </div>
              );
            })
          ) : (
            <p>功夫数据库为空。</p>
          ))}
        {menu.tab === 4 && (
          <div className="cheat-editor-stack identity-editor">
            <label>姓名（1–8 字符）
              <input defaultValue={actor.name || "江湖少侠"} maxLength={8} onBlur={(event) => mutate((draft) => {
                const name = event.target.value.trim().slice(0, 8);
                if (!name) return "姓名不能为空。";
                draft.actor.name = name; return `姓名修改为${name}。`;
              })} />
            </label>
            <label>性别
              <select value={actor.gender} onChange={(event) => mutate((draft) => { draft.actor.gender = Math.max(0, Math.min(2, Number(event.target.value))); return "性别已经修改。"; })}>
                <option value={0}>男</option><option value={1}>女</option><option value={2}>其他</option>
              </select>
            </label>
            <label>门派
              <select value={actor.classId} onChange={(event) => mutate((draft) => setCheatIdentity(draft.actor, Number(event.target.value), draft.actor.teacherId))}>
                {cheatSchools.map((school, id) => <option key={id} value={id}>{id} · {school}</option>)}
              </select>
            </label>
            <label>师父
              <select value={actor.teacherId} onChange={(event) => mutate((draft) => {
                return setCheatIdentity(draft.actor, draft.actor.classId, Number(event.target.value));
              })}>
                <option value={0}>0 · 无师父</option>
                {cheatTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.id} · {teacher.name}{teacher.schoolId ? `（${cheatSchools[teacher.schoolId]}）` : ""}</option>)}
              </select>
            </label>
            <p>修改器中的门派与师父可以独立任意组合；正常拜师仍遵守门派限制。</p>
          </div>
        )}
        {menu.tab === 5 && (
          <div className="cheat-editor-stack world-editor">
            <section className="cheat-toggle-grid">
              {([
                ["haveNewHome", "拥有桃花源家园"], ["swordBattle", "通过铸剑挑战"], ["xue6", "特殊武学标记"],
              ] as const).map(([key, label]) => <label key={key}>
                <input type="checkbox" checked={Boolean(actor[key])} onChange={(event) => mutate((draft) => {
                  (draft.actor as unknown as Record<string, unknown>)[key] = event.target.checked;
                  return `${label}${event.target.checked ? "已开启" : "已关闭"}。`;
                })} /> {label}
              </label>)}
            </section>
            <h3>复活已杀死 NPC</h3>
            {killed.length ? killed.map((id) => <div className="cheat-owned-row" key={id}>
              <span><b>{originalTables.enemies[id]?.name || id}</b><small>NPC ID {id} · 复活后恢复地图人物与互动</small></span>
              <button onClick={() => mutate((draft) => reviveCheatNpc(draft.actor, id))}>复活</button>
            </div>) : <p>当前没有可复活的 NPC。</p>}
            <h3>任务时钟</h3>
            <label>世界时间（秒）· 0–4,294,967,295
              <input type="number" min={0} max={4294967295} defaultValue={tasks.clock}
                key={`clock:${tasks.clock}`} onBlur={(event) => mutate((draft) => {
                  draft.tasks.clock = Math.max(0, Math.min(4294967295, Math.floor(Number(event.target.value) || 0)));
                  return `世界时间调整为 ${draft.tasks.clock} 秒。`;
                })} />
            </label>
            <section className="cheat-toggle-grid">
              <label><input type="checkbox" checked={tasks.finishFlag} onChange={(event) => mutate((draft) => { draft.tasks.finishFlag = event.target.checked; return "主任务领奖标记已经修改。"; })} /> 主任务奖励待领取</label>
              <label><input type="checkbox" checked={tasks.stoneStarted} onChange={(event) => mutate((draft) => { draft.tasks.stoneStarted = event.target.checked; return "石料任务状态已经修改。"; })} /> 石料任务进行中</label>
            </section>
            <button className="danger-action" onClick={() => mutate((draft) => {
              const clock = draft.tasks.clock;
              draft.tasks = { ...freshTaskState(), clock };
              return "全部任务状态已重置，并保留当前世界时间。";
            })}>重置全部任务状态</button>
          </div>
        )}
      </section>
      <footer>
        Q/Tab 切页 · 数值可直接输入 · 人物/武功页支持 W/S、A/D、E、M · K/Esc 关闭
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
  const skills = organizedSkills(actor);
  return (
    <section className="kungfu-list">
      {skills.length ? (
        skills.map((skill, i) => (
          <div className="kungfu-fragment" key={skill.id}>
            {(i === 0 || skills[i - 1].category !== skill.category) && (
              <header className="kungfu-category">
                <span>{skill.category}</span>
                <small>
                  {skills.filter((item) => item.category === skill.category).length} 门
                </small>
              </header>
            )}
          <button
            className={index === i ? "active" : ""}
            onMouseEnter={() => setMenu({ tab: 2, index: i })}
            onClick={() => activate(skill.id)}
          >
            <b>
              <small>{skill.category}</small>
              <span>{skill.name}</span>
            </b>
            <span>{skill.level} 级</span>
            <em>
              {levelTitle(skill.level)} · 第 {levelTier(skill.level)}/50 阶 ·{" "}
              {skill.points} 点
            </em>
            <i className="skill-tags">
              {skill.equipped && <span>当前运用</span>}
              {skill.parrying && <span>用于招架</span>}
              {!skill.equipped && !skill.parrying && <span>已习得</span>}
            </i>
          </button>
          </div>
        ))
      ) : (
        <p>尚未学会任何功夫，可向江湖人物拜师请教。</p>
      )}
    </section>
  );
}

function conversationSessionKey(npc: AmbientNpc, player: AmbientPlayerState) {
  if (npc.bubbleKind === "action") return "";
  if (npc.groupId) return `group:${npc.groupId}`;
  if (npc.partnerId) return `pair:${Math.min(npc.eventId, npc.partnerId)}:${Math.max(npc.eventId, npc.partnerId)}`;
  if (player.npcIds.includes(npc.eventId) && npc.speechTargetName)
    return `player:${[...player.npcIds].sort((a, b) => a - b).join(":")}`;
  const routed = npc.bubble.match(/^(?:群聊\s*·\s*)?(.+?)\s+to\s+(.+?)：/);
  if (routed) return `route:${[routed[1], routed[2]].sort().join(":")}`;
  return "";
}

function collectConversationCards(ambient: AmbientWorld, player: AmbientPlayerState, sx: number, sy: number) {
  const sessions = new Map<string, AmbientNpc[]>();
  for (const npc of ambient.npcs) {
    const key = conversationSessionKey(npc, player);
    if (!key) continue;
    sessions.set(key, [...(sessions.get(key) || []), npc]);
  }
  return [...sessions.values()].flatMap((members) => {
    const contexts = members.map((member) => member.conversationContext).sort((a, b) => b.length - a.length),
      active = members.filter((member) => member.bubble).sort((a, b) => a.bubbleShownAt - b.bubbleShownAt).map((member) => member.bubble),
      includesPlayer = members.some((member) => player.npcIds.includes(member.eventId)),
      history = [...(contexts[0] || []), ...active, ...(includesPlayer && player.bubble ? [player.bubble] : [])]
        .filter((line, index, all) => line && all.indexOf(line) === index)
        .slice(-3);
    if (!history.length) return [];
    return [{
      x: members.reduce((sum, member) => sum + (member.x - sx) * T + 16, 0) / members.length,
      y: Math.min(...members.map((member) => (member.y - sy) * T - 18)),
      lines: history,
    }];
  });
}

function draw(ctx: CanvasRenderingContext2D, state: WorldSave, ambient: AmbientWorld, playerAmbient: AmbientPlayerState) {
  const pos = state.position,
    map = getOriginalMap(pos.mapId),
    viewport = ambientViewportBounds(map.width, map.height, pos.x, pos.y),
    sx = viewport.left,
    sy = viewport.top,
    ambientBubbles: Array<{ x: number; y: number; text: string; kind: AmbientBubbleKind | "player"; shownAt: number }> = [];
  ctx.fillStyle = "#0c1410";
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < 15; y++)
    for (let x = 0; x < 20; x++) {
      const mx = sx + x,
        my = sy + y;
      if (mx >= map.width || my >= map.height) continue;
      drawAuthoredTerrain(ctx, map, mx, my, x * T, y * T);
    }
  drawFactionLandmarks(ctx, map, sx, sy);
  drawPinganTownPlan(ctx, map, sx, sy);
  drawMapStructures(ctx, map, state, sx, sy);
  for (const e of map.events) {
    const visual = eventVisual(e, state),
      roaming = visual.kind === "npc" ? ambient.npcs.find((npc) => npc.eventId === e.id) : undefined,
      eventX = roaming?.x ?? e.x,
      eventY = roaming?.y ?? e.y;
    if (eventX < sx || eventY < sy || eventX >= sx + 20 || eventY >= sy + 15) continue;
    const near = Math.abs(eventX - pos.x) + Math.abs(eventY - pos.y) <= 2;
    if (visual.kind === "npc") {
      drawActor(
        ctx,
        (eventX - sx) * T + 16,
        (eventY - sy) * T + 23,
        hash(visual.label),
        false,
        npcCharacterSprite(visual.npcId || 0, visual.label),
        roaming?.direction || 2,
      );
      drawNpcMarker(
        ctx,
        (eventX - sx) * T + 16,
        (eventY - sy) * T + 23,
        visual.label,
        near,
      );
      if (roaming?.bubble && !conversationSessionKey(roaming, playerAmbient)) ambientBubbles.push({
        x: (eventX - sx) * T + 16,
        y: (eventY - sy) * T - 13,
        text: roaming.bubble,
        kind: roaming.bubbleKind,
        shownAt: roaming.bubbleShownAt,
      });
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
      state.tasks.wantedGender ? { sheet: 4, row: 0 } : { sheet: 3, row: 1 },
    );
    drawNpcMarker(ctx, wx, wy, "通缉犯", near, true);
  }
  drawActor(
    ctx,
    (pos.x - sx) * T + 16,
    (pos.y - sy) * T + 23,
    "#dce8ec",
    true,
    { sheet: 0, row: state.actor.gender ? 1 : 0 },
    pos.direction,
  );
  const conversationCards = collectConversationCards(ambient, playerAmbient, sx, sy).map((card) => layoutConversationCard(ctx, card)),
    playerGrouped = conversationCards.length > 0 && playerAmbient.npcIds.length > 0;
  if (playerAmbient.bubble && !playerGrouped) ambientBubbles.push({
    x: (pos.x - sx) * T + 16,
    y: (pos.y - sy) * T - 13,
    text: playerAmbient.bubble,
    kind: "player",
    shownAt: playerAmbient.bubbleShownAt,
  });
  // 玩家气泡永远最后绘制(最上层)；所有气泡再统一做碰撞错开布局。
  const placedBubbles = resolveAmbientBubbleLayout(
    ctx,
    ambientBubbles.sort((first, second) =>
      first.kind === "player" && second.kind !== "player"
        ? 1
        : second.kind === "player" && first.kind !== "player"
          ? -1
          : first.shownAt - second.shownAt,
    ),
    conversationCards,
  );
  conversationCards.forEach((card) => drawConversationCard(ctx, card));
  placedBubbles.forEach((bubble) => drawAmbientBubble(ctx, bubble));
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
  npcId?: number;
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
function npcDisplayName(id: number, fallback = "江湖人物") {
  return String(npcRecord(id).name || fallback);
}
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
      npcId: scene.id,
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
type MapTheme = "town" | "indoor" | "grassland" | "forest" | "desert" | "mountain" | "snow" | "water" | "altar" | "mystic" | "scifi";
const roadCache = new Map<number, Set<string>>();
const eventCellCache = new Map<number, Set<string>>();
const furnitureCache = new Map<number, Map<string, number>>();

function mapTheme(map: OriginalMap): MapTheme {
  if (/家中|家$|店|当铺|武馆|衙门|大厅|二楼|客房|西厢$|东厢$|房屋|室内|客栈|兵器行/.test(map.name)) return "indoor";
  if (/时空的尽头/.test(map.name)) return "scifi";
  if (/失落的世界|铸剑谷/.test(map.name)) return "desert";
  if (/桃花源|花园/.test(map.name)) return "forest";
  if (/大雪山|长白山|冰火岛/.test(map.name)) return "snow";
  if (/东海|南海|渡口|岛$/.test(map.name)) return "water";
  if (/坛$/.test(map.name)) return "altar";
  if (/时空|失落|桃花源|铸剑谷/.test(map.name)) return "mystic";
  if (/山|峰|谷/.test(map.name)) return "mountain";
  if (/郊|盆地/.test(map.name)) return "grassland";
  return "town";
}

function authoredRoads(map: OriginalMap) {
  const cached = roadCache.get(map.id);
  if (cached) return cached;
  const anchors = map.events
    .filter((event) => executeMapCommands(activePage(event).commands).transfer)
    .map((event) => ({ x: event.x, y: event.y }));
  const cells = new Set<string>(),
    hub = anchors.length
      ? {
          x: Math.round(anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length),
          y: Math.round(anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length),
        }
      : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const add = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < map.width && y < map.height) cells.add(`${x},${y}`);
  };
  for (const anchor of anchors.length ? anchors : [hub]) {
    for (let y = Math.min(anchor.y, hub.y); y <= Math.max(anchor.y, hub.y); y++) add(anchor.x, y);
    for (let x = Math.min(anchor.x, hub.x); x <= Math.max(anchor.x, hub.x); x++) add(x, hub.y);
  }
  roadCache.set(map.id, cells);
  return cells;
}

function eventCells(map: OriginalMap) {
  const cached = eventCellCache.get(map.id);
  if (cached) return cached;
  const cells = new Set(map.events.map((event) => `${event.x},${event.y}`));
  eventCellCache.set(map.id, cells);
  return cells;
}

const factionMapIds = new Set([23, 25, 27, 36, 42, 52, 54, 59, 60, 61, 62, 63, 64, 65, 66]);
const pinganUrbanMapIds = new Set([2, 3, 5, 15]);

function drawCleanBaseTile(
  ctx: CanvasRenderingContext2D,
  theme: ReturnType<typeof mapTheme>,
  road: boolean,
  faction: boolean,
  pingan: boolean,
  mx: number,
  my: number,
  x: number,
  y: number,
) {
  const stone = faction || pingan || theme === "altar";
  const color = road
    ? stone ? "#77776f" : "#8b7859"
    : theme === "indoor" ? "#896746"
    : theme === "water" ? "#39747c"
    : theme === "snow" ? "#cbd4d2"
    : theme === "forest" ? "#4f7448"
    : theme === "grassland" ? "#799553"
    : theme === "desert" ? "#b89a63"
    : theme === "scifi" ? "#303d4d"
    : theme === "mountain" || theme === "mystic" ? "#87755b"
    : stone ? "#7d817b"
    : "#718852";
  ctx.fillStyle = color;
  ctx.fillRect(x, y, T, T);
  ctx.lineWidth = 1;
  if (theme === "indoor") {
    ctx.strokeStyle = "rgba(55,35,22,.23)";
    ctx.beginPath();
    ctx.moveTo(x, y + T - .5);
    ctx.lineTo(x + T, y + T - .5);
    if ((my & 1) === 0) {
      ctx.moveTo(x + T / 2, y);
      ctx.lineTo(x + T / 2, y + T);
    }
    ctx.stroke();
    ctx.fillStyle = (mx + my) % 3 === 0 ? "rgba(255,235,190,.025)" : "rgba(30,18,10,.018)";
    ctx.fillRect(x, y, T, T);
  } else if (theme === "water" && !road) {
    ctx.strokeStyle = "rgba(197,230,225,.18)";
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 10); ctx.lineTo(x + 19, y + 10);
    ctx.moveTo(x + 13, y + 23); ctx.lineTo(x + 28, y + 23);
    ctx.stroke();
  } else if (theme === "scifi") {
    ctx.strokeStyle = "rgba(91,205,220,.22)";
    ctx.strokeRect(x + 2.5, y + 2.5, T - 5, T - 5);
    if ((mx + my) % 4 === 0) { ctx.fillStyle = "rgba(111,226,232,.18)"; ctx.fillRect(x + 6, y + 6, 3, 3); }
  } else if (theme === "desert") {
    ctx.strokeStyle = "rgba(105,77,42,.13)";
    ctx.beginPath(); ctx.moveTo(x + 4, y + 22); ctx.quadraticCurveTo(x + 16, y + 17, x + 29, y + 21); ctx.stroke();
  } else if (stone || road) {
    ctx.strokeStyle = "rgba(38,40,37,.16)";
    ctx.strokeRect(x + .5, y + .5, T - 1, T - 1);
    if ((my & 1) === 0) {
      ctx.beginPath(); ctx.moveTo(x + T / 2, y); ctx.lineTo(x + T / 2, y + T); ctx.stroke();
    }
  } else {
    ctx.fillStyle = (mx * 3 + my * 5) % 7 === 0 ? "rgba(213,224,151,.035)" : "rgba(27,48,24,.025)";
    ctx.fillRect(x, y, T, T);
  }
}

function drawAuthoredTerrain(
  ctx: CanvasRenderingContext2D,
  map: OriginalMap,
  mx: number,
  my: number,
  x: number,
  y: number,
) {
  const theme = mapTheme(map),
    roads = authoredRoads(map),
    road = roads.has(`${mx},${my}`),
    faction = factionMapIds.has(map.id),
    pingan = pinganUrbanMapIds.has(map.id);
  drawCleanBaseTile(ctx, theme, road, faction, pingan, mx, my, x, y);
  if (road && theme !== "indoor") {
    ctx.strokeStyle = theme === "mountain" ? "rgba(83,59,35,.42)" : "rgba(38,49,39,.35)";
    ctx.lineWidth = 1;
    if (!roads.has(`${mx - 1},${my}`)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + T); ctx.stroke(); }
    if (!roads.has(`${mx + 1},${my}`)) { ctx.beginPath(); ctx.moveTo(x + T, y); ctx.lineTo(x + T, y + T); ctx.stroke(); }
    if (!roads.has(`${mx},${my - 1}`)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + T, y); ctx.stroke(); }
    if (!roads.has(`${mx},${my + 1}`)) { ctx.beginPath(); ctx.moveTo(x, y + T); ctx.lineTo(x + T, y + T); ctx.stroke(); }
  }
  if (theme === "snow") {
    ctx.fillStyle = "rgba(221,235,235,.22)";
    ctx.fillRect(x, y, T, T);
  }
  if (theme === "indoor") {
    const furniture = indoorFurniture(map).get(`${mx},${my}`);
    if (furniture !== undefined) drawOverlayCell(ctx, furniture, x, y);
    return;
  }
  if (road || eventCells(map).has(`${mx},${my}`)) return;
  const seed = (Math.imul(map.id + 17, 73856093) ^ Math.imul(mx + 11, 19349663) ^ Math.imul(my + 7, 83492791)) >>> 0;
  const besideRoad = roads.has(`${mx - 1},${my}`) || roads.has(`${mx + 1},${my}`) || roads.has(`${mx},${my - 1}`) || roads.has(`${mx},${my + 1}`),
    vegetationBorder = theme !== "water" && theme !== "desert" && theme !== "scifi" &&
      (mx === 2 || my === 2 || mx === map.width - 3 || my === map.height - 3);
  if (besideRoad && (mx + my + map.id) % 4 === 0) {
    drawOverlayCell(ctx, theme === "snow" ? 5 : theme === "forest" ? 2 : [3, 4, 8, 9, 10][seed % 5], x, y);
    return;
  }
  if (vegetationBorder && (mx * 3 + my + map.id) % 4 === 0) {
    drawOverlayCell(ctx, theme === "forest" ? [0, 2, 3][seed % 3] : [2, 3, 4][seed % 3], x, y);
    return;
  }
  const landscapedEdge = faction && (mx < 3 || my < 3 || mx >= map.width - 3 || my >= map.height - 3);
  if (landscapedEdge && seed % 11 === 0) {
    const factionDecoration = map.id === 23 ? 4 : map.id === 25 ? 9 : map.id === 36 || map.id === 42 || map.id === 54 ? 5 : [3, 4, 12, 13][seed % 4];
    drawOverlayCell(ctx, factionDecoration, x, y);
    return;
  }
  if (seed % (faction ? 37 : 31) !== 0) return;
  const decoration =
    theme === "water" ? 6 :
    theme === "altar" || theme === "scifi" ? 13 :
    theme === "desert" ? [12, 13, 15][seed % 3] :
    theme === "forest" ? [0, 2, 3, 4, 5, 6][seed % 6] :
    theme === "mountain" || theme === "snow" ? [5, 12, 13, 14, 15][seed % 5] :
    [0, 2, 3, 4, 8, 9, 10][seed % 7];
  drawOverlayCell(ctx, decoration, x, y);
}

function indoorFurniture(map: OriginalMap) {
  const cached = furnitureCache.get(map.id);
  if (cached) return cached;
  const cells = new Map<string, number>(),
    occupied = eventCells(map),
    add = (x: number, y: number, source: number) => {
      if (x > 0 && y > 0 && x < map.width - 1 && y < map.height - 1 && !occupied.has(`${x},${y}`) && !cells.has(`${x},${y}`))
        cells.set(`${x},${y}`, source);
    },
    cx = Math.floor(map.width / 2),
    cy = Math.floor(map.height / 2),
    row = (y: number, start: number, end: number, step: number, source: number) => {
      for (let x = start; x <= end; x += step) add(x, y, source);
    },
    tableSet = (x: number, y: number) => {
      add(x, y, 16); add(x - 1, y, 17); add(x + 1, y, 17);
    };
  if (/客房|家中|家$|房屋|西厢|东厢/.test(map.name)) {
    add(3, 3, 18); add(map.width - 4, 3, 19); add(map.width - 4, 6, 23);
    tableSet(cx, cy); add(3, map.height - 4, 24); add(map.width - 4, map.height - 4, 22);
  } else if (/药店/.test(map.name)) {
    row(3, 3, map.width - 4, 3, 19);
    row(6, 4, map.width - 5, 4, 26);
    add(cx, 8, 20); add(cx - 2, 8, 23); add(cx + 2, 8, 23);
  } else if (/裁缝店/.test(map.name)) {
    row(3, 3, map.width - 4, 4, 25);
    row(6, 4, map.width - 5, 5, 19);
    add(cx, 8, 20); tableSet(5, map.height - 4);
  } else if (/杂货店|豆腐店|当铺/.test(map.name)) {
    row(3, 3, map.width - 4, 3, 19);
    row(6, 4, map.width - 5, 4, /当铺/.test(map.name) ? 21 : /豆腐/.test(map.name) ? 27 : 26);
    add(cx, 9, 20); add(cx - 3, 9, 24); add(cx + 3, 9, 23);
  } else if (/兵器行|武馆/.test(map.name)) {
    row(3, 3, map.width - 4, 4, 30);
    row(6, 4, map.width - 5, 5, 21);
    tableSet(cx, cy + 2);
  } else if (/客栈/.test(map.name)) {
    for (let y = 5; y < map.height - 4; y += 4)
      for (let x = 4; x < map.width - 3; x += 5) tableSet(x, y);
    row(3, 3, map.width - 4, 5, 24); add(map.width - 4, 3, 22);
  } else if (/衙门|大厅|二楼/.test(map.name)) {
    row(3, 3, map.width - 4, 5, 29);
    add(cx, 5, 20); add(cx - 2, 7, 17); add(cx + 2, 7, 17);
    add(3, map.height - 4, 22); add(map.width - 4, map.height - 4, 22);
  } else {
    add(3, 3, 19); add(map.width - 4, 3, 21); add(cx, cy, 16); add(cx - 1, cy + 1, 17);
  }
  // A restrained repeated furnishing rhythm makes every room feel occupied
  // without returning to random clutter or embedding props in the floor.
  for (let x = 3; x < map.width - 3; x += 6) {
    add(x, map.height - 3, (x + map.id) % 3 ? 23 : 22);
    add(x + 2, map.height - 3, (x + map.id) % 2 ? 8 : 10);
  }
  furnitureCache.set(map.id, cells);
  return cells;
}

function drawOverlayCell(
  ctx: CanvasRenderingContext2D,
  source: number,
  x: number,
  y: number,
) {
  const interior = source >= 16,
    atlas = interior ? wuxiaArt.interiorOverlays : wuxiaArt.natureOverlays,
    atlasSource = interior ? source - 16 : source;
  if (!atlas?.complete || !atlas.naturalWidth) return;
  const cellWidth = atlas.naturalWidth / 4,
    cellHeight = atlas.naturalHeight / 4,
    tree = source <= 5,
    size = tree ? 44 : 36,
    offsetX = (T - size) / 2,
    offsetY = tree ? T - size : (T - size) / 2;
  ctx.drawImage(
    atlas,
    (atlasSource % 4) * cellWidth,
    Math.floor(atlasSource / 4) * cellHeight,
    cellWidth,
    cellHeight,
    x + offsetX,
    y + offsetY,
    size,
    size,
  );
}

function drawMapStructures(
  ctx: CanvasRenderingContext2D,
  map: OriginalMap,
  state: WorldSave,
  sx: number,
  sy: number,
) {
  // Interior maps use furniture and interior walls only. A transfer back to a
  // street is an exit, not permission to place that street's facade indoors.
  if (mapTheme(map) === "indoor") return;
  const outdoorWords = /山|郊|峰|海|岛|谷|林|坛|渡口|桃花源|时空|世界/;
  const occupied: Array<{ x: number; y: number }> = [];
  for (const event of map.events) {
    const visual = eventVisual(event, state);
    if (visual.kind !== "door") continue;
    if (outdoorWords.test(visual.label)) {
      // Outdoor transfers keep the same clean terrain. A symmetric flower pair
      // signals the entrance without replacing its base tile with a cave/rock.
      drawOverlayCell(ctx, hashIndex(visual.label, 2) ? 9 : 10, (event.x - sx - 1) * T, (event.y - sy) * T);
      drawOverlayCell(ctx, hashIndex(visual.label, 2) ? 10 : 9, (event.x - sx + 1) * T, (event.y - sy) * T);
      continue;
    }
    if (event.x < sx - 3 || event.x >= sx + 23 || event.y < sy || event.y >= sy + 16)
      continue;
    if (occupied.some((point) => Math.abs(point.x - event.x) < 4 && Math.abs(point.y - event.y) < 3))
      continue;
    occupied.push({ x: event.x, y: event.y });
    const widthTiles = hashIndex(visual.label, 2) ? 5 : 4,
      leftTile = event.x - Math.floor(widthTiles / 2),
      topTile = event.y - 3;
    drawCleanBuilding(ctx, (leftTile - sx) * T, (topTile - sy) * T, widthTiles, event.x - leftTile, hashIndex(visual.label, 3));
  }
}

function drawCleanBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, widthTiles: number, doorColumn: number, style: number) {
  const width = widthTiles * T,
    roof = style === 1 ? "#354650" : style === 2 ? "#59413a" : "#343936",
    wall = style === 1 ? "#bdc7c3" : style === 2 ? "#c6aa82" : "#d2c7aa",
    timber = style === 2 ? "#58372c" : "#4b4540";
  ctx.fillStyle = "rgba(25,28,25,.24)"; ctx.fillRect(x + 4, y + T * 3 - 2, width - 8, 5);
  ctx.fillStyle = wall; ctx.fillRect(x + 5, y + T, width - 10, T * 2);
  ctx.fillStyle = roof; ctx.fillRect(x, y + 5, width, T - 6);
  ctx.fillStyle = "rgba(235,240,226,.14)"; ctx.fillRect(x + 6, y + 9, width - 12, 3);
  ctx.fillStyle = timber;
  for (let column = 0; column <= widthTiles; column++) ctx.fillRect(x + column * T - 2, y + T, 4, T * 2);
  ctx.fillRect(x + 3, y + T, width - 6, 5); ctx.fillRect(x + 3, y + T * 2 - 3, width - 6, 5);
  for (let column = 0; column < widthTiles; column++) {
    if (column === doorColumn) continue;
    ctx.fillStyle = "#51483e"; ctx.fillRect(x + column * T + 10, y + T + 10, 12, 10);
    ctx.fillStyle = "#9dbea8"; ctx.fillRect(x + column * T + 12, y + T + 12, 8, 6);
  }
  ctx.fillStyle = "#492e25"; ctx.fillRect(x + doorColumn * T + 7, y + T * 2 - 1, 18, T + 1);
  ctx.fillStyle = "#c89b55"; ctx.fillRect(x + doorColumn * T + 22, y + T * 2 + 13, 2, 2);
}

function drawStoneFoundation(ctx: CanvasRenderingContext2D, x: number, y: number, widthTiles: number, heightTiles: number) {
  ctx.fillStyle = "#929b9b"; ctx.fillRect(x, y, widthTiles * T, heightTiles * T);
  ctx.strokeStyle = "rgba(50,58,60,.25)"; ctx.lineWidth = 1;
  for (let row = 0; row <= heightTiles; row++) { ctx.beginPath(); ctx.moveTo(x, y + row * T); ctx.lineTo(x + widthTiles * T, y + row * T); ctx.stroke(); }
  for (let column = 0; column <= widthTiles; column++) { ctx.beginPath(); ctx.moveTo(x + column * T, y); ctx.lineTo(x + column * T, y + heightTiles * T); ctx.stroke(); }
}

function drawFactionLandmarks(
  ctx: CanvasRenderingContext2D,
  map: OriginalMap,
  sx: number,
  sy: number,
) {
  if (!factionMapIds.has(map.id)) return;
  const width = map.id >= 59 ? 9 : Math.min(11, map.width - 2),
    left = Math.max(1, Math.floor(map.width / 2 - width / 2)),
    top = Math.max(1, Math.min(4, Math.floor(map.height * 0.16))),
    x = (left - sx) * T,
    y = (top - sy) * T;
  if (mapTheme(map) === "snow") {
    drawStoneFoundation(ctx, x, y + T, width, 3);
  } else {
    drawStoneFoundation(ctx, x, y + T * 3, width, 2);
    drawCleanBuilding(ctx, x, y, width, Math.floor(width / 2), map.id % 3);
  }
  drawOverlayCell(ctx, map.id === 23 ? 3 : 4, x - T, y + T * 3);
  drawOverlayCell(ctx, map.id === 23 ? 3 : 4, x + width * T, y + T * 3);
}

function drawPinganTownPlan(
  ctx: CanvasRenderingContext2D,
  map: OriginalMap,
  sx: number,
  sy: number,
) {
  if (!pinganUrbanMapIds.has(map.id) || mapTheme(map) === "indoor") return;
  const occupied = eventCells(map),
    draw = (mx: number, my: number, source: number) => {
      if (occupied.has(`${mx},${my}`)) return;
      const x = (mx - sx) * T, y = (my - sy) * T;
      if (x <= -T || y <= -T || x >= W || y >= H) return;
      drawOverlayCell(ctx, source, x, y);
    };
  // Repeated planting is an overlay, never part of the terrain base.
  for (let x = 2; x < map.width - 2; x += 5) { draw(x, 2, 2); draw(x, map.height - 3, 3); }
  for (let y = 5; y < map.height - 5; y += 5) { draw(2, y, 4); draw(map.width - 3, y, 4); }
  if (map.id === 15) {
    for (let x = 4; x < map.width - 4; x += 5) {
      draw(x, 4, 8); draw(x + 2, 4, 10);
      draw(x, map.height - 5, 8); draw(x + 2, map.height - 5, 10);
    }
  }
}
function drawActor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  hero: boolean,
  sprite: CharacterSprite = { sheet: 0, row: 0 },
  direction = 2,
) {
  const atlas = wuxiaArt.characters[sprite.sheet];
  if (atlas?.complete && atlas.naturalWidth) {
    const cellWidth = atlas.naturalWidth / 4,
      cellHeight = atlas.naturalHeight / 4,
      // Generated profiles are named by their visible screen-facing direction.
      // RMXP direction 4 means travel left, so it uses the left-facing profile.
      column = direction === 4 ? 2 : direction === 6 ? 1 : direction === 8 ? 3 : 0,
      width = 44,
      height = 44;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 9, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(
      atlas,
      column * cellWidth,
      (sprite.row % 4) * cellHeight,
      cellWidth,
      cellHeight,
      x - width / 2,
      y - 34,
      width,
      height,
    );
    return;
  }
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
  ctx.fillRect(x - 2, y - 47 - (pulse ? 2 : 0), 5, 7);
  ctx.fillRect(x - 2, y - 38 - (pulse ? 2 : 0), 5, 3);
  if (!near) return;
  const label = name.length > 7 ? `${name.slice(0, 7)}…` : name;
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  const width = Math.ceil(ctx.measureText(label).width) + 8;
  ctx.fillStyle = "rgba(7,12,9,.92)";
  ctx.fillRect(x - width / 2, y - 62, width, 13);
  ctx.fillStyle = accent;
  ctx.fillText(label, x, y - 52);
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
function hashIndex(text: string, max: number) {
  let n = 0;
  for (const c of text) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n % max;
}
