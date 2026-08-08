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
  queuedBubble: string;
  bubbleKind: AmbientBubbleKind;
  bubbleUntil: number;
  bubbleShownAt: number;
  generationPending: boolean;
  queuedAt: number;
  speechTargetName: string;
  nextBehaviorAt: number;
  partnerId: number;
  conversationTurn: number;
  conversationRound: number;
  conversationContext: string[];
  llmRequested: boolean;
  lastPartnerId: number;
  partnerCooldownUntil: number;
  waitingForPlayer: boolean;
  groupId: number;
  groupMembers: number[];
  groupTurn: number;
  groupNextAt: number;
};

export type AmbientWorld = {
  mapId: number;
  npcs: AmbientNpc[];
};

export type AmbientViewport = { left: number; top: number; right: number; bottom: number };

export function ambientViewportBounds(mapWidth: number, mapHeight: number, playerX: number, playerY: number): AmbientViewport {
  const left = Math.max(0, Math.min(Math.max(0, mapWidth - 20), playerX - 10)),
    top = Math.max(0, Math.min(Math.max(0, mapHeight - 15), playerY - 7));
  return { left, top, right: Math.min(mapWidth, left + 20), bottom: Math.min(mapHeight, top + 15) };
}

export function ambientNpcInViewport(npc: Pick<AmbientNpc, "x" | "y">, viewport: AmbientViewport) {
  return npc.x >= viewport.left && npc.x < viewport.right && npc.y >= viewport.top && npc.y < viewport.bottom;
}

export function resetAmbientSessions(world: AmbientWorld, resumeAt: number) {
  for (const npc of world.npcs) {
    npc.partnerId = 0; npc.groupId = 0; npc.groupMembers = []; npc.groupTurn = -1; npc.groupNextAt = 0;
    npc.conversationTurn = 0; npc.conversationRound = 0; npc.lastPartnerId = 0;
    npc.bubble = ""; npc.queuedBubble = ""; npc.generationPending = false; npc.llmRequested = true;
    npc.speechTargetName = ""; npc.conversationContext = []; npc.nextBehaviorAt = resumeAt;
  }
}

const hash = (value: number) => {
  let next = value | 0;
  next = Math.imul(next ^ (next >>> 16), 0x45d9f3b);
  next = Math.imul(next ^ (next >>> 16), 0x45d9f3b);
  return (next ^ (next >>> 16)) >>> 0;
};

