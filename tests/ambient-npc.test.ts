import assert from "node:assert/strict";
import test from "node:test";
import { AMBIENT_BUBBLE_MS, AMBIENT_DEPART_MS, ambientCanHear, ambientNpcAt, ambientNpcByEventId, ambientNpcByName, ambientNpcsByName, ambientNpcInPlayerRange, ambientNpcInViewport, ambientViewportBounds, countActiveNpcConversations, createAmbientWorld, pairConversationShouldEnd, resetAmbientSessions, tickAmbientWorld } from "../app/game-core/ambient-npc";

test("ambient NPCs exist only in the initialized current map", () => {
  const world = createAmbientWorld(2, 0, [{ eventId: 1, npcId: 3, name: "捕快", identity: "官差", x: 4, y: 4 }]);
  assert.equal(world.mapId, 2);
  assert.equal(ambientNpcAt(world, 4, 4)?.npcId, 3);
});

test("ambient runtime keeps stable event and name indexes", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "捕快", identity: "官差", x: 4, y: 4 },
    { eventId: 2, npcId: 4, name: "掌柜", identity: "商人", x: 5, y: 4 },
  ]);
  const guard = ambientNpcByEventId(world, 1);
  assert.equal(guard, world.npcs[0]);
  assert.equal(ambientNpcByName(world, "掌柜"), world.npcs[1]);
  guard!.x = 8;
  assert.equal(ambientNpcByEventId(world, 1)?.x, 8);
});

test("ambient name indexes retain duplicates and resolve within the active session", () => {
  const world = createAmbientWorld(61, 0, [
    { eventId: 8, npcId: 163, name: "朱雀喽猡", identity: "坛众", x: 2, y: 2 },
    { eventId: 3, npcId: 163, name: "朱雀喽猡", identity: "坛众", x: 8, y: 8 },
    { eventId: 11, npcId: 164, name: "坛主", identity: "坛主", x: 7, y: 8 },
  ]);
  assert.deepEqual(
    ambientNpcsByName(world, "朱雀喽猡").map((npc) => npc.eventId),
    [8, 3],
  );
  // The two-argument API retains its original first-match behaviour.
  assert.equal(ambientNpcByName(world, "朱雀喽猡")?.eventId, 8);
  // A recorded event target wins inside a partner/group/player session.
  assert.equal(
    ambientNpcByName(world, "朱雀喽猡", {
      preferredEventIds: [3],
      near: world.npcs[2],
    })?.eventId,
    3,
  );
  // Without an exact session target, the nearest duplicate is selected.
  assert.equal(
    ambientNpcByName(world, "朱雀喽猡", { near: world.npcs[2] })?.eventId,
    3,
  );
});

test("ambient simulation uses a player-centered screen range", () => {
  const world = createAmbientWorld(2, 0, [{ eventId: 1, npcId: 3, name: "远处人物", identity: "路人", x: 30, y: 30 }]);
  assert.equal(ambientNpcInPlayerRange(world.npcs[0], 5, 5), false);
  world.npcs[0].x = 29; world.npcs[0].bubble = "不会留在远处";
  tickAmbientWorld({ world, now: 1000, playerX: 5, playerY: 5, indoor: false, canEnter: () => true });
  assert.deepEqual([world.npcs[0].x, world.npcs[0].y, world.npcs[0].bubble], [30, 30, ""]);
});

test("performance window matches the visible ten by seven tile radius", () => {
  const npc = createAmbientWorld(2, 0, [{ eventId: 1, npcId: 3, name: "远处人物", identity: "路人", x: 14, y: 12 }]).npcs[0];
  assert.equal(ambientNpcInPlayerRange(npc, 5, 5), true);
  npc.x = 15;
  assert.equal(ambientNpcInPlayerRange(npc, 5, 5), false);
  npc.x = -5;
  assert.equal(ambientNpcInPlayerRange(npc, 5, 5), true);
});

test("activity viewport follows the clamped camera at map edges", () => {
  const topLeft = ambientViewportBounds(40, 30, 1, 1);
  assert.deepEqual(topLeft, { left: 0, top: 0, right: 20, bottom: 15 });
  assert.equal(ambientNpcInViewport({ x: 19, y: 14 }, topLeft), true);
  assert.equal(ambientNpcInViewport({ x: 20, y: 14 }, topLeft), false);
  assert.deepEqual(ambientViewportBounds(40, 30, 39, 29), { left: 20, top: 15, right: 40, bottom: 30 });
});

