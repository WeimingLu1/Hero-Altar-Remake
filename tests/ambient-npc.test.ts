import assert from "node:assert/strict";
import test from "node:test";
import { ambientCanHear, ambientNpcAt, ambientNpcInPlayerRange, ambientNpcInViewport, ambientViewportBounds, createAmbientWorld, tickAmbientWorld } from "../app/game-core/ambient-npc";

test("ambient NPCs exist only in the initialized current map", () => {
  const world = createAmbientWorld(2, 0, [{ eventId: 1, npcId: 3, name: "捕快", identity: "官差", x: 4, y: 4 }]);
  assert.equal(world.mapId, 2);
  assert.equal(ambientNpcAt(world, 4, 4)?.npcId, 3);
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

test("nearby NPC conversation displays one speaker at a time", () => {
  const world = createAmbientWorld(2, 0, [
    { eventId: 1, npcId: 3, name: "甲", identity: "侠客", x: 4, y: 4 },
    { eventId: 2, npcId: 4, name: "乙", identity: "商人", x: 5, y: 4 },
  ]);
  const [first, second] = world.npcs;
  first.partnerId = second.eventId; second.partnerId = first.eventId;
  first.conversationTurn = 1; second.conversationTurn = 2;
  first.bubble = "“近来可好？”"; first.bubbleUntil = 100;
  second.queuedBubble = "“一切尚好。”"; second.bubbleUntil = 1000;
  tickAmbientWorld({ world, now: 200, playerX: 10, playerY: 10, indoor: false, canEnter: () => true });
  assert.equal(first.bubble, "");
  assert.equal(second.bubble, "“一切尚好。”");
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
  assert.equal(second.queuedBubble, "");
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
  second.queuedBubble = "旧回复";
  tickAmbientWorld({ world, now: 1000, playerX: 5, playerY: 5, indoor: false, canEnter: () => true });
  assert.deepEqual([first.partnerId, second.partnerId], [0, 0]);
  assert.deepEqual([first.conversationContext, second.conversationContext], [[], []]);
  assert.equal(second.queuedBubble, "");
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
  assert.equal(world.npcs[1].speechTargetName, "甲");
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
  assert.equal(world.npcs[1].speechTargetName, "甲");
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
