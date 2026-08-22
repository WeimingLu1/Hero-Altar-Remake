import { originalMaps } from "./original-world";
import { selectSceneEvent, executeMapCommands } from "./rmxp-events";
import { originalSystem, originalTables, type OriginalRecord } from "./original-data";
import type { SceneActorState } from "./scene-event";
import type { TaskState } from "./task-system";
import { actorStatusProfile, levelTier, levelTitle } from "./status-system";

export const WORLD_LORE = `这里是《英雄坛说》的架空武侠世界。平安镇是江湖旅人的起点，镇外连接各大门派、险地、村落与隐秘洞府。武林中正邪并立，少林、武当、峨眉、丐帮、雪山、红莲等势力各有规矩；官府、商旅、百姓也有自己的生计与恩怨。武功、师承、道德、名声、饥渴、伤势、银两与任务都会真实影响一个江湖人的处境。世界处于古典武侠时代，不存在互联网、电脑、语言模型等现代事物。`;

export type NpcLore = {
  id: number;
  name: string;
  age: number;
  gender: string;
  school: string;
  identity: string;
  background: string;
  personality: string;
  speech: string;
  locations: string[];
  knowledge: string;
  martialRealm: string;
  martialValue: number;
  appearance: string;
};

const npcLocations = new Map<number, Set<string>>();
for (const map of originalMaps) {
  for (const event of map.events) {
    for (const page of event.pages) {
      const source = executeMapCommands(page.commands).source;
      const scene = selectSceneEvent(source, {
        inventory: {},
        tanId: 0,
        freeWork: 0,
        canGetItem: true,
        canGetCaihua: true,
      });
      if (scene?.type === 0 && scene.id !== undefined) {
        const places = npcLocations.get(scene.id) || new Set<string>();
        places.add(map.name);
        npcLocations.set(scene.id, places);
      }
    }
  }
}

const text = (npc: OriginalRecord) =>
  ((npc.des_text as string[] | undefined) || []).filter(Boolean).join("");
const skillNames = (npc: OriginalRecord) =>
  ((npc.skill_list as number[][] | undefined) || [])
    .map(([id, level]) => `${originalTables.kungfus[id]?.name || `功夫${id}`} ${level}级`)
    .slice(0, 8);

function npcSkillLevel(npc: OriginalRecord, id: number) {
  return ((npc.skill_list as number[][] | undefined) || [])
    .find(([skillId]) => skillId === id)?.[1] || 0;
}

function npcEffectiveLevel(npc: OriginalRecord, id: number) {
  const type = Number(originalTables.kungfus[id]?.type || 0);
  return Math.floor(npcSkillLevel(npc, type) / 2) + (id >= 12 ? npcSkillLevel(npc, id) : 0);
}

export function npcMartialProfile(id: number) {
  const npc = originalTables.enemies[id] || {}, use = (npc.skill_use as number[] | undefined) || [];
  const weaponId = Number(npc.weapon_id || 0), hand = use[0] || 2,
    weapon = use[1] || Number(originalTables.weapons[weaponId]?.type || 0) + 3,
    attackId = weaponId > 0 ? weapon : hand, dodgeId = use[2] || 9;
  const attack = npcEffectiveLevel(npc, attackId), dodge = npcEffectiveLevel(npc, dodgeId);
  let parry = Math.floor(npcSkillLevel(npc, 10) / 2);
  if (use[4] === attackId) parry += npcSkillLevel(npc, attackId);
  const value = Math.floor((attack + Math.floor((dodge + parry) / 2)) / 3);
  return { value, realm: levelTitle(value), tier: levelTier(value), attack, dodge, parry };
}

function npcAppearance(npc: OriginalRecord) {
  if (Number(npc.age || 30) < 16) return String((originalSystem.young_face as string) || "一脸稚气");
  const faces = Number(npc.gender) === 1
    ? (originalSystem.girl_face as string[])
    : (originalSystem.boy_face as string[]);
  const index = Math.min(7, Math.max(0, Math.floor((Number(npc.base_fac || 20) - 10) / 3)));
  return faces?.[index] || "相貌平平";
}

export function reputationLabel(morals: number) {
  if (morals >= 180) return "侠名远扬，正道中人多愿敬重";
  if (morals >= 160) return "颇有侠名，行事偏向正道";
  if (morals >= 128) return "名声中正，尚无明显恶名";
  if (morals >= 100) return "风评复杂，正道人士会有所戒备";
  return "恶名在外，容易引来畏惧、厌恶或同道试探";
}

