import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  characterDirectionColumn,
  mapTheme,
  npcCharacterSprite,
} from "../app/original/world-renderer";

const worldSource = readFileSync(
  new URL("../app/original/original-world.tsx", import.meta.url),
  "utf8",
);
const rendererSource = readFileSync(
  new URL("../app/original/world-renderer.tsx", import.meta.url),
  "utf8",
);
const uiSource = readFileSync(
  new URL("../app/original/world-ui.tsx", import.meta.url),
  "utf8",
);
const ambientRuntimeSource = readFileSync(
  new URL("../app/original/use-ambient-runtime.ts", import.meta.url),
  "utf8",
);
const source = `${worldSource}\n${rendererSource}\n${uiSource}\n${ambientRuntimeSource}`;
const worldCss = readFileSync(
  new URL("../app/original/world.css", import.meta.url),
  "utf8",
);
const battleCss = readFileSync(
  new URL("../app/original/battle.css", import.meta.url),
  "utf8",
);
const specialCss = readFileSync(
  new URL("../app/original/special.css", import.meta.url),
  "utf8",
);
const menuCss = readFileSync(
  new URL("../app/original/menu.css", import.meta.url),
  "utf8",
);
const ambientSource = readFileSync(
  new URL("../app/game-core/ambient-npc.ts", import.meta.url),
  "utf8",
);
const ambientDialogueSource = readFileSync(
  new URL("../app/game-core/ambient-dialogue.ts", import.meta.url),
  "utf8",
);
const bubbleSource = readFileSync(
  new URL("../app/game-core/ambient-bubble-layout.ts", import.meta.url),
  "utf8",
);

test("player left and right directions use screen-facing sprite columns", () => {
  assert.equal(characterDirectionColumn(2), 0);
  assert.equal(characterDirectionColumn(4), 2);
  assert.equal(characterDirectionColumn(6), 1);
  assert.equal(characterDirectionColumn(8), 3);
});

test("NPC art selection uses original gender age role and description", () => {
  assert.deepEqual(npcCharacterSprite(2), { sheet: 1, row: 0 });
  assert.deepEqual(npcCharacterSprite(12), { sheet: 1, row: 1 });
  assert.equal(npcCharacterSprite(3).sheet, 2);
  assert.equal(npcCharacterSprite(110).portrait, 20);
  assert.equal(npcCharacterSprite(59).portrait, 21);
});