test("conversation hearing is limited to the surrounding tile ring", () => {
  assert.equal(ambientCanHear({ x: 5, y: 5 }, { x: 6, y: 6 }), true);
  assert.equal(ambientCanHear({ x: 5, y: 5 }, { x: 7, y: 5 }), false);
});

test("NPCs stop moving when the player approaches", () => {
  const world = createAmbientWorld(2, 0, [{ eventId: 1, npcId: 3, name: "捕快", identity: "官差", x: 4, y: 4 }]);
  world.npcs[0].nextBehaviorAt = 0;
  tickAmbientWorld({ world, now: 10000, playerX: 5, playerY: 4, indoor: false, canEnter: () => true });
  assert.deepEqual([world.npcs[0].x, world.npcs[0].y], [4, 4]);
});

test("ambient movement respects the supplied collision gate and home radius", () => {
  const world = createAmbientWorld(2, 0, [{ eventId: 1, npcId: 3, name: "捕快", identity: "官差", x: 4, y: 4 }]);
  world.npcs[0].nextBehaviorAt = 0;
  tickAmbientWorld({ world, now: 10001, playerX: 15, playerY: 15, indoor: false, canEnter: () => false });
  assert.deepEqual([world.npcs[0].x, world.npcs[0].y], [4, 4]);
});

test("nearby pair conversation shows both speakers' bubbles in parallel", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = second.eventId; second.partnerId = first.eventId;
  first.conversationTurn = 1; second.conversationTurn = 2;
  first.conversationRound = second.conversationRound = 1;
  first.bubble = "甲 to 乙：“近来可好？”"; first.bubbleUntil = 5000;
  second.bubble = "乙 to 甲：“一切尚好。”"; second.bubbleUntil = 5000;
  tickAmbientWorld({ world, now: 200, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(first.bubble, "甲 to 乙：“近来可好？”");
  assert.equal(second.bubble, "乙 to 甲：“一切尚好。”");
});

test("paired NPCs continue the same session for a second exchange", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = second.eventId; second.partnerId = first.eventId;
  first.conversationTurn = 3; second.conversationTurn = 2;
  first.conversationRound = second.conversationRound = 1;
  second.bubble = "乙 to 甲：“我也正有此感。”";
  second.bubbleUntil = 100;
  tickAmbientWorld({ world, now: 200, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(first.conversationRound, 2);
  assert.equal(second.conversationRound, 2);
  assert.equal(first.bubble, "");
  assert.equal(first.speechTargetName, "乙");
  assert.equal(first.generationPending, true);
  assert.equal(second.bubble, "");
});

test("leaving the active window clears both sides of a conversation session", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 30, y: 30 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 31, y: 30 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = 2; second.partnerId = 1;
  first.conversationRound = second.conversationRound = 2;
  first.conversationContext = second.conversationContext = ["旧话题"];
  tickAmbientWorld({ world, now: 1000, playerX: 5, playerY: 5, indoor: false, canEnter: () => true });
  assert.deepEqual([first.partnerId, second.partnerId], [0, 0]);
  assert.deepEqual([first.conversationContext, second.conversationContext], [[], []]);
  assert.equal(second.bubble, "");
});

test("NPCs approach and face each other before conversation", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 3, y: 4 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 6, y: 4 },
  ]);
  world.npcs[0].partnerId = 2; world.npcs[1].partnerId = 1;
  world.npcs[0].conversationTurn = world.npcs[1].conversationTurn = 0;
  tickAmbientWorld({
    world, now: 1000, playerX: 10, playerY: 10, indoor: false,
    canEnter: (moving, x, y) => !world.npcs.some((npc) => npc.eventId !== moving.eventId && npc.x === x && npc.y === y),
  });
  assert.equal(Math.abs(world.npcs[0].x - world.npcs[1].x) + Math.abs(world.npcs[0].y - world.npcs[1].y), 1);
  assert.equal(world.npcs[0].direction, 6);
  assert.equal(world.npcs[1].direction, 4);
});

test("leaving an NPC resumes roaming quickly", () => {
  const world = createAmbientWorld(2, 0, [{ eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 4, y: 4 }]);
  tickAmbientWorld({ world, now: 1000, playerX: 5, playerY: 4, indoor: false, canEnter: () => true });
  assert.equal(world.npcs[0].waitingForPlayer, true);
  tickAmbientWorld({ world, now: 1500, playerX: 10, playerY: 10, indoor: false, canEnter: () => false });
  assert.equal(world.npcs[0].waitingForPlayer, false);
  assert.equal(world.npcs[0].nextBehaviorAt, 1950);
});

