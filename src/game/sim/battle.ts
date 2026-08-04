import { ENEMIES, enemyDef } from "../content/enemies";
import { ITEMS } from "../content/items";
import { NPCS } from "../content/npcs";
import { PLATE_SECTS, SECTS } from "../content/sects";
import { SKILLS, skillDef } from "../content/skills";
import type { EnemySkillDef, UltDef } from "../content/types";
import { randomQteText } from "../content/story";
import {
  activeNeigongLevel,
  attackPower,
  clamp,
  critChance,
  damageCalc,
  defensePower,
  dodgeChance,
  gainExpForSkill,
  hitChance,
  maxHp,
  maxMp,
  speedValue,
  weaponOf
} from "./formulas";
import type { GameState } from "./state";
import { applyNpcDrops, getRewards } from "./actions";

export interface Buff {
  stat: "atk" | "def" | "spd" | "dodge" | "parry";
  // atk/def/spd 为数值加减；dodge/parry 为概率加成（0.15 即 +15%）
  value: number;
  turns: number;
}

export interface BattleEntity {
  name: string;
  title?: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  hit: number;
  dodge: number;
  crit: number;
  buffs: Buff[];
  poison: number;
  defending: boolean;
}

export type BattleEventKind = "move" | "attack" | "hit" | "crit" | "dodge" | "parry" | "heal" | "buff" | "debuff" | "poison" | "death" | "flee" | "phase" | "stance" | "opening" | "qte" | "info";

export interface BattleEvent {
  kind: BattleEventKind;
  side: "player" | "enemy";
  text: string;
  dmg?: number;
  // 展示用字段：绝招/敌方技能名、武功类型（剑/刀/拳/杖/鞭/内功）、倍率（BattleScene 特效用）
  ultName?: string;
  ultType?: string;
  mult?: number;
  qte?: boolean;
}

export interface BattleState {
  player: BattleEntity;
  enemy: BattleEntity;
  enemyId: string;
  sourceNpc?: string;
  jiali: number;
  log: BattleEvent[];
  rewardLines: string[];
  over: boolean;
  victory: boolean;
  fled: boolean;
  turn: number; // 玩家行动回合计数（治疗绝招冷却以此为准）
  phase: number; // boss AI 阶段：1 常规 / 2 凌厉 / 3 狂暴
  // 破绽：攻击被闪避/招架的一方露出破绽，下次受击伤害 ×1.5
  opening: { player: boolean; enemy: boolean };
  rewardHalf: boolean; // 敌方落荒而逃：按胜利结算但奖励减半
  lastHealTurn: number;
  lastHealUlt: string | null;
  enemyWasHit: boolean; // guard AI 反击判定用：敌方上回合后是否受过击
  // QTE 微操：随机字母，按对后本次攻击获得大幅加成
  qteActive: boolean;
  qteKey: string;
  qteSuccess: boolean;
  qteStreak: number;
}

export function startBattle(s: GameState, enemyId: string, sourceNpc?: string): BattleState {
  const def = enemyDef(enemyId);
  const p = s.player;
  const effHp = maxHp(p);
  const effMp = maxMp(p);
  const player: BattleEntity = {
    name: p.name,
    title: p.sect ? "江湖人" : "初入江湖",
    hp: clamp(p.hp, 1, effHp),
    maxHp: effHp,
    mp: clamp(p.mp, 0, effMp),
    maxMp: effMp,
    atk: attackPower(p),
    def: defensePower(p),
    spd: speedValue(p),
    hit: hitChance(p),
    dodge: dodgeChance(p),
    crit: critChance(p),
    buffs: [],
    poison: p.poison,
    defending: false
  };
  const enemy: BattleEntity = {
    name: def.name,
    title: def.title,
    hp: def.hp,
    maxHp: def.hp,
    mp: def.mp,
    maxMp: def.mp,
    atk: def.atk,
    def: def.def,
    spd: def.spd,
    hit: def.accuracy / 100,
    dodge: def.dodge / 100,
    crit: def.crit / 100,
    buffs: [],
    poison: 0,
    defending: false
  };
  return {
    player,
    enemy,
    enemyId,
    sourceNpc,
    jiali: 0,
    log: [],
    rewardLines: [],
    over: false,
    victory: false,
    fled: false,
    turn: 0,
    phase: 1,
    opening: { player: false, enemy: false },
    rewardHalf: false,
    lastHealTurn: -99,
    lastHealUlt: null,
    enemyWasHit: false,
    qteActive: false,
    qteKey: "",
    qteSuccess: false,
    qteStreak: 0
  };
}

