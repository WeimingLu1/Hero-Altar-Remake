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
  generatedQuestObjective,
  generatedQuestParticipant,
  generatedQuestReward,
  markGeneratedQuestBattleWin,
  shouldOfferGeneratedQuest,
} from "../app/game-core/generated-task-system";
import { newActor } from "../app/game-core/save-system";
import { freshTaskState } from "../app/game-core/task-system";

const sequence = (...values: number[]) => {
  let index = 0;
  return (max: number) => Math.abs(values[index++] || 0) % Math.max(1, max);
};

test("生成任务从第四轮起按百分比检查，并遵守任务槽和冷却", () => {
  const tasks = freshTaskState();
  assert.equal(shouldOfferGeneratedQuest({ replyCount: 3, offeredThisSession: false, tasks, random: () => 0 }), false);
  assert.equal(shouldOfferGeneratedQuest({ replyCount: 4, offeredThisSession: true, tasks, random: () => 0 }), false);
  assert.equal(shouldOfferGeneratedQuest({ replyCount: 4, offeredThisSession: false, tasks, random: () => 11 }), true);
  assert.equal(shouldOfferGeneratedQuest({ replyCount: 4, offeredThisSession: false, tasks, random: () => 12 }), false);
  tasks.generatedQuestNextOfferAt = 20;
  assert.equal(shouldOfferGeneratedQuest({ replyCount: 8, offeredThisSession: false, tasks, random: () => 0 }), false);
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
  assert.equal(tasks.generatedQuestNextOfferAt, 300);
  appendGeneratedQuestTranscript(tasks, { speaker: "player", speech: "我接下了。" });
  appendGeneratedQuestTranscript(tasks, { speaker: "npc", npcId: issuer.npcId, speech: "一路小心。" });
  assert.equal(tasks.generatedQuest?.transcript.length, 2);
  assert.equal(advanceGeneratedQuestAfterDialogue(tasks, tasks.generatedQuest!.target.npcId), true);
  assert.equal(tasks.generatedQuest?.stage, "report");
  assert.match(generatedQuestObjective(tasks.generatedQuest!), /复命/);
});

test("委派战斗只由匹配任务和目标胜利推进，战后对话再进入复命", () => {
  const actor = newActor(), tasks = freshTaskState(), issuer = generatedQuestParticipant(13)!;
  const draft = createGeneratedQuestDraft({ issuer, actor, tasks, random: sequence(2, 0, 99) });
  assert.equal(draft?.kind, "delegated-duel");
  acceptGeneratedQuest(tasks, draft!);
  appendGeneratedQuestTranscript(tasks, {
    speaker: "npc",
    npcId: draft!.target.npcId,
    speech: "先说清楚这桩旧怨。",
  });
  assert.equal(advanceGeneratedQuestAfterDialogue(tasks, draft!.target.npcId), false);
  appendGeneratedQuestTranscript(tasks, {
    speaker: "npc",
    npcId: draft!.target.npcId,
    speech: "缘由既明，便以武会友。",
  });
  assert.equal(advanceGeneratedQuestAfterDialogue(tasks, draft!.target.npcId), true);
  assert.equal(tasks.generatedQuest?.stage, "confrontation");
  assert.equal(markGeneratedQuestBattleWin(tasks, "wrong", draft!.target.npcId), false);
  assert.equal(markGeneratedQuestBattleWin(tasks, draft!.id, draft!.target.npcId), true);
  assert.equal(tasks.generatedQuest?.stage, "defeated");
  assert.equal(advanceGeneratedQuestAfterDialogue(tasks, draft!.target.npcId), true);
  assert.equal(tasks.generatedQuest?.stage, "report");
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
  const claimed = claimGeneratedQuestReward(actor, tasks, issuer.npcId);
  assert.equal(claimed.ok, true);
  assert.equal(actor.exp, before.exp + draft.reward.exp);
  assert.equal(actor.potential, before.potential + draft.reward.potential);
  assert.equal(actor.gold, before.gold + draft.reward.gold);
  assert.equal(tasks.generatedQuest, null);
  assert.equal(claimGeneratedQuestReward(actor, tasks, issuer.npcId).ok, false);
});

test("任务中断线有含真实人物地点的固定文本，放弃后进入冷却", () => {
  const actor = newActor(), tasks = freshTaskState(), issuer = generatedQuestParticipant(2)!;
  const draft = createGeneratedQuestDraft({ issuer, actor, tasks, random: sequence(0, 0, 99) })!;
  acceptGeneratedQuest(tasks, draft);
  const fallback = generatedQuestFallbackText(tasks.generatedQuest!, draft.target.npcId);
  assert.match(fallback, new RegExp(draft.target.name));
  assert.match(fallback, new RegExp(draft.issuer.name));
  tasks.clock = 50;
  assert.equal(abandonGeneratedQuest(tasks), true);
  assert.equal(tasks.generatedQuest, null);
  assert.equal(tasks.generatedQuestNextOfferAt, 350);
});
