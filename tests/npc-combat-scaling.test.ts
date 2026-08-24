import assert from "node:assert/strict";
import test from "node:test";
import { originalTables } from "../app/game-core/original-data";
import { npcCombatLevel } from "../app/game-core/npc-combat-scaling";
import { beginOriginalBattle } from "../app/game-core/original-battle";
import baselineJson from "../game-data/enemies_plus.json";

const NPC_CEILING = 12000;

test("无战斗武学的百姓只获得克制的基础生存强化", () => {
  const child = originalTables.enemies[2] || {};
  assert.equal(npcCombatLevel(child), 0);
  assert.equal(Number(child.maxhp), 120);
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

test("任何 NPC 都不能突破数值天花板，百姓仍明显弱于武林人物", () => {
  for (let id = 0; id < originalTables.enemies.length; id++) {
    const e = originalTables.enemies[id];
    if (!e) continue;
    assert.ok(
      Number(e.maxhp) <= NPC_CEILING,
      `${e.name}(id${id}) 血量 ${e.maxhp} 超过天花板`,
    );
    assert.ok(Number(e.str) <= 255 && Number(e.agi) <= 255);
    if (npcCombatLevel(e) === 0) {
      // 无专门武功者只提高少量气血，不凭空获得门派绝学。
      assert.ok(
        Number(e.maxhp) <= 1500,
        `无战斗武学的 ${e.name} 不应超过百姓上限，实际 ${e.maxhp}`,
      );
    }
  }
});

test("武林人物按既有门派谱系普遍学会更多武功且运用槽始终有效", () => {
  const baseline = (baselineJson as { data: Array<Record<string, unknown> | null> }).data;
  let expanded = 0;
  let additions = 0;
  for (let id = 0; id < originalTables.enemies.length; id++) {
    const current = originalTables.enemies[id];
    const before = baseline[id];
    if (!current || !before || npcCombatLevel(before) <= 0 || id === 198) continue;
    const oldIds = new Set(((before.skill_list as number[][]) || []).map(([skillId]) => skillId));
    const learned = ((current.skill_list as number[][]) || []).map(([skillId]) => skillId);
    const newlyLearned = learned.filter((skillId) => !oldIds.has(skillId));
    if (newlyLearned.length) expanded++;
    additions += newlyLearned.length;
    for (const skillId of (current.skill_use as number[]) || [])
      assert.ok(skillId === 0 || learned.includes(skillId), `${current.name} 运用了未学会的武功 ${skillId}`);
  }
  assert.ok(expanded >= 90, `实际只有 ${expanded} 名武林人物扩充武学`);
  assert.ok(additions >= 180, `实际只新增 ${additions} 门人物武功`);
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