test("group conversation addresses participants and advances one speaker at a time", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 5, y: 4 },
    { eventId: 3, npcId: 3, name: "丙", identity: "书生", x: 4, y: 5 },
  ]);
  for (const npc of world.npcs) { npc.groupId = 1; npc.groupMembers = [1, 2, 3]; npc.groupTurn = -1; }
  tickAmbientWorld({ world, now: 1000, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(world.npcs[0].bubble, "");
  assert.equal(world.npcs[0].speechTargetName, "乙");
  assert.equal(world.npcs[0].generationPending, true);
  world.npcs[0].generationPending = false;
  world.npcs[0].bubble = "甲 to 乙：“山下可有异动？”";
  world.npcs[0].groupNextAt = 2000;
  tickAmbientWorld({ world, now: 2001, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(world.npcs[1].bubble, "");
  // 群聊不再强制回上一位：乙随机指向群里另一个人(甲或丙)，但不能指向自己
  assert.ok(["甲", "丙"].includes(world.npcs[1].speechTargetName), `乙应指向甲或丙，实际 ${world.npcs[1].speechTargetName}`);
  assert.equal(world.npcs[1].generationPending, true);
  assert.equal(world.npcs.filter((npc) => npc.bubble).length, 0);
});

test("a player reply locks the current conversation turn", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 5, y: 4 },
    { eventId: 3, npcId: 3, name: "丙", identity: "书生", x: 4, y: 5 },
  ]);
  for (const npc of world.npcs) { npc.groupId = 1; npc.groupMembers = [1, 2, 3]; npc.groupTurn = 0; npc.groupNextAt = 100; }
  world.npcs[0].bubble = "甲 to 乙：“先听我说。”";
  tickAmbientWorld({
    world, now: 1000, playerX: 5, playerY: 5, indoor: false,
    pausedConversationNpcIds: [1, 2, 3], canEnter: () => true,
  });
  assert.equal(world.npcs[0].groupTurn, 0);
  assert.equal(world.npcs[1].bubble, "");
});

test("all group members freeze while the player owns the conversation", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 7, y: 4 },
  ]);
  for (const npc of world.npcs) { npc.groupId = 1; npc.groupMembers = [1, 2]; npc.groupTurn = 0; }
  tickAmbientWorld({ world, now: 1000, playerX: 5, playerY: 5, indoor: false, pausedConversationNpcIds: [1, 2], canEnter: () => true });
  assert.deepEqual(world.npcs.map((npc) => [npc.x, npc.y]), [[4, 4], [7, 4]]);
});