export function createAmbientWorld(
  mapId: number,
  now: number,
  entries: Array<{ eventId: number; npcId: number; name: string; identity: string; x: number; y: number }>,
): AmbientWorld {
  return {
    mapId,
    npcs: entries.map((entry, index) => ({
      ...entry,
      homeX: entry.x,
      homeY: entry.y,
      direction: 2,
      bubble: "",
      queuedBubble: "",
      bubbleKind: "speech",
      bubbleUntil: 0,
      bubbleShownAt: 0,
      generationPending: false,
      queuedAt: 0,
      speechTargetName: "",
      nextBehaviorAt: now + 700 + (hash(mapId * 97 + entry.eventId * 31 + index) % 2400),
      partnerId: 0,
      conversationTurn: 0,
      conversationRound: 0,
      conversationContext: [],
      llmRequested: true,
      lastPartnerId: 0,
      partnerCooldownUntil: 0,
      waitingForPlayer: false,
      groupId: 0,
      groupMembers: [],
      groupTurn: -1,
      groupNextAt: 0,
    })),
  };
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
  const clearGroup = (member: AmbientNpc, resumeAt: number) => {
    const memberIds = new Set([...member.groupMembers, member.eventId]);
    for (const item of world.npcs.filter((candidate) => memberIds.has(candidate.eventId))) {
      item.bubble = ""; item.queuedBubble = ""; item.generationPending = false; item.speechTargetName = ""; item.groupId = 0; item.groupMembers = [];
      item.groupTurn = -1; item.groupNextAt = 0; item.nextBehaviorAt = resumeAt; item.conversationContext = [];
      item.partnerCooldownUntil = now + 30000;
    }
  };
  for (const npc of world.npcs.filter((item) => !isActive(item))) {
    if (npc.groupId) clearGroup(npc, now + 700);
    if (npc.partnerId) {
      const partner = world.npcs.find((item) => item.eventId === npc.partnerId);
      if (partner) {
        partner.partnerId = 0; partner.conversationTurn = 0; partner.conversationRound = 0;
        partner.conversationContext = []; partner.bubble = ""; partner.queuedBubble = ""; partner.generationPending = false; partner.speechTargetName = "";
        partner.nextBehaviorAt = now + 700;
      }
    }
    npc.x = npc.homeX; npc.y = npc.homeY; npc.partnerId = 0; npc.conversationTurn = 0; npc.conversationRound = 0; npc.conversationContext = [];
    npc.bubble = ""; npc.queuedBubble = ""; npc.generationPending = false; npc.speechTargetName = ""; npc.waitingForPlayer = false; npc.nextBehaviorAt = now + 700;
  }
  for (const npc of world.npcs) {
    if (!isActive(npc)) continue;
    const playerDistance = Math.abs(npc.x - playerX) + Math.abs(npc.y - playerY);
    if (playerDistance <= 2) {
      npc.waitingForPlayer = true;
      if (!npc.groupId && !npc.partnerId && !npc.bubble) continue;
    }
    if (playerDistance > 2 && npc.waitingForPlayer) {
      npc.waitingForPlayer = false;
      npc.bubble = "";
      npc.nextBehaviorAt = now + 450;
    }
    if (npc.groupId) {
      const members = npc.groupMembers.map((id) => world.npcs.find((item) => item.eventId === id)).filter((item): item is AmbientNpc => Boolean(item)),
        leader = members.reduce((first, item) => item.eventId < first.eventId ? item : first, members[0] || npc);
      if (members.length < 2 || !members.some((item) => item.eventId === npc.eventId)) {
        clearGroup(npc, now + 700);
        continue;
      }
      // Every member freezes while the player owns this conversation. Previously
      // only the leader paused, allowing other participants to walk out of range.
      if (members.some((item) => pausedConversationNpcIds.has(item.eventId))) continue;
      if (npc.eventId !== leader.eventId) {
        if (!ambientCanHear(npc, leader)) stepToward(npc, leader);
        else faceToward(npc, leader);
        continue;
      }
      // The player has joined this circle: freeze the NPC turn cursor until the
      // player's visible reply finishes, so nobody talks over the current turn.
      if (members.some((item) => item.generationPending)) continue;
      if (members.some((item) => item.eventId !== leader.eventId && !ambientCanHear(item, leader))) continue;
      if (leader.groupTurn < 0) {
        leader.groupTurn = 0;
        const target = members.find((item) => item.eventId !== leader.eventId) || leader;
        leader.bubble = ""; leader.speechTargetName = target.name; leader.generationPending = true; leader.queuedAt = now;
        leader.conversationContext = [];
        leader.bubbleKind = "speech"; leader.bubbleUntil = now + 12000; leader.groupNextAt = leader.bubbleUntil; leader.llmRequested = false;
        faceToward(leader, target); faceToward(target, leader);
        continue;
      }
      if (now >= leader.groupNextAt) {
        const visibleBubble = members.find((item) => item.bubble)?.bubble;
        if (visibleBubble && leader.conversationContext.at(-1) !== visibleBubble)
          leader.conversationContext = [...leader.conversationContext, visibleBubble].slice(-6);
        members.forEach((item) => { item.bubble = ""; });
        const nextTurn = leader.groupTurn + 1,
          previousSpeakerName = leader.conversationContext.at(-1)?.match(/^(.+?) to /)?.[1] || members[Math.min(nextTurn - 1, members.length - 1)].name,
          previousSpeakerIsMember = members.some((item) => item.name === previousSpeakerName);
        // If the player spoke after the nominal last NPC turn, answer once before closing.
        if (nextTurn >= members.length && previousSpeakerIsMember) { clearGroup(leader, now + 450); continue; }
        const speaker = nextTurn >= members.length ? leader : members[nextTurn],
          target = members.find((item) => item.name === previousSpeakerName);
        if (target && !ambientCanHear(speaker, target)) {
          stepToward(speaker, target);
          leader.groupNextAt = now + 500;
          continue;
        }
        speaker.bubble = ""; speaker.speechTargetName = previousSpeakerName; speaker.generationPending = true; speaker.queuedAt = now;
        speaker.bubbleKind = "speech"; speaker.bubbleUntil = now + 12000; speaker.llmRequested = false;
        if (target) { faceToward(speaker, target); faceToward(target, speaker); }
        leader.groupTurn = nextTurn; leader.groupNextAt = speaker.bubbleUntil;
      }
      continue;
    }
    if (npc.partnerId && npc.conversationTurn === 0) {
      if (pausedConversationNpcIds.has(npc.eventId)) continue;
      const partner = world.npcs.find((item) => item.eventId === npc.partnerId);
      if (!partner) {
        npc.partnerId = 0; npc.speechTargetName = ""; npc.conversationTurn = 0; npc.conversationRound = 0;
        npc.conversationContext = []; npc.generationPending = false; npc.nextBehaviorAt = now + 700;
        continue;
      }
      if (!ambientCanHear(npc, partner)) {
        stepToward(npc, partner);
        npc.nextBehaviorAt = now + 500;
        continue;
      }
      faceToward(npc, partner);
      faceToward(partner, npc);
      if (npc.eventId < partner.eventId) {
        // 候选 = 发起者听觉圈内的活跃 NPC(含当前双人)。
        // 只有所有候选彼此都在对方 3×3 听觉圈内才组成群聊；人数不设上限。
        const candidates = world.npcs.filter((item) => isActive(item) && !item.groupId && (!item.partnerId || item.eventId === npc.eventId || item.eventId === partner.eventId) && ambientCanHear(npc, item));
        const mutuallyHeard =
          candidates.length >= 3 &&
          candidates.every((a) => candidates.every((b) => ambientCanHear(a, b)));
        if (mutuallyHeard) {
          const members = candidates, ids = members.map((item) => item.eventId), groupId = Math.min(...ids);
          for (const member of members) {
            member.groupId = groupId; member.groupMembers = ids; member.groupTurn = -1; member.groupNextAt = 0;
            member.partnerId = 0; member.conversationTurn = 0; member.bubble = ""; member.nextBehaviorAt = now + 300;
          }
          continue;
        }
        npc.conversationTurn = 1;
        npc.conversationRound = partner.conversationRound = 1;
        npc.conversationContext = partner.conversationContext = [];
        partner.conversationTurn = 2;
        npc.bubble = ""; npc.speechTargetName = partner.name; npc.generationPending = true; npc.queuedAt = now;
        partner.queuedBubble = ""; partner.speechTargetName = npc.name;
        npc.bubbleKind = partner.bubbleKind = "speech";
        npc.bubbleUntil = now + 12000;
        partner.bubbleUntil = now + 20000;
        npc.llmRequested = false;
        partner.llmRequested = true;
      }
      continue;
    }
    if (npc.partnerId && npc.conversationTurn === 1 && npc.bubbleUntil <= now) {
      if (pausedConversationNpcIds.has(npc.eventId)) continue;
      if (npc.generationPending) continue;
      const partner = world.npcs.find((item) => item.eventId === npc.partnerId);
      if (!partner) {
        npc.partnerId = 0; npc.speechTargetName = ""; npc.conversationTurn = 0; npc.conversationRound = 0;
        npc.conversationContext = []; npc.generationPending = false; npc.nextBehaviorAt = now + 700;
        continue;
      }
      const completedTurn = [npc.bubble, partner?.queuedBubble || ""].filter(Boolean);
      npc.bubble = "";
      npc.conversationTurn = 3;
      if (partner) {
        const nextContext = [...npc.conversationContext, ...completedTurn].filter((line, index, all) => index === 0 || line !== all[index - 1]).slice(-6);
        npc.conversationContext = partner.conversationContext = nextContext;
        partner.bubble = partner.queuedBubble;
        partner.bubbleShownAt = now;
        partner.queuedBubble = "";
        partner.bubbleUntil = now + Math.max(3400, partner.bubble.length * 180);
      }
      continue;
    }
    if (npc.partnerId && npc.conversationTurn === 2 && npc.bubbleUntil <= now) {
      if (pausedConversationNpcIds.has(npc.eventId)) continue;
      if (npc.generationPending) continue;
      const partner = world.npcs.find((item) => item.eventId === npc.partnerId);
      if (partner && npc.conversationRound < 3) {
        partner.conversationRound = npc.conversationRound = npc.conversationRound + 1;
        partner.conversationTurn = 1; npc.conversationTurn = 2;
        partner.bubble = ""; partner.speechTargetName = npc.name; partner.generationPending = true; partner.queuedAt = now;
        npc.bubble = ""; npc.queuedBubble = ""; npc.speechTargetName = partner.name;
        partner.bubbleUntil = now + 12000; npc.bubbleUntil = now + 20000;
        partner.llmRequested = false; npc.llmRequested = true;
        continue;
      }
      const formerPartnerId = npc.partnerId;
      npc.bubble = ""; npc.partnerId = 0; npc.speechTargetName = ""; npc.conversationTurn = 0; npc.conversationRound = 0; npc.conversationContext = [];
      npc.lastPartnerId = formerPartnerId; npc.partnerCooldownUntil = now + 30000; npc.nextBehaviorAt = now + 400;
      if (partner) {
        partner.bubble = ""; partner.partnerId = 0; partner.speechTargetName = ""; partner.conversationTurn = 0; partner.conversationRound = 0; partner.conversationContext = [];
        partner.lastPartnerId = npc.eventId; partner.partnerCooldownUntil = now + 30000; partner.nextBehaviorAt = now + 400;
      }
      continue;
    }
    if (npc.bubbleUntil <= now) {
      npc.bubble = "";
    }
    if (npc.partnerId || npc.bubble || npc.generationPending || now < npc.nextBehaviorAt) continue;

    const nearbyCandidates = world.npcs.filter((other) =>
      isActive(other) && other.eventId !== npc.eventId && !other.partnerId && !other.groupId && !other.bubble &&
      Math.abs(other.x - npc.x) + Math.abs(other.y - npc.y) <= 8 &&
      !(npc.lastPartnerId === other.eventId && npc.partnerCooldownUntil > now) &&
      Math.abs(other.x - playerX) + Math.abs(other.y - playerY) > 2,
    ).slice(0, 3), nearby = nearbyCandidates[0];
    const seed = hash(Math.floor(now / 1000) + npc.eventId * 131 + world.mapId * 17);
    if (nearby && seed % 2 === 0) {
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
      npc.bubbleKind = "action";
      npc.bubbleUntil = now + 12000;
      npc.llmRequested = false; npc.generationPending = true; npc.queuedAt = now;
      npc.nextBehaviorAt = now + 5500 + seed % 5500;
      continue;
    }
    if (seed % 4 === 0) {
      npc.bubble = "";
      npc.speechTargetName = "";
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
      if (Math.abs(x - npc.homeX) > 9 || Math.abs(y - npc.homeY) > 9) continue;
      if (x === playerX && y === playerY) continue;
      if (canEnter(npc, x, y)) {
        npc.x = x; npc.y = y; npc.direction = direction;
        break;
      }
    }
    npc.nextBehaviorAt = now + 420 + seed % 1050;
  }
  return world;
}
