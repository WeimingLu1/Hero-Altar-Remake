import assert from "node:assert/strict";
import test from "node:test";
import {
  abandonGeneratedQuest,
  acceptGeneratedQuest,
  advanceGeneratedQuestAfterDialogue,
  appendGeneratedQuestTranscript,
  claimGeneratedQuestReward,
  createGeneratedQuestDraft,
  generatedQuestEligibleKinds,
  generatedQuestFallbackText,
  generatedQuestCurrentNpc,
  generatedQuestInteraction,
  generatedQuestObjective,
  generatedQuestParticipant,
  generatedQuestPrompt,
  generatedQuestReward,
  markGeneratedQuestBattleWin,
  normalizeGeneratedQuest,
  shouldOfferGeneratedQuest,
} from "../app/game-core/generated-task-system";
import { newActor } from "../app/game-core/save-system";
import { freshTaskState } from "../app/game-core/task-system";

const sequence = (...values: number[]) => {
  let index = 0;
  return (max: number) => Math.abs(values[index++] || 0) % Math.max(1, max);
};

test("生成任务在三轮背景铺垫后由NPC第四句固定提出，不受旧冷却字段阻挡", () => {
  const tasks = freshTaskState();
  assert.equal(shouldOfferGeneratedQuest({ completedNpcReplies: 0, offeredThisSession: false, tasks }), false);
  assert.equal(shouldOfferGeneratedQuest({ completedNpcReplies: 1, offeredThisSession: false, tasks }), false);
  assert.equal(shouldOfferGeneratedQuest({ completedNpcReplies: 2, offeredThisSession: false, tasks }), false);
  assert.equal(shouldOfferGeneratedQuest({ completedNpcReplies: 3, offeredThisSession: false, tasks }), true);
  assert.equal(shouldOfferGeneratedQuest({ completedNpcReplies: 8, offeredThisSession: true, tasks }), false);
  tasks.generatedQuestNextOfferAt = 20;
  assert.equal(shouldOfferGeneratedQuest({ completedNpcReplies: 8, offeredThisSession: false, tasks }), true);
});

test("任务候选使用真实地图事件并按人物条件过滤三种类型", () => {
  const actor = newActor(), tasks = freshTaskState(), issuer = generatedQuestParticipant(13, 15);
  assert.ok(issuer);
  const kinds = generatedQuestEligibleKinds(issuer!, actor, tasks);
  assert.ok(kinds.includes("duel"));
  assert.ok(kinds.includes("visit"));
  assert.ok(kinds.includes("delegated-duel"));
  actor.killList = [17, 21, 32, 47];
  const draft = createGeneratedQuestDraft({ issuer: issuer!, actor, tasks, random: sequence(0, 0, 99) });
  assert.equal(draft?.kind, "duel");
  assert.equal(draft?.target.npcId, 13);
  assert.equal(draft?.stage, "accepted");
});

test("拜访任务保存目标地点、完整对话并在目标交谈后进入复命", () => {
  const actor = newActor(), tasks = freshTaskState(), issuer = generatedQuestParticipant(2)!;
  const draft = createGeneratedQuestDraft({ issuer, actor, tasks, random: sequence(0, 0, 99) });
  assert.equal(draft?.kind, "visit");
  assert.ok(draft?.target.mapName);
  assert.equal(acceptGeneratedQuest(tasks, draft!), true);
  assert.equal(tasks.generatedQuestSerial, 1);
  assert.equal(tasks.generatedQuestNextOfferAt, tasks.clock);
  appendGeneratedQuestTranscript(tasks, { speaker: "player", speech: "我接下了。" });
  appendGeneratedQuestTranscript(tasks, { speaker: "npc", npcId: issuer.npcId, speech: "一路小心。" });
  assert.equal(tasks.generatedQuest?.transcript.length, 2);
  assert.deepEqual(generatedQuestCurrentNpc(tasks.generatedQuest!), draft!.target);
  assert.equal(advanceGeneratedQuestAfterDialogue(tasks, tasks.generatedQuest!.target), true);
  assert.equal(tasks.generatedQuest?.stage, "report");
  assert.deepEqual(generatedQuestCurrentNpc(tasks.generatedQuest!), draft!.issuer);
  assert.match(generatedQuestObjective(tasks.generatedQuest!), /复命/);
});

