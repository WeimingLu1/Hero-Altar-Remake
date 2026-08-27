export type AmbientBubbleKind = "speech" | "action";

export type AmbientNpc = {
  eventId: number;
  npcId: number;
  name: string;
  identity: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  direction: 2 | 4 | 6 | 8;
  bubble: string;
  bubbleKind: AmbientBubbleKind;
  bubbleUntil: number;
  bubbleShownAt: number;
  generationPending: boolean;
  queuedAt: number;
  speechTargetName: string;
  /** Exact runtime target when multiple visible events share one display name. */
  speechTargetEventId?: number;
  nextBehaviorAt: number;
  partnerId: number;
  conversationTurn: number;
  conversationRound: number;
  conversationContext: string[];
  llmRequested: boolean;
  lastPartnerId: number;
  partnerCooldownUntil: number;
  waitingForPlayer: boolean;
  /** 预取缓冲的下一对台词，双方成员镜像持有（轮转时读取 A 一份为准）。 */
  nextPair?: { a: string; b: string };
  /** 预取请求是否在途（区别于 generationPending 的"当前轮"）。 */
  nextPairPending?: boolean;
  /** 排队中的接续台词：上一句展示到 at 后由 tick 提升上屏，形成一问一答的先后节奏。 */
  queuedLine?: { text: string; at: number };
  /** 对话自然结束后先走开的时间点；期间只朝远离最后搭档的方向走，不组对/不独白/不动作。 */
  departUntil: number;
  /** 走开时远离的参照点（最后搭档的位置）。 */
  departFrom?: { x: number; y: number };
};

export type AmbientWorld = {
  mapId: number;
  npcs: AmbientNpc[];
  /** Runtime-only indexes. They point at the mutable NPC objects in `npcs`. */
  byEventId?: Map<number, AmbientNpc>;
  byName?: Map<string, AmbientNpc[]>;
};

function ensureAmbientIndexes(world: AmbientWorld) {
  if (!world.byEventId)
    world.byEventId = new Map(world.npcs.map((npc) => [npc.eventId, npc]));
  if (!world.byName) {
    world.byName = new Map();
    for (const npc of world.npcs) {
      const matches = world.byName.get(npc.name) || [];
      matches.push(npc);
      world.byName.set(npc.name, matches);
    }
  }
}

export function ambientNpcByEventId(world: AmbientWorld, eventId: number) {
  ensureAmbientIndexes(world);
  return world.byEventId?.get(eventId);
}

export function ambientNpcsByName(world: AmbientWorld, name: string) {
  ensureAmbientIndexes(world);
  return world.byName?.get(name) || [];
}

export function ambientNpcByName(
  world: AmbientWorld,
  name: string,
  options: {
    preferredEventIds?: readonly number[];
    near?: { x: number; y: number };
    excludeEventId?: number;
  } = {},
) {
  const matches = ambientNpcsByName(world, name).filter(
    (npc) => npc.eventId !== options.excludeEventId,
  );
  if (!matches.length) return undefined;
  if (!options.preferredEventIds?.length && !options.near) return matches[0];
  const preferredOrder = new Map(
    (options.preferredEventIds || []).map((eventId, index) => [eventId, index]),
  );
  const distance = (npc: AmbientNpc) => options.near
    ? Math.max(Math.abs(npc.x - options.near.x), Math.abs(npc.y - options.near.y))
    : 0;
  return [...matches].sort((first, second) => {
    const firstPreferred = preferredOrder.get(first.eventId),
      secondPreferred = preferredOrder.get(second.eventId);
    if (firstPreferred !== undefined || secondPreferred !== undefined) {
      if (firstPreferred === undefined) return 1;
      if (secondPreferred === undefined) return -1;
      if (firstPreferred !== secondPreferred) return firstPreferred - secondPreferred;
    }
    return distance(first) - distance(second) || first.eventId - second.eventId;
  })[0];
}

export type AmbientViewport = { left: number; top: number; right: number; bottom: number };

export function ambientViewportBounds(mapWidth: number, mapHeight: number, playerX: number, playerY: number): AmbientViewport {
  const left = Math.max(0, Math.min(Math.max(0, mapWidth - 20), playerX - 10)),
    top = Math.max(0, Math.min(Math.max(0, mapHeight - 15), playerY - 7));
  return { left, top, right: Math.min(mapWidth, left + 20), bottom: Math.min(mapHeight, top + 15) };
}

