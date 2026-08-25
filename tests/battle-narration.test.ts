import assert from "node:assert/strict";
import test from "node:test";
import {
  battleEffectKind,
  battleFactAnchorMatches,
  battleFactIsImpact,
  battleFactTechniqueNames,
  battleNarrativeDisplaySections,
  battleNarrativeInvalidFactIndexes,
  battleNarrativeProseIsGrounded,
  battleNarrativeTextTokens,
  buildBattleNarrationFallback,
  buildBattleNarrationFacts,
  buildBattleNarrationPrompt,
  buildBattleNarrationRepairPrompt,
  mergeBattleNarrativeAnswers,
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
  assert.match(prompt, /第1句只对应第1行/);
  assert.match(prompt, /不得.*重新判断谁出招、谁应招/);
  assert.match(prompt, /【事实N】原始事实逐字复制/);
  assert.match(prompt, /每行演绎通常45至90个汉字/);
  assert.match(prompt, /经典金庸式武侠叙事/);
  assert.match(prompt, /命中、闪避、招架、伤害、当前气血、胜负/);
  assert.match(prompt, /起手、发力、行进路线或变招/);
  assert.match(prompt, /非必要不加入对话/);
  assert.match(prompt, /本回合所用武学/);
  assert.match(prompt, /原始出招句中的招式、动作方向、攻击部位/);
  assert.match(prompt, /不得把特色招式淡化/);
  assert.match(prompt, /不足一成只能是轻微疼痛/);
  assert.match(prompt, /不得写骨折、内伤或吐血/);
  assert.match(prompt, /不得凭空加入回血、疗伤、消耗资源/);
  assert.match(prompt, /不能遗漏、改数、重复、把数字写成中文/);
  assert.match(prompt, /招式名称.*必须在该行演绎中原字保留/);
});

test("battle narration strips old ownership labels and presents every line uniformly", () => {
  assert.deepEqual(parseBattleNarrativeSections(
    "【你出招】踏步递掌。\n【对手应招】横肘封架。\n【对手出招】旋身回掌。\n【你应招】卸力退开。",
  ), [
    { speaker: "clash", text: "踏步递掌。" },
    { speaker: "clash", text: "横肘封架。" },
    { speaker: "clash", text: "旋身回掌。" },
    { speaker: "clash", text: "卸力退开。" },
  ]);
  assert.deepEqual(parseBattleNarrativeSections("旧模型的普通正文。"), [
    { speaker: "clash", text: "旧模型的普通正文。" },
  ]);
});

test("battle prompt uses exact numbered fact anchors without ownership classification", () => {
  const input = event();
  const prompt = buildBattleNarrationPrompt(input), facts = buildBattleNarrationFacts(input);
  assert.doesNotMatch(prompt, /【你出招】|【对手应招】|【对手出招】|【你应招】/);
  assert.match(facts, /【事实1】测试少侠一掌拍向潘小莲。\n【事实2】潘小莲受到 16 点伤害。/);
  assert.match(facts, /逐字复制.*全角竖线“｜”/);
});

test("battle continuation preserves one output paragraph for every original log line", () => {
  const input = event();
  input.facts = ["你一掌拍出。", "潘小莲受到伤害。", "潘小莲退开。"];
  assert.equal(parseBattleNarrativeSections(buildBattleNarrationFallback(input)).length, input.facts.length);
  assert.equal(buildBattleNarrationFallback(input), input.facts.join("\n"));
  assert.match(buildBattleNarrationPrompt(input), /原始战报共有3句.*依次输出3行/);
});

