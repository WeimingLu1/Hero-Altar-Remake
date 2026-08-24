import type { OriginalBattle } from "./original-battle";
import type { SceneActorState } from "./scene-event";

export type BattlePlaybackSide = "player" | "enemy";
export type BattlePlaybackPopupKind =
  | "damage"
  | "heal"
  | "wound"
  | "force"
  | "magic";

export type BattlePresentation = {
  playerHp: number;
  playerMaxHp: number;
  playerFp: number;
  playerMaxFp: number;
  playerMp: number;
  playerMaxMp: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyFp: number;
  enemyMp: number;
};

export type BattlePlaybackPopup = {
  side: BattlePlaybackSide;
  kind: BattlePlaybackPopupKind;
  text: string;
};

export type BattlePlaybackFrame = {
  fact: string;
  factIndex: number;
  durationMs: number;
  presentation: BattlePresentation;
  popup?: BattlePlaybackPopup;
};

export function battlePresentation(
  actor: SceneActorState,
  battle: OriginalBattle,
): BattlePresentation {
  return {
    playerHp: actor.hp,
    playerMaxHp: actor.maxHp,
    playerFp: actor.fp,
    playerMaxFp: actor.maxFp,
    playerMp: actor.mp,
    playerMaxMp: actor.maxMp,
    enemyHp: battle.enemyHp,
    enemyMaxHp: battle.enemyMaxHp,
    enemyFp: battle.enemyFp,
    enemyMp: battle.enemyMp,
  };
}

const numberFrom = (text: string, expression: RegExp) =>
  Number(text.match(expression)?.[1] || 0);

function itemGain(fact: string, label: string) {
  return numberFrom(fact, new RegExp(`${label}\\+(\\d+)`));
}

function playerDamage(fact: string) {
  const received = numberFrom(fact, /你受到 (\d+) 点[^。]*伤害/);
  if (received > 0) return received;
  // NPC 法术绝招的结算句没有重复写“你受到”，但伤害目标固定为玩家。
  return numberFrom(fact, /命中，共造成 (\d+) 点法术伤害/);
}

function enemyDamage(fact: string, enemyName: string) {
  if (fact.includes(enemyName)) {
    const received = numberFrom(fact, /受到 (\d+) 点[^。]*伤害/);
    if (received > 0) return received;
    const caused = numberFrom(fact, /造成 (\d+) 点伤害/);
    if (caused > 0) return caused;
  }
  // 这两类玩家召唤/法术结算句省略目标名，目标固定为敌方。
  if (/^(三昧真火命中|铁爪苍鹰)/.test(fact))
    return numberFrom(fact, /造成 (\d+) 点伤害/);
  return 0;
}

function frameDuration(fact: string, factCount: number) {
  // 总时长控制在约 7 秒内；普通回合保持清楚，超长连击自动压缩节拍。
  const budget = Math.floor(7000 / factCount),
    base = Math.max(280, Math.min(820, budget));
  return /伤害|恢复|吸回|\+\d+/.test(fact)
    ? Math.min(980, base + Math.min(140, Math.max(0, budget - base)))
    : base;
}

function clampPresentation(value: number) {
  return Math.max(0, Math.floor(value));
}

/**
 * 把一次已经完成的确定性结算转换为逐事实播放帧。
 *
 * 引擎状态仍一次性结算，界面只使用这些临时快照演出；最后一帧强制与
 * 引擎真实结果对齐，因此新绝招或未识别的资源变化也不会造成显示漂移。
 */