test("generic map characters never render an undefined speaker name", () => {
  assert.match(source, /function npcDisplayName\(id: number, fallback = "江湖人物"\)/);
  assert.match(source, /String\(npcRecord\(id\)\.name \|\| fallback\)/);
  assert.doesNotMatch(source, /setEventText\(`\$\{npcRecord\(id\)\.name\}/);
  assert.match(source, /setEventText\(`\$\{npcDisplayName\(id\)\}/);
});

test("environment art uses authored themes and entrance road networks", () => {
  assert.equal(mapTheme({ name: "平安小镇" }), "town");
  assert.equal(mapTheme({ name: "大雪山" }), "snow");
  assert.equal(mapTheme({ name: "时空的尽头" }), "scifi");
  assert.equal(mapTheme({ name: "桃花源" }), "forest");
  assert.match(rendererSource, /function authoredRoads/);
  assert.match(rendererSource, /function drawAuthoredTerrain/);
  assert.match(rendererSource, /executeMapCommands\(activePage\(event\)\.commands\)\.transfer/);
  assert.doesNotMatch(rendererSource, /wuxia-map-modules-v2\.png/);
  assert.doesNotMatch(rendererSource, /function drawEnvironmentCell/);
  assert.match(rendererSource, /function drawCleanBuilding/);
  assert.match(rendererSource, /function drawStoneFoundation/);
});

test("NPC marker stays above the character face", () => {
  assert.match(rendererSource, /y - 47 - \(pulse \? 2 : 0\)/);
});

test("portraits are shared by unified dialogue, status and battle", () => {
  assert.match(rendererSource, /function CharacterPortrait/);
  assert.match(worldSource, /className="dialog-portrait"/);
  assert.match(worldSource, /playerGender=\{state\.actor\.gender\}/);
  assert.match(uiSource, /className="status-portrait"/);
  assert.match(uiSource, /className="battle-portrait"/);
});

test("world orchestration consumes modal UI through its public boundary", () => {
  assert.match(worldSource, /from "\.\/world-ui"/);
  assert.match(worldSource, /<GameMenu/);
  assert.match(worldSource, /<BattleView/);
  assert.match(uiSource, /export function GameMenu/);
  assert.match(uiSource, /export function BattleView/);
  assert.doesNotMatch(worldSource, /function useDialogFocus/);
  assert.doesNotMatch(worldSource, /function CheatInner/);
});

test("world orchestration consumes the renderer through its public boundary", () => {
  assert.match(worldSource, /from "\.\/world-renderer"/);
  assert.match(worldSource, /drawWorld\(ctx,/);
  assert.match(worldSource, /loadWorldArt\(\)/);
  assert.doesNotMatch(worldSource, /function drawAuthoredTerrain/);
  assert.doesNotMatch(worldSource, /function npcCharacterSprite/);
  assert.doesNotMatch(worldSource, /staticMapCache/);
});

test("world orchestration consumes ambient NPC runtime through its public hook", () => {
  assert.match(worldSource, /from "\.\/use-ambient-runtime"/);
  assert.match(worldSource, /useAmbientRuntime\(\{/);
  assert.match(ambientRuntimeSource, /export function useAmbientRuntime/);
  assert.match(ambientRuntimeSource, /interruptAmbientPlayerConversation/);
  assert.match(ambientRuntimeSource, /ambientControllers\.current\.clear\(\)/);
  assert.doesNotMatch(worldSource, /const enrichAmbientPlayer/);
  assert.doesNotMatch(worldSource, /const enrichAmbientNpc/);
  assert.doesNotMatch(worldSource, /ambientControllers = useRef/);
});

test("unified active talk has dual portraits and continuous automatic dialogue", () => {
  assert.match(source, /npc-talk-portrait npc/);
  assert.match(source, /npc-talk-portrait player/);
  assert.match(source, /暂停发展/);
  assert.match(source, /function buildAutoPlayerPrompt|const buildAutoPlayerPrompt/);
  assert.match(source, /nextSpeaker: "主角"/);
  assert.match(source, /advanceNpcConversation/);
});

test("a nearby player can be addressed and join ambient NPC conversations", () => {
  assert.match(source, /now - lastPlayerMove\.current >= 450/);
  assert.match(source, /const ids = nearby\.map\(\(npc\) => npc\.eventId\)/);
  assert.match(source, /groupId = nearby\.length > 1/);
  assert.match(source, /buildAutoPlayerPrompt\(target\.npcId/);
  assert.match(source, /createAmbientPlayerState\(\)/);
});

test("ambient dialogue lifecycle rejects stale requests and ghost NPCs", () => {
  assert.match(source, /ambientEpoch\.current \+= 1/);
  assert.match(source, /ambientControllers\.current\.forEach\(\(_job, controller\) => controller\.abort\(\)\)/);
  assert.match(source, /Map<AbortController, \{ player: boolean; npcEventId\?: number \}>/);
  assert.match(source, /ambientPlayerEpoch/);
  assert.match(source, /if \(item\.speechTargetName && !target\) return false/);
  assert.match(source, /ambientShouldPause/);
  assert.match(source, /killList \|\| \[\]\)\.join/);
  assert.match(source, /if \(!passable\(map, x, y, direction\)\) return false/);
  assert.doesNotMatch(source, /visual\.kind !== "none" && visual\.kind !== "npc"/);
});

test("ambient conversations keep bounded context and highlight the player", () => {
  assert.match(source, /conversationContext/);
  assert.match(source, /slice\(-6\)/);
  assert.match(source, /maxOutputTokens: partner \? 150 : 96/);
  // 玩家气泡样式与布局在独立的 ambient-bubble-layout 模块
  assert.match(bubbleSource, /kind === "player"/);
  assert.match(bubbleSource, /#8ecbff/);
});

test("player ambient bubble is always on the highest layer", () => {
  assert.match(source, /bubbleShownAt/);
  // 玩家气泡永远最上层，NPC 气泡按出现时间堆叠
  assert.match(source, /first\.kind === "player" && second\.kind !== "player"/);
  assert.match(source, /first\.shownAt - second\.shownAt/);
  assert.ok(source.indexOf("ambientBubbles.push") < source.indexOf("ambientBubbles.sort"));
});

test("历史台词不会在气泡存活期后复活显示，玩家气泡无条件最上层", () => {
  // 每个 NPC 的气泡都在自己头顶、只在该台词存活期间显示；不再聚合历史会话卡。
  assert.match(source, /if \(roaming\?\.bubble\)/);
  assert.match(source, /roaming\.bubbleShownAt/);
  assert.match(source, /if \(playerAmbient\.bubble\)/);
  assert.match(source, /preferBelow: playerInConversation/);
  assert.doesNotMatch(source, /collectConversationCards/);
});

test("战报生成期间仍可打开战斗药品且中止战报不会永久锁定", () => {
  assert.match(source, /if \(k === "i"\) setBattleItem\(0\)/);
  assert.match(source, /if \(controller\.signal\.aborted\)[\s\S]*battleNarrationAbort\.current[\s\S]*loading: false/);
  assert.match(source, /text: item\.text \|\| buildBattleNarrationFallback\(event\),\s*loading: false/);
  assert.match(source, /openItem} disabled=\{Boolean\(battle\.finished\)\}/);
  assert.match(source, /const requestId = \+\+battleNarrationSerial\.current/);
  assert.match(source, /item\.requestId === requestId/);
});

test("离开游玩界面或卸载世界会中止主动交谈和战报请求", () => {
  assert.match(source, /runtimeMounted\.current = false/);
  assert.match(source, /activeChat\?\.abort\(\)/);
  assert.match(source, /activeNarration\?\.abort\(\)/);
  assert.match(source, /const returnToTitle = useCallback\([\s\S]*closeNpcChat\(\);[\s\S]*battleNarrationAbort\.current\?\.abort\(\)/);
  assert.match(source, /onClick=\{returnToTitle\}>主菜单/);
});

test("战报生成不能锁住普通攻击绝招或退出操作", () => {
  assert.doesNotMatch(
    source,
    /if \(!battle \|\| battle\.finished \|\| battleNarrativesRef\.current\.some/,
  );
  assert.doesNotMatch(
    source,
    /if \(!battle \|\| !id \|\| battleNarrativesRef\.current\.some/,
  );
  assert.doesNotMatch(source, /disabled=\{Boolean\(battle\.finished\) \|\| generating\}/);
});

test("ambient conversations open on a self-raised matter and demand depth", () => {
  assert.match(source, /isOpening = sessionContext\.length === 0/);
  assert.match(source, /自然地提起一件具体的/);
  assert.match(source, /空泛附和/);
});

test("group chats cycle through every member and mark the player bubble", () => {
  assert.match(source, /responderQueue/);
  assert.match(source, /participants\.length > 1 \? "群聊 · "/);
  assert.match(source, /让群聊其余成员随后轮流回应/);
  // 群成员回应时不强制对玩家：一半概率随机指向群里另一个人
  assert.match(source, /Math\.random\(\) < 0\.5/);
  assert.match(source, /responseTarget = peers\.length[\s\S]*peers\[Math\.floor\(Math\.random\(\) \* peers\.length\)\]/);
  assert.match(source, /speechTargetName = responseTarget\?\.name \|\| playerName/);
  assert.match(source, /speechTargetEventId = responseTarget\?\.eventId \|\| 0/);
});

test("self-talk and action bubbles carry an explicit speaker label", () => {
  assert.match(source, /npc\.name\}正在和环境交互：/);
  assert.match(source, /npc\.name\}自言自语：/);
  assert.match(source, /\$\{address\}“/); // 定向对话保留 to 路由
});

test("every directed ambient turn requires one-tile hearing distance", () => {
  assert.match(ambientSource, /target && !ambientCanHear\(speaker, target\)/);
  assert.match(source, /partner && !ambientCanHear\(npc, partner\)/);
  assert.match(source, /namedTarget && !ambientCanHear\(npc, namedTarget\)/);
  assert.match(source, /player moved out of hearing range/);
  assert.match(source, /conversationIsClose/);
  assert.match(source, /conversationIsClose\(item\)/);
});

test("ambient conversations strip narration and request spoken lines only", () => {
  assert.match(ambientDialogueSource, /function cleanAmbientSpeech/);
  assert.match(ambientDialogueSource, /function cleanAmbientAction/);
  assert.match(source, /严禁描写天气、风景、地点、环境/);
  assert.match(source, /只生成要求的口头台词，不补充任何背景描写/);
  assert.match(ambientDialogueSource, /spokenClauses/);
  assert.match(source, /禁止输出状态、动作、神态/);
  assert.match(source, /严禁描写天气、风景、地点、环境、声音、衣物、身体、动作或神态/);
  assert.match(source, /cleanAmbientSpeech\(line, \[npc\.name, (pairPartner|partner)\.name\]\)/);
  assert.match(source, /不得再次出现任何参与者姓名/);
  assert.match(source, /绝对不得输出或讨论 to、谁对谁/);
  assert.match(ambientDialogueSource, /\\s\+to\\s\+/);
});

test("ambient performance text is generated without canned fallback lines", () => {
  assert.match(source, /item\.generationPending && !item\.llmRequested/);
  assert.match(source, /LM Studio returned no usable ambient line/);
  assert.doesNotMatch(source, /const openers =/);
  assert.doesNotMatch(source, /retain the local fallback/);
  assert.match(source, /必须由模型现场生成/);
  assert.match(source, /npc\.bubbleKind === "action" \? cleanAmbientAction/);
});

test("LLM sessions use a player-first bounded priority queue", () => {
  assert.match(source, /activeNpcOnlySessions/);
  assert.match(source, /ambientConcurrency\.current = loadLlmSettings\(\)\.concurrency/);
  assert.match(source, /maxConcurrency - 1 - activeNpcOnlySessions/);
  assert.match(source, /isPlayerWork\(item\) \? 0/);
  assert.match(source, /sole dispatcher for ambient LLM work/);
  assert.match(source, /now - lastPlayerMove\.current >= 450/);
  assert.match(source, /world\.npcs\.filter\(\(npc\) => ambientCanHear\(npc, current\.position\)\)/);
  assert.match(source, /ambientPlayerStarts\.current = playerStarts/);
  assert.match(source, /npcIds: ids/);
  assert.match(source, /first\.queuedAt - second\.queuedAt/);
  assert.match(source, /ambientViewportBounds\(map\.width, map\.height/);
  assert.match(source, /ambientNpcInViewport\(item, viewport\)/);
  assert.doesNotMatch(source, /generationPending && !item\.llmRequested && item\.bubbleUntil > Date\.now/);
});

test("map entrances anchor coherent multi-tile buildings", () => {
  assert.match(source, /function drawMapStructures/);
  assert.match(source, /widthTiles = hashIndex/);
  assert.match(source, /drawCleanBuilding\(ctx/);
  assert.match(source, /column === doorColumn/);
});

test("named adult women remain distinct after strict child and elder guards", () => {
  assert.match(source, /阿绣: 20/);
  assert.match(source, /李青照: 21/);
  assert.doesNotMatch(source, /age >= 35 \|\|/);
  assert.match(source, /wuxia-characters-faction-signatures-v1\.webp/);
  assert.ok(source.indexOf("if (age >= 55)") < source.indexOf("if (/花间派"));
});

test("major factions receive authored landmark compounds", () => {
  assert.match(source, /function drawFactionLandmarks/);
  assert.match(source, /23, 25, 27, 36, 42, 52, 54/);
  assert.match(source, /map\.id >= 59/);
});

test("Flower School named women use distinct directional sprites", () => {
  assert.match(source, /阿绣: 0, 李青照: 1, 柳如是: 2, 聂隐娘: 3/);
  assert.match(source, /wuxia-characters-flower-variants-v1\.webp/);
});

test("indoor rooms receive type-specific furniture away from events", () => {
  assert.match(source, /function indoorFurniture/);
  assert.match(source, /if \(furniture !== undefined\) drawOverlayCell/);
  assert.match(source, /家中\|家\$\|店\|当铺/);
  assert.match(source, /客房\|家中\|家\$\|房屋/);
  assert.match(source, /杂货店\|豆腐店\|当铺/);
  assert.match(source, /!occupied\.has/);
  assert.match(source, /兵器行\|武馆/);
  assert.match(source, /客栈/);
  assert.match(source, /if \(mapTheme\(map\) === "indoor"\) return;/);
});

test("maps render a clean base before sparse transparent overlays", () => {
  assert.match(source, /overlay-nature-v3\.webp/);
  assert.match(source, /overlay-interior-v3\.webp/);
  assert.match(source, /atlasSource = interior \? source - 16 : source/);
  assert.match(source, /atlas\.naturalWidth \/ 4/);
  assert.match(source, /function drawOverlayCell/);
  assert.match(source, /function drawCleanBaseTile/);
  assert.match(source, /theme === "indoor" \? "#896746"/);
  assert.match(source, /seed % \(faction \? 37 : 31\)/);
  assert.match(source, /drawCleanBaseTile\(ctx, theme, road, faction, pingan/);
  assert.match(source, /drawOverlayCell\(ctx, decoration/);
  assert.match(source, /"grassland" \| "forest" \| "desert"/);
  assert.match(source, /时空的尽头.*"scifi"/);
  assert.match(source, /vegetationBorder/);
  assert.match(source, /besideRoad/);
});

test("world canvas renders characters props bubbles and text at high resolution", () => {
  assert.match(source, /new ResizeObserver\(resizeCanvas\)/);
  assert.match(source, /window\.devicePixelRatio/);
  assert.match(source, /ctx\.setTransform\(width \/ W, 0, 0, height \/ H/);
  assert.match(source, /ctx\.imageSmoothingEnabled = true/);
  assert.match(source, /ctx\.imageSmoothingQuality = "high"/);
  assert.match(worldSource, /observer\.disconnect\(\)/);
  assert.match(worldSource, /cancelAnimationFrame\(raf\)/);
  assert.match(worldSource, /drawWorld\(ctx, stateRef\.current, ambientWorld\.current, ambientPlayer\.current\)/);
  assert.doesNotMatch(worldCss, /image-rendering:\s*pixelated/);
});

test("双人和群聊台词各自显示在说话者头顶的小气泡", () => {
  assert.match(source, /if \(roaming\?\.bubble\)/);
  assert.match(source, /roaming\.partnerId/);
  assert.match(source, /preferBelow: below/);
  assert.match(source, /resolveAmbientBubbleLayout/);
  assert.match(source, /drawAmbientBubble\(ctx, bubble\)/);
  assert.doesNotMatch(source, /conversationSessionKey/);
  assert.doesNotMatch(source, /collectConversationCards/);
  assert.doesNotMatch(source, /drawConversationCard/);
});

test("indoor furnishing follows repeatable scene-specific patterns", () => {
  assert.match(source, /tableSet =/);
  assert.match(source, /for \(let y = 5; y < map\.height - 4; y \+= 4\)/);
  assert.match(source, /row\(3, 3, map\.width - 4, 3, 19\)/);
  assert.match(source, /\/杂货店\|豆腐店\|当铺\//);
  assert.match(source, /add\(x \+ 2, map\.height - 3, .*\? 8 : 10\)/);
});

test("factions and Pingan districts use full-map authored plans", () => {
  assert.match(source, /const factionMapIds = new Set/);
  assert.match(source, /const pinganUrbanMapIds = new Set\(\[2, 3, 5, 15\]\)/);
  assert.match(source, /function drawPinganTownPlan/);
  assert.match(source, /landscapedEdge/);
});

test("原作交谈保持任务优先并统一进入双立绘底部 LLM", () => {
  const chooseStart = worldSource.indexOf("const chooseNpc"),
    chooseEnd = worldSource.indexOf("const closeNpcChat", chooseStart),
    talkFlow = worldSource.slice(chooseStart, chooseEnd),
    llmEntry = talkFlow.lastIndexOf("openNpcConversation(id");
  assert.ok(chooseStart >= 0 && chooseEnd > chooseStart && llmEntry > 0);
  for (const originalBranch of [
    "tasks.visitId === id",
    "acceptFreeWork",
    "startStoneTask",
    "acceptWantedTask",
    "startTanQuest",
    "finishMainTask",
    "claimMainReward",
    "resolveSpecialNpcTalk",
    "hiddenQuestOffer",
  ])
    assert.ok(talkFlow.indexOf(originalBranch) < llmEntry, originalBranch);
  assert.match(worldSource, /probeLlmHealth\(controller\.signal\)/);
  assert.doesNotMatch(talkFlow, /option === "chat"/);
  assert.match(worldSource, /className=\{`npc-talk-dialog/);
  assert.match(worldSource, /npc-talk-portrait npc/);
  assert.match(worldSource, /npc-talk-portrait player/);
  assert.match(worldSource, /openOriginalNpcConversation/);
  assert.match(worldSource, /eventText \|\|[\s\S]*npcChat \|\|[\s\S]*taskBook/);
  assert.match(rendererSource, /generatedQuestCurrentNpc/);
  assert.match(rendererSource, /generatedQuestNpc\.mapId === map\.id/);
  assert.match(rendererSource, /generatedQuestNpc\.eventId === e\.id/);
  assert.match(worldSource, /generatedQuestInteraction\(activeQuest, ref\)/);
  assert.match(worldSource, /activeQuest && activeInteraction !== null/);
  assert.match(worldSource, /generatedQuestParticipant\(chat\.id, chat\.mapId, chat\.eventId\)/);
});

test("生成奇遇提议和各任务节点按完整台词单句收束", () => {
  const requestStart = worldSource.indexOf("const requestNpcReply"),
    requestEnd = worldSource.indexOf("const acceptNpcQuest", requestStart),
    requestFlow = worldSource.slice(requestStart, requestEnd);
  assert.ok(requestStart >= 0 && requestEnd > requestStart);
  assert.ok(requestFlow.indexOf("await streamNpcReply") < requestFlow.indexOf("pendingQuest: offerDraft"));
  assert.match(requestFlow, /只说一句催办对白/);
  assert.match(requestFlow, /只说一句承接发布人、缘由和来意的开战对白/);
  assert.match(requestFlow, /只说一句认下胜负并让玩家回发布人所在地图复命/);
  assert.match(worldSource, /terminal: "close" \| "battle" \| null/);
  assert.match(worldSource, /话音落下，切磋即将开始/);
  assert.match(worldSource, /className="generated-quest-sidebar"/);
  assert.doesNotMatch(worldSource, /当前奇遇尚未走到交手阶段/);
});

test("任务交谈预先锁定同一委托背景，战斗舞台按招式演出并统一逐句战报", () => {
  assert.match(worldSource, /plannedQuest: GeneratedQuestDraft \| null/);
  assert.match(worldSource, /同一委托的铺垫/);
  assert.match(worldSource, /异状、你的顾虑/);
  assert.match(worldSource, /相关人物关系、旧因/);
  assert.match(worldSource, /迫切风险与为何需要玩家相助/);
  assert.match(uiSource, /battleNarrativeDisplaySections/);
  for (const effect of ["fist", "sword", "blade", "staff", "whip", "spell", "special", "item"])
    assert.match(battleCss, new RegExp(`effect-${effect}`));
  assert.doesNotMatch(uiSource, /你出招|你应招|对手出招|对手应招|交锋结果/);
  assert.match(battleCss, /battle-log article small\{display:grid.*overflow:visible.*font-size:13px.*white-space:normal/);
  assert.match(battleCss, /battle-narrative-copy p\{display:block.*font-size:17px/);
  assert.match(battleCss, /narrative-impact\{color:#ff8f79/);
  assert.match(uiSource, /battleFactIsImpact\(fact\)/);
  assert.match(worldSource, /maxOutputTokens: Math\.min\(3072/);
  assert.match(battleCss, /prefers-reduced-motion/);
});

test("战斗界面提供完整行囊与临阵武学切换入口", () => {
  assert.match(uiSource, /行囊 <kbd>I<\/kbd>/);
  assert.match(uiSource, /武学 <kbd>M<\/kbd>/);
  assert.match(uiSource, /export function BattleBagPicker/);
  assert.match(uiSource, /export function BattleSkillPicker/);
  // 战斗内新增：双方内力/法力条、调息子菜单与对手情报面板。
  assert.match(uiSource, /className="side-bars"/);
  // 气血条同时显示当前气血、受伤后的可用上限与未受伤健康上限；
  // 日常侧栏和双方战斗条使用同一套分层语义。
  assert.match(uiSource, /function BattleResourceBar/);
  assert.match(uiSource, /className="battle-live-fact"/);
  assert.match(uiSource, /className=\{`battle-popup/);
  assert.match(uiSource, /aria-busy=\{Boolean\(playback\)\}/);
  assert.match(worldSource, /buildBattlePlayback/);
  assert.match(worldSource, /battlePlaybackRef\.current/);
  assert.match(battleCss, /battle-number-rise/);
  assert.match(battleCss, /transition:width \.5s/);
  assert.match(uiSource, /function BattleEffectStrip/);
  assert.match(uiSource, /battleStatusEffects\(battle, "enemy", enemyBurnRate\)/);
  assert.match(uiSource, /effects=\{playerEffects\}/);
  assert.match(uiSource, /effects=\{enemyEffects\}/);
  assert.match(uiSource, /ceiling=\{playerHealthyHp\}/);
  assert.match(uiSource, /ceiling=\{enemyHealthyHp\}/);
  assert.match(uiSource, /伤势 −\$\{wound\}/);
  assert.match(worldSource, /ceiling=\{fullHp\(state\.actor\)\}/);
  assert.match(uiSource, /调息 <kbd>O<\/kbd>/);
  assert.match(uiSource, /情报 <kbd>V<\/kbd>/);
  assert.match(uiSource, /export function BattleInnerPicker/);
  assert.match(uiSource, /export function BattleInfoPanel/);
  assert.match(worldSource, /setBattleInner\(0\)/);
  assert.match(worldSource, /setBattleInfo\(true\)/);
  // 生死战胜利处置：手下留情为默认第一项，杀死为第二项。
  assert.match(worldSource, /title="如何处置对手？"/);
  assert.match(worldSource, /items=\{\["手下留情", "杀死"\]\}/);
  assert.match(worldSource, /settleBattle\(index === 1\)/);
  // 战斗行囊复用主菜单 bag-list 的完整条目设计(分类、像素图标、描述、加成)。
  assert.match(uiSource, /className="bag-list battle-bag-list"/);
  assert.match(uiSource, /item-pixel kind-\$\{entry\.kind\}/);
  // 战斗武学与主菜单「功夫」页同一份完整清单，运用规则一致。
  assert.match(uiSource, /className="kungfu-list battle-kungfu-list"/);
  assert.match(uiSource, /E\/Enter 运用或卸下 · R 仅当前攻防武学与基本招架可设招架 · M\/X 返回/);
  // 招架入口只对原作允许的武学渲染(基本招架与当前攻防武学)。
  assert.match(uiSource, /canParryWith\(actor, skill\.id\) && \(/);
  // 选中行展开效果数据块。
  assert.match(uiSource, /skillEffectSummary\(actor, skill\)/);
  assert.match(menuCss, /\.skill-effect\s*\{[\s\S]*?grid-column: 1\/-1/);
  assert.match(worldSource, /battleBagEntries/);
  assert.match(worldSource, /临阵换装不消耗回合/);
});

test("绝招与战斗武学面板锁定视口并只滚动内部列表", () => {
  assert.match(uiSource, /className="special-picker-list"/);
  assert.match(uiSource, /scrollIntoView\(\{ block: "nearest" \}\)/);
  assert.match(specialCss, /grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(specialCss, /\.special-picker-list\s*\{[\s\S]*overflow-y:\s*auto/);
  // 新的行囊/功夫面板同样只滚动内部列表。
  assert.match(
    specialCss,
    /\.battle-bag-list,\s*\n\.battle-kungfu-list\s*\{[\s\S]*overflow-y:\s*auto/,
  );
  assert.match(specialCss, /\.special-picker\s*\{[\s\S]*overflow:\s*hidden/);
  // 绝招按所属武学类目分组，卡片内展示出处、伤害、效果与消耗。
  assert.match(uiSource, /className="kungfu-category"/);
  assert.match(uiSource, /所属 · \$\{special\.owner\}/);
  assert.match(uiSource, /special\.damage/);
  assert.match(uiSource, /className="special-card-effect"/);
  assert.match(specialCss, /\.special-picker-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  // 卡片采用物品菜单主题色：可见卡片底、金槽位、暖色正文与绿色效果。
  assert.match(specialCss, /\.special-picker-list button\s*\{[\s\S]*background:\s*#ffffff05/);
  assert.match(specialCss, /\.special-card-damage\s*\{[\s\S]*color:\s*#e0bf65/);
  assert.match(specialCss, /\.special-card-effect\s*\{[\s\S]*color:\s*#7fa489/);
});

test("奇遇选择保留完整委托对白并在任务簿展示完成日志", () => {
  assert.match(worldSource, /pendingQuest \? " has-offer"/);
  assert.match(worldSource, /委托原委保留在上方对白中，可滚动查看/);
  assert.match(worldSource, /className="task-journal-history"/);
  assert.match(worldSource, /已完成奇遇日志/);
  assert.match(worldSource, /generatedQuestHistory/);
  assert.match(worldSource, /奇遇任务完成并已自动保存/);
  assert.match(worldCss, /\.task-history-list[^}]*overflow-y:\s*auto/);
});

test("修炼面板分区展示调息/加力法点/按类目分组的练习", () => {
  assert.match(uiSource, /export function CultivationPanel/);
  assert.match(uiSource, /className="cultivation-actions"/);
  assert.match(uiSource, /cultivation-power-row/);
  assert.match(uiSource, /className="cultivation-practice"/);
  assert.match(uiSource, /className="kungfu-category"/);
  assert.match(worldSource, /adjustForcePower\(-10\)/);
  assert.match(worldSource, /adjustMagicPower\(10\)/);
  assert.match(menuCss, /\.cultivation-panel\s*\{/);
  assert.match(menuCss, /\.cultivation-actions\s*\{/);
});

test("任务簿当前奇遇卡片按阶段徽章/目标/奖励分区展示且对白单独滚动", () => {
  assert.match(worldSource, /generatedQuestStageName\(state\.tasks\.generatedQuest\.stage\)/);
  assert.match(worldSource, /className="task-quest-objective"/);
  assert.match(worldSource, /className="task-quest-reward"/);
  assert.match(worldCss, /\.task-journal-generated\s*\{[\s\S]*flex-direction:\s*column/);
  assert.match(worldCss, /\.task-transcript\s*\{[\s\S]*overflow:\s*auto/);
  assert.match(worldCss, /\.task-quest-stage\s*\{/);
});