function effectiveStat(e: BattleEntity, stat: string, base: number): number {
  let v = base;
  for (const b of e.buffs) if (b.stat === stat) v += b.value;
  return Math.max(0, v);
}

// 物理伤害上限：单次最多削掉目标约 45% 最大气血（弱敌保底 50 点），避免一招秒杀
function capDamage(dmg: number, targetMaxHp: number): number {
  return Math.max(1, Math.min(dmg, Math.max(50, Math.floor(targetMaxHp * 0.45))));
}

function qteTechName(s: GameState): string {
  const pool = Object.entries(s.player.skills)
    .filter(([, lv]) => lv > 0)
    .map(([id]) => skillDef(id).name);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "所学招式";
}

function addBuff(e: BattleEntity, buff: { stat: Buff["stat"]; value: number; turns: number }): void {
  const existing = e.buffs.find((b) => b.stat === buff.stat);
  if (existing) {
    existing.value = buff.value;
    existing.turns = Math.max(existing.turns, buff.turns);
  } else {
    e.buffs.push({ ...buff });
  }
}

function tickBuffs(e: BattleEntity): void {
  e.buffs = e.buffs
    .map((b) => ({ ...b, turns: b.turns - 1 }))
    .filter((b) => b.turns > 0);
}

// 加力先付费后出招：内力不足则当次加力作废，返回实际生效的加力值
function payJiali(b: BattleState, events: BattleEvent[]): number {
  if (b.jiali <= 0) return 0;
  const cost = b.jiali * 3;
  if (b.player.mp >= cost) {
    b.player.mp -= cost;
    return b.jiali;
  }
  b.jiali = 0;
  events.push({ kind: "info", side: "player", text: "内力不足，无法加力。" });
  return 0;
}

export function availableUts(s: GameState): UltDef[] {
  const p = s.player;
  const out: UltDef[] = [];
  for (const [id, lv] of Object.entries(p.skills)) {
    if (lv <= 0) continue;
    const def = skillDef(id);
    for (const ult of def.ult || []) {
      if (lv >= ult.lv) out.push(ult);
    }
  }
  return out.sort((a, b) => b.lv - a.lv);
}

export function playerAttack(b: BattleState, s: GameState, qteSuccess?: boolean): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (b.over) return events;
  b.turn += 1;
  const p = b.player;
  const e = b.enemy;
  const skill = mainSkill(s);
  const jiali = payJiali(b, events);
  const hitRoll = Math.random();
  const eDodge = Math.min(0.6, effectiveStat(e, "dodge", e.dodge));
  if (hitRoll > p.hit - eDodge * 0.5) {
    // 攻击被闪避，自己露出破绽
    b.opening.player = true;
    events.push({ kind: "dodge", side: "enemy", text: `${e.name}身形一闪，避开了你的攻击。` });
  } else {
    const crit = Math.random() < p.crit;
    // 暴击加成只在 damageCalc 内部乘一次，与绝招保持一致
    let dmg = damageCalc(
      effectiveStat(p, "atk", p.atk) + jiali * 3,
      effectiveStat(e, "def", e.def),
      { mult: 1 + Math.sqrt(skill.level || 0) * 0.055 + weaponOf(s.player).atk * 0.0015, crit }
    );
    if (e.defending) {
      dmg = Math.floor(dmg * 0.5);
      e.defending = false;
    }
    if (b.opening.enemy) {
      dmg = Math.round(dmg * 1.5);
      b.opening.enemy = false;
      events.push({ kind: "opening", side: "enemy", text: `${e.name}门户大开，破绽毕露！` });
    }
    if (qteSuccess) {
      const tech = qteTechName(s);
      const bonus = 0.5 + Math.min(0.4, b.qteStreak * 0.06);
      dmg = Math.round(dmg * (1 + bonus));
      events.push({ kind: "qte", side: "player", text: randomQteText(true, tech), qte: true });
    }
    dmg = capDamage(dmg, e.maxHp);
    e.hp -= dmg;
    b.enemyWasHit = true;
    events.push({
      kind: crit ? "crit" : "hit",
      side: "player",
      text: `${crit ? "会心一击！" : ""}你使出「${skill.name}」，对${e.name}造成 ${dmg} 点伤害。`,
      dmg
    });
    gainExpForSkill(s.player, skill.id, dmg);
    if (e.hp <= 0) {
      e.hp = 0;
      events.push({ kind: "death", side: "enemy", text: `${e.name}轰然倒地！` });
      endBattle(b, s, true);
      return events;
    }
  }
  events.push(...enemyTurn(b, s));
  return events;
}

