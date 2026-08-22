import assert from "node:assert/strict";
import test from "node:test";
import {
  battleEffectKind,
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
  assert.match(prompt, /三个连续短段/);
  assert.match(prompt, /【主角】/);
  assert.match(prompt, /160至280个汉字/);
  assert.match(prompt, /绝不超过360个汉字/);
  assert.match(prompt, /命中、闪避、招架、伤害、当前气血、胜负/);
  assert.match(prompt, /起手、发力、行进路线或变招/);
  assert.match(prompt, /非必要不加入对话/);
  assert.match(prompt, /本回合所用武学/);
  assert.match(prompt, /原始出招句中的招式、动作方向、攻击部位/);
  assert.match(prompt, /不得把特色招式淡化/);
  assert.match(prompt, /不足一成只能是轻微疼痛/);
  assert.match(prompt, /不得写骨折、内伤或吐血/);
});

test("battle narration separates player, enemy and clash prose for distinct colors", () => {
  assert.deepEqual(parseBattleNarrativeSections(
    "【主角】踏步递掌。\n【对手】横肘封架。\n【交锋】掌肘相撞，各退半步。",
  ), [
    { speaker: "player", text: "踏步递掌。" },
    { speaker: "enemy", text: "横肘封架。" },
    { speaker: "clash", text: "掌肘相撞，各退半步。" },
  ]);
  assert.deepEqual(parseBattleNarrativeSections("旧模型的普通正文。"), [
    { speaker: "clash", text: "旧模型的普通正文。" },
  ]);
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
  input.facts.push("潘小莲横掌回击。", "两股掌力在身前相撞。");
  const fallback = buildBattleNarrationFallback(input);
  assert.match(fallback, /【主角】测试少侠/);
  assert.match(fallback, /【对手】潘小莲/);
  assert.match(fallback, /【交锋】两股掌力/);
});
