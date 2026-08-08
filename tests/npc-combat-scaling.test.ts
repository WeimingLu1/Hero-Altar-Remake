import assert from "node:assert/strict";
import test from "node:test";
import { originalTables } from "../app/game-core/original-data";
import {
  npcCombatLevel,
  scaledNpcCombatRecord,
} from "../app/game-core/npc-combat-scaling";
import { beginOriginalBattle } from "../app/game-core/original-battle";

test("untrained civilians retain their deliberately weak original values", () => {
  const child = originalTables.enemies[2] || {};
  assert.equal(npcCombatLevel(child), 0);
  assert.equal(scaledNpcCombatRecord(child), child);
  const battle = beginOriginalBattle(2);
  assert.equal(battle.enemyMaxHp, Number(child.maxhp));
  assert.equal(battle.enemyFp, Number(child.fp || 0));
});

test("martial tiers widen progressively and true masters survive many more blows", () => {
  const ordinary = scaledNpcCombatRecord(originalTables.enemies[35] || {});
  const leader = originalTables.enemies[59] || {};
  const scaledLeader = scaledNpcCombatRecord(leader);
  assert.equal(npcCombatLevel(leader), 250);
  assert.ok(Number(scaledLeader.maxhp) >= Number(leader.maxhp) * 10);
  assert.ok(Number(scaledLeader.maxfp) >= Number(leader.maxfp) * 8);
  assert.ok(Number(scaledLeader.pdef) > Number(leader.pdef || 0));
  assert.equal(Number(scaledLeader.base_agi), Number(leader.base_agi) + 20);
  assert.equal(Number(scaledLeader.agi), Number(leader.agi) + 20);
  assert.ok(Number(scaledLeader.base_hit) >= 100);
  assert.equal(ordinary.maxhp, originalTables.enemies[35]?.maxhp);
  assert.equal(ordinary.base_agi, originalTables.enemies[35]?.base_agi);
});

test("magic masters receive a real mana pool while non-casters do not", () => {
  const mage = scaledNpcCombatRecord(originalTables.enemies[144] || {});
  const fighter = scaledNpcCombatRecord(originalTables.enemies[59] || {});
  assert.ok(Number(mage.maxmp) >= Number(originalTables.enemies[144]?.maxmp) * 8);
  assert.equal(Number(fighter.maxmp || 0), 0);
});

test("runtime task enemies keep their existing player-relative balance", () => {
  const dynamic = {
    name: "动态通缉犯",
    hp: 800,
    maxhp: 800,
    fp: 640,
    maxfp: 640,
    skill_list: [[2, 180]],
  };
  assert.equal(scaledNpcCombatRecord(dynamic, true), dynamic);
  const battle = beginOriginalBattle(1, 42, dynamic);
  assert.equal(battle.enemyMaxHp, 800);
  assert.equal(battle.enemyFp, 640);
});
