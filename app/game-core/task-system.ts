import { originalTables, originalTasks, originalText } from "./original-data";
import type { SceneActorState } from "./scene-event";
import { derivedStats } from "./inventory-system";
import type { OriginalRecord } from "./original-data";
import { getOriginalMap } from "./original-world";
import type { GeneratedQuest } from "./generated-task-system";

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
  wantedX: number;
  wantedY: number;
  wantedGender: number;
  wantedClass: number;
  wantedLevel: number;
  wantedPercent: number;
  stoneStarted: boolean;
  stoneStartedAt: number;
  generatedQuest: GeneratedQuest | null;
  generatedQuestNextOfferAt: number;
  generatedQuestSerial: number;
  generatedQuestOfferMisses: number;
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
  wantedX: 0,
  wantedY: 0,
  wantedGender: 0,
  wantedClass: 1,
  wantedLevel: 1,
  wantedPercent: 80,
  stoneStarted: false,
  stoneStartedAt: -180,
  generatedQuest: null,
  generatedQuestNextOfferAt: 0,
  generatedQuestSerial: 0,
  generatedQuestOfferMisses: 0,
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
  const descriptions =
      ((originalText.work_text as string[][]) || [])[id - 1] || [],
    finished = String(
      originalText.finish_work_text || "费了老大力气，总算干完了！",
    ),
    result = reward(actor, 20 * scale, 10 * scale, 50 * scale);
  return {
    ok: true,
    text: [...descriptions, finished, result].join("\n"),
  };
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
  const index = random(available.length),
    // Game_Task#make_task_list removes dead NPCs before indexing. Selecting
    // from source here could resurrect a killed target after filtering.
    row = available[index],
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

export function startStoneTask(
  actor: SceneActorState,
  tasks: TaskState,
  fast = false,
) {
  const cooldown = fast ? 90 : 180;
  if (tasks.stoneStarted)
    return {
      ok: false,
      text: String(originalText.stone_undo_text || "先把石料送到工地。"),
    };
  if (tasks.clock - tasks.stoneStartedAt < cooldown)
    return {
      ok: false,
      text: String(originalText.no_stone_task || "工地现在不需要石料。"),
    };
  if (actor.exp < 1000)
    return {
      ok: false,
      text: String(originalText.stone_less_exp || "你经验尚浅，搬不动石料。"),
    };
  if (actor.exp >= 100000)
    return {
      ok: false,
      text: String(originalText.stone_more_exp || "这种粗活不敢再劳烦大侠。"),
    };
  tasks.stoneStarted = true;
  tasks.stoneStartedAt = tasks.clock;
  actor.inventory["1:29"] = (actor.inventory["1:29"] || 0) + 1;
  return {
    ok: true,
    text: String(originalText.give_stone_text || "把石料送到工地去。"),
  };
}

export function finishStoneTask(
  actor: SceneActorState,
  tasks: TaskState,
  fast = false,
) {
  if (!tasks.stoneStarted)
    return {
      ok: false,
      text: String(originalText.no_stone_task2 || "你没有领取石料。"),
    };
  if ((actor.inventory["1:29"] || 0) < 1) {
    tasks.stoneStarted = false;
    return {
      ok: false,
      text: String(originalText.lose_stone_text || "石料已经遗失，任务取消。"),
    };
  }
  actor.inventory["1:29"]--;
  if (actor.inventory["1:29"] <= 0) delete actor.inventory["1:29"];
  tasks.stoneStarted = false;
  const scale = fast ? 3 : 1,
    exp = (Math.floor(actor.exp / 1500) + 40) * scale,
    potential = Math.floor(exp / 2);
  return {
    ok: true,
    text: `${String(originalText.finish_stone_text || "石料已经送到工地。")}\n${reward(actor, exp, potential, -1)}`,
  };
}

export function startTanQuest(actor: SceneActorState) {
  const mapKey = "1:21";
  if (actor.exp < 80000) return { ok: false, text: "" };
  if (actor.tanId !== 0 && !(actor.tanId === 1 && !actor.inventory[mapKey]))
    return { ok: false, text: "" };
  actor.tanId = 1;
  actor.inventory[mapKey] = (actor.inventory[mapKey] || 0) + 1;
  return {
    ok: true,
    text: String(originalText.tan_start || "老夫把青龙坛地图送给你。"),
  };
}

