"use client";

import { useEffect, useRef, useState } from "react";
import type { SceneActorState } from "../game-core/scene-event";
import type { OriginalBattle } from "../game-core/original-battle";
import { originalTables } from "../game-core/original-data";
import {
  bagEntries,
  derivedStats,
  equipmentCategory,
  fullHp,
  maxFood,
  maxWater,
  type BagEntry,
} from "../game-core/inventory-system";
import {
  battleCombatSkills,
  battleSkillWeaponText,
  learnedSkills,
} from "../game-core/skill-system";
import { battleSpecials } from "../game-core/special-system";
import {
  customSwordBonus,
  furnitureNames,
  swordTypes,
} from "../game-core/life-system";
import {
  addCheatInventory,
  cheatQuickOptions,
  cheatSchools,
  cheatStats,
  cheatStatMaximum,
  cheatTeachers,
  removeCheatSkill,
  reviveCheatNpc,
  setCheatIdentity,
  setCheatInventory,
  setCheatSkill,
  setCheatStat,
  type CheatInventoryKind,
  type CheatQuickAction,
} from "../game-core/cheat-system";
import {
  actorStatusProfile,
  levelTier,
  levelTitle,
} from "../game-core/status-system";
import {
  parseBattleNarrativeSections,
  type BattleNarrative,
} from "../game-core/battle-narration";
import { freshTaskState, type TaskState } from "../game-core/task-system";
import type { WorldSave } from "../game-core/save-system";
import {
  kungfuSchoolId,
  kungfuSchoolName,
} from "../game-core/kungfu-school";
import { CharacterPortrait } from "./world-renderer";

export const organizedBagEntries = (actor: SceneActorState) =>
  bagEntries(actor).sort(
    (a, b) =>
      a.category.localeCompare(b.category, "zh-CN") ||
      Number(b.equipped) - Number(a.equipped) ||
      a.id - b.id,
  );
export const organizedSkills = (actor: SceneActorState) =>
  learnedSkills(actor).sort((a, b) => a.type - b.type || a.id - b.id);
export const allCheatSkills = originalTables.kungfus
  .flatMap((skill, id) =>
    skill
      ? [{ id, name: String(skill.name || id), type: Number(skill.type || 0) }]
      : [],
  )
  .sort(
    (a, b) => kungfuSchoolId(a.id) - kungfuSchoolId(b.id) || a.id - b.id,
  );
// 秘技「物品装备」的完整目录：防具按原作互斥装备槽分组，
// 行内标记装备状态，不再复制一份“已装备”分组。
const cheatCatalogGroups = (
  kind: CheatInventoryKind,
  equippedIds: number[],
) => {
  const table =
      kind === 1
        ? originalTables.items
        : kind === 2
          ? originalTables.weapons
          : originalTables.armors,
    equipped = new Set(equippedIds),
    groups = new Map<
      string,
      Array<{
        id: number;
        name: string;
        bonus: string;
        description: string;
        equipped: boolean;
      }>
    >();
  table.forEach((record, id) => {
    if (!record) return;
    const name = String(record.name || id),
      description = String(record.description || "");
    let group: string, bonus: string;
    if (kind === 1) {
      const effects: string[] = [];
      for (const [key, label] of [
        ["add_food", "食物"],
        ["add_water", "饮水"],
        ["add_hp", "气血"],
        ["add_mhp", "伤限"],
        ["add_fp", "内力"],
        ["add_mfp", "内力上限"],
        ["add_mp", "法力"],
        ["add_mmp", "法力上限"],
      ] as const) {
        const value = (record[key] as [number, number] | undefined)?.[1];
        if (value) effects.push(`${label}+${value}`);
      }
      group = record.is_book
        ? "秘籍"
        : record.type === 0
          ? "食物"
          : record.type === 1
            ? "丹药"
            : "杂物";
      if (record.is_book) {
        const teaches = ((record.skill_list as number[][]) || []).map(
          ([sid, lv]) => `${originalTables.kungfus[sid]?.name || sid}${lv}`,
        );
        bonus = teaches.length ? `研读：${teaches.join("、")}` : "无效果";
      } else bonus = effects.length ? effects.join(" · ") : "无效果";
    } else {
      const stats: string[] = [];
      for (const [key, label] of [
        ["add_atk", "攻击"],
        ["add_def", "防御"],
        ["add_hit", "命中"],
        ["add_eva", "闪避"],
        ["add_str", "膂力"],
        ["add_agi", "敏捷"],
        ["add_int", "悟性"],
        ["add_bon", "根骨"],
      ] as const) {
        const value = Number(record[key] || 0);
        if (value) stats.push(`${label}${value > 0 ? "+" : ""}${value}`);
      }
      bonus = stats.length ? stats.join(" · ") : "无常驻属性";
      group =
        equipmentCategory(kind, record);
    }
    const list = groups.get(group) || [];
    list.push({ id, name, bonus, description, equipped: equipped.has(id) });
    groups.set(group, list);
  });
  return [...groups.entries()].map(([name, items]) => ({
    name,
    items,
  }));
};
export type ArcadeState =
  | { kind: "select"; index: number }
  | { kind: "dance"; dir: number; count: number; score: number }
  | {
      kind: "ball";
      step: 1 | 2 | 3;
      x: number;
      dir: 1 | 2;
      score: number;
      fail: number;
      flight: number;
    };