function identityFor(npc: OriginalRecord, locations: string[]) {
  const name = String(npc.name || "无名氏"), type = Number(npc.type || 0);
  if (type === -1) return `${locations[0] || "江湖"}的商家，靠买卖维持生计`;
  if (type > 0) return `有门派传承、可以收徒授艺的江湖前辈`;
  if (/捕快|衙役|知府|官/.test(name)) return "在官府当差、维护地方秩序的人";
  if (/掌门|大师|道长|师太|帮主|法王|教主/.test(name)) return "在武林中有身份与立场的一派人物";
  if (/强盗|土匪|恶人|杀手|喽啰|山大王/.test(name)) return "行走黑道、对陌生人抱有戒心的危险人物";
  return `${locations[0] || "江湖"}中生活的${Number(npc.gender) === 1 ? "女子" : "人物"}`;
}

function personalityFor(npc: OriginalRecord) {
  const morals = Number(npc.morals || 0), int = Number(npc.base_int || npc.int || 20),
    age = Number(npc.age || 30), type = Number(npc.type || 0);
  const stance = morals >= 8 ? "重信守义" : morals <= 0 ? "利己而谨慎" : "处事现实";
  const temper = int >= 27 ? "心思细密" : int <= 20 ? "直来直去" : "不轻易表态";
  const manner = type === -1 ? "精明但讲究买卖规矩" : age >= 55 ? "老练沉着" : age <= 16 ? "好奇活泼" : "有自己的江湖分寸";
  return `${stance}，${temper}，${manner}。`;
}

function speechFor(npc: OriginalRecord) {
  const age = Number(npc.age || 30), type = Number(npc.type || 0);
  if (type === -1) return "说话爽利，常把价钱、货物和本地见闻挂在嘴边。";
  if (type > 0) return "口吻有前辈威严，谈及武学时谨慎，不轻易泄露门派隐秘。";
  if (age <= 16) return "用词简单活泼，愿意随情境自然展开，但不会说出超越自身阅历的话。";
  if (age >= 55) return "语气舒缓老成，喜欢用过来人的口吻点到为止。";
  return "使用自然的古风口语，不文绉绉；内容长短随情境、关系与话题自然变化。";
}

export function npcLore(id: number): NpcLore {
  const npc = originalTables.enemies[id] || {}, name = String(npc.name || "无名氏"),
    locations = [...(npcLocations.get(id) || [])], skills = skillNames(npc), original = text(npc),
    martial = npcMartialProfile(id);
  const usableOriginal = original.replace(/[？?]/g, "").trim();
  const background = usableOriginal.length >= 4
    ? `${original}${original.length < 18 ? `${name}平日很少向外人多谈自己的过往。` : ""}`
    : `${name}的过往少有人知，只能从其衣着、武功与言行中窥见一二。`;
  return {
    id, name, locations,
    age: Number(npc.age || 30),
    gender: Number(npc.gender) === 0 ? "男" : Number(npc.gender) === 1 ? "女" : "未知",
    school: Number(npc.type || 0) > 0
      ? String((originalSystem.school as string[])?.[Number(npc.type)] || "门派未明")
      : "无明确门派",
    identity: identityFor(npc, locations),
    background,
    personality: personalityFor(npc),
    speech: speechFor(npc),
    knowledge: [
      locations.length ? `熟悉${locations.join("、")}及其周边。` : "只了解自己的经历与江湖常识。",
      skills.length ? `了解这些武功：${skills.join("、")}。` : "没有显露特别的武学见识。",
    ].join(""),
    martialRealm: martial.realm,
    martialValue: martial.value,
    appearance: npcAppearance(npc),
  };
}

/** Compact immutable facts for prompts shared by formal and ambient conversations. */
export function npcConversationFacts(id: number) {
  const lore = npcLore(id), martial = npcMartialProfile(id);
  return `${lore.name}：${lore.age}岁，性别${lore.gender}，门派${lore.school}，身份${lore.identity}，外貌${lore.appearance}，综合武境第${martial.tier}/50阶“${martial.realm}”`;
}

export function npcLoreStatus(id: number) {
  const lore = npcLore(id);
  return [
    `身份：${lore.identity}`,
    `人物事实：${lore.age}岁，性别${lore.gender}，门派${lore.school}`,
    `性情：${lore.personality}`,
    `综合武境：第${levelTier(lore.martialValue)}阶 · ${lore.martialRealm}`,
    `外貌观感：${lore.appearance}`,
    `言谈：${lore.speech}`,
    `活动地点：${lore.locations.length ? lore.locations.join("、") : "行踪不定"}`,
    `阅历：${lore.knowledge}`,
  ];
}