export function giveTanReward(actor: SceneActorState) {
  const id = actor.tanId,
    texts = (originalTasks.tan_reward as string[]) || [];
  if (id < 1 || id > 8) return { ok: false, text: "九坛挑战尚未推进。" };
  if (id === 1) actor.exp += 50000;
  if (id === 2) {
    actor.exp += 50000;
    actor.gold += 60000;
  }
  if (id === 3) actor.maxFp += 150;
  if (id === 4) {
    actor.gold += 60000;
    actor.maxFp += 200;
  }
  if (id === 5) {
    actor.exp += 60000;
    actor.maxFp += 200;
  }
  if (id >= 6)
    for (const skill of Object.values(actor.skills))
      skill.level = Math.min(255, skill.level + 3);
  if (id === 6) actor.gold += 60000;
  if (id === 7) actor.exp += 60000;
  if (id === 8) actor.maxFp += 200;
  actor.tanId++;
  return { ok: true, text: texts[id] || `通过第 ${id} 坛。` };
}

export function acceptWantedTask(
  actor: SceneActorState,
  tasks: TaskState,
  random: (max: number) => number,
  fast = false,
  player?: { mapId: number; x: number; y: number },
) {
  if (actor.morals < 128)
    return {
      ok: false,
      text: String(originalText.you_bad_text || "你也是通缉犯，休想领任务。"),
    };
  if (tasks.wantedPlace > 0 && tasks.clock - tasks.wantedStarted < 1200)
    return {
      ok: false,
      text: String(originalText.bad_undo_text || "先去收服name。 ").replace(
        "name",
        tasks.wantedName,
      ),
    };
  if (tasks.wantedPlace > 0) tasks.wantedCount--;
  const cooldown = fast ? 150 : 300;
  if (tasks.wantedPlace <= 0 && tasks.clock - tasks.wantedStarted < cooldown)
    return {
      ok: false,
      text: String(originalText.no_bad_task || "暂无通缉任务。"),
    };
  const maps = (originalTasks.bad_map as number[]) || [],
    areas = (originalTasks.bad_area as number[][][]) || [],
    index = random(maps.length),
    first = ((originalText.bad_name1 as string[]) || ["赵"])[random(8)] || "赵",
    second =
      ((originalText.bad_name2 as string[]) || ["某"])[random(8)] || "某";
  tasks.wantedPlace = maps[index] || 3;
  tasks.wantedStarted = tasks.clock;
  tasks.wantedName = first + second;
  tasks.wantedGender =
    ((originalText.bad_name2 as string[]) || []).indexOf(second) > 3 ? 0 : 1;
  tasks.wantedCount++;
  if (tasks.wantedCount > 10) {
    tasks.wantedTurn++;
    tasks.wantedCount = 1;
  }
  tasks.wantedReward =
    (80 + random(80)) * (tasks.wantedCount + tasks.wantedTurn - 1);
  tasks.wantedClass = random(8) + 1;
  tasks.wantedPercent = Math.min(
    70 + 5 * tasks.wantedCount + 5 * tasks.wantedTurn,
    125,
  );
  tasks.wantedLevel = Math.floor(
    (Math.max(1, ...Object.values(actor.skills).map((skill) => skill.level)) *
      tasks.wantedPercent) /
      100,
  );
  const area = areas[index] || [[1, 1]],
    candidates = tasks.wantedPlace === 10 && player?.mapId === 10
      ? area.filter(([x, y]) => x !== player.x || y !== player.y)
      : area,
    pointPool = candidates.length ? candidates : area,
    point = pointPool[random(pointPool.length)] || [1, 1];
  tasks.wantedX = point[0];
  tasks.wantedY = point[1];
  const place = getOriginalMap(tasks.wantedPlace).name;
  return {
    ok: true,
    text: String(originalText.give_bad_text || "恶人name出没于place。")
      .replace("name", tasks.wantedName)
      .replace("place", place),
  };
}

