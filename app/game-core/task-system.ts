import { originalTables, originalTasks, originalText } from "./original-data";
import type { SceneActorState } from "./scene-event";

export type TaskState = {
  clock: number;
  freeWork: number;
  visitId: number;
  visitName: string;
  visitDeadline: number;
  visitReward: number;
  findType: number;
  findId: number;
  findName: string;
  findDeadline: number;
  findReward: number;
  killId: number;
  killName: string;
  killDeadline: number;
  killReward: number;
  finishFlag: boolean;
  guReward: number;
  wantedPlace: number;
  wantedName: string;
  wantedStarted: number;
  wantedReward: number;
  wantedCount: number;
  wantedTurn: number;
  stoneStarted: boolean;
  stoneStartedAt: number;
};

export const freshTaskState = (): TaskState => ({
  clock: 0,
  freeWork: 0,
  visitId: 0,
  visitName: "",
  visitDeadline: 0,
  visitReward: 0,
  findType: 0,
  findId: 0,
  findName: "",
  findDeadline: 0,
  findReward: 0,
  killId: 0,
  killName: "",
  killDeadline: 0,
  killReward: 0,
  finishFlag: false,
  guReward: 0,
  wantedPlace: 0,
  wantedName: "",
  wantedStarted: -300,
  wantedReward: 0,
  wantedCount: 0,
  wantedTurn: 1,
  stoneStarted: false,
  stoneStartedAt: -180,
});

const reward = (
  actor: SceneActorState,
  exp: number,
  potential: number,
  money: number,
) => {
  actor.exp += Math.max(0, exp);
  actor.potential += Math.max(0, potential);
  actor.gold += Math.max(0, money);
  return `获得经验 ${Math.max(0, exp)}、潜能 ${Math.max(0, potential)}、银两 ${Math.max(0, money)}。`;
};

export function acceptFreeWork(
  actor: SceneActorState,
  tasks: TaskState,
  random: (max: number) => number,
) {
  if (actor.exp >= 5000)
    return {
      ok: false,
      text: String(
        originalText.not_work_text || "这里已经没有适合你的杂活了。",
      ),
    };
  if (tasks.freeWork > 0)
    return {
      ok: false,
      text: String(originalText.work_undo_text || "先把手头的活做完。"),
    };
  tasks.freeWork = random(3) + 1;
  const work =
    ((originalText.all_work as string[]) || [])[tasks.freeWork - 1] || "杂活";
  return {
    ok: true,
    text: String(originalText.give_work_text || "请去做work。 ").replace(
      "work",
      work,
    ),
  };
}

export function finishFreeWork(
  actor: SceneActorState,
  tasks: TaskState,
  id: number,
  fast = false,
) {
  if (tasks.freeWork !== id)
    return { ok: false, text: "这不是当前领取的义工。" };
  const cost = 20 + 10 * id;
  if (actor.hp <= cost) {
    tasks.freeWork = 0;
    return {
      ok: false,
      text: String(originalText.work_tired_text || "你已经累得干不动了。"),
    };
  }
  actor.hp -= cost;
  tasks.freeWork = 0;
  const scale = fast ? 5 : 1;
  return { ok: true, text: reward(actor, 20 * scale, 10 * scale, 50 * scale) };
}

const tableFor = (kind: number) =>
  kind === 1
    ? originalTables.items
    : kind === 2
      ? originalTables.weapons
      : originalTables.armors;
const log10Integer = (value: number) => {
  let result = 0,
    n = Math.floor(value / 10);
  while (n > 0) {
    n = Math.floor(n / 10);
    result++;
  }
  return result;
};

