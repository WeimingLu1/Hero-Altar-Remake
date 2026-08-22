import { originalTables } from "./original-data";
import { actorStatusProfile } from "./status-system";
import { npcLore, npcMartialProfile } from "./npc-lore";
import { originalMaps } from "./original-world";
import { executeMapCommands, selectSceneEvent } from "./rmxp-events";
import type { SceneActorState } from "./scene-event";
import type { TaskState } from "./task-system";

export type GeneratedQuestKind = "duel" | "visit" | "delegated-duel";
export type GeneratedQuestStage =
  | "accepted"
  | "confrontation"
  | "travel"
  | "defeated"
  | "report"
  | "failed";

export type GeneratedQuestParticipant = {
  npcId: number;
  name: string;
  mapId: number;
  mapName: string;
  eventId: number;
  x: number;
  y: number;
};

export type GeneratedQuestReward = {
  exp: number;
  potential: number;
  gold: number;
  item?: { kind: 1; id: number; name: string; amount: 1 };
};

export type GeneratedQuestTranscriptEntry = {
  id: number;
  speaker: "player" | "npc" | "system";
  npcId?: number;
  state?: string;
  action?: string;
  speech: string;
  stage: GeneratedQuestStage;
  at: number;
};

type GeneratedQuestBase = {
  version: 1;
  id: string;
  title: string;
  premise: string;
  issuer: GeneratedQuestParticipant;
  target: GeneratedQuestParticipant;
  reward: GeneratedQuestReward;
  transcript: GeneratedQuestTranscriptEntry[];
};

export type GeneratedQuest =
  | (GeneratedQuestBase & {
      kind: "duel";
      stage: "accepted" | "confrontation" | "defeated" | "report" | "failed";
    })
  | (GeneratedQuestBase & {
      kind: "visit";
      stage: "accepted" | "travel" | "report" | "failed";
    })
  | (GeneratedQuestBase & {
      kind: "delegated-duel";
      stage: GeneratedQuestStage;
    });

export type GeneratedQuestDraft = GeneratedQuest;

export type GeneratedQuestHistoryEntry = {
  version: 1;
  id: string;
  kind: GeneratedQuestKind;
  title: string;
  premise: string;
  summary: string;
  issuerName: string;
  issuerMapName: string;
  targetName: string;
  targetMapName: string;
  reward: GeneratedQuestReward;
  closingLine?: string;
  completedAt: number;
};

const GENERATED_KINDS = new Set<GeneratedQuestKind>(["duel", "visit", "delegated-duel"]);
const GENERATED_STAGES = new Set<GeneratedQuestStage>([
  "accepted",
  "confrontation",
  "travel",
  "defeated",
  "report",
  "failed",
]);

export const GENERATED_QUEST_OFFER_REPLY_COUNT = 2;

const RESERVED_NPC_IDS = new Set([
  3, 6, 10, 14, 15, 25, 26, 31, 111, 139, 148, 149, 162, 163, 164, 165,
  166, 167, 168, 169, 170, 172, 195, 196, 197, 198,
]);
// 163–198 are the original altar chain, its minions, and other story-only combat
// records. They share map events with the original tan progression and must never
// be reused as generated-quest participants.
const isGeneratedQuestReservedNpc = (npcId: number) =>
  RESERVED_NPC_IDS.has(npcId) || (npcId >= 163 && npcId <= 198);
const HIDDEN_QUEST_NPC_IDS = new Set([2, 5, 13, 20, 30, 37, 47, 64, 68, 90]);

const participantIndex = new Map<number, GeneratedQuestParticipant[]>();
for (const map of originalMaps) {
  for (const event of map.events) {
    for (const page of event.pages) {
      const source = executeMapCommands(page.commands).source;
      const scene = selectSceneEvent(source, {
        inventory: {},
        tanId: 0,
        freeWork: 0,
        canGetItem: true,
        canGetCaihua: true,
      });
      if (scene?.type !== 0 || !scene.id) continue;
      const rows = participantIndex.get(scene.id) || [];
      if (!rows.some((row) => row.mapId === map.id && row.eventId === event.id)) {
        rows.push({
          npcId: scene.id,
          name: String(originalTables.enemies[scene.id]?.name || "江湖人物"),
          mapId: map.id,
          mapName: map.name,
          eventId: event.id,
          x: event.x,
          y: event.y,
        });
        participantIndex.set(scene.id, rows);
      }
    }
  }
}

