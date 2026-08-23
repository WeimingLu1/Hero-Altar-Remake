import assert from "node:assert/strict";
import test from "node:test";
import {
  battleCombatSkills,
  canParryWith,
  combatSkillProfile,
  equipSkill,
  learnedSkills,
  selectBattleCombatSkill,
  skillEffectSummary,
  toggleParry,
} from "../app/game-core/skill-system";
import type { SceneActorState } from "../app/game-core/scene-event";
const actor = (): SceneActorState => ({
  inventory: { "2:1": 1 },
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
  skills: {
    "2": { level: 40, points: 0 },
    "4": { level: 60, points: 0 },
    "10": { level: 30, points: 0 },
    "14": { level: 50, points: 0 },
  },
  weaponId: 1,
  armorIds: [],
  skillUse: [0, 0, 0, 0, 0, 0],
  fpPlus: 0,
  mpPlus: 0,
  xue6: false,
});
test("original weapon mismatch falls back to matching basic skill", () => {
  const a = actor();
  a.weaponId = 2;
  a.skills["3"] = { level: 60, points: 0 };
  equipSkill(a, 14);
  assert.equal(a.skillUse[1], 14);
  const p = combatSkillProfile(a);
  assert.equal(p.attackId, 3);
  assert.equal(p.attack, 30);
});
test("equipped attack skill may also become parry", () => {
  const a = actor();
  a.weaponId = 0;
  a.skills["12"] = { level: 50, points: 0 };
  equipSkill(a, 12);
  toggleParry(a, 12);
  const p = combatSkillProfile(a);
  assert.equal(p.attack, 70);
  assert.equal(p.parry, 65);
});
test("战斗中可从全部已学拳脚兵刃武学分别选择攻击与招架", () => {
  const a = actor();
  a.skills["12"] = { level: 50, points: 0 };
  assert.deepEqual(
    battleCombatSkills(a).map((skill) => skill.id),
    [12, 14],
  );
  assert.equal(selectBattleCombatSkill(a, 12).ok, true);
  assert.equal(a.skillUse[0], 12);
  assert.equal(selectBattleCombatSkill(a, 14, true).ok, true);
  assert.equal(a.skillUse[1], 14);
  assert.equal(a.skillUse[4], 14);
});
test("只有基本招架与当前攻防武学可设为招架", () => {
  const a = actor();
  equipSkill(a, 14); // 兵刃武学成为当前运用
  assert.equal(canParryWith(a, 10), true);
  assert.equal(canParryWith(a, 14), true);
  assert.equal(canParryWith(a, 16), false); // 内功不可招架
  a.skills["12"] = { level: 50, points: 0 }; // 已学但未运用的拳脚
  assert.equal(canParryWith(a, 12), false);
  assert.equal(toggleParry(a, 16).ok, false);
});

test("选中行效果说明：招架资格、内功加力与无特殊效果注明", () => {
  const a = actor();
  equipSkill(a, 14);
  const sword = learnedSkills(a).find((skill) => skill.id === 14)!;
  const swordLines = skillEffectSummary(a, sword);
  assert.ok(swordLines.some((line) => line.includes("当前兵器匹配")));
  assert.ok(swordLines.some((line) => line.includes(`设为招架时招架+${sword.level}`)));

  a.skills["16"] = { level: 120, points: 0 };
  const inner = learnedSkills(a).find((skill) => skill.id === 16)!;
  const innerLines = skillEffectSummary(a, inner);
  assert.ok(innerLines.some((line) => line.includes("加力上限 60"))); // 有效等级120的一半
  assert.ok(innerLines.every((line) => !line.includes("设为招架")));

  a.skills["55"] = { level: 30, points: 0 }; // 天师正道：原作即无战斗效果
  const tianshi = learnedSkills(a).find((skill) => skill.id === 55)!;
  assert.ok(
    skillEffectSummary(a, tianshi).some((line) => line.includes("无特殊战斗效果")),
  );
});

test("学识槽效果说明：吸血大法与驻颜术区分是否装备生效", () => {
  const a = actor();
  a.skills["56"] = { level: 40, points: 0 };
  const vampire = () => learnedSkills(a).find((skill) => skill.id === 56)!;
  assert.ok(
    skillEffectSummary(a, vampire()).some((line) => line.includes("未装备学识槽")),
  );
  assert.ok(skillEffectSummary(a, vampire()).some((line) => line.includes("40%")));
  a.skillUse[6] = 56;
  const equipped = skillEffectSummary(a, vampire());
  assert.ok(equipped.some((line) => line.includes("学识槽生效中")));
  assert.ok(equipped.every((line) => !line.includes("未装备学识槽")));

  a.skills["22"] = { level: 50, points: 0 };
  a.skillUse[6] = 22; // 驻颜术替换吸血大法
  const face = learnedSkills(a).find((skill) => skill.id === 22)!;
  const faceLines = skillEffectSummary(a, face);
  assert.ok(faceLines.some((line) => line.includes("容貌评价+5")) && faceLines.some((line) => line.includes("有效容貌 25")));
});