test("任务头顶标记严格跟随当前阶段的下一名 NPC", () => {
  const actor = newActor(), tasks = freshTaskState(), issuer = generatedQuestParticipant(13)!;
  const draft = createGeneratedQuestDraft({ issuer, actor, tasks, random: sequence(2, 0, 99) })!;
  acceptGeneratedQuest(tasks, draft);
  assert.deepEqual(generatedQuestCurrentNpc(tasks.generatedQuest!), draft.target);
  tasks.generatedQuest!.stage = "defeated";
  assert.deepEqual(generatedQuestCurrentNpc(tasks.generatedQuest!), draft.target);
  tasks.generatedQuest!.stage = "report";
  assert.deepEqual(generatedQuestCurrentNpc(tasks.generatedQuest!), draft.issuer);
  tasks.generatedQuest!.stage = "failed";
  assert.equal(generatedQuestCurrentNpc(tasks.generatedQuest!), null);
});

test("委派战斗由目标一句承接后开战，只由匹配胜利推进并在战后复命", () => {
  const actor = newActor(), tasks = freshTaskState(), issuer = generatedQuestParticipant(13)!;
  const draft = createGeneratedQuestDraft({ issuer, actor, tasks, random: sequence(2, 0, 99) });
  assert.equal(draft?.kind, "delegated-duel");
  acceptGeneratedQuest(tasks, draft!);
  appendGeneratedQuestTranscript(tasks, {
    speaker: "npc",
    npcId: draft!.target.npcId,
    speech: "先说清楚这桩旧怨。",
  });
  assert.equal(advanceGeneratedQuestAfterDialogue(tasks, draft!.target), true);
  assert.equal(tasks.generatedQuest?.stage, "confrontation");
  assert.equal(markGeneratedQuestBattleWin(tasks, "wrong", draft!.target.npcId), false);
  assert.equal(markGeneratedQuestBattleWin(tasks, draft!.id, draft!.target.npcId), true);
  assert.equal(tasks.generatedQuest?.stage, "defeated");
  assert.equal(advanceGeneratedQuestAfterDialogue(tasks, draft!.target), true);
  assert.equal(tasks.generatedQuest?.stage, "report");
});

test("原作坛战专用人物不会成为生成任务参与者，旧冲突任务会在读档时清除", () => {
  const actor = newActor(), tasks = freshTaskState(), altarMinion = generatedQuestParticipant(179)!;
  assert.ok(altarMinion);
  assert.deepEqual(generatedQuestEligibleKinds(altarMinion, actor, tasks), []);
  const issuer = generatedQuestParticipant(13)!;
  const draft = createGeneratedQuestDraft({ issuer, actor, tasks, random: sequence(0, 0, 99) })!;
  const conflicted = structuredClone(draft);
  conflicted.target = altarMinion;
  assert.equal(normalizeGeneratedQuest(conflicted), null);
});

test("奖励公式固定、只结算一次且完成后清除完整任务记录", () => {
  const actor = newActor(), tasks = freshTaskState(), issuer = generatedQuestParticipant(13)!;
  const reward = generatedQuestReward("delegated-duel", issuer.npcId, actor, () => 99);
  assert.deepEqual(reward, { exp: 100, potential: 33, gold: 50 });
  const draft = createGeneratedQuestDraft({ issuer, actor, tasks, random: sequence(0, 0, 99) })!;
  acceptGeneratedQuest(tasks, draft);
  tasks.generatedQuest!.stage = "report";
  appendGeneratedQuestTranscript(tasks, { speaker: "npc", npcId: issuer.npcId, speech: "办得好。" });
  const before = { exp: actor.exp, potential: actor.potential, gold: actor.gold };
  const claimed = claimGeneratedQuestReward(actor, tasks, issuer);
  assert.equal(claimed.ok, true);
  assert.equal(actor.exp, before.exp + draft.reward.exp);
  assert.equal(actor.potential, before.potential + draft.reward.potential);
  assert.equal(actor.gold, before.gold + draft.reward.gold);
  assert.equal(tasks.generatedQuestHistory.length, 1);
  assert.equal(tasks.generatedQuestHistory[0].id, draft.id);
  assert.match(tasks.generatedQuestHistory[0].summary, /完成|拜访|切磋|挑战/);
  assert.equal(tasks.generatedQuestHistory[0].reward.exp, draft.reward.exp);
  assert.equal(tasks.generatedQuest, null);
  assert.equal(claimGeneratedQuestReward(actor, tasks, issuer).ok, false);
  assert.equal(tasks.generatedQuestHistory.length, 1, "重复领奖不能重复写入日志");
  assert.equal(tasks.generatedQuestNextOfferAt, tasks.clock, "领奖后应立即允许下一名NPC重新开始三轮铺垫");
});