test("battle display accepts only exact one-to-one fact anchors and colors real impacts red", () => {
  const input = event();
  assert.deepEqual(battleNarrativeDisplaySections(
    `【事实1】${input.facts[0]}｜少侠沉肩递掌，掌势由虚转实，直取中宫。\n` +
      `【事实2】${input.facts[1]}｜掌力落在肩头，潘小莲气血损去 16 点，随即稳住身形。`,
    input.facts,
  ), [
    { factIndex: 0, speaker: "clash", text: "少侠沉肩递掌，掌势由虚转实，直取中宫。" },
    { factIndex: 1, speaker: "impact", text: "掌力落在肩头，潘小莲气血损去 16 点，随即稳住身形。" },
  ]);
  assert.deepEqual(battleNarrativeDisplaySections(
    `【事实1】${input.facts[0]}｜掌势直取中宫。\n【事实2】${input.facts[1]}｜潘小莲肩头一沉，气血实损 16 点。`,
    input.facts,
  ).map((section) => section.speaker), ["clash", "impact"]);
  assert.equal(battleFactIsImpact("剑光掠过，却未能命中。"), false);
  assert.equal(battleFactIsImpact("招式虽中，却未伤到对手。"), true);
  assert.equal(battleFactIsImpact("命中大幅下降。"), false);
  assert.equal(battleFactIsImpact("太极刚劲造成 6453 点伤害。"), true);
  // 法术/灼烧等带修饰词的伤害行同样要标红。
  assert.equal(battleFactIsImpact("墨邪受到 500 点法术伤害。"), true);
  assert.equal(battleFactIsImpact("墨邪受到 120 点灼烧伤害。"), true);
  // 非气血损耗(如内力被挤)不标红。
  assert.equal(battleFactIsImpact("乙损失 350 点内力。"), false);
});

test("battle prose validator rejects changed numbers and facts borrowed from adjacent lines", () => {
  assert.equal(battleNarrativeProseIsGrounded(
    "茅盈受到 1720 点灼烧伤害。",
    "法火透体，茅盈受到 1720 点灼烧伤害。",
  ), true);
  assert.equal(battleNarrativeProseIsGrounded(
    "茅盈受到 1720 点灼烧伤害。",
    "法火透体，茅盈受到 1477 点灼烧伤害。",
  ), false);
  assert.equal(battleNarrativeProseIsGrounded(
    "茅盈受到 1720 点灼烧伤害。",
    "法火透体，茅盈受到一千四百七十七点灼烧重创。",
  ), false);
  assert.equal(battleNarrativeProseIsGrounded(
    "茅盈被雷光灼目，命中下降 8。",
    "视线骤暗，茅盈准备施展绝招「掌心雷」。",
  ), false);
  assert.equal(battleNarrativeProseIsGrounded(
    "连珠雷！",
    "雷火接连三次轰向对手。",
  ), false);
  assert.equal(battleNarrativeProseIsGrounded(
    "余鸿儒提气归元，恢复 11586 点气血，消耗 8913 点内力。",
    "余鸿儒提气归元，经脉间恢复 11586 点气血，却只写了内力消耗。",
  ), false);
  assert.equal(battleNarrativeProseIsGrounded(
    "余鸿儒提气归元，恢复 11586 点气血，消耗 8913 点内力。",
    "余鸿儒提气归元，恢复 11586 点气血，同时消耗 8913 点内力，气机旋即归稳。",
  ), true);
});

test("fact anchors tolerate punctuation and spacing while preserving exact content", () => {
  const fact = "你身形一转,周围一片火海,烈焰熊熊,半空中一个巨大的火球砸向余鸿儒。";
  assert.equal(battleFactAnchorMatches(
    fact,
    "你身形一转，周围一片火海，烈焰熊熊，半空中一个巨大的火球砸向余鸿儒！",
  ), true);
  assert.equal(battleFactAnchorMatches(fact, "你身形一转，火球砸向余鸿儒！"), false);
});

test("battle techniques and exact numbers are required and tokenized for highlighting", () => {
  assert.deepEqual(battleFactTechniqueNames("火风暴！"), ["火风暴"]);
  assert.deepEqual(
    battleFactTechniqueNames("余鸿儒一招「弯弓射雕」，手中精钢杖脱手飞出。"),
    ["弯弓射雕"],
  );
  assert.equal(battleNarrativeProseIsGrounded(
    "火风暴！",
    "烈焰随身法翻涌，巨大的火球自半空压下。",
  ), false);
  assert.equal(battleNarrativeProseIsGrounded(
    "火风暴！",
    "火风暴随身法翻涌，巨大的火球自半空压下。",
  ), true);
  assert.deepEqual(
    battleNarrativeTextTokens("火风暴轰落，余鸿儒受到 3664 点法术伤害。", "火风暴！余鸿儒受到 3664 点法术伤害。"),
    [
      { kind: "technique", text: "火风暴" },
      { kind: "text", text: "轰落，余鸿儒受到 " },
      { kind: "number", text: "3664" },
      { kind: "text", text: " 点法术伤害。" },
    ],
  );
});

