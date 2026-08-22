import { originalTables } from "./original-data";
import { npcLore, npcMartialProfile, reputationLabel, WORLD_LORE } from "./npc-lore";
import type { OriginalBattle } from "./original-battle";
import type { SceneActorState } from "./scene-event";
import { combatSkillProfile } from "./skill-system";
import { actorStatusProfile, levelTier } from "./status-system";

export type BattleNarrative = {
  turn: number;
  facts: string[];
  text: string;
  effect: BattleEffectKind;
  loading: boolean;
  error: string;
};

export type BattleEffectKind =
  | "fist"
  | "sword"
  | "blade"
  | "staff"
  | "whip"
  | "spell"
  | "special"
  | "item";

export type BattleNarrativeSection = {
  speaker: "player" | "enemy" | "clash";
  text: string;
};

export type BattleNarrationEvent = {
  battle: OriginalBattle;
  actor: SceneActorState;
  mapName: string;
  facts: string[];
  playerHpBefore: number;
  enemyHpBefore: number;
  playerTechnique?: string;
  effectHint?: BattleEffectKind;
};

export function battleEffectKind(event: BattleNarrationEvent): BattleEffectKind {
  if (event.effectHint === "item") return "item";
  const source = `${event.playerTechnique || ""} ${event.facts.join(" ")}`;
  if (/剑/.test(source)) return "sword";
  if (/刀/.test(source)) return "blade";
  if (/[棍杖棒]/.test(source)) return "staff";
  if (/[鞭索]/.test(source)) return "whip";
  if (/[法术咒符雷火冰霜电罡气]/.test(source)) return "spell";
  if (event.effectHint) return event.effectHint;
  return "fist";
}

export function parseBattleNarrativeSections(text: string): BattleNarrativeSection[] {
  const marker = /【(主角|对手|交锋)】/g,
    matches = [...text.matchAll(marker)];
  if (!matches.length) return text.trim() ? [{ speaker: "clash", text: text.trim() }] : [];
  return matches.flatMap((match, index): BattleNarrativeSection[] => {
    const start = (match.index || 0) + match[0].length,
      end = matches[index + 1]?.index ?? text.length,
      content = text.slice(start, end).trim();
    if (!content) return [];
    return [{
      speaker: match[1] === "主角" ? "player" : match[1] === "对手" ? "enemy" : "clash",
      text: content,
    }];
  });
}

export function buildBattleNarrationFallback(event: BattleNarrationEvent) {
  const player: string[] = [], enemy: string[] = [], clash: string[] = [],
    playerName = event.actor.name || "主角";
  for (const fact of event.facts) {
    if (fact.startsWith(playerName)) player.push(fact);
    else if (fact.startsWith(event.battle.enemyName)) enemy.push(fact);
    else clash.push(fact);
  }
  const sections = [
    player.length ? `【主角】${player.join(" ")}` : "",
    enemy.length ? `【对手】${enemy.join(" ")}` : "",
    clash.length ? `【交锋】${clash.join(" ")}` : "",
  ].filter(Boolean);
  return sections.join("\n") || "【交锋】双方凝神对峙，胜负仍由下一回合决定。";
}