test("a missing pair partner cannot leave an NPC stuck in conversation", () => {
  const world = createAmbientWorld(2, 0, [{ eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 4, y: 4 }]);
  const npc = world.npcs[0];
  npc.partnerId = 99; npc.conversationTurn = 1; npc.bubbleUntil = 100;
  tickAmbientWorld({ world, now: 200, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(npc.partnerId, 0);
  assert.equal(npc.conversationTurn, 0);
  assert.equal(npc.generationPending, false);
});

test("a malformed group clears the member instead of creating self-talk", () => {
  const world = createAmbientWorld(2, 0, [{ eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 4, y: 4 }]);
  const npc = world.npcs[0];
  npc.groupId = 99; npc.groupMembers = [99]; npc.groupTurn = -1;
  tickAmbientWorld({ world, now: 200, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(npc.groupId, 0);
  assert.equal(npc.generationPending, false);
  assert.equal(npc.speechTargetName, "");
});

test("global pause resets every in-flight NPC session", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  for (const npc of world.npcs) { npc.partnerId = npc.eventId === 1 ? 2 : 1; npc.generationPending = true; npc.llmRequested = true; npc.bubble = "旧气泡"; }
  resetAmbientSessions(world, 1700);
  for (const npc of world.npcs) {
    assert.equal(npc.partnerId, 0);
    assert.equal(npc.generationPending, false);
    assert.equal(npc.bubble, "");
    assert.equal(npc.nextBehaviorAt, 1700);
  }
});

test("group dialogue forms a directed reply chain without broadcasts", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 5, y: 4 },
    { eventId: 3, npcId: 3, name: "丙", identity: "书生", x: 4, y: 5 },
  ]);
  for (const npc of world.npcs) { npc.groupId = 1; npc.groupMembers = [1, 2, 3]; npc.groupTurn = 0; npc.groupNextAt = 100; }
  world.npcs[0].bubble = "甲 to 乙：“你怎么看？”";
  world.npcs[0].conversationContext = [world.npcs[0].bubble];
  tickAmbientWorld({ world, now: 1000, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(world.npcs[1].bubble, "");
  // 仍是有向接话(指向群里另一个成员)，但不再强制是上一位发言者
  assert.ok(["甲", "丙"].includes(world.npcs[1].speechTargetName), `乙应指向甲或丙，实际 ${world.npcs[1].speechTargetName}`);
  assert.equal(world.npcs[1].generationPending, true);
});

test("the discussion answers a player who joins after the last NPC turn", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 5, y: 4 },
    { eventId: 3, npcId: 3, name: "丙", identity: "书生", x: 4, y: 5 },
  ]);
  for (const npc of world.npcs) {
    npc.groupId = 1; npc.groupMembers = [1, 2, 3]; npc.groupTurn = 2; npc.groupNextAt = 100;
    npc.conversationContext = ["少侠 to 丙：“此事或许另有隐情。”"];
  }
  tickAmbientWorld({ world, now: 1000, playerX: 5, playerY: 5, indoor: false, canEnter: () => true });
  assert.equal(world.npcs[0].bubble, "");
  assert.equal(world.npcs[0].speechTargetName, "少侠");
  assert.equal(world.npcs[0].generationPending, true);
  assert.equal(world.npcs[0].groupId, 1);
});

test("mutually heard NPCs form a group with no member cap", () => {
  // 三个人彼此都在 3×3 听觉圈内：eventId 1 发起、2 为伙伴、3 在旁边
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "路", x: 5, y: 5 },
    { eventId: 2, npcId: 4, name: "乙", identity: "路", x: 5, y: 6 },
    { eventId: 3, npcId: 5, name: "丙", identity: "路", x: 6, y: 6 },
    { eventId: 4, npcId: 6, name: "丁", identity: "路", x: 6, y: 5 },
  ]);
  const [a, b, c, d] = world.npcs;
  a.partnerId = 2; b.partnerId = 1;
  a.conversationTurn = 0; b.conversationTurn = 0;
  a.nextBehaviorAt = b.nextBehaviorAt = c.nextBehaviorAt = d.nextBehaviorAt = 1e9;
  tickAmbientWorld({ world, now: 1000, playerX: 8, playerY: 8, indoor: false, canEnter: () => true });
  // 四人都彼此近身(互相听觉圈成立)，应全部加入同一群聊，无 4 人上限
  const members = world.npcs.filter((n) => n.groupId > 0);
  assert.equal(members.length, 4, `应 4 人全部入组，实际 ${members.length}`);
  assert.ok(members.every((n) => n.groupMembers.length === 4), "组员应包含全部 4 人");
});

test("NPCs merely inside the initiator circle but not mutually heard stay a pair", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "路", x: 5, y: 5 },
    { eventId: 2, npcId: 4, name: "乙", identity: "路", x: 5, y: 6 },
    { eventId: 3, npcId: 5, name: "丙", identity: "路", x: 6, y: 4 }, // 在甲圈内但与乙相距 2
  ]);
  const [a, b, c] = world.npcs;
  a.partnerId = 2; b.partnerId = 1;
  a.conversationTurn = 0; b.conversationTurn = 0;
  a.nextBehaviorAt = b.nextBehaviorAt = c.nextBehaviorAt = 1e9;
  tickAmbientWorld({ world, now: 1000, playerX: 8, playerY: 8, indoor: false, canEnter: () => true });
  // 丙虽在甲听觉圈内，但与乙不互相近身 → 不组群，回到双人
  assert.equal(a.groupId, 0);
  assert.equal(b.groupId, 0);
  assert.equal(c.groupId, 0);
});

