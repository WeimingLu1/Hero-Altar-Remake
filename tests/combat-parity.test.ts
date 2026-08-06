import assert from "node:assert/strict";
import test from "node:test";
import { attackEffect, kfPower, type Combatant } from "../app/game-core/combat";

const battler = (override: Partial<Combatant> = {}): Combatant => ({
  exp: 10_000, hit: 10, eva: 5, attackKfLv: 20, dodgeKfLv: 10,
  parryKfLv: 10, agi: 30, int: 30, str: 30, atk: 20, pdef: 3,
  fp: 100, fpPlus: 0, weaponId: 1, movable: true, fenshen: -1,
  kfAp: 0, kfDp: 0, kfPp: 0, kfDamage: 0, kfForce: 0, hitType: 2,
  ...override,
});

test("kfPower preserves RGSS integer arithmetic", () => {
  assert.equal(kfPower(battler(), 0), 190);
  assert.equal(kfPower(battler({ agi: 40 }), 0), 199);
  assert.equal(kfPower(battler({ hit: -100, attackKfLv: 0 }), 0), 50);
});

test("first gate reports lightness dodge", () => {
  const result = attackEffect(battler(), battler({ eva: 100, dodgeKfLv: 100 }), () => 0);
  assert.equal(result.damage, "Miss.1");
});

test("successful attack consumes force and returns wound separately", () => {
  const attacker = battler({ fp: 80, fpPlus: 30, weaponId: 1 });
  const target = battler({ eva: 0, dodgeKfLv: 0, parryKfLv: 0, pdef: 1, fenshen: -1 });
  const result = attackEffect(attacker, target, max => Math.max(0, max - 1));
  assert.equal(typeof result.damage, "number");
  assert.equal(attacker.fp, 50);
  assert.ok(result.hurt > 0);
});