export function generatedQuestParticipant(
  npcId: number,
  preferredMapId?: number,
  preferredEventId?: number,
) {
  const rows = participantIndex.get(npcId) || [];
  return (
    rows.find(
      (row) =>
        row.mapId === preferredMapId &&
        (preferredEventId === undefined || row.eventId === preferredEventId),
    ) || rows[0]
  );
}

export function normalizeGeneratedQuest(value: unknown): GeneratedQuest | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<GeneratedQuest>,
    kind = source.kind,
    stage = source.stage;
  if (!kind || !GENERATED_KINDS.has(kind) || !stage || !GENERATED_STAGES.has(stage))
    return null;
  const normalizeParticipant = (entry: unknown) => {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Partial<GeneratedQuestParticipant>,
      npcId = Number(row.npcId), mapId = Number(row.mapId), eventId = Number(row.eventId),
      map = originalMaps.find((item) => item.id === mapId),
      event = map?.events.find((item) => item.id === eventId),
      canonical = (participantIndex.get(npcId) || []).find(
        (item) => item.mapId === mapId && item.eventId === eventId,
      );
    if (!npcId || !map || !event || !canonical) return null;
    return {
      npcId,
      name: String(row.name || originalTables.enemies[npcId]?.name || "江湖人物"),
      mapId,
      mapName: String(row.mapName || map.name),
      eventId,
      x: canonical.x,
      y: canonical.y,
    } satisfies GeneratedQuestParticipant;
  };
  const issuer = normalizeParticipant(source.issuer), target = normalizeParticipant(source.target);
  if (
    !issuer ||
    !target ||
    isGeneratedQuestReservedNpc(issuer.npcId) ||
    isGeneratedQuestReservedNpc(target.npcId) ||
    !source.reward ||
    typeof source.reward !== "object"
  ) return null;
  const rawReward = source.reward as Partial<GeneratedQuestReward>,
    item = rawReward.item &&
      Number(rawReward.item.kind) === 1 &&
      Number(rawReward.item.id) > 0 &&
      Number(rawReward.item.id) < 19
      ? {
          kind: 1 as const,
          id: Math.floor(Number(rawReward.item.id)),
          name: String(rawReward.item.name || originalTables.items[Number(rawReward.item.id)]?.name || "物品"),
          amount: 1 as const,
        }
      : undefined,
    transcript = Array.isArray(source.transcript)
      ? source.transcript.flatMap((entry, index): GeneratedQuestTranscriptEntry[] => {
          if (!entry || typeof entry !== "object") return [];
          const row = entry as Partial<GeneratedQuestTranscriptEntry>;
          if (!row.speaker || !["player", "npc", "system"].includes(row.speaker)) return [];
          return [{
            id: Math.max(1, Math.floor(Number(row.id) || index + 1)),
            speaker: row.speaker,
            npcId: row.npcId ? Math.floor(Number(row.npcId)) : undefined,
            state: typeof row.state === "string" ? row.state : undefined,
            action: typeof row.action === "string" ? row.action : undefined,
            speech: typeof row.speech === "string" ? row.speech : "",
            stage: row.stage && GENERATED_STAGES.has(row.stage) ? row.stage : stage,
            at: Math.max(0, Math.floor(Number(row.at) || 0)),
          }];
        })
      : [];
  const normalizedStage = stage === "accepted"
    ? kind === "duel" ? "confrontation" : "travel"
    : stage;
  if (
    (kind === "visit" && !["travel", "report", "failed"].includes(normalizedStage)) ||
    (kind === "duel" && !["confrontation", "defeated", "report", "failed"].includes(normalizedStage))
  ) return null;
  return {
    version: 1,
    id: String(source.id || `llm-import-${issuer.npcId}-${target.npcId}`),
    kind,
    stage: normalizedStage,
    title: String(source.title || "江湖奇遇"),
    premise: String(source.premise || "一桩尚未了结的江湖委托。"),
    issuer,
    target,
    reward: {
      exp: Math.max(0, Math.floor(Number(rawReward.exp) || 0)),
      potential: Math.max(0, Math.floor(Number(rawReward.potential) || 0)),
      gold: Math.max(0, Math.floor(Number(rawReward.gold) || 0)),
      ...(item ? { item } : {}),
    },
    transcript,
  } as GeneratedQuest;
}