export function playerUlt(b: BattleState, s: GameState, ult: UltDef, qteSuccess?: boolean): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (b.over) return events;
  const p = b.player;
  const e = b.enemy;
  if (p.mp < ult.cost) {
    events.push({ kind: "info", side: "player", text: "内力不足，施展不出这一招。" });
    return events;
  }
  if (ult.kind === "heal" && b.lastHealUlt === ult.id && b.turn - b.lastHealTurn < 4) {
    // 同一治疗绝招每场战斗冷却 4 回合
    events.push({ kind: "info", side: "player", text: `「${ult.name}」气机未复，还需 ${4 - (b.turn - b.lastHealTurn)} 回合方能再使。` });
    return events;
  }
  b.turn += 1;
  p.mp -= ult.cost;
  const ultType = ultOwnerType(ult.id);
  events.push({ kind: "move", side: "player", text: ult.text, ultName: ult.name, ultType, mult: ult.mult });
  if (qteSuccess) {
    events.push({ kind: "qte", side: "player", text: randomQteText(true, ult.name), qte: true });
  }
  if (ult.kind === "attack") {
    const jiali = payJiali(b, events);
    const hitRoll = Math.random();
    const eDodge = Math.min(0.6, effectiveStat(e, "dodge", e.dodge));
    if (hitRoll > p.hit - eDodge * 0.3) {
      b.opening.player = true;
      events.push({ kind: "dodge", side: "enemy", text: `${e.name}堪堪避开了绝招。` });
    } else {
      const crit = Math.random() < p.crit;
      // 暴击加成只在 damageCalc 内部乘一次，与普攻保持一致
      let dmg = damageCalc(effectiveStat(p, "atk", p.atk) + jiali * 3, effectiveStat(e, "def", e.def), {
        mult: ult.mult,
        crit
      });
      if (e.defending) {
        dmg = Math.floor(dmg * 0.5);
        e.defending = false;
      }
      if (b.opening.enemy) {
        dmg = Math.round(dmg * 1.5);
        b.opening.enemy = false;
        events.push({ kind: "opening", side: "enemy", text: `${e.name}门户大开，破绽毕露！` });
      }
      if (qteSuccess) {
        const bonus = 0.5 + Math.min(0.4, b.qteStreak * 0.06);
        dmg = Math.round(dmg * (1 + bonus));
      }
      dmg = capDamage(dmg, e.maxHp);
      e.hp -= dmg;
      b.enemyWasHit = true;
      events.push({
        kind: crit ? "crit" : "hit",
        side: "player",
        text: `${ult.name}命中！对${e.name}造成 ${dmg} 点伤害。`,
        dmg,
        ultName: ult.name,
        ultType,
        mult: ult.mult
      });
      if (e.hp <= 0) {
        e.hp = 0;
        events.push({ kind: "death", side: "enemy", text: `${e.name}再也站不起来了！` });
        endBattle(b, s, true);
        return events;
      }
    }
  } else if (ult.kind === "heal") {
    // 治疗绝招：固定 120 + 最大气血 8% + 当前内功等级 ×0.8
    let heal = Math.floor(120 + p.maxHp * 0.08 + activeNeigongLevel(s.player) * 0.8);
    if (qteSuccess) heal = Math.round(heal * 1.3);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    b.lastHealTurn = b.turn;
    b.lastHealUlt = ult.id;
    events.push({ kind: "heal", side: "player", text: `你恢复了 ${heal} 点气血。` });
  } else if (ult.kind === "buff") {
    if (ult.buff) addBuff(p, { ...ult.buff, turns: ult.buff.turns + (qteSuccess ? 1 : 0) });
    if (ult.buff2) addBuff(p, { ...ult.buff2, turns: ult.buff2.turns + (qteSuccess ? 1 : 0) });
    const names = [ult.buff ? statName(ult.buff.stat) : "", ult.buff2 ? statName(ult.buff2.stat) : ""].filter(Boolean);
    events.push({ kind: "buff", side: "player", text: `${names.join("、") || "气息"}提升了！` });
  } else if (ult.kind === "defense") {
    if (ult.buff) addBuff(p, { ...ult.buff, turns: ult.buff.turns + (qteSuccess ? 1 : 0) });
    events.push({ kind: "buff", side: "player", text: "你凝神运功，防御大增。" });
  } else if (ult.kind === "debuff") {
    if (ult.debuff) {
      if (Math.random() < 0.85) addBuff(e, ult.debuff);
      else events.push({ kind: "info", side: "enemy", text: `${e.name}内力深厚，化解了负面效果。` });
    }
  }
  events.push(...enemyTurn(b, s));
  return events;
}