test("reported spell chain remains one-to-one when model changes damage and invents later actions", () => {
  const facts = [
    "铁爪苍鹰俯冲抓伤茅盈，造成 50 点伤害。",
    "茅盈受到 1720 点灼烧伤害。",
    "连珠雷！",
    "你掐指念咒，电光缭绕雷声大作，一团雷火直袭茅盈。",
    "茅盈受到 3180 点法术伤害。",
    "茅盈被雷光灼目，命中下降 8。",
  ];
  const model = [
    `【事实1】${facts[0]}｜苍鹰破空落爪，造成 50 点伤害，茅盈肩头衣袍顿裂，身形微晃。`,
    `【事实2】${facts[1]}｜幽蓝法火透体，茅盈受到 1477 点灼烧重创。`,
    `【事实3】${facts[2]}｜雷声骤起，电光在施法者指掌之间盘旋。`,
    `【事实4】${facts[3]}｜电光裹住雷火，循着指诀所引直逼茅盈。`,
    `【事实5】${facts[4]}｜雷火轰然炸开，茅盈受到 3180 点法术伤害。`,
    `【事实6】${facts[5]}｜刺目雷光扰乱视线，茅盈准备施展绝招「掌心雷」。`,
    "茅盈提气归元，恢复 10192 点气血并耗去 9266 点内力。",
    "茅盈施展「天堂无路」，韦铭闪身避开。",
  ].join("\n");
  const sections = battleNarrativeDisplaySections(model, facts);
  assert.equal(sections.length, facts.length);
  assert.equal(sections[1].text, facts[1]);
  assert.equal(sections[5].text, facts[5]);
  assert.equal(sections[0].text, "苍鹰破空落爪，造成 50 点伤害，茅盈肩头衣袍顿裂，身形微晃。");
  assert.equal(sections[4].text, "雷火轰然炸开，茅盈受到 3180 点法术伤害。");
  assert.doesNotMatch(sections.map((section) => section.text).join(""), /1477|10192|9266|天堂无路/);
});

test("missing, reordered and still-streaming fact lines never shift onto neighbours", () => {
  const facts = ["甲抬掌。", "乙受到 20 点伤害。", "乙退开。"];
  const reordered = `【事实2】${facts[1]}｜掌力落下。\n【事实1】${facts[0]}｜甲沉肩发力。`;
  assert.deepEqual(
    battleNarrativeDisplaySections(reordered, facts).map((section) => section.text),
    facts,
  );
  const streaming = `【事实1】${facts[0]}｜甲沉肩发力。\n【事实2】${facts[1]}｜乙肩头一震。`;
  assert.deepEqual(battleNarrativeDisplaySections(streaming, facts, false), [
    { factIndex: 0, speaker: "clash", text: "甲沉肩发力。" },
  ]);
});