export function normalizeGeneratedQuestHistory(
  value: unknown,
): GeneratedQuestHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): GeneratedQuestHistoryEntry[] => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Partial<GeneratedQuestHistoryEntry>;
    if (!row.kind || !GENERATED_KINDS.has(row.kind) || !row.id) return [];
    const rawReward = row.reward;
    if (!rawReward || typeof rawReward !== "object") return [];
    const reward: GeneratedQuestReward = {
      exp: Math.max(0, Math.floor(Number(rawReward.exp) || 0)),
      potential: Math.max(0, Math.floor(Number(rawReward.potential) || 0)),
      gold: Math.max(0, Math.floor(Number(rawReward.gold) || 0)),
    };
    if (
      rawReward.item &&
      Number(rawReward.item.kind) === 1 &&
      Number(rawReward.item.id) > 0 &&
      Number(rawReward.item.id) < 19
    ) reward.item = {
      kind: 1,
      id: Math.floor(Number(rawReward.item.id)),
      name: String(rawReward.item.name || "物品"),
      amount: 1,
    };
    return [{
      version: 1,
      id: String(row.id),
      kind: row.kind,
      title: String(row.title || "江湖奇遇"),
      premise: String(row.premise || "一桩已经了结的江湖委托。"),
      summary: String(row.summary || "这桩江湖委托已经圆满完成。"),
      issuerName: String(row.issuerName || "江湖人物"),
      issuerMapName: String(row.issuerMapName || "江湖某处"),
      targetName: String(row.targetName || "江湖人物"),
      targetMapName: String(row.targetMapName || "江湖某处"),
      reward,
      ...(row.closingLine ? { closingLine: String(row.closingLine) } : {}),
      completedAt: Math.max(0, Math.floor(Number(row.completedAt) || 0)),
    }];
  });
}

export function generatedQuestHistoryEntry(
  quest: GeneratedQuest,
  completedAt: number,
): GeneratedQuestHistoryEntry {
  const summary = quest.kind === "duel"
    ? `应${quest.issuer.name}之邀，在${quest.target.mapName}完成了一场点到为止的切磋。`
    : quest.kind === "visit"
      ? `受${quest.issuer.name}所托，前往${quest.target.mapName}拜访${quest.target.name}，并返回${quest.issuer.mapName}复命。`
      : `受${quest.issuer.name}委派，前往${quest.target.mapName}挑战${quest.target.name}，取胜后返回${quest.issuer.mapName}复命。`;
  const closingLine = [...quest.transcript]
    .reverse()
    .find((entry) => entry.speaker === "npc" && entry.speech.trim())
    ?.speech.trim();
  return {
    version: 1,
    id: quest.id,
    kind: quest.kind,
    title: quest.title,
    premise: quest.premise,
    summary,
    issuerName: quest.issuer.name,
    issuerMapName: quest.issuer.mapName,
    targetName: quest.target.name,
    targetMapName: quest.target.mapName,
    reward: structuredClone(quest.reward),
    ...(closingLine ? { closingLine } : {}),
    completedAt: Math.max(0, Math.floor(completedAt)),
  };
}

const excludedNpcIds = (actor: SceneActorState, tasks: TaskState) =>
  new Set([
    ...(actor.killList || []),
    tasks.visitId > 0 ? tasks.visitId : 0,
    tasks.killId > 0 ? tasks.killId : 0,
  ]);

function candidateParticipants(
  issuerId: number,
  actor: SceneActorState,
  tasks: TaskState,
  combat: boolean,
) {
  const excluded = excludedNpcIds(actor, tasks),
    playerRealm = actorStatusProfile(actor).realmValue;
  return [...participantIndex.entries()].flatMap(([npcId, rows]) => {
    const record = originalTables.enemies[npcId] || {}, lore = npcLore(npcId);
    if (
      npcId === issuerId ||
      isGeneratedQuestReservedNpc(npcId) ||
      HIDDEN_QUEST_NPC_IDS.has(npcId) ||
      excluded.has(npcId) ||
      !rows.length
    ) return [];
    if (combat) {
      if (lore.age < 16 || Math.abs(npcMartialProfile(npcId).value - playerRealm) > 20)
        return [];
      if (Number(record.maxhp || record.hp || 0) <= 0) return [];
    }
    return rows;
  });
}

