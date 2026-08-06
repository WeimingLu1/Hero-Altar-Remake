import assert from "node:assert/strict";
import test from "node:test";
import type { SceneActorState } from "../app/game-core/scene-event";
import {
  acceptFreeWork,
  acceptMainTask,
  claimMainReward,
  finishFreeWork,
  finishMainTask,
  freshTaskState,
} from "../app/game-core/task-system";

const actor = (): SceneActorState => ({
  inventory: {},
  gold: 100,
  hp: 100,
  maxHp: 100,
  fp: 0,
  maxFp: 0,
  food: 100,
  water: 100,
  exp: 1000,
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

test("义工随机编号、体力消耗与普通模式奖励保持原作", () => {
  const a = actor(),
    tasks = freshTaskState();
  assert.equal(acceptFreeWork(a, tasks, () => 1).ok, true);
  assert.equal(tasks.freeWork, 2);
  assert.equal(finishFreeWork(a, tasks, 2).ok, true);
  assert.equal(a.hp, 60);
  assert.equal(a.exp, 1020);
  assert.equal(a.potential, 10);
  assert.equal(a.gold, 150);
});

test("寻物任务使用原作排序、期限与三倍奖励系数", () => {
  const a = actor(),
    tasks = freshTaskState();
  const result = acceptMainTask(a, tasks, 2, () => 0);
  assert.equal(result.ok, true);
  assert.equal(tasks.findType, 1);
  assert.equal(tasks.findId, 1);
  assert.equal(tasks.findDeadline, 35);
});

test("逾期二十分钟完成任务会清空顾炎武奖励", () => {
  const a = actor(),
    tasks = freshTaskState();
  tasks.visitId = -1;
  tasks.visitDeadline = 50;
  tasks.visitReward = 300;
  tasks.clock = 1250;
  assert.equal(finishMainTask(a, tasks, 1), true);
  assert.equal(tasks.guReward, 0);
});

test("顾炎武按原作七成概率发经验奖励", () => {
  const a = actor(),
    tasks = freshTaskState();
  tasks.finishFlag = true;
  tasks.guReward = 120;
  assert.equal(claimMainReward(a, tasks, () => 0).ok, true);
  assert.equal(a.exp, 1120);
});
