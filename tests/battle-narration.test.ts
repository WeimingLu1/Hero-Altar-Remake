import assert from "node:assert/strict";
import test from "node:test";
import {
  battleEffectKind,
  battleNarrativeDisplaySections,
  battleNarrationOutline,
  buildBattleNarrationFallback,
  buildBattleNarrationFacts,
  buildBattleNarrationPrompt,
  parseBattleNarrativeSections,
  type BattleNarrationEvent,
} from "../app/game-core/battle-narration";
import { beginOriginalBattle } from "../app/game-core/original-battle";
import type { SceneActorState } from "../app/game-core/scene-event";

const actor = {
  name: "测试少侠", age: 18, gender: 0, face: 30, gold: 88, morals: 168,
  teacherId: 31, classId: 5, tanId: 0,
  skills: { "2": { level: 65, points: 0 }, "9": { level: 65, points: 0 } },
  skillUse: [2, 0, 9, 0, 2, 0], inventory: {}, weaponId: 0, armorIds: [],
  hp: 82, maxHp: 100, fp: 100, maxFp: 100, mp: 0, maxMp: 0,
  food: 100, water: 100, exp: 0, potential: 0,
  baseBon: 20, baseInt: 20, baseAgi: 20, baseStr: 20,
  bon: 20, int: 20, agi: 20, str: 20, luck: 20, fpPlus: 0, mpPlus: 0,
  xue6: false,
} as SceneActorState;

const event = (): BattleNarrationEvent => {
  const battle = beginOriginalBattle(1, 42, undefined, "lethal");
  battle.turn = 2;
  battle.enemyHp -= 16;
  return {
    battle,
    actor,
    mapName: "豆腐店",
    facts: ["测试少侠一掌拍向潘小莲。", "潘小莲受到 16 点伤害。"],
    playerHpBefore: 100,
    enemyHpBefore: battle.enemyHp + 16,
  };
};

test("battle narration prompt grounds wuxia prose in both fighters and exact results", () => {
  const input = event(), prompt = buildBattleNarrationPrompt(input);
  assert.match(prompt, /武侠小说的现场战斗叙事者/);
  assert.match(prompt, /测试少侠/);
  assert.match(prompt, /潘小莲/);
  assert.match(prompt, /豆腐店/);
  assert.match(prompt, /原版每次攻防严格依次显示/);
  assert.match(prompt, /【你出招】/);
  assert.match(prompt, /【对手应招】/);
  assert.match(prompt, /【对手出招】/);
  assert.match(prompt, /【你应招】/);
  assert.match(prompt, /一条原文只改写成一段/);
  assert.match(prompt, /每段通常70至130个汉字/);
  assert.match(prompt, /经典金庸式武侠叙事/);
  assert.match(prompt, /命中、闪避、招架、伤害、当前气血、胜负/);
  assert.match(prompt, /起手、发力、行进路线或变招/);
  assert.match(prompt, /非必要不加入对话/);
  assert.match(prompt, /本回合所用武学/);
  assert.match(prompt, /原始出招句中的招式、动作方向、攻击部位/);
  assert.match(prompt, /不得把特色招式淡化/);
  assert.match(prompt, /不足一成只能是轻微疼痛/);
  assert.match(prompt, /不得写骨折、内伤或吐血/);
});

test("battle narration follows the original attack-response order with distinct fighter colors", () => {
  assert.deepEqual(parseBattleNarrativeSections(
    "【你出招】踏步递掌。\n【对手应招】横肘封架。\n【对手出招】旋身回掌。\n【你应招】卸力退开。",
  ), [
    { speaker: "player", text: "踏步递掌。", label: "你出招" },
    { speaker: "enemy", text: "横肘封架。", label: "对手应招" },
    { speaker: "enemy", text: "旋身回掌。", label: "对手出招" },
    { speaker: "player", text: "卸力退开。", label: "你应招" },
  ]);
  assert.deepEqual(parseBattleNarrativeSections("旧模型的普通正文。"), [
    { speaker: "clash", text: "旧模型的普通正文。" },
  ]);
});

test("battle prompt gives the model the exact engine-derived section outline", () => {
  const input = event();
  assert.deepEqual(battleNarrationOutline(input), ["【你出招】", "【对手应招】"]);
  assert.match(buildBattleNarrationPrompt(input), /本回合逐条续写骨架】.*你出招.*对手应招/);
  assert.match(buildBattleNarrationFacts(input), /本回合逐条续写骨架：.*你出招.*对手应招/);

  input.facts = ["使用了金创药：气血+15。", "潘小莲一掌拍来。", "你侧身避开。"];
  assert.deepEqual(battleNarrationOutline(input), ["【交锋】", "【对手出招】", "【你应招】"]);

  input.facts = ["你受制于招式，本回合无法出手。", "潘小莲受制于招式，无法还手。"];
  assert.deepEqual(battleNarrationOutline(input), ["【你应招】", "【对手应招】"]);
});