export function wantedEnemyRecord(
  actor: SceneActorState,
  tasks: TaskState,
): OriginalRecord {
  const base = structuredClone(originalTables.enemies[198] || {}),
    stats = derivedStats(actor),
    percent = tasks.wantedPercent || 80,
    classes = (originalTasks.bad_data as number[][]) || [],
    data = classes[tasks.wantedClass] || classes[1] || [],
    weaponId = data[0] || 0,
    // 原版 set_badman 对法术型恶人(class_id==8)会把法术位改写为 rand(3)+52
    // (五雷咒/万鸦咒/玄冰咒)；web 端按存档状态确定性派生，保证重载后同一
    // 通缉犯的法术武功不变。
    spellId =
      tasks.wantedClass === 8
        ? 52 + (Math.abs(tasks.wantedStarted + tasks.wantedPlace) % 3)
        : data[6],
    use = [data[1], data[2], data[3], data[4], data[5], spellId],
    ids = (data[8] as unknown as number[]) || [1, 2, 9, 10],
    maxhp = Math.max(1, Math.floor((actor.maxHp * percent) / 100)),
    maxfp = Math.max(0, Math.floor((actor.maxFp * percent) / 100));
  return {
    ...base,
    name: tasks.wantedName,
    gender: tasks.wantedGender,
    age: Number(base.age || 30),
    exp: Math.floor((actor.exp * percent) / 100),
    hp: maxhp,
    maxhp,
    fp: maxfp,
    maxfp,
    fp_plus: Math.floor(maxfp / 40),
    maxmp: tasks.wantedClass === 8 ? maxfp : 0,
    mp: tasks.wantedClass === 8 ? maxfp : 0,
    mp_plus: tasks.wantedClass === 8 ? Math.floor(maxfp / 40) : 0,
    base_str: actor.baseStr,
    base_agi: actor.baseAgi,
    base_int: actor.baseInt,
    base_bon: actor.baseBon,
    base_fac: actor.face,
    base_luc: actor.luck,
    morals: 0,
    base_hit: stats.hit,
    base_eva: stats.eva,
    agi: stats.agi,
    int: stats.int,
    str: stats.str,
    atk: stats.atk,
    pdef: stats.pdef,
    weapon_id: weaponId,
    skill_use: use,
    skill_list: ids.map((id) => [id, tasks.wantedLevel]),
  };
}

export function finishWantedTask(actor: SceneActorState, tasks: TaskState) {
  if (tasks.wantedPlace <= 0)
    return { ok: false, text: "当前没有可结算的通缉犯。" };
  tasks.wantedPlace = 0;
  const exp = tasks.wantedReward,
    potential = Math.floor(tasks.wantedReward / 4);
  return { ok: true, text: reward(actor, exp, potential, -1) };
}

// 返回隐藏交换的请求与奖励信息(不消耗)，供确认弹窗使用。
export function hiddenQuestOffer(
  actor: SceneActorState,
  npcId: number,
): {
  ok: boolean;
  requestName: string;
  requestCount: number;
  prizeName: string;
} {
  const quest = (
    originalTasks.quest_list as Record<
      string,
      [[number, number, number, number], [number, number, number]]
    >
  )?.[String(npcId)];
  if (!quest) return { ok: false, requestName: "", requestCount: 0, prizeName: "" };
  const [request, prize] = quest,
    [, type1, id1, num1] = request,
    [type2, id2] = prize,
    requestKey = `${type1}:${id1}`;
  if ((actor.inventory[requestKey] || 0) < num1)
    return { ok: false, requestName: "", requestCount: 0, prizeName: "" };
  return {
    ok: true,
    requestName: String(tableFor(type1)[id1]?.name || id1),
    requestCount: num1,
    prizeName: String(tableFor(type2)[id2]?.name || id2),
  };
}

export function completeHiddenQuest(actor: SceneActorState, npcId: number) {
  const quest = (
    originalTasks.quest_list as Record<
      string,
      [[number, number, number, number], [number, number, number]]
    >
  )?.[String(npcId)];
  if (!quest) return { ok: false, text: "" };
  const [request, prize] = quest,
    [questType, type1, id1, num1] = request,
    [type2, id2, num2] = prize,
    requestKey = `${type1}:${id1}`,
    prizeKey = `${type2}:${id2}`;
  if ((actor.inventory[requestKey] || 0) < num1) return { ok: false, text: "" };
  if (questType === 1) {
    actor.inventory[requestKey] -= num1;
    if (actor.inventory[requestKey] <= 0) delete actor.inventory[requestKey];
  }
  actor.inventory[prizeKey] = (actor.inventory[prizeKey] || 0) + num2;
  const lines = (originalText.quest_talk as Record<string, string[]>)?.[
    String(npcId)
  ];
  return { ok: true, text: lines?.[1] || "交换完成。" };
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
    lines.push(
      `通缉：${tasks.wantedName} · ${getOriginalMap(tasks.wantedPlace).name}`,
    );
  if (tasks.stoneStarted) lines.push("石料：将石料送回工地");
  if (tasks.finishFlag) lines.push("顾炎武处有任务奖励待领");
  if (tasks.generatedQuest)
    lines.push(`奇遇：${tasks.generatedQuest.title}`);
  return lines.length ? lines : ["当前没有进行中的任务。"];
}
