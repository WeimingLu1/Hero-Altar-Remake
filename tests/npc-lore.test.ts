import assert from "node:assert/strict";
import test from "node:test";
import { originalData } from "../app/game-core/original-data";
import {
  buildNpcSystemPrompt,
  npcLore,
  npcConversationFacts,
  npcLoreStatus,
  npcMartialProfile,
  reputationLabel,
  WORLD_LORE,
} from "../app/game-core/npc-lore";
import { freshTaskState } from "../app/game-core/task-system";
import type { SceneActorState } from "../app/game-core/scene-event";

const actor = {
  name: "测试少侠", age: 18, gender: 0, face: 30, gold: 88, morals: 168,
  teacherId: 31, classId: 5, tanId: 0, skills: {
    "2": { level: 65, points: 0 },
    "9": { level: 65, points: 0 },
    "10": { level: 65, points: 0 },
  },
  skillUse: [2, 0, 9, 0, 2, 0], inventory: {}, weaponId: 0, armorIds: [],
  hp: 100, maxHp: 100, fp: 100, maxFp: 100, mp: 0, maxMp: 0,
  food: 100, water: 100, exp: 0, potential: 0,
  baseBon: 20, baseInt: 20, baseAgi: 20, baseStr: 20,
  bon: 20, int: 20, agi: 20, str: 20, luck: 20, fpPlus: 0, mpPlus: 0,
  xue6: false,
} as SceneActorState;

test("every original NPC record receives a complete stable lore profile", () => {
  assert.equal(originalData.enemies.length, 198);
  for (const record of originalData.enemies) {
    const lore = npcLore(Number(record.id));
    assert.equal(lore.id, record.id);
    assert.ok(lore.name.length > 0);
    assert.ok(lore.identity.length > 5);
    assert.ok(lore.background.length > 8);
    assert.ok(lore.personality.length > 5);
    assert.ok(lore.speech.length > 5);
    assert.ok(lore.age > 0);
    assert.match(lore.gender, /^(男|女|未知)$/);
    assert.ok(lore.school.length > 0);
    assert.equal(npcLoreStatus(lore.id).length, 8);
  }
});

test("NPC prompt combines world, personal, player, location and task context", () => {
  const prompt = buildNpcSystemPrompt(1, actor, freshTaskState(), "豆腐店");
  assert.match(prompt, /英雄坛说/);
  assert.match(prompt, /潘小莲/);
  assert.match(prompt, /豆腐店/);
  assert.match(prompt, /测试少侠/);
  assert.match(prompt, /太极门/);
  assert.match(prompt, /顾炎武/);
  assert.match(prompt, /综合武境/);
  assert.match(prompt, /气宇轩昂/);
  assert.match(prompt, /颇有侠名/);
  assert.match(prompt, /师承、武境差距、年龄、容貌和名声/);
  assert.match(prompt, /称谓和代词必须符合明确性别/);
  assert.match(prompt, /只输出角色实际说出口的纯台词/);
  assert.match(prompt, /不要添加.*状态、动作、神态/);
  assert.doesNotMatch(prompt, /状态：具体描述此刻/);
  assert.doesNotMatch(prompt, /动作：描述紧接着/);
  assert.doesNotMatch(prompt, /不超过160个汉字/);
  assert.match(prompt, /不能跳出角色/);
  assert.ok(prompt.includes(WORLD_LORE));
});

test("compact NPC conversation facts include immutable social and martial identity", () => {
  const facts = npcConversationFacts(1);
  assert.match(facts, /潘小莲/);
  assert.match(facts, /岁，性别(男|女|未知)/);
  assert.match(facts, /门派/);
  assert.match(facts, /身份/);
  assert.match(facts, /外貌/);
  assert.match(facts, /综合武境第\d+\/50阶/);
});

test("NPC martial realm and player reputation use readable original-world labels", () => {
  const martial = npcMartialProfile(7);
  assert.ok(martial.value > 0);
  assert.ok(martial.tier > 1);
  assert.ok(martial.realm.length > 0);
  assert.match(reputationLabel(80), /恶名在外/);
  assert.match(reputationLabel(180), /侠名远扬/);
});