export function playerDefend(b: BattleState, s: GameState): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (b.over) return events;
  b.turn += 1;
  const p = b.player;
  p.defending = true;
  const heal = Math.max(1, Math.floor(p.maxHp * 0.03));
  const mpRegen = Math.max(1, Math.floor(p.maxMp * 0.05));
  p.hp = Math.min(p.maxHp, p.hp + heal);
  p.mp = Math.min(p.maxMp, p.mp + mpRegen);
  events.push({ kind: "buff", side: "player", text: `你运功防御，恢复 ${heal} 点气血、${mpRegen} 点内力。` });
  events.push(...enemyTurn(b, s));
  return events;
}

export function playerItem(b: BattleState, s: GameState, itemId: string): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (b.over) return events;
  const def = ITEMS[itemId];
  if (!def || (s.player.items[itemId] || 0) <= 0) {
    events.push({ kind: "info", side: "player", text: "没有这个物品。" });
    return events;
  }
  b.turn += 1;
  s.player.items[itemId] -= 1;
  if (s.player.items[itemId] <= 0) delete s.player.items[itemId];
  const eff = def.effect || {};
  if (def.kind === "food") {
    // 行军打仗啃干粮：战斗中吃食物回 8% 最大气血
    const before = b.player.hp;
    b.player.hp = Math.min(b.player.maxHp, b.player.hp + Math.max(1, Math.floor(b.player.maxHp * 0.08)));
    events.push({ kind: "heal", side: "player", text: `你啃了几口「${def.name}」垫饥，恢复 ${b.player.hp - before} 点气血。` });
  } else if (def.kind === "drink") {
    // 战斗中痛饮一口，回 10% 最大内力
    const before = b.player.mp;
    b.player.mp = Math.min(b.player.maxMp, b.player.mp + Math.max(1, Math.floor(b.player.maxMp * 0.1)));
    events.push({ kind: "heal", side: "player", text: `你灌下一口「${def.name}」，恢复 ${b.player.mp - before} 点内力。` });
  } else {
    if (eff.hp) {
      const before = b.player.hp;
      b.player.hp = Math.min(b.player.maxHp, b.player.hp + eff.hp);
      events.push({ kind: "heal", side: "player", text: `你使用了「${def.name}」，恢复 ${b.player.hp - before} 点气血。` });
    }
    if (eff.mp) {
      const before = b.player.mp;
      b.player.mp = Math.min(b.player.maxMp, b.player.mp + eff.mp);
      events.push({ kind: "heal", side: "player", text: `你使用了「${def.name}」，恢复 ${b.player.mp - before} 点内力。` });
    }
    if (eff.effective) {
      s.player.effHp = clamp(s.player.effHp + eff.effective, 1, maxHp(s.player));
      b.player.hp = Math.min(b.player.hp, s.player.effHp);
      events.push({ kind: "heal", side: "player", text: "受损的经脉温养了一些。" });
    }
    if (eff.curePoison) {
      b.player.poison = 0;
      s.player.poison = 0;
      events.push({ kind: "heal", side: "player", text: "毒气被清除了。" });
    }
  }
  events.push(...enemyTurn(b, s));
  return events;
}