export function ambientNpcInViewport(npc: Pick<AmbientNpc, "x" | "y">, viewport: AmbientViewport) {
  return npc.x >= viewport.left && npc.x < viewport.right && npc.y >= viewport.top && npc.y < viewport.bottom;
}

/**
 * 当前视野内纯 NPC 一对一会话数（玩家参与的不计）。
 * 每对只由 eventId 较小的一方计数。
 */
export function countActiveNpcConversations(
  world: AmbientWorld,
  viewport: AmbientViewport,
  pausedIds: ReadonlySet<number> = new Set(),
) {
  let pairs = 0;
  for (const item of world.npcs) {
    if (!ambientNpcInViewport(item, viewport) || pausedIds.has(item.eventId)) continue;
    if (item.partnerId > 0 && item.eventId < item.partnerId) {
      pairs += 1;
    }
  }
  return pairs;
}

export function resetAmbientSessions(world: AmbientWorld, resumeAt: number) {
  for (const npc of world.npcs) {
    npc.partnerId = 0;
    npc.conversationTurn = 0; npc.conversationRound = 0; npc.lastPartnerId = 0;
    npc.bubble = ""; npc.generationPending = false; npc.llmRequested = true;
    npc.speechTargetName = ""; npc.speechTargetEventId = 0; npc.conversationContext = []; npc.nextPair = undefined; npc.nextPairPending = false; npc.queuedLine = undefined; npc.departUntil = 0; npc.departFrom = undefined; npc.nextBehaviorAt = resumeAt;
  }
}

function resetAmbientConversationMember(npc: AmbientNpc, resumeAt: number) {
  npc.partnerId = 0;
  npc.conversationTurn = 0;
  npc.conversationRound = 0;
  npc.bubble = "";
  npc.bubbleUntil = 0;
  npc.generationPending = false;
  npc.llmRequested = true;
  npc.speechTargetName = "";
  npc.speechTargetEventId = 0;
  npc.conversationContext = [];
  npc.nextPair = undefined;
  npc.nextPairPending = false;
  npc.queuedLine = undefined;
  npc.departUntil = 0;
  npc.departFrom = undefined;
  npc.nextBehaviorAt = resumeAt;
}

/**
 * 解除某个 NPC 当前的一对一会话。玩家接管、离屏、模型失败和主动中断都
 * 走同一条清理边界，避免只清一方后留下幽灵搭档或旧气泡。
 */
export function clearAmbientNpcConversation(
  world: AmbientWorld,
  eventId: number,
  resumeAt: number,
  cooldownUntil = 0,
) {
  const npc = ambientNpcByEventId(world, eventId);
  if (!npc) return [] as number[];
  const partner = npc.partnerId ? ambientNpcByEventId(world, npc.partnerId) : undefined,
    npcId = npc.eventId,
    partnerId = partner?.eventId || 0;
  resetAmbientConversationMember(npc, resumeAt);
  if (partner && partner.partnerId === npcId) resetAmbientConversationMember(partner, resumeAt);
  if (cooldownUntil > 0 && partner) {
    npc.lastPartnerId = partnerId;
    npc.partnerCooldownUntil = cooldownUntil;
    partner.lastPartnerId = npcId;
    partner.partnerCooldownUntil = cooldownUntil;
  }
  return partner ? [npcId, partnerId] : [npcId];
}

/** 双人会话前几轮不掷散场骰；此后每轮按 PAIR_END_PERCENT 概率成为最后一轮。 */
export const PAIR_MIN_ROUNDS = 4;
export const PAIR_END_PERCENT = 15;
/** 屏幕上最多同时进行的纯 NPC 对话会话数；玩家参与时降为 1。 */
export const MAX_NPC_CONVERSATIONS = 2;
export const MAX_NPC_CONVERSATIONS_WITH_PLAYER = 1;
/** 头顶气泡固定停留时长（毫秒）；新台词到达即替换。 */
export const AMBIENT_BUBBLE_MS = 8000;
/**
 * 单句台词的滞留时长：按长度伸缩保证可读——短句至少 2.8 秒，
 * 长句封顶 6 秒；双人对话两句先后显示，各自按此停留。
 */