test("pairConversationShouldEnd rolls deterministically from round four", () => {
  // mapId=2 的确定性子：1-3 轮恒不结束；(1,2) 第 6 轮结束，(3,4) 第 7 轮结束
  assert.equal(pairConversationShouldEnd(2, 1, 2, 1), false);
  assert.equal(pairConversationShouldEnd(2, 1, 2, 3), false);
  assert.equal(pairConversationShouldEnd(2, 1, 2, 4), false);
  assert.equal(pairConversationShouldEnd(2, 1, 2, 6), true);
  assert.equal(pairConversationShouldEnd(2, 3, 4, 7), true);
  assert.equal(pairConversationShouldEnd(2, 3, 4, 5), false);
  // 与双方顺序无关（种子用 Math.min）
  assert.equal(pairConversationShouldEnd(2, 2, 1, 6), pairConversationShouldEnd(2, 1, 2, 6));
});

test("a pair ends naturally when the round roll says so", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = second.eventId; second.partnerId = first.eventId;
  first.conversationTurn = 3; second.conversationTurn = 2;
  first.conversationRound = second.conversationRound = 6;
  first.nextPair = second.nextPair = { a: "甲 to 乙：“续。”", b: "乙 to 甲：“续。”" };
  second.bubble = "乙 to 甲：“最后一轮。”"; second.bubbleUntil = 100;
  tickAmbientWorld({ world, now: 200, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.deepEqual([first.partnerId, second.partnerId], [0, 0]);
  assert.equal(first.conversationRound, 0);
  assert.equal(first.nextPair, undefined);
  assert.equal(first.nextPairPending, false);
  assert.equal(first.partnerCooldownUntil, 200 + 30000);
});

test("a pair that keeps going advances to the next round on demand", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = second.eventId; second.partnerId = first.eventId;
  first.conversationTurn = 3; second.conversationTurn = 2;
  first.conversationRound = second.conversationRound = 4;
  second.bubble = "乙 to 甲：“还要说。”"; second.bubbleUntil = 100;
  tickAmbientWorld({ world, now: 200, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(first.conversationRound, 5);
  assert.equal(second.conversationRound, 5);
  assert.equal(first.generationPending, true);
  assert.equal(first.nextPairPending, false);
  assert.equal(first.speechTargetName, "乙");
  assert.equal(second.bubble, "");
});

test("a buffered prefetched pair promotes seamlessly at round close", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = second.eventId; second.partnerId = first.eventId;
  first.conversationTurn = 3; second.conversationTurn = 2;
  first.conversationRound = second.conversationRound = 4;
  first.nextPair = second.nextPair = { a: "甲 to 乙：“第二问。”", b: "乙 to 甲：“第二答。”" };
  second.bubble = "乙 to 甲：“第一答。”"; second.bubbleUntil = 100;
  tickAmbientWorld({ world, now: 200, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(first.conversationRound, 5);
  assert.equal(first.bubble, "甲 to 乙：“第二问。”");
  assert.equal(second.bubble, "乙 to 甲：“第二答。”");
  assert.equal(first.nextPair, undefined);
  assert.equal(first.generationPending, true);
  assert.equal(first.nextPairPending, true);
  assert.equal(first.bubbleUntil, second.bubbleUntil);
  assert.equal(first.bubbleUntil, 200 + AMBIENT_BUBBLE_MS);
  assert.deepEqual(first.conversationContext, ["甲 to 乙：“第二问。”", "乙 to 甲：“第二答。”"]);
  assert.equal(second.speechTargetName, "甲");
});

test("a pending prefetch makes the pair wait instead of double-requesting", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = second.eventId; second.partnerId = first.eventId;
  first.conversationTurn = 3; second.conversationTurn = 2;
  first.conversationRound = second.conversationRound = 4;
  first.nextPairPending = second.nextPairPending = true;
  first.generationPending = true; first.queuedAt = 150;
  second.bubble = "乙 to 甲：“等一下。”"; second.bubbleUntil = 100;
  tickAmbientWorld({ world, now: 200, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(first.conversationRound, 4);
  assert.equal(second.bubble, "");
  // 预取就绪后下一 tick 无缝提升（双方同时写入）
  first.nextPair = second.nextPair = { a: "甲 to 乙：“续。”", b: "乙 to 甲：“续。”" };
  tickAmbientWorld({ world, now: 201, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(first.conversationRound, 5);
  assert.equal(first.bubble, "甲 to 乙：“续。”");
  assert.equal(second.bubble, "乙 to 甲：“续。”");
});

test("a stalled prefetch times out and falls back to on-demand", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = second.eventId; second.partnerId = first.eventId;
  first.conversationTurn = 3; second.conversationTurn = 2;
  first.conversationRound = second.conversationRound = 4;
  first.nextPairPending = second.nextPairPending = true;
  first.generationPending = true; first.queuedAt = 0;
  second.bubble = "乙 to 甲：“太久了。”"; second.bubbleUntil = 100;
  tickAmbientWorld({ world, now: 25000, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(first.conversationRound, 5);
  assert.equal(first.generationPending, true);
  assert.equal(first.nextPairPending, false);
  assert.equal(first.llmRequested, false);
  assert.equal(second.llmRequested, true);
});

test("countActiveNpcConversations counts pairs and groups, excluding player-paused NPCs", () => {
  const viewport = { left: 0, top: 0, right: 20, bottom: 15 };
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 1, y: 1 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 2, y: 1 },
    { eventId: 3, npcId: 3, name: "丙", identity: "书生", x: 3, y: 1 },
    { eventId: 4, npcId: 4, name: "丁", identity: "镖师", x: 4, y: 1 },
    { eventId: 5, npcId: 5, name: "戊", identity: "货郎", x: 5, y: 1 },
  ]);
  assert.equal(countActiveNpcConversations(world, viewport), 0);
  world.npcs[0].partnerId = 2; world.npcs[1].partnerId = 1;
  assert.equal(countActiveNpcConversations(world, viewport), 1);
  world.npcs[2].partnerId = 4; world.npcs[3].partnerId = 3;
  assert.equal(countActiveNpcConversations(world, viewport), 2);
  for (const npc of world.npcs.slice(0, 3)) { npc.groupId = 1; npc.groupMembers = [1, 2, 3]; npc.partnerId = 0; }
  world.npcs[3].partnerId = 0; world.npcs[4].partnerId = 0;
  assert.equal(countActiveNpcConversations(world, viewport), 1);
  world.npcs[3].partnerId = 5; world.npcs[4].partnerId = 4;
  assert.equal(countActiveNpcConversations(world, viewport), 2);
  assert.equal(countActiveNpcConversations(world, viewport, new Set([1, 2, 3])), 1);
  assert.equal(countActiveNpcConversations(world, viewport, new Set([1, 2, 3, 4, 5])), 0);
});

test("a third pair is deferred while two conversations already run", () => {
  const viewport = { left: 0, top: 0, right: 20, bottom: 15 };
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 1, y: 1 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 2, y: 1 },
    { eventId: 3, npcId: 3, name: "丙", identity: "书生", x: 1, y: 3 },
    { eventId: 4, npcId: 4, name: "丁", identity: "镖师", x: 2, y: 3 },
    { eventId: 5, npcId: 5, name: "戊", identity: "货郎", x: 5, y: 5 },
    { eventId: 6, npcId: 6, name: "己", identity: "花匠", x: 7, y: 5 },
  ]);
  const [a, b, c, d, e, f] = world.npcs;
  for (const [lead, follow] of [[a, b], [c, d]] as const) {
    lead.partnerId = follow.eventId; follow.partnerId = lead.eventId;
    lead.conversationTurn = 1; follow.conversationTurn = 2;
    lead.bubble = `${lead.name} to ${follow.name}：……`; lead.bubbleUntil = 8000;
    follow.bubbleUntil = 8000;
  }
  e.nextBehaviorAt = 0; f.nextBehaviorAt = 1000000;
  tickAmbientWorld({ world, now: 1001, playerX: 30, playerY: 30, indoor: false, viewport, canEnter: () => true });
  assert.equal(e.partnerId, 0);
  assert.ok(e.nextBehaviorAt > 1001);
});

test("a pair still forms while a single conversation is running", () => {
  const viewport = { left: 0, top: 0, right: 20, bottom: 15 };
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 1, y: 1 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 2, y: 1 },
    { eventId: 5, npcId: 5, name: "戊", identity: "货郎", x: 5, y: 5 },
    { eventId: 6, npcId: 6, name: "己", identity: "花匠", x: 7, y: 5 },
  ]);
  const [a, b, e, f] = world.npcs;
  a.partnerId = 2; b.partnerId = 1;
  a.conversationTurn = 1; b.conversationTurn = 2;
  a.bubble = "甲 to 乙：……"; a.bubbleUntil = 8000;
  b.bubbleUntil = 8000;
  e.nextBehaviorAt = 0; f.nextBehaviorAt = 1000000;
  tickAmbientWorld({ world, now: 1001, playerX: 30, playerY: 30, indoor: false, viewport, canEnter: () => true });
  assert.equal(e.partnerId, f.eventId);
  assert.equal(f.partnerId, e.eventId);
});