export function acceptMainTask(
  actor: SceneActorState,
  tasks: TaskState,
  type: 1 | 2 | 3,
  random: (max: number) => number,
) {
  const source =
    ((type === 2
      ? originalTasks.find_list
      : originalTasks.npc_list) as number[][]) || [];
  const available = source.filter(
    (row) =>
      actor.exp >= row[2] &&
      (type === 2 || !(actor.killList || []).includes(row[1])),
  );
  if (!available.length) return { ok: false, text: "暂时没有合适的任务。" };
  // The original indexes the sorted source by the eligible-list random index.
  const index = random(available.length),
    row = source[index],
    [kind, id, targetExp] = row,
    baseCount = source.length,
    deadline = tasks.clock + Math.floor((80 * index) / baseCount) + 35;
  let amount = Math.floor((200 * (index + 1)) / baseCount);
  amount *= 1 + log10Integer(Math.floor(actor.exp / 10000));
  amount = Math.floor(
    (amount * (actor.exp * targetExp)) /
      Math.max(1, (actor.exp + targetExp) ** 2),
  );
  amount += random(Math.max(1, actor.int)) + random(Math.max(1, actor.luck));
  amount = Math.min(amount, 200) * 3;
  const name =
    type === 2
      ? String(tableFor(kind)[id]?.name || id)
      : String(originalTables.enemies[id]?.name || id);
  if (type === 1) {
    tasks.visitId = id;
    tasks.visitName = name;
    tasks.visitDeadline = deadline;
    tasks.visitReward = amount;
  } else if (type === 2) {
    tasks.findType = kind;
    tasks.findId = id;
    tasks.findName = name;
    tasks.findDeadline = deadline;
    tasks.findReward = amount;
  } else {
    tasks.killId = id;
    tasks.killName = name;
    tasks.killDeadline = deadline;
    tasks.killReward = amount;
  }
  return {
    ok: true,
    text: `任务目标：${name}。`,
    id,
    kind,
    deadline,
    reward: amount,
  };
}

export function finishMainTask(
  actor: SceneActorState,
  tasks: TaskState,
  type: 1 | 2 | 3,
) {
  const deadline =
      type === 1
        ? tasks.visitDeadline
        : type === 2
          ? tasks.findDeadline
          : tasks.killDeadline,
    amount =
      type === 1
        ? tasks.visitReward
        : type === 2
          ? tasks.findReward
          : tasks.killReward;
  if (type === 1 && tasks.visitId !== -1) return false;
  if (type === 2) {
    const key = `${tasks.findType}:${tasks.findId}`;
    if ((actor.inventory[key] || 0) < 1) return false;
    actor.inventory[key]--;
    if (actor.inventory[key] <= 0) delete actor.inventory[key];
    tasks.findType = 0;
    tasks.findId = 0;
  }
  if (type === 3 && tasks.killId !== -1) return false;
  tasks.guReward = tasks.clock - deadline >= 1200 ? 0 : amount;
  tasks.finishFlag = true;
  if (type === 1) tasks.visitId = 0;
  if (type === 3) tasks.killId = 0;
  return true;
}

export function claimMainReward(
  actor: SceneActorState,
  tasks: TaskState,
  random: (max: number) => number,
) {
  if (!tasks.finishFlag) return { ok: false, text: "当前没有待领的任务奖励。" };
  tasks.finishFlag = false;
  const amount = tasks.guReward;
  tasks.guReward = 0;
  return random(100) < 70
    ? { ok: true, text: reward(actor, amount, 0, 0) }
    : { ok: true, text: reward(actor, 0, Math.floor(amount / 2), 0) };
}

export function taskJournal(tasks: TaskState) {
  const lines: string[] = [];
  if (tasks.freeWork)
    lines.push(
      `义工：${((originalText.all_work as string[]) || [])[tasks.freeWork - 1] || tasks.freeWork}`,
    );
  if (tasks.visitId > 0) lines.push(`拜访：${tasks.visitName}`);
  if (tasks.findId > 0) lines.push(`寻物：${tasks.findName}`);
  if (tasks.killId > 0) lines.push(`除恶：${tasks.killName}`);
  if (tasks.wantedPlace > 0)
    lines.push(`通缉：${tasks.wantedName} · Map ${tasks.wantedPlace}`);
  if (tasks.stoneStarted) lines.push("石料：将石料送回工地");
  if (tasks.finishFlag) lines.push("顾炎武处有任务奖励待领");
  return lines.length ? lines : ["当前没有进行中的任务。"];
}