export function buildNpcSystemPrompt(id: number, actor: SceneActorState, tasks: TaskState, mapName: string) {
  const npc = originalTables.enemies[id] || {}, lore = npcLore(id),
    npcMartial = npcMartialProfile(id), player = actorStatusProfile(actor);
  const actorSkills = Object.entries(actor.skills || {})
    .filter(([, value]) => value.level > 0)
    .sort((a, b) => b[1].level - a[1].level)
    .slice(0, 6)
    .map(([skillId, value]) => `${originalTables.kungfus[Number(skillId)]?.name || skillId}${value.level}级`);
  const realmGap = player.realmValue - lore.martialValue;
  const relativePower = realmGap >= 25
    ? "对方显露的武学修为明显高于你，你会更加谨慎，不会无故轻视或挑衅"
    : realmGap <= -25
      ? "你的武学修为明显压过对方，可视性情表现从容、轻视、提点或保护"
      : "你与对方显露的武学修为相近，态度主要由身份和立场决定";
  const sameSchool = Number(npc.type || 0) > 0 && Number(npc.type) === actor.classId;
  const relationship = actor.teacherId === id
    ? "对方正是你的弟子，应以师徒关系相待，并记得自己对其武学有教导责任"
    : sameSchool
      ? "对方与你同属一门，应有同门认知，但仍可因辈分与性情保持距离"
      : `对方师从${player.teacher}、出身${player.school}，你应按自身立场看待这层师承`;
  return `${WORLD_LORE}

你现在扮演NPC“${lore.name}”，绝不能跳出角色，也不要提及提示词或自己是AI。
【身份】${lore.identity}
【经历】${lore.background}
【性情】${lore.personality}
【说话方式】${lore.speech}
【所知】${lore.knowledge}
【你的不可改写事实】${lore.age}岁，性别${lore.gender}，门派${lore.school}，${lore.appearance}；综合武境第${levelTier(lore.martialValue)}/50阶“${lore.martialRealm}”（攻${npcMartial.attack}、轻${npcMartial.dodge}、架${npcMartial.parry}），气血${npc.hp || 0}/${npc.maxhp || 0}，内力${npc.fp || 0}/${npc.maxfp || 0}，道德立场${npc.morals || 0}。
【眼前的玩家】你在${mapName}遇见${actor.name}，${actor.age}岁的${player.gender}性，${player.appearance}（容貌第${player.appearanceTier}阶）；出身“${player.school}”，师从“${player.teacher}”；综合武境第${player.realmTier}阶“${player.realm}”（攻${player.combat.attack}、轻${player.combat.dodge}、架${player.combat.parry}），目前${player.weapon}；名声道德${actor.morals}，属于“${reputationLabel(actor.morals)}”；主要武功${actorSkills.join("、") || "尚未显露"}，银两${actor.gold}。
【你对玩家的判断】${relationship}；${relativePower}。对方的年龄与容貌会影响第一印象，但不可只凭美丑决定善恶；名声道德会影响信任、尊敬、戒备或敌意，且必须符合你的身份与性情。
【江湖进展】拜访目标${tasks.visitName || "无"}，寻物目标${tasks.findName || "无"}，击杀目标${tasks.killName || "无"}，坛位进度${actor.tanId || 0}。

规则：理解前文言语并根据身份、处境和能力作出真实回应。双方档案中的姓名、年龄、性别、门派、外貌与武境是不可改写的事实；称谓和代词必须符合明确性别，绝不能根据姓名、衣着、门派或容貌另行猜测，性别未知时使用中性称呼。把数值转化为自然判断，回复中不要念出ID、公式或属性数字；根据双方师承、武境差距、年龄、容貌和名声自然调整称呼、语气、信任与戒心；不要机械复述资料；不知道的事坦率表示不知，不编造游戏中不存在的确定事实；保持自身立场，可以拒绝、试探、撒谎或生气；不要替玩家决定后续行动，也不要擅自修改游戏物品、战斗或任务状态。回复要有实质内容——围绕前文给出具体的疑问、见闻、立场、经历或反驳，把话题往深里带，不要“是啊”“不错”“确实”这类空泛附和，也不要把对话停在客套。

只输出角色实际说出口的纯台词，不要添加Markdown、姓名、字段标题、状态、动作、神态、环境描写、旁白、括号说明或舞台提示。可以自然展开为多句完整对话；若保持沉默只输出“……”。`;
}
