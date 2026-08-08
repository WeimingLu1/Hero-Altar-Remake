import assert from "node:assert/strict";
import test from "node:test";
import { originalTables } from "../app/game-core/original-data";
import { npcCombatLevel } from "../app/game-core/npc-combat-scaling";
import { beginOriginalBattle } from "../app/game-core/original-battle";

const NPC_CEILING = 3500;

test("无战斗武学的百姓保持原始弱小数值", () => {
  const child = originalTables.enemies[2] || {};
  assert.equal(npcCombatLevel(child), 0);
  assert.equal(Number(child.maxhp), 100);
  assert.equal(Number(child.fp || 0), 0);
  const battle = beginOriginalBattle(2);
  assert.equal(battle.enemyMaxHp, Number(child.maxhp));
  assert.equal(battle.enemyFp, Number(child.fp || 0));
});

test("重平衡后顶级高手拥有与等级相称且不超玩家天花板的数值", () => {
  const leader = originalTables.enemies[111] || {}; // 白瑞德，掌门顶到 254
  assert.equal(npcCombatLevel(leader), 254);
  assert.ok(
    Number(leader.maxhp) >= 3000,
    `白瑞德应获得与 250 级相称的血量，实际 ${leader.maxhp}`,
  );
  assert.ok(
    Number(leader.maxhp) <= NPC_CEILING,
    `白瑞德血量 ${leader.maxhp} 不得超过天花板 ${NPC_CEILING}`,
  );
  assert.ok(Number(leader.maxfp) > 5000);
  assert.ok(Number(leader.base_hit) >= 50);
});

test("任何 NPC 都不能突破数值天花板，百姓保持弱小", () => {
  for (let id = 0; id < originalTables.enemies.length; id++) {
    const e = originalTables.enemies[id];
    if (!e) continue;
    assert.ok(
      Number(e.maxhp) <= NPC_CEILING,
      `${e.name}(id${id}) 血量 ${e.maxhp} 超过天花板`,
    );
    assert.ok(Number(e.str) <= 255 && Number(e.agi) <= 255);
    if (npcCombatLevel(e) === 0) {
      // 无战斗武学者不被重平衡，保持原始弱小数值（如顾炎武 620）
      assert.ok(
        Number(e.maxhp) <= 700,
        `无战斗武学的 ${e.name} 应保持原值，实际 ${e.maxhp}`,
      );
    }
  }
});

test("法术型高手获得法力池，非法术型没有", () => {
  const mage = originalTables.enemies[144] || {}; // 茅盈
  const fighter = originalTables.enemies[59] || {}; // 李青照
  assert.ok(Number(mage.maxmp) > 0, "茅盈应有法力池");
  assert.equal(Number(fighter.maxmp || 0), 0, "李青照无法力池");
});

test("动态任务敌人保持玩家相对平衡的原始数值", () => {
  const dynamic = {
    name: "动态通缉犯",
    hp: 800,
    maxhp: 800,
    fp: 640,
    maxfp: 640,
    skill_list: [[2, 180]],
  };
  const battle = beginOriginalBattle(1, 42, dynamic);
  assert.equal(battle.enemyMaxHp, 800);
  assert.equal(battle.enemyFp, 640);
});
