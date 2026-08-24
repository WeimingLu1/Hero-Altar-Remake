import assert from "node:assert/strict";
import test from "node:test";
import { battleStatusEffects } from "../app/game-core/battle-status-effects";
import { beginOriginalBattle } from "../app/game-core/original-battle";

test("玩家多个绝招增益按引擎实际合计值逐项显示", () => {
  const battle = beginOriginalBattle(1, 123);
  battle.buff = {
    ...battle.buff,
    atk: 45,
    hit: 25,
    str: 18,
    fenshen: 40,
    turns: 4,
  };
  const effects = battleStatusEffects(battle, "player");
  assert.deepEqual(
    effects.map(({ name, detail, turns }) => ({ name, detail, turns })),
    [
      { name: "攻击提升", detail: "攻击 +45", turns: 4 },
      { name: "命中提升", detail: "命中 +25", turns: 4 },
      { name: "膂力提升", detail: "膂力 +18", turns: 4 },
      { name: "残影格挡", detail: "额外格挡 40%", turns: 4 },
    ],
  );
});

test("敌方增益、命中削弱、控制、灼烧和苍鹰追击可同时显示", () => {
  const battle = beginOriginalBattle(1, 456);
  battle.enemyBuff.atk = 30;
  battle.enemyBuff.pdef = 60;
  battle.enemyBuff.turns = 5;
  battle.enemyDebuff.hit = -16;
  battle.enemyDebuff.turns = 3;
  battle.enemyDebuff.busy = 2;
  battle.enemyDebuff.burnTurns = 4;
  battle.enemyDebuff.eagleTurns = 6;
  const effects = battleStatusEffects(battle, "enemy", 6.25);
  assert.deepEqual(
    effects.map((effect) => effect.key),
    [
      "buff-atk",
      "buff-pdef",
      "debuff-hit",
      "control-busy",
      "ongoing-burn",
      "ongoing-eagle",
    ],
  );
  assert.match(effects.find((effect) => effect.key === "ongoing-burn")?.detail || "", /6\.25%/);
  assert.match(effects.at(-1)?.detail || "", /60%.*50/);
});

test("没有持续战斗状态时不渲染空图标", () => {
  const battle = beginOriginalBattle(1, 789);
  assert.deepEqual(battleStatusEffects(battle, "player"), []);
  assert.deepEqual(battleStatusEffects(battle, "enemy"), []);
});