export function generatedQuestEligibleKinds(
  issuer: GeneratedQuestParticipant,
  actor: SceneActorState,
  tasks: TaskState,
) {
  if (isGeneratedQuestReservedNpc(issuer.npcId)) return [];
  const kinds: GeneratedQuestKind[] = [],
    issuerLore = npcLore(issuer.npcId),
    playerRealm = actorStatusProfile(actor).realmValue;
  if (
    issuerLore.age >= 16 &&
    Math.abs(npcMartialProfile(issuer.npcId).value - playerRealm) <= 20
  ) kinds.push("duel");
  if (candidateParticipants(issuer.npcId, actor, tasks, false).length)
    kinds.push("visit");
  if (candidateParticipants(issuer.npcId, actor, tasks, true).length)
    kinds.push("delegated-duel");
  return kinds;
}

export function shouldOfferGeneratedQuest(options: {
  completedNpcReplies: number;
  offeredThisSession: boolean;
  tasks: TaskState;
}) {
  return (
    !options.offeredThisSession &&
    !options.tasks.generatedQuest &&
    options.completedNpcReplies + 1 >= GENERATED_QUEST_OFFER_REPLY_COUNT
  );
}

function itemRewardCandidates(issuerId: number) {
  const npc = originalTables.enemies[issuerId] || {}, rows: number[][] = [];
  for (const entry of (npc.sell_item as number[][] | undefined) || []) rows.push(entry);
  for (const key of ["item1", "item2", "item3", "item4"]) {
    const entry = npc[key];
    if (Array.isArray(entry)) rows.push(entry as number[]);
  }
  return [...new Set(rows.flatMap(([kind, signedId]) => {
    const id = Math.abs(Number(signedId || 0)), item = originalTables.items[id];
    if (
      kind !== 1 ||
      id <= 0 ||
      id >= 19 ||
      !item ||
      ((item.skill_list as number[][] | undefined) || []).length
    ) return [];
    return [id];
  }))];
}

export function generatedQuestReward(
  kind: GeneratedQuestKind,
  issuerId: number,
  actor: SceneActorState,
  random: (max: number) => number,
): GeneratedQuestReward {
  const base = Math.max(
      80,
      Math.min(1200, 80 + actorStatusProfile(actor).realmValue * 4),
    ),
    multiplier = kind === "visit" ? 0.75 : kind === "delegated-duel" ? 1.25 : 1,
    exp = Math.floor(base * multiplier),
    reward: GeneratedQuestReward = {
      exp,
      potential: Math.floor(exp / 3),
      gold: Math.floor(exp / 2),
    },
    chance = Math.max(10, Math.min(35, 10 + Math.floor(actor.luck / 10))),
    candidates = itemRewardCandidates(issuerId);
  if (candidates.length && random(100) < chance) {
    const id = candidates[random(candidates.length)];
    reward.item = {
      kind: 1,
      id,
      name: String(originalTables.items[id]?.name || `物品${id}`),
      amount: 1,
    };
  }
  return reward;
}

export function createGeneratedQuestDraft(options: {
  issuer: GeneratedQuestParticipant;
  actor: SceneActorState;
  tasks: TaskState;
  random: (max: number) => number;
}): GeneratedQuestDraft | null {
  const { issuer, actor, tasks, random } = options,
    kinds = generatedQuestEligibleKinds(issuer, actor, tasks);
  if (!kinds.length) return null;
  const kind = kinds[random(kinds.length)],
    pool = kind === "duel"
      ? [issuer]
      : candidateParticipants(issuer.npcId, actor, tasks, kind === "delegated-duel"),
    target = pool[random(pool.length)];
  if (!target) return null;
  const title = kind === "duel"
      ? `与${issuer.name}切磋`
      : kind === "visit"
        ? `代${issuer.name}拜访${target.name}`
        : `受${issuer.name}委托挑战${target.name}`,
    premise = kind === "duel"
      ? `${issuer.name}想亲自试一试你的武艺。`
      : kind === "visit"
        ? `${issuer.name}请你前往${target.mapName}拜访${target.name}，交谈后回来复命。`
        : `${issuer.name}请你前往${target.mapName}挑战${target.name}，安全击败对方后回来复命。`;
  return {
    version: 1,
    id: `llm-${tasks.generatedQuestSerial + 1}-${tasks.clock}-${issuer.npcId}`,
    kind,
    stage: "accepted",
    title,
    premise,
    issuer,
    target,
    reward: generatedQuestReward(kind, issuer.npcId, actor, random),
    transcript: [],
  };
}

