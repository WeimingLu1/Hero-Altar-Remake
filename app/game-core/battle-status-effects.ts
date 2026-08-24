import type { OriginalBattle } from "./original-battle";

export type BattleStatusEffect = {
  key: string;
  icon: string;
  name: string;
  detail: string;
  turns: number;
  kind: "buff" | "debuff" | "control" | "ongoing";
};

type BattleSide = "player" | "enemy";

const statEffects = [
  ["atk", "攻", "攻击"],
  ["pdef", "防", "防御"],
  ["hit", "命", "命中"],
  ["eva", "闪", "闪避"],
  ["str", "力", "膂力"],
  ["agi", "敏", "敏捷"],
] as const;

/**
 * Convert the battle engine's aggregate state into the exact values shown by
 * the UI. Player special buffs intentionally share one aggregate duration in
 * the original port; NPC support specials are not recast while that aggregate
 * is active. Debuffs and ongoing effects keep their own counters.
 */
export function battleStatusEffects(
  battle: OriginalBattle,
  side: BattleSide,
  burnRatePercent?: number,
): BattleStatusEffect[] {
  const buff = side === "player" ? battle.buff : battle.enemyBuff;
  const effects: BattleStatusEffect[] = [];
  for (const [key, icon, name] of statEffects) {
    const value = buff[key];
    if (value === 0) continue;
    effects.push({
      key: `buff-${key}`,
      icon,
      name: `${name}提升`,
      detail: `${name} ${value > 0 ? "+" : ""}${value}`,
      turns: buff.turns,
      kind: value > 0 ? "buff" : "debuff",
    });
  }
  if (buff.fenshen >= 0) {
    effects.push({
      key: "buff-fenshen",
      icon: "影",
      name: "残影格挡",
      detail: `额外格挡 ${buff.fenshen}%`,
      turns: buff.turns,
      kind: "buff",
    });
  }

  const debuff = side === "player" ? battle.playerDebuff : battle.enemyDebuff;
  if (debuff.hit < 0) {
    effects.push({
      key: "debuff-hit",
      icon: "盲",
      name: "命中下降",
      detail: `命中 ${debuff.hit}`,
      turns: debuff.turns,
      kind: "debuff",
    });
  }
  const busy = side === "player" ? battle.playerBusy : battle.enemyDebuff.busy;
  if (busy > 0) {
    effects.push({
      key: "control-busy",
      icon: "制",
      name: "行动受制",
      detail: "无法进行普通行动",
      turns: busy,
      kind: "control",
    });
  }
  if (debuff.burnTurns > 0) {
    const rate = burnRatePercent === undefined
      ? "5%–8%"
      : `${Number(burnRatePercent.toFixed(2))}%`;
    effects.push({
      key: "ongoing-burn",
      icon: "燃",
      name: "法火灼烧",
      detail: `每回合造成内息压制差 ${rate} 的伤害`,
      turns: debuff.burnTurns,
      kind: "ongoing",
    });
  }
  if (side === "enemy" && battle.enemyDebuff.eagleTurns > 0) {
    effects.push({
      key: "ongoing-eagle",
      icon: "鹰",
      name: "苍鹰追击",
      detail: "每回合 60% 概率造成 50 伤害",
      turns: battle.enemyDebuff.eagleTurns,
      kind: "ongoing",
    });
  }
  return effects;
}
