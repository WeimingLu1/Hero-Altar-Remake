import assert from "node:assert/strict";
import test from "node:test";
import maps from "../game-data/maps.json";
import { executeMapCommands, selectSceneEvent, supportedEventCodes } from "../app/game-core/rmxp-events";

test("every command code used by the 69 shipped maps has an adapter", () => {
  const codes = new Set<number>();
  for (const map of maps.maps) for (const event of map.events) for (const page of event.pages) for (const command of page.commands) codes.add(command.code);
  assert.deepEqual([...codes].sort((a,b)=>a-b), [...supportedEventCodes].sort((a,b)=>a-b));
});
test("map Ruby condition subset respects inventory and tan progress",()=>{const source="if $game_actor.item_number(1,26)>0 or \n$game_actor.tan_id>6\n $scene=Scene_Event.new(13,64,0)\nend";assert.equal(selectSceneEvent(source,{inventory:{},tanId:0,freeWork:0}),undefined);assert.deepEqual(selectSceneEvent(source,{inventory:{"1:26":1},tanId:0,freeWork:0}),{type:13,id:64,extra:0});});

test("transfer and Scene_Event hooks retain exact arguments", () => {
  const result = executeMapCommands([
    { code: 201, indent: 0, parameters: [0, 22, 9, 9, 0, 0] },
    { code: 355, indent: 0, parameters: ["$scene=Scene_Event.new(13,64,0)"] },
  ]);
  assert.deepEqual(result.transfer, { mapId:22, x:9, y:9, direction:0, fade:0 });
  assert.deepEqual(result.sceneEvent, { type:13, id:64, extra:0 });
});