export function playerFlee(b: BattleState, s: GameState): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (b.over) return events;
  b.turn += 1;
  const pSpd = effectiveStat(b.player, "spd", b.player.spd);
  const eSpd = effectiveStat(b.enemy, "spd", b.enemy.spd);
  const chance = clamp(0.55 + (pSpd - eSpd) * 0.02, 0.25, 0.92);
  if (Math.random() < chance) {
    events.push({ kind: "flee", side: "player", text: "你虚晃一招，脱出战圈，头也不回地跑了。" });
    b.over = true;
    b.fled = true;
    syncBack(b, s, false);
  } else {
    events.push({ kind: "info", side: "enemy", text: `${b.enemy.name}缠了上来，跑不掉！` });
    events.push(...enemyTurn(b, s));
  }
  return events;
}

interface EnemyAction {
  kind: "attack" | "skill" | "stance" | "flee";
  skill?: EnemySkillDef;
}

function pickWeighted(skills: EnemySkillDef[], weight: (sk: EnemySkillDef) => number): EnemySkillDef | undefined {
  const total = skills.reduce((sum, sk) => sum + weight(sk), 0);
  if (total <= 0) return undefined;
  let pick = Math.random() * total;
  for (const sk of skills) {
    pick -= weight(sk);
    if (pick < 0) return sk;
  }
  return skills[skills.length - 1];
}

// 五档敌方 AI：wild 乱打 / bandit 抢攻+落跑 / guard 守势+反击 / master 智能 / boss 阶段化
function enemyDecide(b: BattleState, def: ReturnType<typeof enemyDef>): EnemyAction {
  const e = b.enemy;
  const p = b.player;
  // 技能耗 mp：mp 不足的技能不可用
  const usable = (def.skills || []).filter((sk) => (sk.mpCost || 0) <= e.mp);
  const attackSkills = usable.filter((sk) => !sk.heal && !sk.buff);
  const wasHit = b.enemyWasHit;
  b.enemyWasHit = false;
  switch (def.ai) {
    case "wild": {
      // 野兽凭本能：八成撕咬，两成本能技，从不防御
      if (usable.length && Math.random() < 0.2) {
        const skill = pickWeighted(usable, (sk) => sk.chance);
        if (skill) return { kind: "skill", skill };
      }
      return { kind: "attack" };
    }
    case "bandit": {
      // 血量见低时可能落荒而逃
      if (e.hp < e.maxHp * 0.3 && Math.random() < 0.15) return { kind: "flee" };
      // 抢攻型：优先放攻击技能（权重 ×1.5）
      if (attackSkills.length && Math.random() < 0.55) {
        const skill = pickWeighted(attackSkills, (sk) => sk.chance * 1.5);
        if (skill) return { kind: "skill", skill };
      }
      return { kind: "attack" };
    }
    case "guard": {
      // 体健时三成概率摆出守势（下回合受伤 ×0.5）
      if (e.hp > e.maxHp * 0.6 && Math.random() < 0.3) return { kind: "stance" };
      // 技能偏 buff 自己
      const buffSkills = usable.filter((sk) => sk.buff);
      if (buffSkills.length && !e.buffs.some((bf) => bf.value > 0) && Math.random() < 0.5) {
        const skill = pickWeighted(buffSkills, (sk) => sk.chance);
        if (skill) return { kind: "skill", skill };
      }
      // 被攻击后反击概率提升
      const counterRate = wasHit ? 0.6 : 0.4;
      if (attackSkills.length && Math.random() < counterRate) {
        const skill = pickWeighted(attackSkills, (sk) => sk.chance);
        if (skill) return { kind: "skill", skill };
      }
      return { kind: "attack" };
    }
    case "master": {
      // 血量见低：半数机会优先治疗，否则守势或抢攻
      if (e.hp < e.maxHp * 0.4) {
        const healSkill = usable.find((sk) => sk.heal);
        if (healSkill && Math.random() < 0.35) return { kind: "skill", skill: healSkill };
        if (Math.random() < 0.4) return { kind: "stance" };
      }
      // 玩家运功防御时用 debuff 破防
      if (p.defending) {
        const deb = usable.filter((sk) => sk.debuff);
        const skill = deb.length ? pickWeighted(deb, (sk) => sk.chance) : undefined;
        if (skill) return { kind: "skill", skill };
      }
      // 绝招按 mp 管理：内力充裕时偏好大威力招
      if (attackSkills.length && Math.random() < 0.6) {
        const rich = e.mp > e.maxMp * 0.3;
        const skill = pickWeighted(attackSkills, (sk) => sk.chance * (rich ? 1 + sk.mult : 1));
        if (skill) return { kind: "skill", skill };
      }
      return { kind: "attack" };
    }
    case "boss": {
      if (attackSkills.length && Math.random() < 0.6) {
        // 阶段二起解锁更强技能：偏好高倍率重招
        const skill = pickWeighted(attackSkills, (sk) => (b.phase >= 2 ? sk.chance * sk.mult : sk.chance));
        if (skill) return { kind: "skill", skill };
      }
      return { kind: "attack" };
    }
  }
  return { kind: "attack" };
}