export function ambientBubbleDwellMs(text: string) {
  const length = text.replace(/\s/g, "").length;
  return Math.min(6000, Math.max(2800, 2200 + length * 42));
}
/** NPC 离开出生点的最大活动半径（格）。 */
export const AMBIENT_HOME_RADIUS = 15;
/** 对话自然结束后先走开的时间窗（毫秒），期间不组对。 */
export const AMBIENT_DEPART_MS = 3000;

const hash = (value: number) => {
  let next = value | 0;
  next = Math.imul(next ^ (next >>> 16), 0x45d9f3b);
  next = Math.imul(next ^ (next >>> 16), 0x45d9f3b);
  return (next ^ (next >>> 16)) >>> 0;
};

/**
 * 双人会话散场骰子。用 mapId、双方较小 eventId 与轮次做确定性种子，
 * 与 now 无关——调度时刻与轮转时刻算同一值，跨 tick 稳定且可测。
 */
export function pairConversationSeed(
  mapId: number,
  aEventId: number,
  bEventId: number,
  round: number,
) {
  return hash(mapId * 17 + Math.min(aEventId, bEventId) * 131 + round * 7919);
}

/** 第 PAIR_MIN_ROUNDS 轮起，每轮按 PAIR_END_PERCENT 概率成为最后一轮。 */
export function pairConversationShouldEnd(
  mapId: number,
  aEventId: number,
  bEventId: number,
  round: number,
) {
  return (
    round >= PAIR_MIN_ROUNDS &&
    pairConversationSeed(mapId, aEventId, bEventId, round) % 100 < PAIR_END_PERCENT
  );
}

export function createAmbientWorld(
  mapId: number,
  now: number,
  entries: Array<{ eventId: number; npcId: number; name: string; identity: string; x: number; y: number }>,
): AmbientWorld {
  const world: AmbientWorld = {
    mapId,
    npcs: entries.map((entry, index) => ({
      ...entry,
      homeX: entry.x,
      homeY: entry.y,
      direction: 2,
      bubble: "",
      bubbleKind: "speech",
      bubbleUntil: 0,
      bubbleShownAt: 0,
      generationPending: false,
      queuedAt: 0,
      speechTargetName: "",
      speechTargetEventId: 0,
      nextBehaviorAt: now + 700 + (hash(mapId * 97 + entry.eventId * 31 + index) % 2400),
      partnerId: 0,
      conversationTurn: 0,
      conversationRound: 0,
      conversationContext: [],
      llmRequested: true,
      lastPartnerId: 0,
      partnerCooldownUntil: 0,
      waitingForPlayer: false,
      nextPair: undefined,
      nextPairPending: false,
      queuedLine: undefined,
      departUntil: 0,
      departFrom: undefined,
    })),
  };
  ensureAmbientIndexes(world);
  return world;
}

export function ambientNpcAt(world: AmbientWorld, x: number, y: number) {
  return world.npcs.find((npc) => npc.x === x && npc.y === y);
}

export function ambientNpcInPlayerRange(
  npc: AmbientNpc,
  playerX: number,
  playerY: number,
  radiusX = 10,
  radiusY = 7,
) {
  const dx = npc.x - playerX, dy = npc.y - playerY;
  return dx >= -radiusX && dx < radiusX && dy >= -radiusY && dy <= radiusY;
}

export function ambientCanHear(first: { x: number; y: number }, second: { x: number; y: number }) {
  return Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y)) <= 1;
}

