import assert from "node:assert/strict";
import test from "node:test";
import type { SceneActorState } from "../app/game-core/scene-event";
import {
  buyFurniture,
  createSword,
  customSwordBonus,
  customSwordDescription,
  reforgeSword,
  upgradeRoom,
} from "../app/game-core/life-system";
import { equipmentBonus } from "../app/game-core/inventory-system";

const actor = () =>
  ({
    inventory: {},
    gold: 3000000,
    hp: 100,
    maxHp: 100,
    fp: 0,
    maxFp: 0,
    food: 100,
    water: 100,
    exp: 200000,
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
    swordBattle: true,
    swordType: -1,
    haveNewHome: true,
    roomLevel: 1,
    jiajuList: [0, 0, 0, 0, 0],
  }) satisfies SceneActorState;

test("初铸四类兵器进入原作31号自制武器槽", () => {
  const a = actor();
  assert.equal(createSword(a, 1, "秋水").ok, true);
  assert.equal(a.swordType, 1);
  assert.equal(a.inventory["2:31"], 1);
});

test("重铸按经验一半收取金钱并增长重铸次数", () => {
  const a = actor();
  createSword(a, 0, "秋水");
  assert.equal(reforgeSword(a, () => 0).ok, true);
  assert.equal(a.gold, 2900000);
  assert.equal(a.swordTimes, 1);
});

test("自制武器31号槽将前中后缀数值计入人物属性", () => {
  const a = actor();
  a.weaponId = 31;
  a.sword1 = 45;
  a.sword2 = 309;
  a.sword3 = 215;
  assert.equal(equipmentBonus(a, "add_atk"), 45);
  assert.equal(equipmentBonus(a, "add_eva"), 9);
  assert.equal(equipmentBonus(a, "add_agi"), 15);
});

test("自制武器词缀说明按攻击、中缀与后缀生成", () => {
  const a = actor();
  a.sword1 = 45;
  a.sword2 = 309; // 中缀 type3=闪避 +9
  a.sword3 = 215; // 后缀 type2=敏捷 +15
  const text = customSwordBonus(a);
  assert.match(text, /攻击\+45/);
  assert.match(text, /闪避\+9/);
  assert.match(text, /敏捷\+15/);
  assert.match(customSwordBonus(actor()), /初铸兵器/);
});

test("自制武器初铸与重铸有动态描述", () => {
  const a = actor();
  createSword(a, 0, "秋水");
  assert.match(customSwordDescription(a), /凡品/);
  a.sword1 = 45;
  assert.match(customSwordDescription(a), /重铸淬炼/);
});

test("重铸结果说明词缀并提示福缘影响", () => {
  const a = actor();
  createSword(a, 0, "秋水");
  const result = reforgeSword(a, () => 0);
  assert.equal(result.ok, true);
  assert.match(result.text, /重铸完成/);
  assert.match(result.text, /福缘 20/);
});

test("房屋升级固定二百万且一级房仅容纳一件家具", () => {
  const a = actor();
  assert.equal(buyFurniture(a, 0).ok, true);
  assert.equal(buyFurniture(a, 1).ok, false);
  assert.equal(upgradeRoom(a).ok, true);
  assert.equal(a.roomLevel, 2);
});