test("a player-owned conversation does not consume the cap", () => {
  const viewport = { left: 0, top: 0, right: 20, bottom: 15 };
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 1, y: 1 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 2, y: 1 },
    { eventId: 5, npcId: 5, name: "戊", identity: "货郎", x: 5, y: 5 },
    { eventId: 6, npcId: 6, name: "己", identity: "花匠", x: 7, y: 5 },
  ]);
  const [a, b, e, f] = world.npcs;
  a.partnerId = 2; b.partnerId = 1;
  a.conversationTurn = 1; b.conversationTurn = 2;
  a.bubble = "甲 to 乙：……"; a.bubbleUntil = 8000;
  b.bubbleUntil = 8000;
  e.nextBehaviorAt = 0; f.nextBehaviorAt = 1000000;
  tickAmbientWorld({ world, now: 1001, playerX: 30, playerY: 30, indoor: false, viewport, pausedConversationNpcIds: [1, 2], canEnter: () => true });
  assert.equal(e.partnerId, f.eventId);
});

test("the conversation cap drops to one while a player conversation is active", () => {
  const viewport = { left: 0, top: 0, right: 20, bottom: 15 };
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 1, y: 1 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 2, y: 1 },
    { eventId: 5, npcId: 5, name: "戊", identity: "货郎", x: 5, y: 5 },
    { eventId: 6, npcId: 6, name: "己", identity: "花匠", x: 7, y: 5 },
  ]);
  const [a, b, e, f] = world.npcs;
  a.partnerId = 2; b.partnerId = 1;
  a.conversationTurn = 1; b.conversationTurn = 2;
  a.bubble = "甲 to 乙：……"; a.bubbleUntil = 8000;
  b.bubbleUntil = 8000;
  e.nextBehaviorAt = 0; f.nextBehaviorAt = 1000000;
  tickAmbientWorld({ world, now: 1001, playerX: 30, playerY: 30, indoor: false, viewport, pausedConversationNpcIds: [9], canEnter: () => true });
  assert.equal(e.partnerId, 0);
  assert.ok(e.nextBehaviorAt > 1001);
});