function enemyTurn(b: BattleState, s: GameState): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (b.over) return events;
  const p = b.player;
  const e = b.enemy;
  if (p.poison > 0) {
    if (s.player.cheatLock) {
      events.push({ kind: "info", side: "player", text: "锁血护体，毒气近不了身。" });
    } else {
      p.hp -= p.poison;
      events.push({ kind: "poison", side: "player", text: `毒发！你损失 ${p.poison} 点气血。` });
      p.poison -= 1;
      s.player.poison = p.poison;
      if (p.hp <= 0) {
        p.hp = 0;
        events.push({ kind: "death", side: "player", text: "毒气攻心，你眼前一黑……" });
        endBattle(b, s, false);
        return events;
      }
    }
  }
  const def = enemyDef(b.enemyId);
  // boss 阶段化：>66% 常规 / 33-66% 攻击 +15% / <33% 狂暴（atk +30%、def -20%）
  if (def.ai === "boss") {
    const ratio = e.hp / Math.max(1, e.maxHp);
    const newPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (newPhase > b.phase) {
      b.phase = newPhase;
      if (newPhase === 2) {
        addBuff(e, { stat: "atk", value: Math.round(e.atk * 0.15), turns: 999 });
        events.push({ kind: "phase", side: "enemy", text: `${e.name}目光一凛，攻势陡然凌厉起来！` });
      } else {
        addBuff(e, { stat: "atk", value: Math.round(e.atk * 0.3), turns: 999 });
        addBuff(e, { stat: "def", value: -Math.round(e.def * 0.2), turns: 999 });
        events.push({ kind: "phase", side: "enemy", text: `${e.name}狂笑一声，招势陡然暴烈！` });
      }
    }
  }
  const action = enemyDecide(b, def);
  if (action.kind === "flee") {
    // 敌方落荒而逃：按玩家胜利结算，奖励减半
    b.rewardHalf = true;
    events.push({ kind: "flee", side: "enemy", text: `${e.name}见势不妙，落荒而逃！` });
    endBattle(b, s, true);
    return events;
  }
  if (action.kind === "stance") {
    e.defending = true;
    events.push({ kind: "stance", side: "enemy", text: `${e.name}凝神蓄势，摆开守势。` });
    tickBuffs(p);
    tickBuffs(e);
    return events;
  }
  const skill = action.kind === "skill" ? action.skill : undefined;
  if (skill) {
    e.mp = Math.max(0, e.mp - (skill.mpCost || 0));
    events.push({ kind: "move", side: "enemy", text: skill.text, ultName: skill.name });
    if (skill.heal) {
      const amt = Math.max(1, Math.floor(e.maxHp * skill.heal));
      e.hp = Math.min(e.maxHp, e.hp + amt);
      events.push({ kind: "heal", side: "enemy", text: `${e.name}伤势稍缓，恢复 ${amt} 点气血。` });
      tickBuffs(p);
      tickBuffs(e);
      return events;
    }
    if (skill.buff) {
      addBuff(e, skill.buff);
      events.push({ kind: "buff", side: "enemy", text: `${e.name}的${statName(skill.buff.stat)}提升了！` });
      tickBuffs(p);
      tickBuffs(e);
      return events;
    }
  }
  let dmg: number;
  const heavy = skill?.heavy;
  const eAtk = effectiveStat(e, "atk", e.atk);
  if (skill) {
    dmg = damageCalc(eAtk, effectiveStat(p, "def", p.def), {
      mult: skill.mult,
      heavy
    });
    if (skill.poison && Math.random() < 0.7) {
      p.poison = skill.poison;
      s.player.poison = skill.poison;
      events.push({ kind: "poison", side: "player", text: "你中毒了！" });
    }
    if (skill.debuff && Math.random() < 0.6) {
      addBuff(p, skill.debuff);
      events.push({ kind: "debuff", side: "player", text: `${statName(skill.debuff.stat)}降低了！` });
    }
  } else {
    dmg = damageCalc(eAtk, effectiveStat(p, "def", p.def), {});
  }
  if (p.defending) {
    // 防御减伤随基本招架成长：0.58 − 招架等级 × 0.002，下限 0.30
    const zhaoJia = s.player.skills.jibenZhaoJia || 0;
    dmg = Math.floor(dmg * Math.max(0.3, 0.58 - zhaoJia * 0.002));
    p.defending = false;
  }
  const dodgeRoll = Math.random();
  const pDodge = Math.min(0.6, effectiveStat(p, "dodge", p.dodge));
  if (dodgeRoll < pDodge + 0.08) {
    // 攻击被闪避，敌方露出破绽
    b.opening.enemy = true;
    events.push({ kind: "dodge", side: "player", text: `你闪身避开了${e.name}的攻击。` });
  } else {
    const parryRoll = Math.random();
    // 招架基础概率 6% 起、上限 30%；招架 buff 为概率加成
    const parryChance = Math.min(0.3, 0.06 + (s.player.skills.jibenZhaoJia || 0) * 0.0012 + effectiveStat(p, "parry", 0));
    if (parryRoll < parryChance) {
      dmg = Math.floor(dmg * 0.5);
      // 攻击被招架，敌方露出破绽
      b.opening.enemy = true;
      events.push({ kind: "parry", side: "player", text: `你举臂格挡，化解了大部分伤害。` });
    }
    const crit = Math.random() < e.crit;
    dmg = Math.round(dmg * (crit ? 1.6 : 1));
    if (b.opening.player) {
      dmg = Math.round(dmg * 1.5);
      b.opening.player = false;
      events.push({ kind: "opening", side: "player", text: "你门户大开，破绽毕露！" });
    }
    if (s.player.cheatLock) {
      dmg = 0;
      events.push({ kind: "info", side: "player", text: "锁血护体，这一击对你毫无作用！" });
    }
    if (!s.player.cheatLock) dmg = capDamage(dmg, p.maxHp);
    p.hp -= dmg;
    events.push({
      kind: crit ? "crit" : "hit",
      side: "enemy",
      text: `${e.name}${skill ? "的攻势" : "的攻击"}命中，你受到 ${dmg} 点伤害${crit ? "（会心一击！）" : ""}。`,
      dmg
    });
    if (heavy) {
      const effLoss = Math.max(1, Math.floor(dmg * 0.4));
      s.player.effHp = Math.max(1, s.player.effHp - effLoss);
      events.push({ kind: "info", side: "player", text: `这一击伤及经脉，你的伤势加重了 ${effLoss} 点。` });
    }
    if (p.hp <= 0) {
      p.hp = 0;
      events.push({ kind: "death", side: "player", text: "你倒下了……" });
      endBattle(b, s, false);
      return events;
    }
  }
  tickBuffs(p);
  tickBuffs(e);
  return events;
}