export function acceptGeneratedQuest(tasks: TaskState, draft: GeneratedQuestDraft) {
  if (tasks.generatedQuest) return false;
  tasks.generatedQuest = structuredClone(draft);
  tasks.generatedQuest.stage = draft.kind === "duel" ? "confrontation" : "travel";
  tasks.generatedQuestSerial += 1;
  tasks.generatedQuestOfferMisses = 0;
  tasks.generatedQuestNextOfferAt = tasks.clock;
  return true;
}

export function declineGeneratedQuest(tasks: TaskState) {
  tasks.generatedQuestOfferMisses = 0;
  tasks.generatedQuestNextOfferAt = tasks.clock;
}

export function appendGeneratedQuestTranscript(
  tasks: TaskState,
  entry: Omit<GeneratedQuestTranscriptEntry, "id" | "stage" | "at">,
) {
  const quest = tasks.generatedQuest;
  if (!quest) return false;
  quest.transcript.push({
    ...entry,
    id: (quest.transcript.at(-1)?.id || 0) + 1,
    stage: quest.stage,
    at: tasks.clock,
  });
  return true;
}

export function generatedQuestInteraction(quest: GeneratedQuest, npcId: number) {
  if (quest.stage === "failed") return "failed" as const;
  if (npcId === quest.issuer.npcId && quest.stage === "report") return "report" as const;
  if (npcId !== quest.target.npcId) return null;
  if (quest.kind === "visit" && quest.stage === "travel") return "visit-target" as const;
  if (quest.kind === "delegated-duel" && quest.stage === "travel")
    return "challenge-target" as const;
  if (
    (quest.kind === "duel" || quest.kind === "delegated-duel") &&
    quest.stage === "confrontation"
  ) return "battle-ready" as const;
  if (quest.stage === "defeated") return "post-battle" as const;
  if (npcId === quest.issuer.npcId) return "issuer-reminder" as const;
  return null;
}

export function advanceGeneratedQuestAfterDialogue(
  tasks: TaskState,
  npcId: number,
) {
  const quest = tasks.generatedQuest;
  if (!quest || npcId !== quest.target.npcId) return false;
  if (quest.kind === "visit" && quest.stage === "travel") {
    quest.stage = "report";
    return true;
  }
  if (quest.kind === "delegated-duel" && quest.stage === "travel") {
    quest.stage = "confrontation";
    return true;
  }
  if (quest.stage === "defeated") {
    quest.stage = "report";
    return true;
  }
  return false;
}

export function markGeneratedQuestBattleWin(
  tasks: TaskState,
  questId: string,
  enemyId: number,
) {
  const quest = tasks.generatedQuest;
  if (
    !quest ||
    quest.id !== questId ||
    quest.target.npcId !== enemyId ||
    quest.stage !== "confrontation" ||
    (quest.kind !== "duel" && quest.kind !== "delegated-duel")
  ) return false;
  quest.stage = "defeated";
  return true;
}

export function failGeneratedQuest(tasks: TaskState, reason: string) {
  const quest = tasks.generatedQuest;
  if (!quest) return false;
  quest.stage = "failed";
  appendGeneratedQuestTranscript(tasks, { speaker: "system", speech: reason });
  return true;
}

export function abandonGeneratedQuest(tasks: TaskState) {
  if (!tasks.generatedQuest) return false;
  tasks.generatedQuest = null;
  tasks.generatedQuestOfferMisses = 0;
  tasks.generatedQuestNextOfferAt = tasks.clock;
  return true;
}