test("任务中断线有含真实人物地点的固定文本，放弃后立即开放新任务", () => {
  const actor = newActor(), tasks = freshTaskState(), issuer = generatedQuestParticipant(2)!;
  const draft = createGeneratedQuestDraft({ issuer, actor, tasks, random: sequence(0, 0, 99) })!;
  acceptGeneratedQuest(tasks, draft);
  const fallback = generatedQuestFallbackText(tasks.generatedQuest!, draft.target);
  assert.match(fallback, new RegExp(draft.target.name));
  assert.match(fallback, new RegExp(draft.issuer.name));
  tasks.clock = 50;
  assert.equal(abandonGeneratedQuest(tasks), true);
  assert.equal(tasks.generatedQuest, null);
  assert.equal(tasks.generatedQuestNextOfferAt, 50);
});

test("生成任务只识别精确地图事件，第三方与同ID的其他事件保持普通交谈", () => {
  const actor = newActor(), tasks = freshTaskState(), issuer = generatedQuestParticipant(2)!;
  const draft = createGeneratedQuestDraft({ issuer, actor, tasks, random: sequence(0, 0, 99) })!;
  acceptGeneratedQuest(tasks, draft);
  const quest = tasks.generatedQuest!;
  assert.equal(generatedQuestInteraction(quest, issuer), "issuer-reminder");
  assert.equal(generatedQuestInteraction(quest, quest.target), "visit-target");
  const wrongEvent = { ...quest.target, eventId: quest.target.eventId + 999 };
  assert.equal(generatedQuestInteraction(quest, wrongEvent), null);
  assert.equal(advanceGeneratedQuestAfterDialogue(tasks, wrongEvent), false);
  const outsider = generatedQuestParticipant(13)!;
  assert.equal(generatedQuestInteraction(quest, outsider), null);
  assert.equal(generatedQuestFallbackText(quest, outsider), "");
  assert.equal(
    generatedQuestParticipant(draft.target.npcId, draft.target.mapId, draft.target.eventId + 999),
    undefined,
    "指定地图事件不存在时不得回退成同ID人物的另一处事件",
  );
});

test("任务提示按铺垫、发布人和目标身份裁剪事实且使用中文阶段", () => {
  const actor = newActor(), tasks = freshTaskState(), issuer = generatedQuestParticipant(2)!;
  const draft = createGeneratedQuestDraft({ issuer, actor, tasks, random: sequence(0, 0, 99) })!;
  appendGeneratedQuestTranscript({ ...tasks, generatedQuest: draft }, {
    speaker: "npc",
    npcId: issuer.npcId,
    speech: "这句话只应在消息历史里出现。",
  });
  const prelude = generatedQuestPrompt(draft, issuer.npcId, {
    disclosure: "prelude",
    includeTranscript: false,
  });
  assert.match(prelude, /尚未正式委托/);
  assert.doesNotMatch(prelude, /约定奖励|经验\d|最近任务对话/);
  assert.doesNotMatch(prelude, /这句话只应/);

  const offer = generatedQuestPrompt(draft, issuer.npcId, { disclosure: "offer" });
  assert.match(offer, /约定奖励/);
  assert.match(offer, /最近任务对话/);
  assert.doesNotMatch(offer, /【当前阶段】accepted/);

  const target = generatedQuestPrompt(draft, draft.target.npcId, {
    disclosure: "active",
    includeTranscript: false,
  });
  assert.match(target, /目标人物/);
  assert.doesNotMatch(target, /约定奖励/);

  const player = generatedQuestPrompt(draft, issuer.npcId, {
    disclosure: "active",
    perspective: "player",
  });
  assert.match(player, /玩家本人/);
  assert.match(player, /约定奖励/);
});