export type LifeState = { kind: "forge" | "home"; index: number };
export function useDialogFocus<T extends HTMLElement>(trapTabs = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusable = () => Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable()[0] || root;
    const frame = requestAnimationFrame(() => first.focus());
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        root.focus();
        return;
      }
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? (current <= 0 ? items.length - 1 : current - 1)
        : (current + 1) % items.length;
      event.preventDefault();
      items[next].focus();
    };
    if (trapTabs) root.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      if (trapTabs) root.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [trapTabs]);
  return ref;
}
export function StatusBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <label>
      <span>
        {label}{" "}
        <em>
          {value.toLocaleString("zh-CN")}/{max.toLocaleString("zh-CN")}
        </em>
      </span>
      <i>
        <b style={{ width: `${percent}%` }} />
      </i>
    </label>
  );
}
export function Arcade({
  game,
  actor,
}: {
  game: ArcadeState;
  actor: SceneActorState;
}) {
  const dialogRef = useDialogFocus<HTMLElement>();
  if (game.kind === "select")
    return (
      <section ref={dialogRef} tabIndex={-1} className="arcade-panel" role="dialog" aria-modal="true" aria-label="平安镇游戏厅">
        <h2>平安镇游戏厅</h2>
        {["跳舞毯", "投铅球", "离开"].map((name, index) => (
          <b className={game.index === index ? "active" : ""} key={name}>
            {name}
          </b>
        ))}
        <small>W/S 选择 · E/Enter 确认 · X/Esc 返回</small>
      </section>
    );
  if (game.kind === "dance") {
    const arrows = ["", "↑", "←", "↓", "→"];
    return (
      <section ref={dialogRef} tabIndex={-1} className="arcade-panel dance-panel" role="dialog" aria-modal="true" aria-label="跳舞毯">
        <h2>跳舞毯</h2>
        <div className="arcade-score">
          SCORE {String(game.score).padStart(5, "0")} · TOP{" "}
          {String(actor.dance || 100).padStart(5, "0")}
        </div>
        <strong>{arrows[game.dir]}</strong>
        <div className="dance-pad">
          ↑<i>← →</i>↓
        </div>
        <small>按对应方向或 WASD；踏错即结束 · X/Esc 离开</small>
      </section>
    );
  }
  const shotX = game.step === 3 ? 155 + Math.min(224, game.flight * 2) : 155,
    shotY =
      game.step === 3
        ? 105 + Math.floor((379 - shotX) ** 2 * 0.004162330905)
        : 290;
  return (
    <section ref={dialogRef} tabIndex={-1} className="arcade-panel ball-panel" role="dialog" aria-modal="true" aria-label="投铅球">
      <h2>投铅球</h2>
      <div className="arcade-score">
        SCORE {String(game.score).padStart(5, "0")} · TOP{" "}
        {String(actor.ball || 100).padStart(5, "0")} · MISS {game.fail}/7
      </div>
      <div className="aim-track">
        <i style={{ left: game.x - 52 }} />
      </div>
      <div className="hoop">
        ┐<span style={{ left: shotX - 90, top: shotY - 80 }}>●</span>
      </div>
      <small>
        E/Enter 开始游标，再按一次投球 · 命中区 110–128 · X/Esc 离开
      </small>
    </section>
  );
}

export function LifeMenu({
  menu,
  actor,
}: {
  menu: LifeState;
  actor: SceneActorState;
}) {
  const dialogRef = useDialogFocus<HTMLElement>();
  const items =
    menu.kind === "forge"
      ? [
          ...swordTypes.map((name, type) => {
            const sword = actor.swords?.[type];
            return sword?.forged
              ? `重铸「${sword.name || `${name}器`}」`
              : `铸造${name}`;
          }),
          "离开",
        ]
      : [
          `翻修房屋（当前 ${actor.roomLevel || 0}/3）`,
          ...furnitureNames.map(
            (name, index) =>
              `${name} / 已有 ${actor.jiajuList?.[index] || 0}`,
          ),
          "销毁全部家具",
          "离开",
        ];
  return (
    <section ref={dialogRef} tabIndex={-1} className="arcade-panel life-panel" role="dialog" aria-modal="true" aria-label={menu.kind === "forge" ? "铸剑谷" : "桃花源管家"}>
      <h2>{menu.kind === "forge" ? "铸剑谷" : "桃花源管家"}</h2>
      {items.map((item, index) => (
        <b className={menu.index === index ? "active" : ""} key={item}>
          {item}
        </b>
      ))}
      <small>
        {menu.kind === "forge"
          ? `经验 ${actor.exp} · 银两 ${actor.gold} · 武器名可在 JSON 中修改`
          : `银两 ${actor.gold} · 家具每件 60000`}
      </small>
      {menu.kind === "forge" && (
        <p className="life-hint">
          {menu.index < 4
            ? (() => {
                const sword = actor.swords?.[menu.index];
                return sword?.forged
                  ? `当前「${sword.name || "无名兵器"}」：${customSwordBonus(sword)}。重铸品质受福缘 ${actor.luck} 影响。`
                  : `铸造${swordTypes[menu.index]}：中缀(闪避/命中)与后缀(四维)品质受福缘 ${actor.luck} 影响，福缘越高越容易出好词缀。`;
              })()
            : "选择要铸造或重铸的兵器类型，按 E/Enter 确认。"}
        </p>
      )}
    </section>
  );
}