function mainSkill(s: GameState): { id: string; name: string; level: number } {
  const w = weaponOf(s.player);
  let bestId = "jibenQuan";
  if (w.kind === "sword") bestId = "jibenJian";
  else if (w.kind === "blade") bestId = "jibenDao";
  else if (w.kind === "staff") bestId = "jibenZhang";
  else if (w.kind === "whip") bestId = "jibenBian";
  let best = { id: bestId, name: skillDef(bestId).name, level: s.player.skills[bestId] || 0 };
  for (const [id, lv] of Object.entries(s.player.skills)) {
    const d = SKILLS[id];
    if (!d || d.base || d.hidden || d.weapon !== w.kind || lv <= best.level) continue;
    best = { id, name: d.name, level: lv };
  }
  return best;
}

function statName(k: string): string {
  const map: Record<string, string> = { atk: "攻击", def: "防御", spd: "身法", dodge: "闪避", parry: "招架" };
  return map[k] || k;
}

// 展示用：由绝招 id 反查所属武功类型（fist/sword/blade/staff/whip/neigong…），供 BattleScene 决定绝招特效形态
function ultOwnerType(ultId: string): string {
  for (const def of Object.values(SKILLS)) {
    if (def.ult?.some((u) => u.id === ultId)) return def.weapon || def.type;
  }
  return "other";
}

