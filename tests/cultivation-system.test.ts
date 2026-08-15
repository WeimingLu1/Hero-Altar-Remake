import assert from "node:assert/strict";
import test from "node:test";
import type { SceneActorState } from "../app/game-core/scene-event";
import {
  cultivationAvailability,
  fullFp,
  fullMp,
  healWounds,
  meditateForce,
  meditateMagic,
  practiceOptions,
  practiceOnce,
  recoverHp,
  setForcePower,
  setMagicPower,
} from "../app/game-core/cultivation-system";

const actor = (): SceneActorState => ({
  inventory: {},
  gold: 0,
  hp: 50,
  maxHp: 100,
  fp: 0,
  maxFp: 100,
  food: 100,
  water: 100,
  exp: 100000,
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
  skills: {
    "1": { level: 100, points: 0 },
    "16": { level: 100, points: 0 },
  },
  weaponId: 0,
  armorIds: [],
  skillUse: [0, 0, 0, 16, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});

test("打坐速度、双倍内力阈值与上限增长保持原作整数公式", () => {
  const a = actor();
  assert.equal(fullFp(a), 1600);
  a.fp = 200;
  const result = meditateForce(a);
  assert.deepEqual(result, { ok: true, increased: true, capped: false });
  assert.equal(a.maxFp, 101);
  assert.equal(a.fp, 0);
});

test("打坐达到当前内功允许的内力上限时报告封顶", () => {
  const a = actor();
  a.maxFp = fullFp(a);
  a.fp = a.maxFp * 2;
  const result = meditateForce(a);
  assert.equal(result.capped, true);
  assert.equal(a.fp, a.maxFp);
});

test("加力被限制为内功有效等级的一半", () => {
  const a = actor();
  assert.equal(setForcePower(a, 999), 75);
});

test("未装备内功或法术时原作所有对应调息操作均不可进入", () => {
  const a = actor();
  a.skillUse[3] = 0;
  for (const action of ["meditate", "recover", "heal", "force"] as const)
    assert.equal(cultivationAvailability(a, action).ok, false);
  assert.equal(cultivationAvailability(a, "magic").ok, false);
  assert.equal(cultivationAvailability(a, "spell").ok, false);
});

test("吸气与疗伤逐项报告原作门槛", () => {
  const a = actor();
  assert.match(cultivationAvailability(a, "recover").text, /内力不足/);
  a.fp = 100;
  a.maxFp = 149;
  assert.match(cultivationAvailability(a, "heal").text, /内力上限不足/);
});

test("吸气按缺失气血和内功等级计算内力消耗", () => {
  const a = actor();
  a.fp = 200;
  assert.equal(recoverHp(a), true);
  assert.equal(a.hp, 100);
  assert.equal(a.fp, 149);
});

test("疗伤恢复伤势上限并固定消耗五十内力", () => {
  const a = actor();
  a.maxFp = a.fp = 200;
  a.maxHp = 120;
  a.hp = 120;
  assert.equal(healWounds(a), true);
  assert.equal(a.maxHp, 150);
  assert.equal(a.fp, 150);
});

test("练功按基本功夫速度、经验与内力门槛增长专门功夫", () => {
  const a = actor();
  a.skills["2"] = { level: 100, points: 0 };
  a.skills["12"] = { level: 100, points: 10180 };
  a.skillUse[0] = 12;
  a.maxFp = 1500;
  a.maxHp = a.hp = 475;
  const result = practiceOnce(a, 12);
  assert.equal(result.ok, true);
  assert.equal(result.leveled, true);
  assert.equal(a.skills["12"].level, 101);
  assert.equal(a.skills["12"].points, 0);
});

test("R 修炼菜单列出全部已学可练专门功夫而非仅限已运用功夫", () => {
  const a = actor();
  a.skills["2"] = { level: 100, points: 0 };
  a.skills["12"] = { level: 50, points: 0 };
  a.skillUse[0] = 0;
  const options = practiceOptions(a);
  assert.equal(options.some((skill) => skill.id === 12), true);
  assert.equal(options.find((skill) => skill.id === 12)?.equipped, false);
  assert.equal(options.some((skill) => skill.id === 16), false);
});

test("冥思、法点和两类修为提示与内功分支对称", () => {
  const a = actor();
  a.skills["8"] = { level: 80, points: 0 };
  a.skills["52"] = { level: 80, points: 0 };
  a.skillUse[5] = 52;
  a.maxMp = 50;
  a.mp = 100;
  assert.ok(fullMp(a) > a.maxMp);
  assert.deepEqual(meditateMagic(a), { ok: true, increased: true, capped: false });
  assert.equal(a.maxMp, 51);
  assert.equal(a.mp, 0);
  assert.equal(setMagicPower(a, -5), 0);
  assert.equal(setMagicPower(a, 999), 60);
  assert.equal(cultivationAvailability(a, "magic").ok, true);
  assert.match(cultivationAvailability(a, "spell").requirement, /范围 0/);
  assert.equal(cultivationAvailability(a, "meditate").ok, true);
  assert.equal(cultivationAvailability(a, "force").ok, true);
});

test("吸气覆盖满血、内力不足与内力不足以完全恢复", () => {
  const a = actor();
  assert.equal(recoverHp(a), false);
  a.fp = 100;
  a.hp = a.maxHp;
  assert.equal(recoverHp(a), false);
  assert.match(cultivationAvailability(a, "recover").text, /全满/);
  a.hp = 1;
  a.fp = 2;
  assert.equal(recoverHp(a), false);
  a.fp = 20;
  assert.equal(recoverHp(a), true);
  assert.ok(a.hp > 1 && a.hp < a.maxHp);
  assert.equal(a.fp, 0);
  assert.equal(cultivationAvailability({ ...a, fp: 20 }, "recover").ok, true);
});

test("疗伤可用性逐一覆盖修为、资源与伤势边界", () => {
  const low = actor();
  low.skills["1"].level = 0;
  low.skills["16"].level = 10;
  low.fp = low.maxFp = 200;
  assert.match(cultivationAvailability(low, "heal").text, /修为不足/);

  const insufficientLimit = actor();
  insufficientLimit.fp = 200;
  insufficientLimit.maxFp = 149;
  assert.match(cultivationAvailability(insufficientLimit, "heal").text, /上限不足/);

  const insufficientCurrent = actor();
  insufficientCurrent.maxFp = 200;
  insufficientCurrent.fp = 99;
  assert.match(cultivationAvailability(insufficientCurrent, "heal").text, /内力不足/);

  const healthy = actor();
  healthy.fp = healthy.maxFp = 200;
  healthy.maxHp = healthy.hp = 150;
  assert.match(cultivationAvailability(healthy, "heal").text, /并未受伤/);
  assert.equal(healWounds(healthy), false);

  const critical = actor();
  critical.fp = critical.maxFp = 200;
  critical.maxHp = critical.hp = 49;
  assert.match(cultivationAvailability(critical, "heal").text, /伤势过重/);
  assert.equal(healWounds(critical), false);

  const recoverable = actor();
  recoverable.fp = recoverable.maxFp = 200;
  recoverable.maxHp = recoverable.hp = 100;
  assert.equal(cultivationAvailability(recoverable, "heal").ok, true);
});

test("练功失败会准确区分伤势、兵器、基本功、经验和内力", () => {
  const unavailable = actor();
  assert.match(practiceOnce(unavailable, 99).text, /无法练习/);

  const injured = actor();
  injured.skills["2"] = { level: 100, points: 0 };
  injured.skills["12"] = { level: 50, points: 0 };
  assert.match(practiceOnce(injured, 12).text, /身上有伤/);

  const bareWeaponSkill = actor();
  bareWeaponSkill.skills["4"] = { level: 100, points: 0 };
  bareWeaponSkill.skills["14"] = { level: 50, points: 0 };
  bareWeaponSkill.maxHp = bareWeaponSkill.hp = 475;
  assert.match(practiceOnce(bareWeaponSkill, 14).text, /需要配合相应兵器/);

  const wrongWeapon = structuredClone(bareWeaponSkill);
  wrongWeapon.weaponId = 15;
  assert.match(practiceOnce(wrongWeapon, 14).text, /兵器与这门功夫不合/);

  const missingBasic = actor();
  missingBasic.skills["12"] = { level: 50, points: 0 };
  missingBasic.maxHp = missingBasic.hp = 475;
  assert.match(practiceOnce(missingBasic, 12).text, /基本功夫尚未学会/);

  const weakBasic = structuredClone(missingBasic);
  weakBasic.skills["2"] = { level: 49, points: 0 };
  assert.match(practiceOnce(weakBasic, 12).text, /基本功夫不足/);

  const noExperience = structuredClone(weakBasic);
  noExperience.skills["2"].level = 100;
  noExperience.exp = 0;
  assert.match(practiceOnce(noExperience, 12).text, /实战经验不足/);

  const noForce = structuredClone(noExperience);
  noForce.exp = 100000;
  noForce.maxFp = 1;
  assert.match(practiceOnce(noForce, 12).text, /内力修为不足/);

  const progressing = structuredClone(noForce);
  progressing.maxFp = 1000;
  const result = practiceOnce(progressing, 12);
  assert.equal(result.ok, true);
  assert.equal(result.leveled, false);
  assert.ok(progressing.skills["12"].points > 0);
});