export function tickAmbientWorld(options: {
  world: AmbientWorld;
  now: number;
  playerX: number;
  playerY: number;
  indoor: boolean;
  viewport?: AmbientViewport;
  pausedConversationNpcIds?: number[];
  canEnter: (npc: AmbientNpc, x: number, y: number) => boolean;
}) {
  const { world, now, playerX, playerY, canEnter } = options,
    viewport = options.viewport || { left: playerX - 10, top: playerY - 7, right: playerX + 10, bottom: playerY + 8 },
    pausedConversationNpcIds = new Set(options.pausedConversationNpcIds || []),
    isActive = (npc: AmbientNpc) => ambientNpcInViewport(npc, viewport);
  const faceToward = (from: AmbientNpc, to: AmbientNpc) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    from.direction = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 4 : 6) : (dy < 0 ? 8 : 2);
  };
  const stepToward = (from: AmbientNpc, to: AmbientNpc) => {
    const choices = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
      ? [[Math.sign(to.x - from.x), 0], [0, Math.sign(to.y - from.y)]]
      : [[0, Math.sign(to.y - from.y)], [Math.sign(to.x - from.x), 0]];
    for (const [dx, dy] of choices) {
      if (!dx && !dy) continue;
      const x = from.x + dx, y = from.y + dy;
      if (canEnter(from, x, y)) {
        from.x = x; from.y = y;
        from.direction = dx < 0 ? 4 : dx > 0 ? 6 : dy < 0 ? 8 : 2;
        return true;
      }
    }
    faceToward(from, to);
    return false;
  };
  for (const npc of world.npcs.filter((item) => !isActive(item))) {
    clearAmbientNpcConversation(world, npc.eventId, now + 700);
    npc.x = npc.homeX;
    npc.y = npc.homeY;
    npc.waitingForPlayer = false;
  }
  for (const npc of world.npcs) {
    if (!isActive(npc)) continue;
    // 逐句显示：上一句展示完毕，把排队的接续台词提升上屏。
    // bubbleUntil 覆盖整个回合窗口，轮转推进与预取调度不受影响。
    if (npc.queuedLine && now >= npc.queuedLine.at) {
      const partner = npc.partnerId
        ? ambientNpcByEventId(world, npc.partnerId)
        : undefined;
      // 严格轮次锁：乙句上屏前先撤掉甲句，任何时刻只留一个会话气泡。
      if (partner) partner.bubble = "";
      npc.bubble = npc.queuedLine.text;
      npc.bubbleKind = "speech";
      npc.bubbleShownAt = now;
      npc.queuedLine = undefined;
    }
    const playerDistance = Math.abs(npc.x - playerX) + Math.abs(npc.y - playerY);
    if (playerDistance <= 2) {
      npc.waitingForPlayer = true;
      if (!npc.partnerId && !npc.bubble) continue;
    }
    if (playerDistance > 2 && npc.waitingForPlayer) {
      npc.waitingForPlayer = false;
      npc.bubble = "";
      npc.nextBehaviorAt = now + 450;
    }
    // 统一守卫：partnerId 指向已不存在的人物时立即清理，避免任何 turn 卡死。
    if (npc.partnerId && !ambientNpcByEventId(world, npc.partnerId)) {
      npc.partnerId = 0; npc.speechTargetName = ""; npc.speechTargetEventId = 0; npc.conversationTurn = 0; npc.conversationRound = 0;
      npc.conversationContext = []; npc.generationPending = false; npc.nextPair = undefined; npc.nextPairPending = false; npc.queuedLine = undefined; npc.departUntil = 0; npc.departFrom = undefined; npc.nextBehaviorAt = now + 700;
      continue;
    }
    if (npc.partnerId && npc.conversationTurn === 0) {
      if (pausedConversationNpcIds.has(npc.eventId)) continue;
      const partner = ambientNpcByEventId(world, npc.partnerId)!;
      if (!ambientCanHear(npc, partner)) {
        stepToward(npc, partner);
        npc.nextBehaviorAt = now + 500;
        continue;
      }
      faceToward(npc, partner);
      faceToward(partner, npc);
      if (npc.eventId < partner.eventId) {
        npc.conversationTurn = 1;
        npc.conversationRound = partner.conversationRound = 1;
        npc.conversationContext = partner.conversationContext = [];
        partner.conversationTurn = 2;
        npc.bubble = ""; npc.speechTargetName = partner.name; npc.speechTargetEventId = partner.eventId; npc.generationPending = true; npc.queuedAt = now;
        partner.speechTargetName = npc.name; partner.speechTargetEventId = npc.eventId;
        npc.bubbleKind = partner.bubbleKind = "speech";
        npc.bubbleUntil = now + 12000;
        partner.bubbleUntil = now + 20000;
        npc.llmRequested = false;
        partner.llmRequested = true;
      }
      continue;
    }
    if (npc.partnerId && npc.conversationTurn === 2 && npc.bubbleUntil <= now) {
      if (pausedConversationNpcIds.has(npc.eventId)) continue;
      if (npc.generationPending) continue;
      const partner = ambientNpcByEventId(world, npc.partnerId)!;
      const round = npc.conversationRound;
      // 散场判定是确定性纯函数：调度时刻与此刻算同一值，无需存储标志。
      if (pairConversationShouldEnd(world.mapId, partner.eventId, npc.eventId, round)) {
        // END：本轮是最后一轮，双方散场并进入冷却；随后各自走开，不原地接着聊。
        partner.nextPair = npc.nextPair = undefined;
        partner.nextPairPending = npc.nextPairPending = false;
        partner.generationPending = false;
        npc.bubble = ""; npc.queuedLine = undefined; npc.partnerId = 0; npc.speechTargetName = ""; npc.speechTargetEventId = 0; npc.conversationTurn = 0; npc.conversationRound = 0; npc.conversationContext = [];
        npc.lastPartnerId = partner.eventId; npc.partnerCooldownUntil = now + 30000; npc.nextBehaviorAt = now + 300;
        npc.departUntil = now + AMBIENT_DEPART_MS; npc.departFrom = { x: partner.x, y: partner.y };
        partner.bubble = ""; partner.queuedLine = undefined; partner.partnerId = 0; partner.speechTargetName = ""; partner.speechTargetEventId = 0; partner.conversationTurn = 0; partner.conversationRound = 0; partner.conversationContext = [];
        partner.lastPartnerId = npc.eventId; partner.partnerCooldownUntil = now + 30000; partner.nextBehaviorAt = now + 300;
        partner.departUntil = now + AMBIENT_DEPART_MS; partner.departFrom = { x: npc.x, y: npc.y };
        continue;
      }
      if (partner.nextPair) {
        // PROMOTE：预取就绪，进入下一轮。台词逐句显示：a 先上屏并按长度
        // 滞留，b 排队等 a 展示完再由 tick 提升——符合自然交谈的先后节奏。
        const { a, b } = partner.nextPair;
        const dwellA = ambientBubbleDwellMs(a),
          dwellB = ambientBubbleDwellMs(b);
        partner.nextPair = npc.nextPair = undefined;
        partner.nextPairPending = npc.nextPairPending = false;
        partner.conversationRound = npc.conversationRound = round + 1;
        partner.conversationTurn = 1; npc.conversationTurn = 2;
        partner.speechTargetName = npc.name; partner.speechTargetEventId = npc.eventId;
        npc.speechTargetName = partner.name; npc.speechTargetEventId = partner.eventId;
        partner.bubble = a; partner.bubbleShownAt = now; partner.bubbleKind = "speech";
        npc.bubble = ""; npc.queuedLine = { text: b, at: now + dwellA };
        partner.bubbleUntil = npc.bubbleUntil = now + dwellA + dwellB;
        const nextContext = [...npc.conversationContext, a, b].filter(Boolean).slice(-8);
        partner.conversationContext = npc.conversationContext = nextContext;
        // 调度下一轮预取（下一轮仍会被允许时才发起）。
        if (!pairConversationShouldEnd(world.mapId, partner.eventId, npc.eventId, round + 1)) {
          partner.nextPairPending = npc.nextPairPending = true;
          partner.generationPending = true; partner.llmRequested = false; partner.queuedAt = now;
        } else {
          partner.generationPending = false;
        }
        continue;
      }
      if (partner.nextPairPending) {
        // WAIT：预取在途，不推进、不双请求；超时后落到 on-demand。
        npc.bubble = "";
        if (now - (partner.queuedAt || 0) <= 20000) continue;
        partner.nextPairPending = npc.nextPairPending = false;
        partner.generationPending = false;
      }
      // ON-DEMAND：首轮或预取失败/超时，现用现请求；完成时由 hook 同时写双方气泡。
      partner.conversationRound = npc.conversationRound = round + 1;
      partner.conversationTurn = 1; npc.conversationTurn = 2;
      partner.bubble = ""; npc.bubble = ""; 
      partner.speechTargetName = npc.name; partner.speechTargetEventId = npc.eventId;
      npc.speechTargetName = partner.name; npc.speechTargetEventId = partner.eventId;
      partner.generationPending = true; partner.queuedAt = now;
      partner.bubbleUntil = now + 12000; npc.bubbleUntil = now + 20000;
      partner.llmRequested = false; npc.llmRequested = true;
      continue;
    }
    if (npc.bubbleUntil <= now) {
      npc.bubble = "";
    }
    if (npc.partnerId || npc.bubble || npc.generationPending || now < npc.nextBehaviorAt) continue;

    const seed = hash(Math.floor(now / 1000) + npc.eventId * 131 + world.mapId * 17);
    // 对话刚结束：先朝远离最后搭档的方向走开，期间不组对/不独白/不动作。
    if (now < npc.departUntil && npc.departFrom) {
      const awayFrom = npc.departFrom,
        awayDirs: Array<[number, number, 2 | 4 | 6 | 8]> = [[0, 1, 2], [-1, 0, 4], [1, 0, 6], [0, -1, 8]],
        awayDist = (dx: number, dy: number) => Math.abs(npc.x + dx - awayFrom.x) + Math.abs(npc.y + dy - awayFrom.y);
      for (const [dx, dy, direction] of awayDirs.slice().sort((a, b) => awayDist(b[0], b[1]) - awayDist(a[0], a[1]))) {
        const x = npc.x + dx, y = npc.y + dy;
        if (Math.abs(x - npc.homeX) > AMBIENT_HOME_RADIUS || Math.abs(y - npc.homeY) > AMBIENT_HOME_RADIUS) continue;
        if (x === playerX && y === playerY) continue;
        if (canEnter(npc, x, y)) { npc.x = x; npc.y = y; npc.direction = direction; break; }
      }
      npc.nextBehaviorAt = now + 300 + seed % 500;
      continue;
    }
    // 偶遇：发现距离每步随机(8–12)，并在候选里随机挑人，而不是永远找最近者。
    const meetRadius = 8 + (seed >>> 5) % 5,
      nearbyCandidates = world.npcs.filter((other) =>
        isActive(other) && other.eventId !== npc.eventId && !other.partnerId && !other.bubble &&
        !other.generationPending && !other.waitingForPlayer &&
        Math.abs(other.x - npc.x) + Math.abs(other.y - npc.y) <= meetRadius &&
        !(npc.lastPartnerId === other.eventId && npc.partnerCooldownUntil > now) &&
        Math.abs(other.x - playerX) + Math.abs(other.y - playerY) > 2,
      ).slice(0, 6),
      nearby = nearbyCandidates.length ? nearbyCandidates[(seed >>> 9) % nearbyCandidates.length] : undefined;
    if (nearby && seed % 2 === 0) {
      // 会话并发上限：玩家参与时降为 1，否则最多 2 组；满则软排队稍后重试。
      const cap = pausedConversationNpcIds.size > 0
        ? MAX_NPC_CONVERSATIONS_WITH_PLAYER
        : MAX_NPC_CONVERSATIONS;
      if (countActiveNpcConversations(world, viewport, pausedConversationNpcIds) >= cap) {
        npc.nextBehaviorAt = now + 1500 + seed % 1500;
        continue;
      }
      npc.partnerId = nearby.eventId;
      nearby.partnerId = npc.eventId;
      npc.conversationTurn = 0;
      nearby.conversationTurn = 0;
      npc.conversationContext = nearby.conversationContext = [];
      npc.bubble = "";
      nearby.bubble = "";
      npc.nextBehaviorAt = nearby.nextBehaviorAt = now + 500;
      continue;
    }
    if (seed % 3 === 0) {
      npc.bubble = "";
      npc.speechTargetName = "";
      npc.speechTargetEventId = 0;
      npc.bubbleKind = "action";
      npc.bubbleUntil = now + 12000;
      npc.llmRequested = false; npc.generationPending = true; npc.queuedAt = now;
      npc.nextBehaviorAt = now + 5500 + seed % 5500;
      continue;
    }
    if (seed % 4 === 0) {
      npc.bubble = "";
      npc.speechTargetName = "";
      npc.speechTargetEventId = 0;
      npc.bubbleKind = "speech";
      npc.bubbleUntil = now + 12000;
      npc.llmRequested = false; npc.generationPending = true; npc.queuedAt = now;
      npc.nextBehaviorAt = now + 7000 + seed % 7000;
      continue;
    }

    const directions = [[0, 1, 2], [-1, 0, 4], [1, 0, 6], [0, -1, 8]] as const;
    for (let offset = 0; offset < directions.length; offset++) {
      const [dx, dy, direction] = directions[(seed + offset) % directions.length],
        x = npc.x + dx,
        y = npc.y + dy;
      if (Math.abs(x - npc.homeX) > AMBIENT_HOME_RADIUS || Math.abs(y - npc.homeY) > AMBIENT_HOME_RADIUS) continue;
      if (x === playerX && y === playerY) continue;
      if (canEnter(npc, x, y)) {
        npc.x = x; npc.y = y; npc.direction = direction;
        break;
      }
    }
    npc.nextBehaviorAt = now + 250 + seed % 500;
  }
  return world;
}