function endBattle(b: BattleState, s: GameState, victory: boolean): void {
  b.over = true;
  b.victory = victory;
  syncBack(b, s, victory);
  if (victory) {
    const msgs = getRewards(s, enemyDef(b.enemyId), b.rewardHalf ? 0.5 : 1);
    if (b.rewardHalf && msgs.length) msgs[0] += "（敌人落荒而逃，所得减半）";
    for (const m of msgs) b.log.push({ kind: "info", side: "player", text: m });
    b.rewardLines.push(...msgs);
    const lootNpcId = b.sourceNpc || (b.enemyId.startsWith("spar-") ? b.enemyId.slice(5) : null);
    if (lootNpcId) {
      const owner = NPCS[lootNpcId]?.name || "对方";
      const drops = applyNpcDrops(s, lootNpcId, owner);
      for (const m of drops) {
        b.log.push({ kind: "info", side: "player", text: m });
        b.rewardLines.push(m);
      }
    }
    const src = b.sourceNpc;
    if (src && isPlateMaster(src) && !s.player.flags[`plate-${src}`]) {
      const masterEnemy = ENEMIES[src];
      if (masterEnemy) {
        s.player.items.sanJiaoBan = (s.player.items.sanJiaoBan || 0) + 1;
        const line = `你从${masterEnemy.title}身上取走了三角石板（${countPlates(s)}/6）。`;
        b.log.push({ kind: "info", side: "player", text: line });
        b.rewardLines.push(line);
      }
      s.player.flags[`plate-${src}`] = true;
    }
    if (src === "qiaoSiHai") {
      s.player.flags["qiaoSiHaiDefeated"] = true;
      b.log.push({ kind: "info", side: "player", text: "乔四海哈哈一笑：好功夫！" });
    }
    if (b.enemyId === "qingLongTanZhu" && !s.player.flags["coldIronDead"]) {
      s.player.flags["coldIronDead"] = true;
      s.player.items.mixin = (s.player.items.mixin || 0) + 1;
      const line = "你在冷铁衣怀中搜出一封密信！";
      b.log.push({ kind: "info", side: "player", text: line });
      b.rewardLines.push(line);
      const qm = s.player.quests.qMain;
      if (qm && qm.stage === 5) qm.stage = 6;
    }
    if (b.enemyId === "zhouSan") {
      s.player.flags["zhouSanDead"] = true;
    }
    if (b.enemyId === "zhaiTou") {
      s.player.flags["zhaiTouDead"] = true;
    }
    if (b.enemyId === "eGui") {
      s.player.flags["eGuiDead"] = true;
    }
    if (b.enemyId === "yunZhongHe") {
      s.player.flags["yunZhongHeDead"] = true;
      const qy = s.player.quests.qYunZhongHe;
      if (qy && !qy.done && qy.stage === 0) qy.stage = 1;
    }
    if (b.enemyId === "jiading") {
      s.player.flags["jiadingDead"] = true;
    }
    if (b.enemyId === "woShiShui" || b.enemyId === "daoDeHeShang" || b.enemyId === "dongFangQiuBai") {
      s.player.ending = b.enemyId;
    }
  }
}

function countPlates(s: GameState): number {
  return s.player.items.sanJiaoBan || 0;
}

function syncBack(b: BattleState, s: GameState, victory: boolean): void {
  const p = s.player;
  p.hp = Math.max(1, b.player.hp);
  p.mp = b.player.mp;
  p.poison = b.player.poison;
  // 切磋与掌门挑战（sourceNpc）死亡无惩罚，不减有效气血
  if (!victory && b.player.hp <= 0 && !ENEMIES[b.enemyId]?.spar && !b.sourceNpc) {
    p.effHp = Math.max(1, Math.floor(p.effHp * 0.5));
  }
}

// 三角石板由 PLATE_SECTS 六派掌门各执一块；依门派数据判断 NPC 是否为持板掌门
function isPlateMaster(npcId: string): boolean {
  const npc = NPCS[npcId];
  if (!npc?.master) return false;
  return PLATE_SECTS.some((sectId) => SECTS[sectId].master.includes(npc.name));
}

export function setJiali(b: BattleState, v: number): void {
  b.jiali = clamp(Math.round(v), 0, 10);
}