export function Choice({
  title,
  items,
  index,
  choose,
  progress,
  message,
  wide = false,
  columns,
  hint,
}: {
  title: string;
  items: string[];
  index: number;
  choose: (index: number) => void;
  progress?: { label: string; value: number; max: number; detail: string };
  message?: string;
  wide?: boolean;
  columns?: number;
  hint?: string;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>();
  const density = columns
    ? " choice-grid"
    : items.length > 18
      ? " three-column dense"
      : items.length > 8
        ? " two-column"
        : "";
  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`world-choice large${wide ? " wide" : ""}${density}`}>
      <b>{title}</b>
      <div
        className="choice-items"
        style={
          columns
            ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {items.map((item, i) => (
          <button
            className={i === index ? "active" : ""}
            onClick={() => choose(i)}
            key={`${item}-${i}`}
          >
            <span>{item}</span>
            {i === index && <i>◆</i>}
          </button>
        ))}
      </div>
      {progress && (
        <div className="training-progress">
          <span>
            <b>{progress.label}</b>
            <em>
              {progress.value.toLocaleString("zh-CN")} /{" "}
              {progress.max.toLocaleString("zh-CN")}
            </em>
          </span>
          <i>
            <b
              style={{
                width: `${Math.max(0, Math.min(100, (progress.value / Math.max(1, progress.max)) * 100))}%`,
              }}
            />
          </i>
          <small>{progress.detail}</small>
        </div>
      )}
      {message && <p className="training-message">{message}</p>}
      <small>{hint || "W/S 选择 · E/Enter 确认 · X/Esc 返回"}</small>
    </div>
  );
}
export function BattleView({
  battle,
  narratives,
  actor,
  hp,
  maxHp,
  fight,
  leave,
  openSpecial,
  openItem,
  openSkill,
  flee,
}: {
  battle: OriginalBattle;
  narratives: BattleNarrative[];
  actor: SceneActorState;
  hp: number;
  maxHp: number;
  fight: () => void;
  leave: () => void;
  openSpecial: () => void;
  openItem: () => void;
  openSkill: () => void;
  flee: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>();
  const logRef = useRef<HTMLDivElement>(null);
  const latestNarrative = narratives.at(-1);
  const effect = latestNarrative?.effect || "fist";
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTo({
      top: log.scrollHeight,
      behavior: latestNarrative?.loading ? "auto" : "smooth",
    });
  }, [battle.log.length, latestNarrative?.loading, latestNarrative?.text.length]);
  return (
    <div ref={dialogRef} tabIndex={-1} className="battle" role="dialog" aria-modal="true" aria-label={`与${battle.enemyName}战斗`}>
      <div className={`battle-stage effect-${effect}`} key={`${latestNarrative?.turn || 0}-${effect}`}>
        <div className="battle-arena" aria-hidden="true"><i /><i /><i /></div>
        <div className="fighter hero">
          <CharacterPortrait
            playerGender={actor.gender}
            name={actor.name || "少侠"}
            className="battle-portrait"
          />
          <span>{actor.name || "少侠"}</span>
        </div>
        <b>
          {battle.mode === "spar" ? "切磋" : "生死战"} · 第 {battle.turn + 1}{" "}
          回合
          {battle.enemyId === 149 && !actor.swordBattle && (
            <>
              {" "}
              · 铸剑挑战 第{" "}
              {Math.min(actor.forgeChallengeStep || 0, 3) + 1}/4 轮 · 用{" "}
              {["钢刀", "长剑", "钢杖", "长鞭"][
                Math.min(actor.forgeChallengeStep || 0, 3)
              ]}
            </>
          )}
        </b>
        <div className="battle-fx" aria-hidden="true">
          <i className="fx-trail one" /><i className="fx-trail two" />
          <i className="fx-impact" /><i className="fx-ring" />
          <i className="fx-particle p1" /><i className="fx-particle p2" /><i className="fx-particle p3" />
        </div>
        <div className="fighter enemy">
          <CharacterPortrait
            npcId={battle.enemyId}
            name={battle.enemyName}
            className="battle-portrait"
          />
          <span>{battle.enemyName}</span>
        </div>
      </div>
      <div className="battle-bars">
        <label>
          你 <meter min="0" max={maxHp} value={hp} />
          <em>
            {hp}/{maxHp}
          </em>
        </label>
        <label>
          {battle.enemyName}{" "}
          <meter min="0" max={battle.enemyMaxHp} value={battle.enemyHp} />
          <em>
            {battle.enemyHp}/{battle.enemyMaxHp}
          </em>
        </label>
      </div>
      <div
        className="battle-log"
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <header><span>战况实录</span><i>LIVE</i></header>
        {!narratives.length && <p className="battle-opening"><span>{battle.log[0]}</span></p>}
        {narratives.map((item, index) => (
          <article className={index === narratives.length - 1 ? "latest" : ""} key={`${item.turn}-${index}`}>
            <header><time>第 {item.turn} 回合</time><small>{item.facts.join(" · ")}</small></header>
            <div className="battle-narrative-copy">
              {parseBattleNarrativeSections(item.text).map((section, sectionIndex) => (
                <p className={`narrative-${section.speaker}`} key={`${section.speaker}-${sectionIndex}`}>
                  <strong>{section.label === "你出招" ? `${actor.name || "主角"}出招` : section.label === "你应招" ? `${actor.name || "主角"}应招` : section.label === "对手出招" ? `${battle.enemyName}出招` : section.label === "对手应招" ? `${battle.enemyName}应招` : section.speaker === "player" ? `${actor.name || "主角"}出招` : section.speaker === "enemy" ? `${battle.enemyName}应战` : "交锋结果"}</strong>
                  <span>{section.text}</span>
                </p>
              ))}
              {!item.text && <p className="narrative-loading">风声骤紧，正在演绎这一回合……</p>}
            </div>
            {item.error && <em>小说战报生成中断，已保留真实结算：{item.error}</em>}
          </article>
        ))}
        <div className="battle-log-anchor" aria-hidden="true" />
      </div>
      <nav>
        <button onClick={battle.finished ? leave : fight}>
          {battle.finished ? "处理战果" : "普通攻击"} <kbd>E</kbd>
        </button>
        <button onClick={openSpecial} disabled={Boolean(battle.finished)}>
          绝招 <kbd>Q</kbd>
        </button>
        <button onClick={openItem} disabled={Boolean(battle.finished)}>
          行囊 <kbd>I</kbd>
        </button>
        <button onClick={openSkill} disabled={Boolean(battle.finished)}>
          武学 <kbd>M</kbd>
        </button>
        <button
          onClick={battle.mode === "spar" ? leave : flee}
          disabled={Boolean(battle.finished)}
        >
          {battle.mode === "spar" ? "退出" : "逃跑"}{" "}
          <kbd>{battle.mode === "spar" ? "X" : "G"}</kbd>
        </button>
      </nav>
    </div>
  );
}
export function SpecialPicker({
  actor,
  battle,
  index,
  choose,
}: {
  actor: SceneActorState;
  battle: OriginalBattle;
  index: number;
  choose: (id?: number) => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(),
    listRef = useRef<HTMLDivElement>(null);
  const list = battleSpecials(actor, battle.cooldowns);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  return (
    <div ref={dialogRef} tabIndex={-1} className="special-picker" role="dialog" aria-modal="true" aria-label="选择绝招">
      <header className="special-picker-title">
        <b>选择绝招</b>
        <small>{list.length} 项已学绝招</small>
      </header>
      {list.length ? (
        <div className="special-picker-list" ref={listRef} role="listbox" aria-label="已学绝招">
          {list.map((special, i) => (
            <button
              className={index === i ? "active" : ""}
              data-active={index === i}
              role="option"
              aria-selected={index === i}
              disabled={!special.enabled}
              onClick={() => choose(special.id)}
              key={special.id}
            >
              <span>
                {special.name}
                <small>{special.description}</small>
              </span>
              <em>
                {special.enabled
                  ? `内力 ${special.fpCost}${special.mpCost ? ` · 法力 ${special.mpCost}` : ""}`
                  : special.reason}
              </em>
            </button>
          ))}
        </div>
      ) : (
        <p className="special-picker-empty">尚未学会带绝招的武学。</p>
      )}
      <footer>W/S 选择 · E/Enter 施展 · X/Esc 返回</footer>
    </div>
  );
}
export function BattleSkillPicker({
  actor,
  index,
  choose,
  chooseParry,
}: {
  actor: SceneActorState;
  index: number;
  choose: (id?: number) => void;
  chooseParry: (id?: number) => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(),
    listRef = useRef<HTMLDivElement>(null);
  const list = battleCombatSkills(actor);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  return (
    <div ref={dialogRef} tabIndex={-1} className="special-picker battle-skill-picker" role="dialog" aria-modal="true" aria-label="选择战斗武学">
      <header className="special-picker-title">
        <b>临阵调整武学</b>
        <small>{list.length} 门可用武学</small>
      </header>
      {list.length ? (
        <div className="special-picker-list battle-skill-list" ref={listRef} role="listbox" aria-label="可用战斗武学">
          {list.map((skill, i) => (
            <div
              className={index === i ? "battle-skill-row active" : "battle-skill-row"}
              data-active={index === i}
              role="option"
              aria-selected={index === i}
              key={skill.id}
            >
              <button onClick={() => choose(skill.id)}>
                <span>{skill.name}<small>{skill.category} · {skill.level} 级 · {battleSkillWeaponText(actor, skill.id)}</small></span>
                <em>{skill.equipped ? "当前攻击" : "设为攻击"}</em>
              </button>
              <button className={skill.parrying ? "parry active" : "parry"} onClick={() => chooseParry(skill.id)}>
                {skill.parrying ? "当前招架" : "设为招架"}
              </button>
            </div>
          ))}
        </div>
      ) : <p className="special-picker-empty">尚未学会可用于攻防的拳脚或兵刃武学。</p>}
      <footer>W/S 选择 · E/Enter 设为攻击 · R 设为招架 · M/X 返回</footer>
    </div>
  );
}
export function GameMenu({
  actor,
  tasks,
  menu,
  setMenu,
  activate,
  discard,
  activateKf,
  quickAction,
  changeStat,
  changeSkill,
  maxStat,
  maxSkill,
  mutate,
}: {
  actor: SceneActorState;
  tasks: TaskState;
  menu: { tab: number; index: number; sub: number };
  setMenu: (value: { tab: number; index: number; sub: number } | null) => void;
  activate: (entry?: BagEntry) => void;
  discard: (entry?: BagEntry) => void;
  activateKf: (id?: number, parry?: boolean) => void;
  quickAction: (action: CheatQuickAction) => void;
  changeStat: (index: number, direction: -1 | 1) => void;
  changeSkill: (index: number, direction: -1 | 1) => void;
  maxStat: (index: number) => void;
  maxSkill: (index: number) => void;
  mutate: (mutation: (draft: WorldSave) => string) => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(false);
  const tabs = ["行囊", "状态", "功夫", "秘技"],
    entries = organizedBagEntries(actor),
    stats = derivedStats(actor),
    profile = actorStatusProfile(actor);
  return (
    <div ref={dialogRef} tabIndex={-1} className="game-menu" role="dialog" aria-modal="true" aria-label="主菜单">
      <nav>
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`${menu.tab === i ? "active" : ""}${i === 3 ? " cheat-entry" : ""}`}
            onClick={() => setMenu({ tab: i, index: 0, sub: menu.sub })}
          >
            {tab}
          </button>
        ))}
      </nav>
      {menu.tab === 3 ? (
        <CheatInner
          actor={actor}
          tasks={tasks}
          sub={menu.sub}
          cursor={menu.index}
          setMenu={setMenu}
          quickAction={quickAction}
          changeStat={changeStat}
          changeSkill={changeSkill}
          maxStat={maxStat}
          maxSkill={maxSkill}
          mutate={mutate}
        />
      ) : menu.tab === 0 ? (
        <section className="bag-list">
          {entries.length ? (
            entries.map((entry, i) => (
              <div className="inventory-fragment" key={entry.key}>
                {(i === 0 || entries[i - 1].category !== entry.category) && (
                  <header className="equipment-category">
                    <span>{entry.category}</span>
                    <small>
                      {entry.kind === 3 ? "同槽择一 · " : ""}
                      {entries.filter((item) => item.category === entry.category).length} 件
                    </small>
                  </header>
                )}
              <div
                className={`bag-row${menu.index === i ? " active" : ""}${entry.equipped ? " equipped" : ""}`}
                onMouseEnter={() => setMenu({ tab: 0, index: i, sub: 0 })}
              >
                <button
                  className="bag-main"
                  onClick={() => activate(entry)}
                >
                  <i className={`item-pixel kind-${entry.kind}`} />
                  <span>
                    <small className="item-slot">{entry.slot}</small>
                    <b>
                      {entry.name}
                      {entry.equipped ? "〔装备中〕" : ""}
                    </b>
                    <small className="item-desc">{entry.description}</small>
                    <em className="item-bonuses">{entry.bonuses}</em>
                  </span>
                  <em>×{entry.amount}</em>
                </button>
                <button
                  className="bag-drop"
                  onClick={() => discard(entry)}
                  title="丢掉"
                >
                  丢掉
                </button>
              </div>
              </div>
            ))
          ) : (
            <p>行囊空空如也。</p>
          )}
        </section>
      ) : menu.tab === 1 ? (
        <section className="actor-status-panel">
          <header>
            <CharacterPortrait
              playerGender={actor.gender}
              name={actor.name || "江湖少侠"}
              className="status-portrait"
            />
            <div className="status-identity">
              <b>{profile.school} · {actor.name || "江湖少侠"}</b>
              <small>{actor.age} 岁 · {profile.gender} · 师承 {profile.teacher}</small>
              <strong>武艺看起来「{profile.realm}」，出手似乎「{profile.attackWeight}」</strong>
              <em>{profile.appearance}</em>
            </div>
            <div className="ladder-summary">
              <span>
                综合武境 <b>{profile.realmTier}/50 阶</b>
              </span>
              <span>
                出手劲道 <b>{profile.attackTier}/6 阶</b>
              </span>
              <span>
                容貌评价 <b>{profile.appearanceTier}/8 阶</b>
              </span>
            </div>
          </header>
          <div className="status-cards">
          <fieldset>
            <legend>精气状态</legend>
            <span>
              气血{" "}
              <b>
                {actor.hp}/{actor.maxHp}
              </b>
            </span>
            <span>
              伤势上限{" "}
              <b>
                {actor.maxHp}/{fullHp(actor)}
              </b>
            </span>
            <span>
              内力{" "}
              <b>
                {actor.fp}/{actor.maxFp}（加力 {actor.fpPlus}）
              </b>
            </span>
            <span>
              法力{" "}
              <b>
                {actor.mp}/{actor.maxMp}（法点 {actor.mpPlus}）
              </b>
            </span>
            <span>
              饱食{" "}
              <b>
                {actor.food}/{maxFood(actor)}
              </b>
            </span>
            <span>
              饮水{" "}
              <b>
                {actor.water}/{maxWater(actor)}
              </b>
            </span>
          </fieldset>
          <fieldset>
            <legend>先天与实战属性</legend>
            <span>
              膂力{" "}
              <b>
                {stats.str}/{actor.baseStr}
              </b>
            </span>
            <span>
              敏捷{" "}
              <b>
                {stats.agi}/{actor.baseAgi}
              </b>
            </span>
            <span>
              悟性{" "}
              <b>
                {stats.int}/{actor.baseInt}
              </b>
            </span>
            <span>
              根骨{" "}
              <b>
                {stats.bon}/{actor.baseBon}
              </b>
            </span>
            <span>
              装备攻击 <b>{stats.atk}</b>
            </span>
            <span>
              装备防御 <b>{stats.pdef}</b>
            </span>
            <span>
              装备命中 <b>{stats.hit}</b>
            </span>
            <span>
              装备闪避 <b>{stats.eva}</b>
            </span>
          </fieldset>
          <fieldset>
            <legend>江湖履历</legend>
            <span>
              经验 <b>{actor.exp.toLocaleString("zh-CN")}</b>
            </span>
            <span>
              潜能 <b>{actor.potential.toLocaleString("zh-CN")}</b>
            </span>
            <span>
              银两 <b>{actor.gold.toLocaleString("zh-CN")}</b>
            </span>
            <span>
              名声/道德 <b>{actor.morals}</b>
            </span>
            <span className="status-explain">
              <span>
                福缘<small>请教速度、任务奖励、铸剑词缀与随机事件</small>
              </span>
              <b>{actor.luck}</b>
            </span>
            <span className="status-explain">
              <span>
                容貌<small>人物评价、部分拜师条件与结局判定</small>
              </span>
              <b>{actor.face}</b>
            </span>
            <span>
              击杀 NPC <b>{actor.killList?.length || 0}</b>
            </span>
            <span>
              追杀恶人 <b>{actor.badmanKill || 0}</b>
            </span>
            <span>
              杀手任务 <b>{actor.taskKill || 0}</b>
            </span>
            <span>
              坛位 <b>{actor.tanId}/8</b>
            </span>
          </fieldset>
          <fieldset>
            <legend>装备与战斗功夫</legend>
            <span>
              兵刃 <b>{profile.weapon}</b>
            </span>
            <span>
              防具 <b>{profile.armor}</b>
            </span>
            <span>
              攻击功夫 <b>{profile.combat.attack}</b>
            </span>
            <span>
              轻功 <b>{profile.combat.dodge}</b>
            </span>
            <span>
              招架 <b>{profile.combat.parry}</b>
            </span>
            <span>
              已学功夫 <b>{Object.keys(actor.skills).length}</b>
            </span>
            <span>
              综合武境进度 <b>{profile.realmValue}/245</b>
            </span>
          </fieldset>
          </div>
        </section>
      ) : (
        <SkillRows
          actor={actor}
          index={menu.index}
          setMenu={setMenu}
          activate={activateKf}
        />
      )}
      <footer>
        W/A/S/D 或方向键选择 · Tab/数字键切页 · E/Enter 装配 · C/R 设为招架 · X/Esc 关闭
      </footer>
    </div>
  );
}
export function CheatInner({
  actor,
  tasks,
  sub,
  cursor,
  setMenu,
  quickAction,
  changeStat,
  changeSkill,
  maxStat,
  maxSkill,
  mutate,
}: {
  actor: SceneActorState;
  tasks: TaskState;
  sub: number;
  cursor: number;
  setMenu: (value: { tab: number; index: number; sub: number } | null) => void;
  quickAction: (action: CheatQuickAction) => void;
  changeStat: (index: number, direction: -1 | 1) => void;
  changeSkill: (index: number, direction: -1 | 1) => void;
  maxStat: (index: number) => void;
  maxSkill: (index: number) => void;
  mutate: (mutation: (draft: WorldSave) => string) => void;
}) {
  const tabs = ["快捷", "人物数值", "物品装备", "全部武功", "身份师承", "世界进度"],
    [inventoryTab, setInventoryTab] = useState<
      "food" | "medicine" | "book" | "misc" | "weapon" | "armor" | "owned"
    >("food"),
    [amounts, setAmounts] = useState<Record<string, number>>({}),
    killed = (actor.killList || []).filter((id) => originalTables.enemies[id]);
  const commitNumber = (valueIndex: number, value: string) =>
    mutate((draft) => setCheatStat(draft.actor, valueIndex, Number(value)));
  return (
    <section className="cheat-inner">
      <nav className="cheat-subnav">
        {tabs.map((tab, tabIndex) => (
          <button
            key={tab}
            className={sub === tabIndex ? "active" : ""}
            onClick={() => setMenu({ tab: 3, sub: tabIndex, index: 0 })}
          >
            {tab}
          </button>
        ))}
      </nav>
      <div className="cheat-list">
        {sub === 0 &&
          cheatQuickOptions.map((option, optionIndex) => (
            <button
              key={option.id}
              className={`${cursor === optionIndex ? "active" : ""} ${option.dangerous ? "danger" : ""}`}
              onMouseEnter={() => setMenu({ tab: 3, sub: 0, index: optionIndex })}
              onClick={() => quickAction(option.id)}
            >
              <span>
                <b>{option.name}</b>
                <small>{option.detail}</small>
              </span>
              <em>{option.dangerous ? "需确认" : "施展"}</em>
            </button>
          ))}
        {sub === 1 &&
          cheatStats.map((stat, index) => (
            <div
              key={stat.key}
              className={cursor === index ? "active" : ""}
              onMouseEnter={() => setMenu({ tab: 3, sub: 1, index })}
            >
              <span>
                <b>{stat.name}</b>
                <small>
                  {stat.group} · 步进 {stat.step.toLocaleString("zh-CN")} · 可修改范围{" "}
                  {("min" in stat ? stat.min : 0).toLocaleString("zh-CN")}–
                  {cheatStatMaximum(actor, index).toLocaleString("zh-CN")}
                </small>
              </span>
              <input
                className="cheat-number"
                type="number"
                min={"min" in stat ? stat.min : 0}
                max={cheatStatMaximum(actor, index)}
                defaultValue={Number(actor[stat.key] || 0)}
                key={`${stat.key}:${Number(actor[stat.key] || 0)}`}
                onBlur={(event) => commitNumber(index, event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              />
              <div>
                <button onClick={() => changeStat(index, -1)}>−</button>
                <button onClick={() => changeStat(index, 1)}>＋</button>
                <button className="max" onClick={() => maxStat(index)}>
                  MAX
                </button>
              </div>
            </div>
          ))}
        {sub === 2 && (
          <div className="cheat-editor-stack cheat-inventory">
            <nav className="cheat-kind-buttons">
              {([
                ["food", "食物"],
                ["medicine", "丹药"],
                ["book", "秘籍"],
                ["misc", "杂物"],
                ["weapon", "武器"],
                ["armor", "防具/工具"],
                ["owned", "已有"],
              ] as const).map(([kind, label]) => (
                <button
                  key={kind}
                  className={inventoryTab === kind ? "active" : ""}
                  onClick={() => setInventoryTab(kind)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {inventoryTab === "owned" ? (
              <div className="cheat-owned-list">
                <p className="cheat-capacity">
                  当前持有 {Object.keys(actor.inventory).length} 种物品。移除已装备的武器或防具时会自动卸下。
                </p>
                {Object.entries(actor.inventory)
                  .filter(([, amount]) => amount > 0)
                  .map(([key, amount]) => {
                    const [kind, id] = key.split(":").map(Number),
                      table =
                        kind === 1
                          ? originalTables.items
                          : kind === 2
                            ? originalTables.weapons
                            : originalTables.armors;
                    return (
                      <div className="cheat-owned-row" key={key}>
                        <span>
                          <b>{table[id]?.name || key}</b>
                          <small>
                            {kind === 1 ? "物品" : kind === 2 ? "武器" : "防具"} · ID{" "}
                            {id}
                          </small>
                        </span>
                        <strong>× {amount}</strong>
                        <button
                          onClick={() =>
                            mutate((draft) =>
                              setCheatInventory(
                                draft.actor,
                                kind as CheatInventoryKind,
                                id,
                                0,
                              ),
                            )
                          }
                        >
                          移除
                        </button>
                      </div>
                    );
                  })}
                {!Object.values(actor.inventory).some((amount) => amount > 0) && (
                  <p className="cheat-empty">当前没有物品。</p>
                )}
              </div>
            ) : (
              <div className="cheat-catalog">
                {(() => {
                  const inventoryKind: CheatInventoryKind =
                      inventoryTab === "weapon" ? 2 : inventoryTab === "armor" ? 3 : 1,
                    itemGroup =
                      inventoryTab === "food"
                        ? "食物"
                        : inventoryTab === "medicine"
                          ? "丹药"
                          : inventoryTab === "book"
                            ? "秘籍"
                            : inventoryTab === "misc"
                              ? "杂物"
                              : null,
                    groups = cheatCatalogGroups(
                      inventoryKind,
                      inventoryKind === 2
                        ? actor.weaponId
                          ? [actor.weaponId]
                          : []
                        : inventoryKind === 3
                          ? actor.armorIds
                          : [],
                    ).filter((group) => !itemGroup || group.name === itemGroup);
                  return groups.map((group) => (
                  <div
                    className={`cheat-catalog-group${group.name === "已装备" ? " equipped-group" : ""}`}
                    key={group.name}
                  >
                    <header className="cheat-group-header">
                      <b>{group.name}</b>
                      <small>
                        {inventoryKind === 3 ? "同槽择一 · " : ""}
                        {group.items.length} 件
                      </small>
                    </header>
                    {group.items.map((entry) => {
                      const amountKey = `${inventoryKind}:${entry.id}`,
                        value = amounts[amountKey] ?? 1,
                        owned = actor.inventory[amountKey] || 0;
                      return (
                        <div
                          key={entry.id}
                          className={`cheat-catalog-row${entry.equipped ? " is-equipped" : ""}`}
                        >
                          <div className="cheat-catalog-info">
                            <span>
                              <b>
                                {entry.name}
                                <small>ID {entry.id}</small>
                                {entry.equipped && <i>已装备</i>}
                              </b>
                              <em>{entry.bonus}</em>
                            </span>
                            <small className="cheat-catalog-desc">
                              {entry.description}
                            </small>
                          </div>
                          <strong className="cheat-owned-count">已有 × {owned}</strong>
                          <div className="cheat-acquire-controls">
                            <label>
                              <span>数量</span>
                              <input
                                className="cheat-number cheat-amount"
                                aria-label={`${entry.name}获得数量`}
                                type="number"
                                min={1}
                                max={inventoryKind === 1 ? 255 : 1}
                                value={value}
                                onChange={(event) =>
                                  setAmounts({
                                    ...amounts,
                                    [amountKey]: Math.max(
                                      1,
                                      Math.min(
                                        inventoryKind === 1 ? 255 : 1,
                                        Number(event.target.value) || 1,
                                      ),
                                    ),
                                  })
                                }
                              />
                            </label>
                            <button
                              className="cheat-obtain"
                              onClick={() =>
                                mutate((draft) =>
                                  addCheatInventory(
                                    draft.actor,
                                    inventoryKind,
                                    entry.id,
                                    value,
                                  ),
                                )
                              }
                            >
                              获得
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}
        {sub === 3 &&
          (allCheatSkills.length ? (
            allCheatSkills.map((skill, index) => {
              const learned = actor.skills[String(skill.id)],
                schoolId = kungfuSchoolId(skill.id),
                showHeader =
                  index === 0 ||
                  kungfuSchoolId(allCheatSkills[index - 1].id) !== schoolId;
              return (
              <div className="cheat-skill-wrap" key={skill.id}>
                {showHeader && (
                  <div className="cheat-group-header">
                    <b>{kungfuSchoolName(skill.id)}</b>
                    <small>
                      {allCheatSkills.filter(
                        (item) => kungfuSchoolId(item.id) === schoolId,
                      ).length}{" "}
                      门
                    </small>
                  </div>
                )}
                <div
                  className={`cheat-skill-row ${cursor === index ? "active" : ""}`}
                  onMouseEnter={() => setMenu({ tab: 3, sub: 3, index })}
                >
                  <span>
                    <b>{skill.name}</b>
                    <small>{learned ? "已习得" : "未习得"} · 可修改范围 1–255 · 类型 {skill.type}</small>
                  </span>
                  <input className="cheat-number" type="number" min={1} max={255}
                    disabled={!learned} defaultValue={learned?.level || 1}
                    key={`${skill.id}:${learned?.level || 0}`}
                    onBlur={(event) => learned && mutate((draft) => setCheatSkill(draft.actor, skill.id, Number(event.target.value)))}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
                  <div>
                    {learned ? <>
                      <button onClick={() => changeSkill(index, -1)}>−</button>
                      <button onClick={() => changeSkill(index, 1)}>＋</button>
                      <button className="max" onClick={() => maxSkill(index)}>MAX</button>
                      <button className="remove" onClick={() => mutate((draft) => removeCheatSkill(draft.actor, skill.id))}>移除</button>
                    </> : <button className="add" onClick={() => mutate((draft) => setCheatSkill(draft.actor, skill.id, 1))}>习得</button>}
                  </div>
                </div>
              </div>
              );
            })
          ) : (
            <p>功夫数据库为空。</p>
          ))}
        {sub === 4 && (
          <div className="cheat-editor-stack identity-editor">
            <label>姓名（1–8 字符）
              <input defaultValue={actor.name || "江湖少侠"} maxLength={8} onBlur={(event) => mutate((draft) => {
                const name = event.target.value.trim().slice(0, 8);
                if (!name) return "姓名不能为空。";
                draft.actor.name = name; return `姓名修改为${name}。`;
              })} />
            </label>
            <label>性别
              <select value={actor.gender} onChange={(event) => mutate((draft) => { draft.actor.gender = Math.max(0, Math.min(2, Number(event.target.value))); return "性别已经修改。"; })}>
                <option value={0}>男</option><option value={1}>女</option><option value={2}>其他</option>
              </select>
            </label>
            <label>门派
              <select value={actor.classId} onChange={(event) => mutate((draft) => setCheatIdentity(draft.actor, Number(event.target.value), draft.actor.teacherId))}>
                {cheatSchools.map((school, id) => <option key={id} value={id}>{id} · {school}</option>)}
              </select>
            </label>
            <label>师父
              <select value={actor.teacherId} onChange={(event) => mutate((draft) => {
                return setCheatIdentity(draft.actor, draft.actor.classId, Number(event.target.value));
              })}>
                <option value={0}>0 · 无师父</option>
                {cheatTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.id} · {teacher.name}{teacher.schoolId ? `（${cheatSchools[teacher.schoolId]}）` : ""}</option>)}
              </select>
            </label>
            <p>修改器中的门派与师父可以独立任意组合；正常拜师仍遵守门派限制。</p>
          </div>
        )}
        {sub === 5 && (
          <div className="cheat-editor-stack world-editor">
            <section className="cheat-toggle-grid">
              {([
                ["haveNewHome", "拥有桃花源家园"], ["swordBattle", "通过铸剑挑战"], ["xue6", "特殊武学标记"],
              ] as const).map(([key, label]) => <label key={key}>
                <input type="checkbox" checked={Boolean(actor[key])} onChange={(event) => mutate((draft) => {
                  (draft.actor as unknown as Record<string, unknown>)[key] = event.target.checked;
                  return `${label}${event.target.checked ? "已开启" : "已关闭"}。`;
                })} /> {label}
              </label>)}
            </section>
            <h3>复活已杀死 NPC</h3>
            {killed.length ? killed.map((id) => <div className="cheat-owned-row" key={id}>
              <span><b>{originalTables.enemies[id]?.name || id}</b><small>NPC ID {id} · 复活后恢复地图人物与互动</small></span>
              <button onClick={() => mutate((draft) => reviveCheatNpc(draft.actor, id))}>复活</button>
            </div>) : <p>当前没有可复活的 NPC。</p>}
            <h3>任务时钟</h3>
            <label>世界时间（秒）· 0–4,294,967,295
              <input type="number" min={0} max={4294967295} defaultValue={tasks.clock}
                key={`clock:${tasks.clock}`} onBlur={(event) => mutate((draft) => {
                  draft.tasks.clock = Math.max(0, Math.min(4294967295, Math.floor(Number(event.target.value) || 0)));
                  return `世界时间调整为 ${draft.tasks.clock} 秒。`;
                })} />
            </label>
            <section className="cheat-toggle-grid">
              <label><input type="checkbox" checked={tasks.finishFlag} onChange={(event) => mutate((draft) => { draft.tasks.finishFlag = event.target.checked; return "主任务领奖标记已经修改。"; })} /> 主任务奖励待领取</label>
              <label><input type="checkbox" checked={tasks.stoneStarted} onChange={(event) => mutate((draft) => { draft.tasks.stoneStarted = event.target.checked; return "石料任务状态已经修改。"; })} /> 石料任务进行中</label>
            </section>
            <button className="danger-action" onClick={() => mutate((draft) => {
              const clock = draft.tasks.clock;
              draft.tasks = { ...freshTaskState(), clock };
              return "全部任务状态已重置，并保留当前世界时间。";
            })}>重置全部任务状态</button>
          </div>
        )}
      </div>
    </section>
  );
}
export function SkillRows({
  actor,
  index,
  setMenu,
  activate,
}: {
  actor: SceneActorState;
  index: number;
  setMenu: (value: { tab: number; index: number; sub: number }) => void;
  activate: (id?: number, parry?: boolean) => void;
}) {
  const skills = organizedSkills(actor);
  return (
    <section className="kungfu-list">
      {skills.length ? (
        skills.map((skill, i) => (
          <div className="kungfu-fragment" key={skill.id}>
            {(i === 0 || skills[i - 1].category !== skill.category) && (
              <header className="kungfu-category">
                <span>{skill.category}</span>
                <small>
                  {skills.filter((item) => item.category === skill.category).length} 门
                </small>
              </header>
            )}
          <button
            className={`${index === i ? "active" : ""}${skill.equipped ? " equipped" : ""}${skill.parrying ? " parrying" : ""}`}
            onMouseEnter={() => setMenu({ tab: 2, index: i, sub: 0 })}
            onClick={() => activate(skill.id)}
          >
            <b>
              <small>{skill.category}</small>
              <span>{skill.name}</span>
            </b>
            <span>{skill.level} 级</span>
            <em>
              {levelTitle(skill.level)} · 第 {levelTier(skill.level)}/50 阶 ·{" "}
              {skill.points} 点 · {skill.school}
            </em>
            <i className="skill-tags">
              {skill.equipped && <span className="tag-equipped">当前运用</span>}
              {skill.parrying && <span className="tag-parrying">用于招架</span>}
              {!skill.equipped && !skill.parrying && <span>已习得</span>}
            </i>
          </button>
          </div>
        ))
      ) : (
        <p>尚未学会任何功夫，可向江湖人物拜师请教。</p>
      )}
    </section>
  );
}