test("battle continuation preserves one output paragraph for every original log line", () => {
  const input = event();
  input.facts = ["你一掌拍出。", "潘小莲受到伤害。", "潘小莲退开。"];
  assert.equal(parseBattleNarrativeSections(buildBattleNarrationFallback(input)).length, input.facts.length);
  assert.deepEqual(battleNarrationOutline(input), ["【你出招】", "【对手应招】", "【对手应招】"]);
  assert.match(buildBattleNarrationPrompt(input), /原始战报共有3条.*依次续写为3段/);
});

test("battle display colors prose from engine ownership even when the model omits labels", () => {
  const input = event(), outline = battleNarrationOutline(input);
  assert.deepEqual(battleNarrativeDisplaySections(
    "少侠沉肩递掌，掌势由虚转实，直取中宫。潘小莲横肘一封，脚下连退两步才卸去掌力。",
    outline,
    input.facts,
  ), [
    { label: "你出招", speaker: "player", text: "少侠沉肩递掌，掌势由虚转实，直取中宫。" },
    { label: "对手应招", speaker: "enemy", text: "潘小莲横肘一封，脚下连退两步才卸去掌力。" },
  ]);
  assert.deepEqual(battleNarrativeDisplaySections(
    "【交锋】模型写错了颜色标签。\n【交锋】但正文仍可显示。",
    outline,
    input.facts,
  ).map(({ label, speaker }) => ({ label, speaker })), [
    { label: "你出招", speaker: "player" },
    { label: "对手应招", speaker: "enemy" },
  ]);
});

test("震字诀三条原始日志依次归属主角出招和对手两次应招", () => {
  const input = event();
  input.playerTechnique = "震字诀";
  input.facts = [
    "突然你双手左右连划，一个圆圈已将潘小莲套住，太极拳的震字诀随即使出！",
    "太极刚劲造成 6453 点伤害。",
    "潘小莲收招认输。",
  ];
  assert.deepEqual(battleNarrationOutline(input), ["【你出招】", "【对手应招】", "【对手应招】"]);
  assert.match(buildBattleNarrationPrompt(input), /不得描写任何一方兵器坠地、脱手或损毁/);
});

test("绝招反震和双方拼力分别归属主角应招与中性交锋", () => {
  const input = event();
  input.playerTechnique = "震字诀";
  input.facts = ["突然你双手左右连划。", "内力反震，你踉跄倒退。"];
  assert.deepEqual(battleNarrationOutline(input), ["【你出招】", "【你应招】"]);
  input.facts = ["突然你双手左右连划。", "双方内力相拼，各自退开。"];
  assert.deepEqual(battleNarrationOutline(input), ["【你出招】", "【交锋】"]);
});

test("battle effect classification follows actual weapon, spell, special and item facts", () => {
  const sword = event();
  sword.playerTechnique = "华山剑法";
  assert.equal(battleEffectKind(sword), "sword");
  const spell = event();
  spell.playerTechnique = "掌心雷";
  assert.equal(battleEffectKind(spell), "spell");
  const special = event();
  special.playerTechnique = "无影绝杀";
  special.effectHint = "special";
  assert.equal(battleEffectKind(special), "special");
  const item = event();
  item.effectHint = "item";
  assert.equal(battleEffectKind(item), "item");
});

test("battle narration facts expose before and after health without changing settlement", () => {
  const facts = buildBattleNarrationFacts(event());
  assert.match(facts, /唯一真实结算/);
  assert.match(facts, /结算前/);
  assert.match(facts, /结算后/);
  assert.match(facts, /受到 16 点伤害/);
});

test("battle narration fallback keeps both fighters color-addressable without an LLM", () => {
  const input = event();
  input.facts.push("潘小莲横掌回击。", "你架开了这一掌。");
  const fallback = buildBattleNarrationFallback(input);
  assert.match(fallback, /【你出招】测试少侠/);
  assert.match(fallback, /【对手应招】潘小莲受到/);
  assert.match(fallback, /【对手出招】潘小莲横掌/);
  assert.match(fallback, /【你应招】你架开/);
});
