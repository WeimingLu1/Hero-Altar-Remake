import assert from "node:assert/strict";
import test from "node:test";
import maps from "../game-data/maps.json";
import {
  activePage,
  canMoveBetween,
  friendlyEventName,
  getOriginalMap,
  passable,
} from "../app/game-core/original-world";
import {
  resolveSceneEvent,
  type SceneActorState,
} from "../app/game-core/scene-event";
import {
  executeMapCommands,
  parseSceneGate,
  selectSceneEvent,
  supportedEventCodes,
} from "../app/game-core/rmxp-events";

const actor = (): SceneActorState => ({
  inventory: {},
  gold: 0,
  hp: 100,
  maxHp: 100,
  fp: 0,
  maxFp: 0,
  food: 100,
  water: 100,
  exp: 0,
  potential: 0,
  morals: 128,
  tanId: 0,
  teacherId: 0,
  classId: 0,
  gender: 0,
  face: 20,
  mp: 0,
  maxMp: 0,
  age: 14,
  baseBon: 20,
  baseInt: 20,
  baseAgi: 20,
  baseStr: 20,
  bon: 20,
  int: 20,
  agi: 20,
  str: 20,
  luck: 20,
  skills: {},
  weaponId: 0,
  armorIds: [],
  skillUse: [0, 0, 0, 0, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});

test("every command code used by the 69 shipped maps has an adapter", () => {
  const codes = new Set<number>();
  for (const map of maps.maps)
    for (const event of map.events)
      for (const page of event.pages)
        for (const command of page.commands) codes.add(command.code);
  assert.deepEqual(
    [...codes].sort((a, b) => a - b),
    [...supportedEventCodes].sort((a, b) => a - b),
  );
});
test("map Ruby condition subset respects inventory and tan progress", () => {
  const source =
    "if $game_actor.item_number(1,26)>0 or \n$game_actor.tan_id>6\n $scene=Scene_Event.new(13,64,0)\nend";
  assert.equal(
    selectSceneEvent(source, { inventory: {}, tanId: 0, freeWork: 0 }),
    undefined,
  );
  assert.deepEqual(
    selectSceneEvent(source, {
      inventory: { "1:26": 1 },
      tanId: 0,
      freeWork: 0,
    }),
    { type: 13, id: 64, extra: 0 },
  );
});

test("transfer and Scene_Event hooks retain exact arguments", () => {
  const result = executeMapCommands([
    { code: 201, indent: 0, parameters: [0, 22, 9, 9, 0, 0] },
    { code: 355, indent: 0, parameters: ["$scene=Scene_Event.new(13,64,0)"] },
  ]);
  assert.deepEqual(result.transfer, {
    mapId: 22,
    x: 9,
    y: 9,
    direction: 0,
    fade: 0,
  });
  assert.deepEqual(result.sceneEvent, { type: 13, id: 64, extra: 0 });
});

test("铸剑谷(67)有传回茅山(52)的出口，玩家不会被困住", () => {
  const map = getOriginalMap(67);
  const exit = map.events.find(
    (event) =>
      event.x === 9 &&
      event.y === 12 &&
      executeMapCommands(activePage(event).commands).transfer?.mapId === 52,
  );
  assert.ok(exit, "铸剑谷应存在传回茅山的出口事件");
});

test("parseSceneGate 解析被物品门槛锁住的坛入口，与条件是否满足无关", () => {
  const source =
    "if $game_actor.item_number(1,21)>0 or \n$game_actor.tan_id>1\n $scene=Scene_Event.new(13,59,0)\nend";
  const gate = parseSceneGate(source);
  assert.deepEqual(gate?.scene, { type: 13, id: 59, extra: 0 });
  assert.equal(gate?.itemId, 21);
  assert.equal(gate?.itemOp, ">");
  assert.equal(gate?.tanId, 1);
  // 缺少地图时 selectSceneEvent 不返回场景，但 parseSceneGate 仍能识别入口。
  assert.equal(
    selectSceneEvent(source, { inventory: {}, tanId: 0, freeWork: 0 }),
    undefined,
  );
});

test("parseSceneGate 解析时空尽头石板门(需六块三角石板)", () => {
  const gate = parseSceneGate(
    "if $game_actor.item_number(1,19)==6\n $scene=Scene_Event.new(8)\nend",
  );
  assert.deepEqual(gate?.scene, { type: 8, id: undefined, extra: undefined });
  assert.equal(gate?.scene?.type, 8);
  assert.equal(gate?.itemId, 19);
  assert.equal(gate?.itemOp, "==");
  assert.equal(gate?.itemCount, 6);
});

test("parseSceneGate 对无场景脚本与无条件入口都能正确处理", () => {
  assert.equal(parseSceneGate("if $game_actor.tan_id>1"), undefined);
  assert.equal(parseSceneGate(""), undefined);
  const plain = parseSceneGate("$scene=Scene_Event.new(13,66,0)");
  assert.deepEqual(plain?.scene, { type: 13, id: 66, extra: 0 });
  assert.equal(plain?.itemId, undefined);
  assert.equal(plain?.tanId, undefined);
});

test("internal transfer event names resolve to their destination map", () => {
  assert.equal(friendlyEventName("EV010", 24), "五指山");
  assert.equal(friendlyEventName("出口", 24), "出口");
  assert.equal(friendlyEventName("125"), "");
});

test("player movement ignores every RMXP wall and terrain passage flag", () => {
  for (const raw of maps.maps) {
    const map = getOriginalMap(raw.id);
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++)
        assert.equal(passable(map, x, y, 2), true);
  }
  const map = getOriginalMap(maps.maps[0].id);
  assert.equal(canMoveBetween(map, 0, 0, 6), true);
  assert.equal(canMoveBetween(map, 0, 0, 4), false);
  assert.equal(canMoveBetween(map, map.width - 1, map.height - 1, 2), false);
});

test("all 215 original Scene_Event interactables resolve to executable browser behavior", () => {
  const calls: Array<{ type: number; id?: number; extra?: number }> = [];
  for (const map of maps.maps)
    for (const event of map.events)
      for (const page of event.pages) {
        const source = page.commands
          .filter(
            (command: { code: number }) =>
              command.code === 355 || command.code === 655,
          )
          .map((command: { parameters: unknown[] }) =>
            String(command.parameters[0] || ""),
          )
          .join("\n");
        for (const match of source.matchAll(
          /Scene_Event\.new\(\s*(-?\d+)(?:\s*,\s*(-?\d+))?(?:\s*,\s*(-?\d+))?/g,
        ))
          calls.push({
            type: Number(match[1]),
            id: match[2] === undefined ? undefined : Number(match[2]),
            extra: match[3] === undefined ? undefined : Number(match[3]),
          });
      }
  assert.equal(calls.length, 215);
  const a = actor();
  a.maxFp = a.fp = 1000;
  a.roomLevel = 3;
  for (const call of calls)
    assert.doesNotMatch(resolveSceneEvent(call, a).tag, /^unknown:/);
  assert.deepEqual(
    [...new Set(calls.map((call) => call.type))].sort((a, b) => a - b),
    [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16],
  );
});