export function buildBattlePlayback(
  facts: string[],
  before: BattlePresentation,
  after: BattlePresentation,
  enemyName: string,
): BattlePlaybackFrame[] {
  if (!facts.length) return [];
  const current = { ...before };
  const parsedPlayerMaxGain = facts.reduce(
    (sum, fact) =>
      sum +
      itemGain(fact, "伤势上限") +
      numberFrom(fact, /你运转内功疗伤，伤势上限恢复 (\d+) 点/),
    0,
  );
  const parsedEnemyMaxGain = facts.reduce(
    (sum, fact) =>
      sum +
      (fact.includes(enemyName)
        ? numberFrom(fact, /伤势上限恢复 (\d+) 点/)
        : 0),
    0,
  );
  let playerWoundLoss = Math.max(
      0,
      before.playerMaxHp + parsedPlayerMaxGain - after.playerMaxHp,
    ),
    enemyWoundLoss = Math.max(
      0,
      before.enemyMaxHp + parsedEnemyMaxGain - after.enemyMaxHp,
    );

  return facts.map((fact, factIndex) => {
    const damageToPlayer = playerDamage(fact),
      damageToEnemy = enemyDamage(fact, enemyName);
    let popup: BattlePlaybackPopup | undefined;

    if (damageToPlayer > 0) {
      current.playerHp = clampPresentation(current.playerHp - damageToPlayer);
      const wound = Math.min(playerWoundLoss, damageToPlayer);
      current.playerMaxHp = clampPresentation(current.playerMaxHp - wound);
      playerWoundLoss -= wound;
      popup = { side: "player", kind: "damage", text: `−${damageToPlayer}` };
    } else if (damageToEnemy > 0) {
      current.enemyHp = clampPresentation(current.enemyHp - damageToEnemy);
      const wound = Math.min(enemyWoundLoss, damageToEnemy);
      current.enemyMaxHp = clampPresentation(current.enemyMaxHp - wound);
      enemyWoundLoss -= wound;
      popup = { side: "enemy", kind: "damage", text: `−${damageToEnemy}` };
    }

    const playerHeal =
        numberFrom(fact, /吸血大法吸回 (\d+) 点气血/) +
        numberFrom(fact, /你提气归元，恢复 (\d+) 点气血/) +
        itemGain(fact, "气血"),
      enemyHeal = fact.includes(enemyName)
        ? numberFrom(fact, /提气归元，恢复 (\d+) 点气血/)
        : 0,
      playerWoundHeal =
        itemGain(fact, "伤势上限") +
        numberFrom(fact, /你运转内功疗伤，伤势上限恢复 (\d+) 点/),
      enemyWoundHeal = fact.includes(enemyName)
        ? numberFrom(fact, /伤势上限恢复 (\d+) 点/)
        : 0;
    if (playerHeal > 0) {
      current.playerHp += playerHeal;
      popup = { side: "player", kind: "heal", text: `+${playerHeal}` };
    } else if (enemyHeal > 0) {
      current.enemyHp += enemyHeal;
      popup = { side: "enemy", kind: "heal", text: `+${enemyHeal}` };
    }
    if (playerWoundHeal > 0) {
      current.playerMaxHp += playerWoundHeal;
      popup = {
        side: "player",
        kind: "wound",
        text: `上限 +${playerWoundHeal}`,
      };
    } else if (enemyWoundHeal > 0) {
      current.enemyMaxHp += enemyWoundHeal;
      popup = {
        side: "enemy",
        kind: "wound",
        text: `上限 +${enemyWoundHeal}`,
      };
    }

    const playerFpGain = itemGain(fact, "内力"),
      playerMpGain = itemGain(fact, "法力"),
      playerMaxFpGain = itemGain(fact, "内力上限"),
      playerMaxMpGain = itemGain(fact, "法力上限"),
      enemyFpCost = fact.includes(enemyName)
        ? numberFrom(fact, /消耗 (\d+) 点内力/)
        : 0,
      playerFpCost = fact.startsWith("你")
        ? numberFrom(fact, /消耗 (\d+) 点内力/)
        : 0;
    current.playerFp += playerFpGain - playerFpCost;
    current.playerMp += playerMpGain;
    current.playerMaxFp += playerMaxFpGain;
    current.playerMaxMp += playerMaxMpGain;
    current.enemyFp -= enemyFpCost;

    const presentation = { ...current };
    // 未显式写入战报的加力消耗、法力消耗和新扩展效果，在最后一帧平滑归位。
    if (factIndex === facts.length - 1) Object.assign(presentation, after);
    Object.assign(current, presentation);
    return {
      fact,
      factIndex,
      durationMs: frameDuration(fact, facts.length),
      presentation,
      ...(popup ? { popup } : {}),
    };
  });
}