export function claimGeneratedQuestReward(
  actor: SceneActorState,
  tasks: TaskState,
  npcId: number,
) {
  const quest = tasks.generatedQuest;
  if (!quest || quest.stage !== "report" || quest.issuer.npcId !== npcId)
    return { ok: false, text: "当前没有可领取的生成任务奖励。" };
  const reward = quest.reward;
  actor.exp += reward.exp;
  actor.potential += reward.potential;
  actor.gold += reward.gold;
  if (reward.item) {
    const key = `${reward.item.kind}:${reward.item.id}`;
    actor.inventory[key] = (actor.inventory[key] || 0) + reward.item.amount;
  }
  tasks.generatedQuestHistory.push(
    generatedQuestHistoryEntry(quest, tasks.clock),
  );
  tasks.generatedQuest = null;
  tasks.generatedQuestOfferMisses = 0;
  // Every terminal outcome immediately reopens discovery: the next eligible
  // NPC can offer another quest after one complete NPC/player exchange.
  tasks.generatedQuestNextOfferAt = tasks.clock;
  return {
    ok: true,
    text: `获得经验 ${reward.exp}、潜能 ${reward.potential}、银两 ${reward.gold}${reward.item ? `，以及${reward.item.name}` : ""}。`,
  };
}

export function generatedQuestObjective(quest: GeneratedQuest) {
  if (quest.stage === "accepted") return quest.premise;
  if (quest.stage === "failed") return "任务已经失败，可在任务簿中清除。";
  if (quest.stage === "report") return `回到${quest.issuer.mapName}向${quest.issuer.name}复命。`;
  if (quest.kind === "duel")
    return quest.stage === "defeated"
      ? `听完${quest.issuer.name}的战后交代，再向其领取奖励。`
      : `与${quest.issuer.name}开始安全切磋。`;
  if (quest.kind === "visit")
    return `前往${quest.target.mapName}拜访${quest.target.name}并交谈。`;
  if (quest.stage === "defeated")
    return `听完${quest.target.name}的战后交代，再回${quest.issuer.mapName}向${quest.issuer.name}复命。`;
  return `前往${quest.target.mapName}找到${quest.target.name}并安全击败对方。`;
}

export function generatedQuestPrompt(quest: GeneratedQuest, currentNpcId: number) {
  const transcript = quest.transcript.slice(-10).map((entry) => {
    const speaker = entry.speaker === "player"
      ? "玩家"
      : entry.speaker === "npc"
        ? npcLore(entry.npcId || currentNpcId).name
        : "任务记录";
    return `${speaker}：${entry.speech}`;
  }).join("\n");
  return `【当前生成任务·不可改写】${quest.title}\n【任务缘由】${quest.premise}\n【发布人】${quest.issuer.name}，位于${quest.issuer.mapName}\n【目标】${quest.target.name}，位于${quest.target.mapName}\n【当前阶段】${quest.stage}\n【当前目标】${generatedQuestObjective(quest)}\n【固定奖励】经验${quest.reward.exp}、潜能${quest.reward.potential}、银两${quest.reward.gold}${quest.reward.item ? `、${quest.reward.item.name}` : ""}\n${transcript ? `【最近任务对话】\n${transcript}` : ""}\n规则：你只能用对白承接这条已经确定的任务，不得更换人物、地点、奖励、胜负或任务阶段，也不得宣称尚未发生的战斗已经完成。`;
}

export function generatedQuestFallbackText(quest: GeneratedQuest, npcId: number) {
  if (quest.stage === "report" && npcId === quest.issuer.npcId)
    return `${quest.issuer.name}确认你已经办妥此事，请领取约定的报酬。`;
  if (npcId === quest.target.npcId) {
    if (quest.kind === "visit")
      return `${quest.target.name}已经听明来意，请你回${quest.issuer.mapName}向${quest.issuer.name}复命。`;
    if (quest.stage === "defeated")
      return `${quest.target.name}认下这场胜负，请你回去向${quest.issuer.name}复命。`;
    return `${quest.target.name}已经听明来意，准备与你进行一场点到为止的切磋。`;
  }
  if (npcId === quest.issuer.npcId)
    return `此事尚未办妥：${generatedQuestObjective(quest)}办好再来见我。`;
  return quest.premise;
}
