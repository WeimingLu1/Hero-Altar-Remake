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
  loading: boolean;
  error: string;
};

export type BattleNarrationEvent = {
  battle: OriginalBattle;
  actor: SceneActorState;
  mapName: string;
  facts: string[];
  playerHpBefore: number;
  enemyHpBefore: number;
  playerTechnique?: string;
};

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

你是武侠小说的现场战斗叙事者，要把游戏引擎已经结算完成的一回合战报扩写成有强烈临场感的武侠小说正文。

【地点】${mapName}
【战斗性质】${battle.mode === "spar" ? "点到为止的切磋" : battle.mode === "story" ? "不可逃避的剧情决战" : "可能决出生死的实战"}
【玩家】${actor.name}，${actor.age}岁的${player.gender}性，${player.appearance}；出身${player.school}，师从${player.teacher}；综合武境第${player.realmTier}阶“${player.realm}”；使用${player.weapon}；名声道德属于“${reputationLabel(actor.morals)}”。
【对手】${battle.enemyName}，${Number(record.age || 30)}岁，${lore.appearance}；${lore.identity}；${lore.personality}；经历：${lore.background}；综合武境第${levelTier(martial.value)}阶“${martial.realm}”；使用${enemyWeapon}；主要武功：${skills}。
【本回合所用武学】玩家明确使用“${playerAttack}”；对手当前攻击武学为“${enemyAttack}”。引擎逐条事实中的原始出招句是本回合动作设计的第一依据。

写作要求：
1. 只输出小说正文，不要标题、回合编号、项目符号、分析、属性面板或写作说明。
2. 通常写成4至8个自然段、约500至900个汉字；情节简单时可以略短，关键招式、重伤或胜负回合可以更充分。
3. 必须以引擎提供的事实为不可改变的骨架：命中、闪避、招架、伤害、当前气血、胜负与招式结果绝不能改写、颠倒或新增。
4. 必须保留并重点演绎原始出招句中的招式、动作方向、攻击部位、兵器和关键意象，围绕它具体描写起手、发力、路线、变招、拆解与落点；不得把特色招式淡化成泛泛的“一拳”“一掌”“一剑”，也不得换成双方没有使用的其他武功。
5. 在事实之间丰富身法轨迹、招式变化、兵刃与拳脚碰撞、内力流转、风声尘土、衣袂、神态、呼吸、疼痛和可观察到的伤势，让读者能看清动作的起承转合。
6. 可以加入符合人物身份、性情和局势的短促喝声、挑衅、闷哼或对话，但不能让人物长篇聊天，也不能凭空泄露隐秘设定。
7. 伤害数字只用于你判断轻重，正文不要机械念出“造成多少点伤害”；应转写成与气血比例一致的伤势表现，也不要渲染成超出结算结果的断肢或死亡。
8. 严格按本回合损失占最大气血的比例控制伤势：零伤害只能写卸力或未破防；不足一成只能是轻微疼痛、擦伤或气息波动；一至三成可以写明显疼痛、淤伤、踉跄，但事实未注明时不得写骨折、内伤或吐血；超过三成才可描写重创。只有结算明确落败或死亡时才能写失去战力或死亡。
9. 文风要像成熟的中文武侠小说：具体、有节奏、有空间感；避免空泛堆砌成语、重复形容词、现代网络用语和游戏系统口吻。
10. 承接此前正文，避免每回合重复介绍人物、场地或使用相同句式。`;
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
