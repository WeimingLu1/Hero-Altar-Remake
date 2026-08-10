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
  type SwordData,
} from "../app/game-core/life-system";
import { equipmentBonus } from "../app/game-core/inventory-system";

const actor = () =>
  ({
    inventory: {} as Record<string, number>,
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
    swords: [
      { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
      { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
      { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
      { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
    ] as SwordData[],
    haveNewHome: true,
    roomLevel: 1,
    jiajuList: [0, 0, 0, 0, 0],
  }) satisfies SceneActorState;

test("四类兵器各自进入对应自制武器槽(2:31-2:34)并可分别铸造", () => {
  const a = actor();
  assert.equal(createSword(a, 1, "秋水").ok, true);
  assert.equal(a.swords![1].forged, true);
  assert.equal(a.inventory["2:32"], 1);
  assert.equal(createSword(a, 3, "玄铁鞭").ok, true);
  assert.equal(a.inventory["2:34"], 1);
  assert.equal(a.swords![0].forged, false, "未铸造的类型保持未铸造");
});

test("重铸按类型独立计费并增长该类型的重铸次数", () => {
  const a = actor();
  createSword(a, 0, "秋水");
  assert.equal(reforgeSword(a, 0, () => 0).ok, true);
  assert.equal(a.gold, 2900000);
  assert.equal(a.swords![0].times, 1);
});

test("自制武器31号槽将前中后缀数值计入人物属性", () => {
  const a = actor();
  a.swords = [
    { forged: true, name: "秋水", atk: 45, mid: 309, suf: 215, times: 1 },
    { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
    { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
    { forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 },
  ];
  a.weaponId = 31;
  assert.equal(equipmentBonus(a, "add_atk"), 45);
  assert.equal(equipmentBonus(a, "add_eva"), 9);
  assert.equal(equipmentBonus(a, "add_agi"), 15);
});

test("自制武器词缀说明按攻击、中缀与后缀生成", () => {
  const sword = { forged: true, name: "秋水", atk: 45, mid: 309, suf: 215, times: 1 };
  const text = customSwordBonus(sword);
  assert.match(text, /攻击\+45/);
  assert.match(text, /闪避\+9/);
  assert.match(text, /敏捷\+15/);
  assert.match(
    customSwordBonus({ forged: false, name: "", atk: 0, mid: 0, suf: 0, times: 0 }),
    /初铸兵器/,
  );
});

test("自制武器初铸与重铸有动态描述", () => {
  const a = actor();
  createSword(a, 0, "秋水");
  assert.match(customSwordDescription(a.swords![0], 0), /凡品/);
  a.swords![0].atk = 45;
  assert.match(customSwordDescription(a.swords![0], 0), /重铸淬炼/);
});

test("重铸结果说明词缀并提示福缘影响", () => {
  const a = actor();
  createSword(a, 0, "秋水");
  const result = reforgeSword(a, 0, () => 0);
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
