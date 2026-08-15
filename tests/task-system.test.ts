import assert from "node:assert/strict";
import test from "node:test";
import type { SceneActorState } from "../app/game-core/scene-event";
import {
  acceptFreeWork,
  acceptMainTask,
  acceptWantedTask,
  claimMainReward,
  completeHiddenQuest,
  finishFreeWork,
  finishMainTask,
  finishStoneTask,
  finishWantedTask,
  freshTaskState,
  giveTanReward,
  hiddenQuestOffer,
  startTanQuest,
  startStoneTask,
  taskJournal,
  wantedEnemyRecord,
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

test("隐藏交换任务消耗原作数量并发放对应奖励", () => {
  const a = actor();
  a.inventory["1:6"] = 2;
  assert.equal(completeHiddenQuest(a, 2).ok, true);
  assert.equal(a.inventory["1:6"], undefined);
  assert.equal(a.inventory["3:2"], 1);
});

test("捕快任务保持五分钟冷却、十次轮转和动态敌人比例", () => {
  const a = actor(),
    tasks = freshTaskState();
  assert.equal(acceptWantedTask(a, tasks, () => 0).ok, true);
  assert.equal(tasks.wantedPlace, 3);
  assert.equal(tasks.wantedName, "赵梅");
  assert.equal(tasks.wantedReward, 80);
  assert.equal(tasks.wantedPercent, 80);
  const enemy = wantedEnemyRecord(a, tasks);
  assert.equal(enemy.name, "赵梅");
  assert.equal(enemy.maxhp, 80);
  assert.equal(enemy.exp, 800);
});

test("石料任务保持原作冷却、道具与动态奖励", () => {
  const a = actor(),
    tasks = freshTaskState();
  assert.equal(startStoneTask(a, tasks).ok, true);
  assert.equal(a.inventory["1:29"], 1);
  assert.equal(finishStoneTask(a, tasks).ok, true);
  assert.equal(a.inventory["1:29"], undefined);
  assert.equal(a.exp, 1040);
  assert.equal(a.potential, 20);
  assert.equal(startStoneTask(a, tasks).ok, false);
});

test("第六坛奖励为全部已学功夫加三级并奖励六万金钱", () => {
  const a = actor();
  a.tanId = 6;
  a.skills = { "1": { level: 254, points: 0 }, "2": { level: 20, points: 0 } };
  assert.equal(giveTanReward(a).ok, true);
  assert.equal(a.skills["1"].level, 255);
  assert.equal(a.skills["2"].level, 23);
  assert.equal(a.gold, 60100);
  assert.equal(a.tanId, 7);
});

test("义工随机编号、体力消耗与普通模式奖励保持原作", () => {
  const a = actor(),
    tasks = freshTaskState();
  assert.equal(acceptFreeWork(a, tasks, () => 1).ok, true);
  assert.equal(tasks.freeWork, 2);
  const finished = finishFreeWork(a, tasks, 2);
  assert.equal(finished.ok, true);
  assert.match(finished.text, /挑水挑水我挑水/);
  assert.match(finished.text, /费了老大力气/);
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

test("三大任务不会在过滤后重新派发已经死亡的NPC", () => {
  const a = actor(), tasks = freshTaskState();
  a.killList = [12];
  const result = acceptMainTask(a, tasks, 1, () => 0);
  assert.equal(result.ok, true);
  assert.equal(tasks.visitId, 125);
  assert.notEqual(tasks.visitName, "小裁缝");
});

test("通缉犯不会生成在当前玩家格且保留法术门派动态属性", () => {
  const a = actor(), tasks = freshTaskState(), sequence = [7, 0, 0, 0, 7, 0];
  a.maxFp = 800;
  const result = acceptWantedTask(
    a,
    tasks,
    () => sequence.shift() ?? 0,
    false,
    { mapId: 10, x: 5, y: 5 },
  );
  assert.equal(result.ok, true);
  assert.equal(tasks.wantedPlace, 10);
  assert.notDeepEqual([tasks.wantedX, tasks.wantedY], [5, 5]);
  assert.equal(tasks.wantedClass, 8);
  const enemy = wantedEnemyRecord(a, tasks);
  assert.equal(enemy.gender, tasks.wantedGender);
  assert.equal(enemy.maxmp, 640);
  assert.equal(enemy.mp, 640);
  assert.equal(enemy.mp_plus, 16);
  // class-8 spellcaster keeps a real spell kungfu (52-54) in the spell slot
  const spellId = (enemy.skill_use as number[])[5];
  assert.ok(
    spellId >= 52 && spellId <= 54,
    `spell id should be 52-54, got ${spellId}`,
  );
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

test("义工入口与收尾覆盖资历、重复领取、错工号、体力和快速奖励", () => {
  const veteran = actor(), veteranTasks = freshTaskState();
  veteran.exp = 5000;
  assert.equal(acceptFreeWork(veteran, veteranTasks, () => 0).ok, false);

  const busy = actor(), busyTasks = freshTaskState();
  busyTasks.freeWork = 1;
  assert.equal(acceptFreeWork(busy, busyTasks, () => 0).ok, false);
  assert.equal(finishFreeWork(busy, busyTasks, 2).ok, false);

  busy.hp = 30;
  assert.equal(finishFreeWork(busy, busyTasks, 1).ok, false);
  assert.equal(busyTasks.freeWork, 0);

  const fast = actor(), fastTasks = freshTaskState();
  fastTasks.freeWork = 1;
  fast.hp = 100;
  const result = finishFreeWork(fast, fastTasks, 1, true);
  assert.equal(result.ok, true);
  assert.equal(fast.exp, 1100);
  assert.equal(fast.potential, 50);
  assert.equal(fast.gold, 350);
});

test("三类主任务完整覆盖无候选、领取、交付失败与完成标记", () => {
  const unavailable = actor(), unavailableTasks = freshTaskState();
  unavailable.exp = -1;
  assert.equal(
    acceptMainTask(unavailable, unavailableTasks, 2, () => 0).ok,
    false,
  );

  const visit = actor(), visitTasks = freshTaskState();
  assert.equal(acceptMainTask(visit, visitTasks, 1, () => 0).ok, true);
  assert.equal(finishMainTask(visit, visitTasks, 1), false);
  visitTasks.visitId = -1;
  assert.equal(finishMainTask(visit, visitTasks, 1), true);
  assert.equal(visitTasks.visitId, 0);

  const find = actor(), findTasks = freshTaskState();
  assert.equal(acceptMainTask(find, findTasks, 2, () => 0).ok, true);
  assert.equal(finishMainTask(find, findTasks, 2), false);
  find.inventory[`${findTasks.findType}:${findTasks.findId}`] = 1;
  assert.equal(finishMainTask(find, findTasks, 2), true);
  assert.equal(findTasks.findId, 0);

  const kill = actor(), killTasks = freshTaskState();
  assert.equal(acceptMainTask(kill, killTasks, 3, () => 0).ok, true);
  assert.equal(finishMainTask(kill, killTasks, 3), false);
  killTasks.killId = -1;
  assert.equal(finishMainTask(kill, killTasks, 3), true);
  assert.equal(killTasks.killId, 0);
});

test("顾炎武奖励覆盖无奖励与潜能分支", () => {
  const a = actor(), tasks = freshTaskState();
  assert.equal(claimMainReward(a, tasks, () => 0).ok, false);
  tasks.finishFlag = true;
  tasks.guReward = 121;
  const result = claimMainReward(a, tasks, () => 99);
  assert.equal(result.ok, true);
  assert.equal(a.exp, 1000);
  assert.equal(a.potential, 60);
  assert.equal(tasks.guReward, 0);
});

test("石料任务覆盖所有拒绝原因、遗失取消与快速结算", () => {
  const active = actor(), activeTasks = freshTaskState();
  activeTasks.stoneStarted = true;
  assert.equal(startStoneTask(active, activeTasks).ok, false);

  const cooling = actor(), coolingTasks = freshTaskState();
  coolingTasks.stoneStartedAt = 0;
  assert.equal(startStoneTask(cooling, coolingTasks).ok, false);

  const novice = actor(), noviceTasks = freshTaskState();
  novice.exp = 999;
  assert.equal(startStoneTask(novice, noviceTasks).ok, false);

  const master = actor(), masterTasks = freshTaskState();
  master.exp = 100000;
  assert.equal(startStoneTask(master, masterTasks).ok, false);

  const absent = actor(), absentTasks = freshTaskState();
  assert.equal(finishStoneTask(absent, absentTasks).ok, false);
  absentTasks.stoneStarted = true;
  assert.equal(finishStoneTask(absent, absentTasks).ok, false);
  assert.equal(absentTasks.stoneStarted, false);

  const fast = actor(), fastTasks = freshTaskState();
  fast.exp = 1500;
  assert.equal(startStoneTask(fast, fastTasks, true).ok, true);
  assert.equal(finishStoneTask(fast, fastTasks, true).ok, true);
  assert.equal(fast.exp, 1623);
  assert.equal(fast.potential, 61);
});

test("九坛起始门槛、地图补发与八阶段奖励都保持可恢复", () => {
  const novice = actor();
  novice.exp = 79999;
  assert.equal(startTanQuest(novice).ok, false);

  const progressed = actor();
  progressed.exp = 80000;
  progressed.tanId = 2;
  assert.equal(startTanQuest(progressed).ok, false);

  const starter = actor();
  starter.exp = 80000;
  assert.equal(startTanQuest(starter).ok, true);
  assert.equal(starter.inventory["1:21"], 1);
  assert.equal(startTanQuest(starter).ok, false);
  delete starter.inventory["1:21"];
  assert.equal(startTanQuest(starter).ok, true);

  for (let id = 1; id <= 8; id++) {
    const a = actor();
    a.tanId = id;
    a.skills["1"] = { level: 10, points: 0 };
    assert.equal(giveTanReward(a).ok, true, `坛奖励 ${id}`);
    assert.equal(a.tanId, id + 1);
    if (id >= 6) assert.equal(a.skills["1"].level, 13);
  }
  const invalid = actor();
  assert.equal(giveTanReward(invalid).ok, false);
});

test("通缉任务覆盖道德、未完成、冷却、轮转和结算边界", () => {
  const outlaw = actor(), outlawTasks = freshTaskState();
  outlaw.morals = 127;
  assert.equal(acceptWantedTask(outlaw, outlawTasks, () => 0).ok, false);

  const active = actor(), activeTasks = freshTaskState();
  activeTasks.wantedPlace = 3;
  activeTasks.wantedName = "旧犯";
  activeTasks.wantedStarted = 0;
  activeTasks.clock = 100;
  assert.equal(acceptWantedTask(active, activeTasks, () => 0).ok, false);

  const cooling = actor(), coolingTasks = freshTaskState();
  coolingTasks.wantedStarted = 0;
  coolingTasks.clock = 299;
  assert.equal(acceptWantedTask(cooling, coolingTasks, () => 0).ok, false);

  const rotating = actor(), rotatingTasks = freshTaskState();
  rotatingTasks.wantedCount = 10;
  assert.equal(acceptWantedTask(rotating, rotatingTasks, () => 0).ok, true);
  assert.equal(rotatingTasks.wantedCount, 1);
  assert.equal(rotatingTasks.wantedTurn, 2);

  const normal = wantedEnemyRecord(rotating, rotatingTasks);
  assert.equal(normal.maxmp, 0);
  assert.equal(normal.mp, 0);

  const none = freshTaskState();
  assert.equal(finishWantedTask(rotating, none).ok, false);
  const beforeExp = rotating.exp;
  assert.equal(finishWantedTask(rotating, rotatingTasks).ok, true);
  assert.equal(rotatingTasks.wantedPlace, 0);
  assert.ok(rotating.exp > beforeExp);
});

test("隐藏交换预览与执行不会在物品不足或无配置时改动背包", () => {
  const a = actor();
  assert.equal(hiddenQuestOffer(a, 999).ok, false);
  assert.equal(hiddenQuestOffer(a, 2).ok, false);
  assert.equal(completeHiddenQuest(a, 999).ok, false);
  assert.equal(completeHiddenQuest(a, 2).ok, false);

  a.inventory["1:6"] = 2;
  const offer = hiddenQuestOffer(a, 2);
  assert.deepEqual(offer, {
    ok: true,
    requestName: "糖葫芦",
    requestCount: 2,
    prizeName: "老花镜",
  });
});

test("任务簿覆盖空状态与全部任务摘要", () => {
  const tasks = freshTaskState();
  assert.deepEqual(taskJournal(tasks), ["当前没有进行中的任务。"]);
  Object.assign(tasks, {
    freeWork: 1,
    visitId: 1,
    visitName: "访客",
    findId: 1,
    findName: "物品",
    killId: 1,
    killName: "恶徒",
    wantedPlace: 3,
    wantedName: "通缉犯",
    stoneStarted: true,
    finishFlag: true,
  });
  const lines = taskJournal(tasks);
  assert.equal(lines.length, 7);
  assert.ok(lines.some((line) => line.startsWith("义工：")));
  assert.ok(lines.some((line) => line.includes("平安镇西")));
});
