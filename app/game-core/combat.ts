/** Browser port of Script/021 and Script/023 Game_Battler combat math. */
export type RandomInt = (maxExclusive: number) => number;

export interface Combatant {
  exp: number;
  hit: number;
  eva: number;
  attackKfLv: number;
  dodgeKfLv: number;
  parryKfLv: number;
  agi: number;
  int: number;
  str: number;
  atk: number;
  pdef: number;
  fp: number;
  fpPlus: number;
  weaponId: number;
  movable: boolean;
  fenshen: number;
  kfAp: number;
  kfDp: number;
  kfPp: number;
  kfDamage: number;
  kfForce: number;
  hitType: number;
}

export type AttackResult = {
  damage: number | "Miss.1" | "Miss.2" | "Miss.3";
  hitType: number;
  hurt: number;
};

const idiv = (value: number, divisor: number) => Math.floor(value / divisor);

export function kfPower(battler: Combatant, type: 0 | 1 | 2): number {
  let attr1 = 0;
  let attr2 = 100;
  if (type === 0) {
    attr1 = battler.hit + battler.attackKfLv + battler.kfAp;
    attr2 = 100 + idiv(battler.agi - 30, 2);
  } else if (type === 1) {
    attr1 = battler.eva + battler.dodgeKfLv + battler.kfDp;
    attr2 = 100 + idiv(battler.int - 30, 2);
  } else {
    attr1 = battler.eva + battler.parryKfLv + battler.kfPp;
    attr2 = 100 + idiv(battler.str - 30, 2);
  }
  attr1 = Math.max(attr1, 0);
  let expPower = idiv(battler.exp, 100);
  if (attr1 === 0) expPower = idiv(expPower, 2);
  return idiv((idiv(attr1 ** 3, 300) + expPower) * attr2, 100);
}

export function attackEffect(attacker: Combatant, target: Combatant, randomInt: RandomInt): AttackResult {
  let hurt = 0;
  const hitPara = kfPower(attacker, 0);
  let evaPara = kfPower(target, 1);
  if (!target.movable) evaPara = idiv(evaPara, 3);
  const firstTotal = Math.max(1, hitPara + evaPara);
  if (randomInt(firstTotal) < evaPara) return { damage: "Miss.1", hitType: attacker.hitType, hurt };

  let parryPara = kfPower(target, 2);
  if (!target.movable) parryPara = idiv(parryPara, 3);
  const secondTotal = Math.max(1, hitPara + parryPara);
  if (randomInt(secondTotal) < parryPara) return { damage: "Miss.2", hitType: attacker.hitType, hurt };
  if (randomInt(100) <= target.fenshen) return { damage: "Miss.3", hitType: attacker.hitType, hurt };

  // force 倍率封顶 ×2.0：否则高 force 武功(如雪影擒拿手 force 250)会把
  // 数值对标的 str/fp 放大成秒人伤害，破坏「数值对照即公平」的重平衡目标。
  const force = Math.min(attacker.kfForce, 100);
  let damage1 = idiv(randomInt(Math.max(1, attacker.atk)) + attacker.atk, 2);
  damage1 += idiv(damage1 * attacker.kfDamage, 100);
  let fpAdd = Math.min(attacker.fp, attacker.fpPlus);
  attacker.fp -= fpAdd;
  let damage2: number;
  if (fpAdd === 0) {
    damage2 = attacker.str + idiv(attacker.str * force, 100);
  } else {
    if (attacker.weaponId > 0) fpAdd = idiv(fpAdd, 6);
    fpAdd += idiv(Math.min(attacker.fp, 3000), 20) - idiv(target.fpPlus, 25);
    damage2 = fpAdd <= 0 ? attacker.str : attacker.str + fpAdd;
    if (fpAdd > 0) damage2 += idiv(damage2 * force, 100);
  }
  const damage = damage1 + idiv(randomInt(Math.max(1, damage2)) + damage2, 2);
  if (randomInt(Math.max(1, damage)) > target.pdef) {
    hurt = damage - target.pdef;
    if (attacker.weaponId <= 0 && randomInt(4) !== 0) hurt = 0;
  }
  return { damage, hitType: attacker.hitType, hurt };
}

export function seededRandom(seed: number): RandomInt {
  let state = seed >>> 0;
  return (maxExclusive: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 4294967296) * Math.max(1, maxExclusive));
  };
}
