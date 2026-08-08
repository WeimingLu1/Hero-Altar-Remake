import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/original/original-world.tsx", import.meta.url),
  "utf8",
);
const ambientSource = readFileSync(
  new URL("../app/game-core/ambient-npc.ts", import.meta.url),
  "utf8",
);
const bubbleSource = readFileSync(
  new URL("../app/game-core/ambient-bubble-layout.ts", import.meta.url),
  "utf8",
);

test("player left and right directions use screen-facing sprite columns", () => {
  assert.match(source, /direction === 4 \? 2 : direction === 6 \? 1/);
});

test("NPC art selection uses original gender age role and description", () => {
  assert.match(source, /npc\.gender/);
  assert.match(source, /npc\.age/);
  assert.match(source, /npc\.type/);
  assert.match(source, /npc\.des_text/);
  assert.match(source, /和尚\|大师\|方丈/);
  assert.match(source, /捕快\|官\|衙门/);
  assert.match(source, /盗\|匪\|恶\|杀手/);
});

test("environment art uses authored themes and entrance road networks", () => {
  assert.match(source, /function mapTheme/);
  assert.match(source, /function authoredRoads/);
  assert.match(source, /function drawAuthoredTerrain/);
  assert.match(source, /executeMapCommands\(activePage\(event\)\.commands\)\.transfer/);
});

test("NPC marker stays above the character face", () => {
  assert.match(source, /y - 47 - \(pulse \? 2 : 0\)/);
});

test("portraits are shared by dialogue chat status and battle", () => {
  assert.match(source, /function CharacterPortrait/);
  assert.match(source, /className="dialog-portrait"/);
  assert.match(source, /className="chat-portrait"/);
  assert.match(source, /className="status-portrait"/);
  assert.match(source, /className="battle-portrait"/);
});

test("free chat has a fixed history region and continuous automatic dialogue", () => {
  assert.match(source, /className="npc-chat-log"/);
  assert.match(source, /className="npc-chat-stage"/);
  assert.match(source, /自动对话中/);
  assert.match(source, /function buildAutoPlayerPrompt|const buildAutoPlayerPrompt/);
  assert.match(source, /nextSpeaker: "主角"/);
  assert.match(source, /last\?\.role === "user"/);
});

test("a nearby player can be addressed and join ambient NPC conversations", () => {
  assert.match(source, /now - lastPlayerMove\.current >= 450/);
  assert.match(source, /const ids = nearby\.map\(\(npc\) => npc\.eventId\)/);
  assert.match(source, /groupId = nearby\.length > 1/);
  assert.match(source, /buildAutoPlayerPrompt\(target\.npcId/);
  assert.match(source, /ambientPlayer\.current = \{ npcIds: \[\], replyToNpcId: 0, bubble: ""/);
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

test("every directed ambient turn requires one-tile hearing distance", () => {
  assert.match(ambientSource, /target && !ambientCanHear\(speaker, target\)/);
  assert.match(source, /partner && !ambientCanHear\(npc, partner\)/);
  assert.match(source, /namedTarget && !ambientCanHear\(npc, namedTarget\)/);
  assert.match(source, /player moved out of hearing range/);
  assert.match(source, /conversationIsClose/);
  assert.match(source, /conversationIsClose\(item\)/);
});

test("ambient conversations strip narration and request spoken lines only", () => {
  assert.match(source, /const cleanAmbientSpeech/);
  assert.match(source, /const cleanAmbientAction/);
  assert.match(source, /严禁描写天气、风景、地点、环境/);
  assert.match(source, /只生成要求的口头台词，不补充任何背景描写/);
  assert.match(source, /spokenClauses/);
  assert.match(source, /禁止输出状态、动作、神态/);
  assert.match(source, /严禁描写天气、风景、地点、环境、声音、衣物、身体、动作或神态/);
  assert.match(source, /cleanAmbientSpeech\(line, \[npc\.name, partner\.name\]\)/);
  assert.match(source, /不得再次出现任何参与者姓名/);
  assert.match(source, /绝对不得输出或讨论 to、谁对谁/);
  assert.match(source, /\\s\+to\\s\+/);
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
  assert.match(source, /Math\.max\(0, 2 - activeNpcOnlySessions\)/);
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
  assert.match(source, /row === 2 && column === doorColumn/);
});

test("named adult women remain distinct after strict child and elder guards", () => {
  assert.match(source, /阿绣: 20/);
  assert.match(source, /李青照: 21/);
  assert.doesNotMatch(source, /age >= 35 \|\|/);
  assert.match(source, /wuxia-characters-faction-signatures-v1\.png/);
  assert.ok(source.indexOf("if (age >= 55)") < source.indexOf("if (/花间派"));
});

test("major factions receive authored landmark compounds", () => {
  assert.match(source, /function drawFactionLandmarks/);
  assert.match(source, /23, 25, 27, 36, 42, 52, 54/);
  assert.match(source, /map\.id >= 59/);
});

test("Flower School named women use distinct directional sprites", () => {
  assert.match(source, /阿绣: 0, 李青照: 1, 柳如是: 2, 聂隐娘: 3/);
  assert.match(source, /wuxia-characters-flower-variants-v1\.png/);
});

test("indoor rooms receive type-specific furniture away from events", () => {
  assert.match(source, /function indoorFurniture/);
  assert.match(source, /wuxia-indoor-furniture-v1\.png/);
  assert.match(source, /!occupied\.has/);
  assert.match(source, /兵器行\|武馆/);
  assert.match(source, /客栈/);
  assert.match(source, /if \(mapTheme\(map\) === "indoor"\) return;/);
});

test("factions and Pingan districts use full-map authored plans", () => {
  assert.match(source, /const factionMapIds = new Set/);
  assert.match(source, /const pinganUrbanMapIds = new Set\(\[2, 3, 5, 15\]\)/);
  assert.match(source, /function drawPinganTownPlan/);
  assert.match(source, /landscapedEdge/);
});
