import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/original/original-world.tsx", import.meta.url),
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
  assert.match(source, /自动对话中/);
  assert.match(source, /function buildAutoPlayerPrompt|const buildAutoPlayerPrompt/);
  assert.match(source, /nextSpeaker: "主角"/);
  assert.match(source, /last\?\.role === "user"/);
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