test("火风暴缺失段落 can be repaired without replacing valid prose with raw facts", () => {
  const input = event();
  input.facts = [
    "火风暴！",
    "你身形一转,周围一片火海,烈焰熊熊,半空中一个巨大的火球砸向余鸿儒。",
    "余鸿儒受到 3664 点法术伤害。",
    "你身形一转,周围一片火海,烈焰熊熊,半空中一个巨大的火球砸向余鸿儒。",
    "余鸿儒受到 2624 点法术伤害。",
    "你身形一转,周围一片火海,烈焰熊熊,半空中一个巨大的火球砸向余鸿儒。",
    "余鸿儒受到 4634 点法术伤害。",
    "余鸿儒提气归元，恢复 11586 点气血，消耗 8913 点内力。",
    "余鸿儒一招「弯弓射雕」，手中精钢杖脱手飞出，如箭矢般飞击你。",
    "你侧身避开。",
  ];
  const primary = input.facts.map((fact, index) => {
    const prose = [
      "火风暴随韦铭指诀骤起，滚滚热浪在身周聚成烈焰洪流。",
      "韦铭旋身引火，半空火球沿着炽热气浪直压余鸿儒面门。",
      "火劲正面轰中，余鸿儒气血随之损去 3664 点，脚下仍强自站稳。",
      "韦铭再转身形，火海翻卷，第二枚火球循着侧翼空门压落。",
      "烈焰透过护体真气，余鸿儒受到法术伤害，气息顿时一滞。",
      "韦铭第三度旋身聚火，半空巨球挟着熊熊烈焰直落余鸿儒身前。",
      "火球轰然炸散，余鸿儒受到 4634 点法术伤害，身形向后震退。",
      "余鸿儒提气归元，恢复 11586 点气血，同时消耗 8913 点内力，周身气机复稳。",
      "余鸿儒施展弯弓射雕，精钢杖脱手如箭，裹着劲风直取韦铭。",
      "韦铭看准杖势侧身避开，沉重杖影擦肩而过，未能沾身。",
    ][index];
    const anchor = index === 5 ? fact.replaceAll(",", "，") : fact;
    return `【事实${index + 1}】${anchor}｜${prose}`;
  }).join("\n");
  assert.deepEqual(battleNarrativeInvalidFactIndexes(primary, input.facts), [4]);
  const repairPrompt = buildBattleNarrationRepairPrompt(input, [4]);
  assert.match(repairPrompt, /【事实5】余鸿儒受到 2624 点法术伤害/);
  assert.match(repairPrompt, /必须包含数字：2624/);
  const repair = `【事实5】${input.facts[4]}｜烈焰再度透体，余鸿儒受到 2624 点法术伤害，护体真气应声震荡。`;
  const merged = mergeBattleNarrativeAnswers(primary, repair, input.facts);
  const sections = battleNarrativeDisplaySections(merged, input.facts);
  assert.equal(sections.length, input.facts.length);
  assert.equal(sections[4].text, "烈焰再度透体，余鸿儒受到 2624 点法术伤害，护体真气应声震荡。");
  assert.ok(sections.every((section, index) => section.text !== input.facts[index]));
  assert.match(sections[8].text, /弯弓射雕/);
});

test("震字诀三条原始日志只按原顺序续写，不再判断攻守归属", () => {
  const input = event();
  input.playerTechnique = "震字诀";
  input.facts = [
    "突然你双手左右连划，一个圆圈已将潘小莲套住，太极拳的震字诀随即使出！",
    "太极刚劲造成 6453 点伤害。",
    "潘小莲收招认输。",
  ];
  assert.equal(battleNarrativeDisplaySections(buildBattleNarrationFallback(input), input.facts).length, 3);
  assert.match(buildBattleNarrationPrompt(input), /不得描写任何一方兵器坠地、脱手或损毁/);
});

test("绝招反震和双方拼力同样只保留逐句顺序", () => {
  const input = event();
  input.playerTechnique = "震字诀";
  input.facts = ["突然你双手左右连划。", "内力反震，你踉跄倒退。"];
  assert.deepEqual(parseBattleNarrativeSections(buildBattleNarrationFallback(input)).map((item) => item.text), input.facts);
  input.facts = ["突然你双手左右连划。", "双方内力相拼，各自退开。"];
  assert.deepEqual(parseBattleNarrativeSections(buildBattleNarrationFallback(input)).map((item) => item.text), input.facts);
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

test("battle narration fallback preserves every original line without adding labels", () => {
  const input = event();
  input.facts.push("潘小莲横掌回击。", "你架开了这一掌。");
  const fallback = buildBattleNarrationFallback(input);
  assert.equal(fallback, input.facts.join("\n"));
  assert.doesNotMatch(fallback, /【|】/);
});