export function buildBattleNarrationPrompt(event: BattleNarrationEvent) {
  const { battle, actor, mapName } = event;
  const record = battle.enemyOverride || originalTables.enemies[battle.enemyId] || {};
  const lore = npcLore(battle.enemyId), martial = npcMartialProfile(battle.enemyId);
  const player = actorStatusProfile(actor);
  const playerCombat = combatSkillProfile(actor);
  const playerAttack = event.playerTechnique || String(
    originalTables.kungfus[playerCombat.attackId]?.name || "基本拳脚",
  );
  const enemyUses = (record.skill_use as number[] | undefined) || [];
  const enemyAttackId = battle.enemyWeaponId > 0
    ? enemyUses[1] || Number(originalTables.weapons[battle.enemyWeaponId]?.type || 0) + 3
    : enemyUses[0] || 2;
  const enemyAttack = String(originalTables.kungfus[enemyAttackId]?.name || "基本拳脚");
  const enemyWeapon = String(originalTables.weapons[battle.enemyWeaponId]?.name || "空手");
  const skills = ((record.skill_list as number[][] | undefined) || [])
    .filter(([, level]) => level > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, level]) => `${String(originalTables.kungfus[id]?.name || `武功${id}`)}${level}级`)
    .join("、") || "未显露明确传承";
  return `${WORLD_LORE}

你是武侠小说的现场战斗叙事者，要把游戏引擎已经结算完成的一回合战报凝练成简短、有临场感的武侠战斗正文。

【地点】${mapName}
【战斗性质】${battle.mode === "spar" ? "点到为止的切磋" : battle.mode === "story" ? "不可逃避的剧情决战" : "可能决出生死的实战"}
【玩家】${actor.name}，${actor.age}岁的${player.gender}性，${player.appearance}；出身${player.school}，师从${player.teacher}；综合武境第${player.realmTier}阶“${player.realm}”；使用${player.weapon}；名声道德属于“${reputationLabel(actor.morals)}”。
【对手】${battle.enemyName}，${Number(record.age || 30)}岁，${lore.appearance}；${lore.identity}；${lore.personality}；经历：${lore.background}；综合武境第${levelTier(martial.value)}阶“${martial.realm}”；使用${enemyWeapon}；主要武功：${skills}。
【本回合所用武学】玩家明确使用“${playerAttack}”；对手当前攻击武学为“${enemyAttack}”。引擎逐条事实中的原始出招句是本回合动作设计的第一依据。

写作要求：
1. 严格输出三个连续短段，并分别以“【主角】”“【对手】”“【交锋】”开头；除此以外不要标题、回合编号、项目符号、分析、属性面板或写作说明。“【主角】”只写玩家的起手、招式路线与变化，“【对手】”只写对手的招式、应对与反击，“【交锋】”写两股劲力相接后的命中、招架、伤害和局势结果。
2. 三段合计通常160至280个汉字，绝不超过360个汉字；每一段都要有明确动作推进，让双方像真实交手而不是轮流朗读战报，不铺陈背景或重复人物介绍。
3. 必须以引擎提供的事实为不可改变的骨架：命中、闪避、招架、伤害、当前气血、胜负与招式结果绝不能改写、颠倒或新增。
4. 必须保留并重点演绎原始出招句中的招式、动作方向、攻击部位、兵器和关键意象，围绕它具体描写起手、发力、路线、变招、拆解与落点；不得把特色招式淡化成泛泛的“一拳”“一掌”“一剑”，也不得换成双方没有使用的其他武功。
5. 每一方至少写清起手、发力、行进路线或变招中的两项，并写出双方距离和攻防节奏；只加入有助于看清交锋的兵刃碰撞、内力或可观察伤势，不要逐项堆砌无关环境、衣袂、神态和呼吸。
6. 非必要不加入对话；允许一声极短的喝声或闷哼，不能聊天，也不能凭空泄露隐秘设定。
7. 伤害数字只用于你判断轻重，正文不要机械念出“造成多少点伤害”；应转写成与气血比例一致的伤势表现，也不要渲染成超出结算结果的断肢或死亡。
8. 严格按本回合损失占最大气血的比例控制伤势：零伤害只能写卸力或未破防；不足一成只能是轻微疼痛、擦伤或气息波动；一至三成可以写明显疼痛、淤伤、踉跄，但事实未注明时不得写骨折、内伤或吐血；超过三成才可描写重创。只有结算明确落败或死亡时才能写失去战力或死亡。
9. 文风要像成熟的中文武侠小说：具体、有节奏、有空间感；避免空泛堆砌成语、重复形容词、现代网络用语和游戏系统口吻。
10. 承接此前正文，避免每回合重复介绍人物、场地或使用相同句式；结算事实已经清楚时宁可更短。`;
}

export function buildBattleNarrationFacts(event: BattleNarrationEvent) {
  const { battle, actor, facts, playerHpBefore, enemyHpBefore } = event;
  return `这是第${battle.turn}回合刚刚完成的唯一真实结算。以下逐条内容包含原始招式描述，必须在正文中得到清晰演绎：
${facts.map((line) => `- ${line}`).join("\n")}
结算前：${actor.name}气血${playerHpBefore}/${actor.maxHp}；${battle.enemyName}气血${enemyHpBefore}/${battle.enemyMaxHp}。
结算后：${actor.name}气血${actor.hp}/${actor.maxHp}；${battle.enemyName}气血${battle.enemyHp}/${battle.enemyMaxHp}。
战斗结果：${battle.finished === "win" ? `${actor.name}获胜` : battle.finished === "lose" ? `${actor.name}落败` : "双方仍可继续战斗"}。
请在完全遵守这些结果的前提下续写本回合正文。`;
}