test("reset sites clear the prefetch buffer and pending flag", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 1, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 2, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  for (const npc of world.npcs) {
    npc.partnerId = npc.eventId === 1 ? 2 : 1;
    npc.nextPair = { a: "a", b: "b" };
    npc.nextPairPending = true;
  }
  resetAmbientSessions(world, 1700);
  for (const npc of world.npcs) {
    assert.equal(npc.partnerId, 0);
    assert.equal(npc.nextPair, undefined);
    assert.equal(npc.nextPairPending, false);
    assert.equal(npc.nextBehaviorAt, 1700);
  }
});

test("leaving the active window clears the prefetch buffer", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 30, y: 30 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 31, y: 30 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = 2; second.partnerId = 1;
  first.nextPair = second.nextPair = { a: "a", b: "b" };
  first.nextPairPending = second.nextPairPending = true;
  tickAmbientWorld({ world, now: 1000, playerX: 5, playerY: 5, indoor: false, canEnter: () => true });
  assert.deepEqual([first.nextPair, second.nextPair], [undefined, undefined]);
  assert.equal(first.nextPairPending, false);
  assert.equal(second.nextPairPending, false);
});

test("对话结束后双方先走开，不原地接着组对", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = second.eventId; second.partnerId = first.eventId;
  first.conversationTurn = 3; second.conversationTurn = 2;
  first.conversationRound = second.conversationRound = 6; // (1,2) 第 6 轮散场
  second.bubble = "乙 to 甲：最后一句。"; second.bubbleUntil = 100;
  tickAmbientWorld({ world, now: 200, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  // END：双方进入走开状态，面向最后搭档的位置。
  assert.equal(first.partnerId, 0);
  assert.equal(first.departUntil, 200 + AMBIENT_DEPART_MS);
  assert.deepEqual(first.departFrom, { x: 5, y: 4 });
  const before = [first.x, first.y];
  // 下一 tick：仍在走开窗口内，位置应远离最后搭档变化，且不组对。
  tickAmbientWorld({ world, now: 900, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.notDeepEqual([first.x, first.y], before);
  assert.equal(first.partnerId, 0);
});
