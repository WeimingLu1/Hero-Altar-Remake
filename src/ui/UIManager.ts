import { AREAS, ROOMS } from "../game/content/areas";
import { ARMORS, ITEMS, WEAPONS } from "../game/content/items";
import { NPCS, npcDef } from "../game/content/npcs";
import { QUESTS, questDef } from "../game/content/quests";
import { ROMANCE } from "../game/content/romance";
import { SECTS } from "../game/content/sects";
import { SKILLS, skillDef } from "../game/content/skills";
import { enemyDef } from "../game/content/enemies";
import { PROLOGUE, isQuestNpc } from "../game/content/story";
import type { DialogNode } from "../game/content/types";
import type { BattleState } from "../game/sim/battle";
import { availableUts } from "../game/sim/battle";
import { canLearnSkill, knownAreas, questProgress } from "../game/sim/actions";
import {
  activeNeigongLevel,
  attackPower,
  defensePower,
  effectiveAttrs,
  expRequired,
  learnCost,
  maxHp,
  maxMp,
  potentialPerStrength,
  speedValue
} from "../game/sim/formulas";
import { hasSave, saveSlots } from "../game/sim/save";
import type { GameState, PlayerState } from "../game/sim/state";
import { getApp } from "../game/bus";

type ActionFn = (action: string) => void;

export class UIManager {
  root: HTMLElement;
  actions: ActionFn = () => {};
  private dialogNodes: DialogNode[] = [];
  private dialogIndex = 0;
  private combatLocked = false;
  dialogNpc: string | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = `
      <div id="game-root">
        <div id="ui" class="ui-layer">
          <div id="hud" class="hidden">
            <span class="hud-name"></span>
            <span class="bar hp"><i>气血</i><b><em></em></b><u></u></span>
            <span class="bar mp"><i>内力</i><b><em></em></b><u></u></span>
            <span class="bar exp"><i>潜能</i><b><em></em></b><u></u></span>
            <span class="hud-loc"></span>
            <div class="hud-right">
              <span class="hud-chip hud-day"></span>
              <span class="hud-chip hud-life"></span>
              <span class="hud-chip hud-weather"></span>
              <span class="hud-chip hud-moral"></span>
              <span class="hud-chip hud-money"></span>
            </div>
          </div>
          <div id="hint" class="hidden"></div>
          <div id="dock" class="hidden">
            <button class="btn" data-act="status">状态<small>[1]</small></button>
            <button class="btn" data-act="bag">背包<small>[2]</small></button>
            <button class="btn" data-act="skill">武功<small>[3]</small></button>
            <button class="btn" data-act="quest">任务<small>[4]</small></button>
            <button class="btn" data-act="meditate">打坐<small>[5]</small></button>
            <button class="btn" data-act="save">存档<small>[6]</small></button>
            <button class="btn" data-act="map">舆图<small>[M]</small></button>
            <button class="btn cheat" data-act="cheat">作弊器<small>[F8]</small></button>
          </div>
          <div id="dialog" class="panel hidden">
            <div class="dlg-name"></div>
            <div class="dlg-text"></div>
            <div class="dlg-opts"></div>
          </div>
          <div id="panel" class="panel hidden">
            <div class="panel-title"></div>
            <div class="panel-body"></div>
            <div class="panel-close"><button class="btn secondary" data-panel-close>关闭 <small>[Esc]</small></button></div>
          </div>
          <div id="cheat" class="panel hidden">
            <div class="panel-title">作弊器 · 逆天改命</div>
            <div class="panel-body"></div>
            <div class="panel-close"><button class="btn secondary" data-panel-close>关闭 <small>[F8]</small></button></div>
          </div>
          <div id="combat-ui" class="hidden">
            <div id="cb-log"></div>
            <div id="cb-menu"></div>
          </div>
          <div id="title"></div>
          <div id="ending" class="hidden"><div class="inner"></div></div>
          <div id="toast"></div>
          <div id="qte" class="hidden">
            <div class="qte-letter"></div>
            <div class="qte-bar"></div>
            <div class="qte-hint">按对应字母</div>
          </div>
          <div id="battle-danmaku"></div>
        </div>
      </div>
    `;
    window.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const k = e.key;
      if (k.length === 1 && /^[a-zA-Z]$/.test(k)) this.actions(`qte-key:${k.toUpperCase()}`);
    });
    this.root.querySelectorAll("[data-act]").forEach((b) => {
      b.addEventListener("click", () => this.actions((b as HTMLElement).dataset.act || ""));
    });
    this.root.querySelectorAll("[data-panel-close]").forEach((b) => {
      b.addEventListener("click", () => {
        this.closePanels();
        this.actions("ui-close");
      });
    });
  }

  setActionHandler(fn: ActionFn): void {
    this.actions = fn;
  }

  el(id: string): HTMLElement {
    const e = this.root.querySelector("#" + id);
    if (!e) throw new Error("missing ui element #" + id);
    return e as HTMLElement;
  }

  showToast(msg: string): void {
    const t = this.el("toast");
    const d = document.createElement("div");
    d.textContent = msg;
    t.appendChild(d);
    setTimeout(() => d.remove(), 3100);
  }

  showQte(key: string): void {
    const q = this.el("qte");
    q.classList.remove("hidden");
    this.q("#qte .qte-letter").textContent = key;
    this.q("#qte .qte-letter").classList.remove("qte-error");
    this.q("#qte .qte-bar").innerHTML = "<i></i>";
  }

  hideQte(): void {
    this.el("qte").classList.add("hidden");
  }

  flashQteError(): void {
    const letter = this.q("#qte .qte-letter");
    letter.classList.add("qte-error");
    setTimeout(() => letter.classList.remove("qte-error"), 220);
  }

  showBattleDanmaku(text: string, kind?: string): void {
    const wrap = this.el("battle-danmaku");
    const d = document.createElement("div");
    d.className = "bd-item" + (kind ? ` bd-${kind}` : "");
    d.textContent = text;
    d.style.top = 6 + Math.random() * 46 + "%";
    const dur = 4 + Math.random() * 2.5;
    d.style.animationDuration = dur.toFixed(2) + "s";
    wrap.appendChild(d);
    setTimeout(() => d.remove(), dur * 1000 + 150);
  }

  showHud(s: GameState): void {
    const p = s.player;
    const hud = this.el("hud");
    hud.classList.remove("hidden");
    this.q(".hud-name").textContent = `${p.name} · ${p.age}岁`;
    const mh = maxHp(p);
    const mm = maxMp(p);
    this.q(".bar.hp em").style.width = Math.max(0, (p.hp / mh) * 100) + "%";
    this.q(".bar.hp u").textContent = `${p.hp}/${mh}`;
    this.q(".bar.mp em").style.width = Math.max(0, (p.mp / mm) * 100) + "%";
    this.q(".bar.mp u").textContent = `${p.mp}/${mm}`;
    const potCost = potentialPerStrength(p);
    this.q(".bar.exp em").style.width = Math.min(100, (p.potential / Math.max(100, potCost * 40)) * 100) + "%";
    this.q(".bar.exp u").textContent = `潜能 ${p.potential}`;
    const loc = p.room ? ROOMS[p.room]?.name : AREAS[p.area]?.name || p.area;
    this.q(".hud-loc").textContent = loc || "";
    const shichen = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"][Math.floor(p.time.hour / 2) % 12];
    const titleTag = p.titles.includes("采花大盗") ? "采花大盗" : p.sect ? SECTS[p.sect].name : "散人";
    this.q(".hud-day").textContent = `第${p.time.day}日 ${shichen}时${p.time.hour % 2 ? "半" : ""} · ${titleTag}`;
    this.q(".hud-life").textContent = `饥 ${Math.floor(p.hunger)} · 渴 ${Math.floor(p.thirst)}`;
    const weatherIcon: Record<string, string> = { sunny: "☀️", rain: "🌧️", snow: "❄️", fog: "🌫️", wind: "💨" };
    const weatherName: Record<string, string> = { sunny: "晴", rain: "雨", snow: "雪", fog: "雾", wind: "风" };
    const thunder = p.weather === "rain" && getApp().world?.thunderstorm;
    this.q(".hud-weather").textContent = `${thunder ? "⛈️" : weatherIcon[p.weather] || "☀️"} ${thunder ? "雷雨" : weatherName[p.weather] || "晴"}`;
    this.q(".hud-moral").textContent = `善恶 ${p.moral}`;
    this.q(".hud-money").textContent = `银两 ${p.money}`;
    this.q(".hud-day").classList.toggle("hud-warn", p.poison > 0);
  }

  showHint(text: string | null): void {
    const h = this.el("hint");
    if (!text) {
      h.classList.add("hidden");
      return;
    }
    h.textContent = text;
    h.classList.remove("hidden");
  }

  showDock(show: boolean): void {
    this.el("dock").classList.toggle("hidden", !show);
  }

  openPanel(title: string, body: string): void {
    const panel = this.el("panel");
    this.q("#panel .panel-title").textContent = title;
    this.q("#panel .panel-body").innerHTML = body;
    panel.classList.remove("hidden");
    const bodyEl = panel.querySelector(".panel-body");
    if (bodyEl) this.bindPanelActions(bodyEl);
  }

  closePanels(): void {
    this.el("panel").classList.add("hidden");
    this.el("cheat").classList.add("hidden");
    this.el("dialog").classList.add("hidden");
    this.el("combat-ui").classList.add("hidden");
  }

  q(sel: string): HTMLElement {
    const e = this.root.querySelector(sel);
    if (!e) throw new Error("missing " + sel);
    return e as HTMLElement;
  }

  /* ---------------- 对话 ---------------- */
  showDialog(nodes: DialogNode[]): void {
    this.dialogNodes = nodes;
    this.dialogIndex = 0;
    this.renderDialog();
  }

  refreshDialog(): void {
    if (this.dialogNodes.length) this.renderDialog();
  }

  private renderDialog(): void {
    const node = this.dialogNodes[this.dialogIndex];
    const dlg = this.el("dialog");
    if (!node) {
      dlg.classList.add("hidden");
      return;
    }
    dlg.classList.remove("hidden");
    const questNpc = this.dialogNpc ? isQuestNpc(this.dialogNpc, getApp().state ?? undefined) : false;
    const nameEl = this.q("#dialog .dlg-name");
    nameEl.textContent = node.speaker || "江湖传闻";
    nameEl.innerHTML = (node.speaker || "江湖传闻") + (questNpc ? '<span class="dlg-quest">任务</span>' : "");
    this.q("#dialog .dlg-text").textContent = node.text;
    const opts = this.q("#dialog .dlg-opts");
    opts.innerHTML = "";
    for (const opt of node.opts || []) {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = opt.text;
      b.addEventListener("click", () => {
        if (opt.action) {
          this.actions(opt.action);
        } else if (opt.node) {
          const idx = this.dialogNodes.findIndex((n) => n.id === opt.node);
          if (idx >= 0) {
            this.dialogIndex = idx;
            this.renderDialog();
          }
        }
      });
      opts.appendChild(b);
    }
    if (!node.opts?.length) {
      const b = document.createElement("button");
      b.className = "btn secondary";
      b.textContent = "离开";
      b.addEventListener("click", () => {
        this.el("dialog").classList.add("hidden");
        this.actions("ui-close");
      });
      opts.appendChild(b);
    } else if (this.dialogNpc && !node.opts.some((o) => o.action?.startsWith("spar:") || o.action?.startsWith("challenge:") || o.text.includes("切磋"))) {
      const b = document.createElement("button");
      b.className = "btn jade";
      b.textContent = "切磋武艺";
      b.addEventListener("click", () => this.actions(`spar:${this.dialogNpc}`));
      opts.appendChild(b);
    }
    if (this.dialogNpc) {
      const info = document.createElement("button");
      info.className = "btn secondary";
      info.textContent = "查看状态";
      info.addEventListener("click", () => this.actions(`npc-status:${this.dialogNpc}`));
      opts.appendChild(info);
      const chat = document.createElement("button");
      chat.className = "btn";
      chat.textContent = "对话";
      chat.addEventListener("click", () => this.actions(`npc-talk:${this.dialogNpc}`));
      opts.appendChild(chat);
      const rom = ROMANCE[this.dialogNpc];
      const s = getApp().state;
      const npcAge = npcDef(this.dialogNpc).age ?? 18;
      const canIntimacy = s ? s.player.gender !== npcDef(this.dialogNpc).gender : false;
      if (rom) {
        const gift = document.createElement("button");
        gift.className = "btn";
        gift.textContent = "送礼物";
        gift.addEventListener("click", () => this.actions(`romance-gift:${this.dialogNpc}`));
        opts.appendChild(gift);
        if (canIntimacy) {
          const close = document.createElement("button");
          close.className = "btn jade";
          close.textContent = "亲近（需18岁）";
          close.addEventListener("click", () => this.actions(`romance-intimacy:${this.dialogNpc}`));
          opts.appendChild(close);
        }
      } else if (s && npcAge >= 18) {
        if (canIntimacy) {
          const close = document.createElement("button");
          close.className = "btn jade";
          close.textContent = "亲近（需18岁）";
          close.addEventListener("click", () => this.actions(`romance-intimacy:${this.dialogNpc}`));
          opts.appendChild(close);
        }
      }
      if (s && rom?.gender === "female") {
        const steal = document.createElement("button");
        steal.className = "btn danger";
        steal.textContent = "偷香（恶行）";
        steal.addEventListener("click", () => this.actions(`romance-steal:${this.dialogNpc}`));
        opts.appendChild(steal);
      }
    }
  }

  /* ---------------- 状态面板 ---------------- */
  showStatus(s: GameState): void {
    const p = s.player;
    const a = effectiveAttrs(p);
    const w = WEAPONS[p.weapon] || { name: "拳脚", desc: "" };
    const arm = ARMORS[p.armor];
    const acc = ARMORS[p.accessory];
    const fw = p.forgeWeapon && p.forgeEquipped ? p.forgeWeapon : null;
    const ng = activeNeigongLevel(p);
    const body = `
      <div class="kv">
        <div><b>姓名</b> ${p.name}</div>
        <div><b>性别</b> ${p.gender === "male" ? "男" : "女"}</div>
        <div><b>年龄</b> ${p.age} 岁</div>
        <div><b>容貌</b> ${p.age >= 15 ? p.looks : "尚不可见"}</div>
        <div><b>膂力</b> ${p.attrs.li}（${a.li}）</div>
        <div><b>悟性</b> ${p.attrs.wu}（${a.wu}）</div>
        <div><b>敏捷</b> ${p.attrs.min}（${a.min}）</div>
        <div><b>根骨</b> ${p.attrs.gen}（${a.gen}）</div>
        <div><b>气血</b> ${p.hp} / ${p.effHp} / ${maxHp(p)}</div>
        <div><b>内力</b> ${p.mp} / ${maxMp(p)}</div>
        <div><b>内力强度</b> ${p.neiliStrength}</div>
        <div><b>经验</b> ${p.exp}</div>
        <div><b>潜能</b> ${p.potential}</div>
        <div><b>善恶</b> ${p.moral}</div>
        <div><b>饥饱</b> ${Math.floor(p.hunger)} / 渴 ${Math.floor(p.thirst)}</div>
        <div><b>门派</b> ${p.sect ? SECTS[p.sect].name : "未入门"}</div>
        <div><b>婚配</b> ${p.married ? p.spouse : "未婚"}</div>
        <div><b>宅邸</b> ${p.house ? "桃花源小筑" : "无"}</div>
      </div>
      <div class="sectline">
        <b>兵器：</b>${fw ? fw.name + `（攻击 ${fw.atk}，亲手打造）` : w.name}
        <br><b>护甲：</b>${arm.name}　<b>饰品：</b>${acc.name}
        <br><b>内功：</b>${p.neigong ? `${skillDef(p.neigong).name} ${ng}级` : "未修习"}
        <br><b>攻击</b> ${attackPower(p)}　<b>防御</b> ${defensePower(p)}　<b>身法</b> ${speedValue(p).toFixed(1)}
        <br><span style="opacity:.75;font-size:12px">天赋有效值上限 60 · 内力强度上限 999 · 武功等级随武学而定</span>
      </div>
      <div class="sectline">
        ${p.poison > 0 ? `<span class="tag red">中毒 ${p.poison} 回合</span>` : ""}
        ${p.cheatLock ? `<span class="tag purple">锁血作弊中</span>` : ""}
        ${p.yobdc ? `<span class="tag">经典黑白模式</span>` : ""}
      </div>
    `;
    this.openPanel("人物状态", body);
  }

  showBag(s: GameState): void {
    const p = s.player;
    const weaponName = p.forgeWeapon && p.forgeEquipped ? p.forgeWeapon.name : (WEAPONS[p.weapon]?.name || "一双肉掌");
    const armorName = ARMORS[p.armor]?.name || "无甲";
    const accName = ARMORS[p.accessory]?.name || "无饰品";
    const weaponRows = p.weaponsOwned
      .filter((id) => WEAPONS[id] && id !== "fist")
      .map((id) => {
        const w = WEAPONS[id];
        const equipped = !p.forgeEquipped && p.weapon === id;
        return `<div class="itemrow"><div><b>${w.name}</b><span class="tag">攻 +${w.atk} · 重 ${w.weight}</span></div>
          <div class="desc">${w.desc}</div>
          ${equipped ? `<span class="tag jade">已装备</span>` : `<button class="btn" data-act="equip-weapon:${id}">穿上</button>`}
        </div>`;
      })
      .join("");
    const forgeRow = p.forgeWeapon && !p.forgeEquipped
      ? `<div class="itemrow"><div><b>${p.forgeWeapon.name}</b><span class="tag purple">亲手打造</span></div>
          <div class="desc">攻 +${p.forgeWeapon.atk} · 重 ${p.forgeWeapon.weight}</div>
          <button class="btn" data-act="equip-forge">穿上</button></div>`
      : "";
    const armorRows = p.armorsOwned
      .filter((id) => ARMORS[id] && ARMORS[id].slot === "armor" && id !== "none")
      .map((id) => {
        const a = ARMORS[id];
        const equipped = p.armor === id;
        return `<div class="itemrow"><div><b>${a.name}</b><span class="tag">防 +${a.def} · 重 ${a.weight}</span></div>
          <div class="desc">${a.desc}</div>
          ${equipped ? `<span class="tag jade">已装备</span>` : `<button class="btn" data-act="equip-armor:${id}">穿上</button>`}
        </div>`;
      })
      .join("");
    const accRows = p.accessoriesOwned
      .filter((id) => ARMORS[id] && ARMORS[id].slot === "accessory" && id !== "noneAcc")
      .map((id) => {
        const a = ARMORS[id];
        const equipped = p.accessory === id;
        return `<div class="itemrow"><div><b>${a.name}</b><span class="tag">防 +${a.def} · 重 ${a.weight}</span></div>
          <div class="desc">${a.desc}</div>
          ${equipped ? `<span class="tag jade">已装备</span>` : `<button class="btn" data-act="equip-accessory:${id}">穿上</button>`}
        </div>`;
      })
      .join("");
    const equipBody = `
      <div class="sectline">
        <b>当前穿戴</b>
        <div class="itemrow"><div><b>兵器</b> ${weaponName}</div>
          ${p.weapon !== "fist" || p.forgeEquipped ? `<button class="btn secondary" data-act="unequip-weapon">脱下</button>` : ""}
        </div>
        <div class="itemrow"><div><b>护甲</b> ${armorName}</div>
          ${p.armor !== "none" ? `<button class="btn secondary" data-act="unequip-armor">脱下</button>` : ""}
        </div>
        <div class="itemrow"><div><b>饰品</b> ${accName}</div>
          ${p.accessory !== "noneAcc" ? `<button class="btn secondary" data-act="unequip-accessory">脱下</button>` : ""}
        </div>
      </div>
      ${weaponRows || forgeRow ? `<div class="sectline"><b>兵器</b>${forgeRow}${weaponRows}</div>` : ""}
      ${armorRows ? `<div class="sectline"><b>护甲</b>${armorRows}</div>` : ""}
      ${accRows ? `<div class="sectline"><b>饰品</b>${accRows}</div>` : ""}
    `;
    const rows = Object.entries(p.items)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => {
        const def = ITEMS[id];
        if (!def) return "";
        const usable = ["food", "drink", "medicine", "book", "special"].includes(def.kind);
        return `<div class="itemrow">
          <div><b>${def.name}</b> ×${n}<span class="tag">${kindName(def.kind)}</span></div>
          <div class="desc">${def.desc}</div>
          ${usable ? `<button class="btn" data-act="use:${id}">使用</button>` : ""}
          <button class="btn secondary" data-act="drop:${id}">丢弃</button>
        </div>`;
      })
      .join("");
    this.openPanel("背包 · 穿戴", equipBody + (rows || "<div style='text-align:center;opacity:.7'>囊中空空如也。</div>"));
  }

  showStorage(s: GameState): void {
    const p = s.player;
    const bag = Object.entries(p.items)
      .filter(([id, n]) => n > 0 && ITEMS[id])
      .map(([id, n]) => {
        const it = ITEMS[id];
        return `<div class="itemrow"><div><b>${it.name}</b> ×${n}<span class="tag">${kindName(it.kind)}</span></div>
          <button class="btn" data-act="store:${id}">存入 1</button></div>`;
      })
      .join("");
    const box = Object.entries(p.storage)
      .filter(([id, n]) => n > 0 && ITEMS[id])
      .map(([id, n]) => {
        const it = ITEMS[id];
        return `<div class="itemrow"><div><b>${it.name}</b> ×${n}<span class="tag">${kindName(it.kind)}</span></div>
          <button class="btn secondary" data-act="take:${id}">取出 1</button></div>`;
      })
      .join("");
    this.openPanel("桃花源小筑 · 存物柜", `
      <div class="sectline"><b>柜中存放</b>${box || "<div style='text-align:center;opacity:.7'>柜中空空如也。</div>"}</div>
      <div class="sectline"><b>随身背包（点击存入）</b>${bag || "<div style='text-align:center;opacity:.7'>囊中空空如也。</div>"}</div>
    `);
  }

  showSkills(s: GameState): void {
    const p = s.player;
    const rows: string[] = [];
    const group = (label: string, ids: string[]) => {
      const list = ids.filter((id) => SKILLS[id] && (p.skills[id] || 0) > 0);
      if (!list.length) return;
      rows.push(`<div class="sectline"><b>${label}</b>`);
      for (const id of list) {
        const d = skillDef(id);
        const lv = p.skills[id] || 0;
        const ults = (d.ult || []).filter((u) => lv >= u.lv);
        rows.push(`<div class="itemrow"><div><b>${d.name}</b> ${lv}/${d.max}</div>
          <div class="desc">${d.desc}${ults.length ? "<br><span class='tag jade'>绝招：" + ults.map((u) => u.name).join("、") + "</span>" : ""}</div></div>`);
      }
      rows.push("</div>");
    };
    group("基本功夫", ["jibenQuan", "jibenJian", "jibenDao", "jibenZhang", "jibenBian", "jibenNeiGong", "jibenQingGong", "jibenZhaoJia", "duShu"]);
    group("门派武学", Object.keys(p.skills).filter((id) => SKILLS[id]?.sect));
    group("奇遇武学", ["mengHuQuan", "jingTianDaoFa", "zuiQuan", "xiaoyaoXinfa"]);
    this.openPanel("武功", rows.join("") || "尚未习武。");
  }

  showQuests(s: GameState): void {
    const rows = Object.values(QUESTS).map((def) => {
      const qp = questProgress(s, def.id);
      const stage = qp.done ? -1 : qp.stage;
      const body = stage < 0
        ? `<div class="desc" style="color:#3f6b45">已完成${qp.repeat > 0 ? `（完成 ${qp.repeat} 次）` : ""}</div>`
        : `<div class="desc">${def.stages[Math.min(stage, def.stages.length - 1)]}</div>
           <div class="desc" style="opacity:.75">${stage + 1}/${def.stages.length}</div>`;
      return `<div class="questrow ${stage < 0 ? "done" : ""}">
        <b>${def.name}</b><span class="tag ${def.kind === "main" ? "red" : "jade"}">${def.kind === "main" ? "主线" : "支线"}</span>
        ${body}
      </div>`;
    });
    this.openPanel("任务与恩怨", rows.join(""));
  }

  /* ---------------- 商店 / 学艺 / 铁匠 ---------------- */
  showShop(s: GameState, npcId: string): void {
    const def = npcDef(npcId);
    const items = (def.shop || []).map((id) => ITEMS[id]).filter(Boolean);
    const shopRows = items.map((it) => `
      <div class="shop-item">
        <div class="row1"><b>${it.name}</b><span>${it.price} 两</span></div>
        <div class="desc">${it.desc}</div>
        <button class="btn" data-act="shop-buy:${it.id}">买 1</button>
        <button class="btn secondary" data-act="shop-buy5:${it.id}">买 5</button>
      </div>`).join("");
    const weaponRows = (def.shop || []).filter((id) => WEAPONS[id]).map((id) => {
      const w = WEAPONS[id];
      return `<div class="shop-item">
        <div class="row1"><b>${w.name}</b><span>${w.price} 两</span></div>
        <div class="desc">${w.desc}（攻 +${w.atk}，重 ${w.weight}）</div>
        <button class="btn" data-act="shop-weapon:${id}">购买并装备</button>
      </div>`;
    }).join("");
    const armorRows = (def.shop || []).filter((id) => ARMORS[id]).map((id) => {
      const a = ARMORS[id];
      return `<div class="shop-item">
        <div class="row1"><b>${a.name}</b><span>${a.price} 两</span></div>
        <div class="desc">${a.desc}（防 +${a.def}，重 ${a.weight}）</div>
        <button class="btn" data-act="shop-armor:${id}">购买并装备</button>
      </div>`;
    }).join("");
    const sellRows = def.buyAll
      ? `<div class="sectline"><b>出售杂物</b>${Object.entries(s.player.items)
          .filter(([id, n]) => n > 0 && ITEMS[id] && ITEMS[id].price > 0)
          .map(([id, n]) => {
            const it = ITEMS[id];
            return `<div class="itemrow"><div><b>${it.name}</b> ×${n}</div><div class="desc">${it.desc}</div>
              <button class="btn secondary" data-act="shop-sell:${id}">卖 1（${Math.floor(it.price * 0.5)}两）</button></div>`;
          })
          .join("")}</div>`
      : "";
    const forgeBtn = def.forge ? `<button class="btn" data-act="forge">打造兵器</button>` : "";
    this.openPanel(`${def.name} · 买卖`, `
      <div class="shop-grid">${shopRows}</div>
      ${weaponRows ? `<div class="sectline"><b>兵器</b><div class="shop-grid">${weaponRows}</div></div>` : ""}
      ${armorRows ? `<div class="sectline"><b>护具</b><div class="shop-grid">${armorRows}</div></div>` : ""}
      ${sellRows}
      <div style="text-align:center;margin-top:10px">${forgeBtn}</div>
    `);
  }

  showLearn(s: GameState, npcId: string): void {
    const def = npcDef(npcId);
    const ids = [...(def.learn || []), ...(def.learnBasic || [])];
    const rows = ids.map((id) => {
      const d = skillDef(id);
      const cur = s.player.skills[id] || 0;
      const block = canLearnSkill(s, id);
      const cost = block ? null : learnCost(id, cur, cur + 1, s.player);
      const exp = expRequired(id, cur + 1);
      return `<div class="learn-row">
        <div class="name">${d.name}</div>
        <div class="info">${d.desc}<br>
          <span class="tag">当前 ${cur}</span>
          ${cost !== null ? `<span class="tag">潜能 ${cost}</span><span class="tag">需经验 ${exp}</span>` : ""}
          ${block ? `<span class="tag red">${block}</span>` : ""}
        </div>
        <div class="lv">${cur}/${d.max}</div>
        ${block ? "" : `<button class="btn" data-act="learn:${id}:1">+1</button><button class="btn secondary" data-act="learn:${id}:10">+10</button>`}
      </div>`;
    });
    this.openPanel(`${def.name} · 授艺`, rows.join("") || "这位前辈暂时无艺可授。");
  }

  showForge(s: GameState): void {
    const body = `
      <div class="sectline">
        <b>打造神兵</b>
        <div class="desc">铁匠张会根据材料与你的运气打出不同品级的兵刃，你可以亲手为它起名。</div>
      </div>
      <div class="learn-row"><div class="name">铁矿石</div><div class="info">普通钢材，可成凡兵</div>
        <div class="lv">${s.player.items.tiekuang || 0}</div></div>
      <div class="learn-row"><div class="name">玄铁</div><div class="info">陨落星铁，可成神兵</div>
        <div class="lv">${s.player.items.xuantie || 0}</div></div>
      <div class="create-row">
        <label>兵刃名称</label><input id="forge-name" maxlength="8" value="无名刀">
        <button class="btn" data-act="forge-tie">铁矿石打造（100两）</button>
        <button class="btn danger" data-act="forge-xuan">玄铁打造（500两）</button>
      </div>
    `;
    this.openPanel("张记铁匠铺 · 打造", body);
  }

  showRest(s: GameState): void {
    this.openPanel("悦来客栈", `
      <div class="sectline">
        <b>投宿一夜</b> <span class="tag">10 两</span>
        <div class="desc">美美睡上一觉，气血尽复，伤势也大为好转。</div>
        <button class="btn jade" data-act="rest">投宿</button>
      </div>
      <div class="sectline">
        <b>闭关七日</b> <span class="tag">50 两</span>
        <div class="desc">谢绝访客，苦修七日。气血精神尽复，时光飞逝（年岁随日递增）。</div>
        <button class="btn" data-act="retreat">闭关</button>
      </div>
      <div class="sectline">
        <b>打尖</b>
        <div class="desc">来一壶茶、两个肉包子，边吃边听店小二说闲话。</div>
        <button class="btn" data-act="eat">叫小二上酒菜</button>
      </div>
      <div class="sectline">
        <b>旁听江湖消息</b>
        <div class="desc">店小二压低声音，说起最近镇上的新鲜事。</div>
        <button class="btn secondary" data-act="rumor">听一耳朵</button>
      </div>
    `);
  }

  showTravel(s: GameState): void {
    const p = s.player;
    const known = knownAreas(s);
    // 时空尽头作为特殊区域：开门即视为已知
    const isKnown = (id: string) => known.includes(id) || (id === "end" && !!p.flags["endOpen"]);
    const target = mainQuestTarget(s);
    const roads = MAP_EDGES
      .filter(([a, b]) => isKnown(a) && isKnown(b))
      .map(([a, b]) => `<path class="map-road" d="M ${MAP_POS[a].x} ${MAP_POS[a].y} L ${MAP_POS[b].x} ${MAP_POS[b].y}"/>`)
      .join("");
    const nodes = Object.keys(MAP_POS)
      .map((id) => {
        const pos = MAP_POS[id];
        const pulse = target === id ? `<circle class="map-pulse" cx="${pos.x}" cy="${pos.y}" r="10"/>` : "";
        if (!isKnown(id)) {
          return `<g class="map-node unknown">${pulse}<circle class="dot" cx="${pos.x}" cy="${pos.y}" r="5"/><text x="${pos.x}" y="${pos.y + 22}">???</text></g>`;
        }
        const here = p.area === id;
        const flag = here
          ? `<path class="map-flag-pole" d="M ${pos.x - 8} ${pos.y - 7} L ${pos.x - 8} ${pos.y - 28}"/><path class="map-flag" d="M ${pos.x - 8} ${pos.y - 28} L ${pos.x + 7} ${pos.y - 23} L ${pos.x - 8} ${pos.y - 18} Z"/>`
          : "";
        const dy = id === "binghuo" ? -14 : 22;
        return `<g class="map-node known${here ? " here" : ""}"${here ? "" : ` data-act="travel:${id}"`}>${pulse}<circle class="dot" cx="${pos.x}" cy="${pos.y}" r="6.5"/>${flag}<text x="${pos.x}" y="${pos.y + dy}">${AREAS[id].name}</text></g>`;
      })
      .join("");
    this.openPanel("江湖舆图", `
      <div class="map-note">足迹所至，方入舆图。点击墨点即可动身；金圈所指，是眼下的去向。</div>
      <svg class="worldmap" viewBox="0 0 860 460" xmlns="http://www.w3.org/2000/svg">
        ${MAP_DECOR}
        <rect class="map-endbox" x="330" y="382" width="132" height="64" rx="10"/>
        ${roads}
        ${nodes}
      </svg>
      <div class="map-legend">
        <span><i class="sw sw-here"></i>你在这里</span>
        <span><i class="sw sw-known"></i>已知名地</span>
        <span><i class="sw sw-unknown"></i>未至之地</span>
      </div>
    `);
  }

  /* ---------------- 存档 ---------------- */
  showSaveLoad(s: GameState | null): void {
    const slots = [1, 2, 3];
    const rows = slots.map((n) => {
      const has = hasSave(n);
      const info = has ? "有存档" : "空";
      return `<div class="slot-row">
        <div class="info"><b>存档 ${n}</b><br><span class="desc" style="opacity:.7">${info}</span></div>
        ${s ? `<button class="btn jade" data-act="save:${n}">存档</button>` : ""}
        ${has ? `<button class="btn" data-act="load:${n}">读取</button><button class="btn danger" data-act="clear:${n}">删除</button>` : ""}
      </div>`;
    }).join("");
    this.openPanel("江湖档案", rows + `
      <div class="sectline" style="text-align:center">
        <button class="btn secondary" data-act="autosave">立即自动存档</button>
        <button class="btn ghost" data-act="return-title">返回标题</button>
      </div>
    `);
  }

  /* ---------------- 作弊器 ---------------- */
  showNpcStatus(npcId: string, s: GameState): void {
    const n = npcDef(npcId);
    const aff = Math.round(s.player.affections[npcId] ?? 0);
    const relation = s.player.spouse === n.name
      ? `<span class="tag red">已结连理</span>`
      : s.player.sect && n.area === s.player.area && n.master
        ? `<span class="tag jade">同门前辈</span>`
        : aff > 0
          ? `<span class="tag purple">好感 ${aff}</span>`
          : `<span class="tag">初识</span>`;
    this.openPanel(`${n.name} · 人物志`, `
      <div class="kv">
        <div><b>姓名</b> ${n.name}</div>
        <div><b>身份</b> ${n.title || "江湖客"}</div>
        <div><b>性别</b> ${n.gender === "female" ? "女" : "男"}</div>
        <div><b>年岁</b> ${n.age ?? "不详"}</div>
        <div><b>与你的关系</b> ${relation}</div>
      </div>
      <div class="sectline"><b>容貌</b><br>${n.looks || "只见寻常面目。"}</div>
      <div class="sectline"><b>武艺</b><br>${n.martial || "看不出深浅。"}</div>
      <div class="sectline"><b>近况</b><br>${n.desc}</div>
    `);
  }

  showGiftPanel(npcId: string, s: GameState): void {
    const rom = ROMANCE[npcId];
    if (!rom) return;
    const rows = rom.gifts.map((g) => {
      const def = ITEMS[g.item];
      const owned = s.player.items[g.item] || 0;
      return `<div class="itemrow"><div><b>${def?.name || g.item}</b> ×${owned}</div>
        <div class="desc">${g.text}</div>
        ${owned > 0 ? `<button class="btn" data-act="romance-give:${npcId}:${g.item}">相赠</button>` : `<span class="tag">尚未持有</span>`}
      </div>`;
    }).join("");
    this.openPanel(`赠礼 · ${npcDef(npcId).name}`, rows || "暂时没有拿得出手的东西。");
  }

  showIntimacy(npcId: string, customText?: string): void {
    const rom = ROMANCE[npcId];
    const text = customText || rom?.intimateText;
    if (!text) return;
    const old = this.root.querySelector("#intimacy");
    if (old) old.remove();
    const div = document.createElement("div");
    div.id = "intimacy";
    div.innerHTML = `
      <div class="intimacy-inner">
        <div class="candles"><span></span><span></span><span></span></div>
        <div class="intimacy-text">${text.replace(/\n/g, "<br>")}</div>
        <div class="intimacy-foot">红烛渐熄，窗外月落。你与她（他）相拥而眠。</div>
      </div>
    `;
    this.root.appendChild(div);
    setTimeout(() => div.remove(), 9000);
    div.addEventListener("click", () => div.remove());
  }

  showCheat(s: GameState): void {
    const p = s.player;
    const skillOpts = Object.keys(SKILLS).map((id) => `<option value="${id}">${skillDef(id).name}</option>`).join("");
    const itemOpts = Object.keys(ITEMS).map((id) => `<option value="${id}">${ITEMS[id].name}</option>`).join("");
    const areaOpts = Object.keys(AREAS).map((id) => `<option value="${id}">${AREAS[id].name}</option>`).join("");
    const questOpts = Object.keys(QUESTS).map((id) => `<option value="${id}">${QUESTS[id].name}</option>`).join("");
    const row = (label: string, id: string, value: string | number, action: string) => `
      <div class="cheat-row"><label>${label}</label><input id="${id}" value="${value}"><span class="now">当前 ${value}</span>
      <button class="btn" data-act="${action}">应用</button></div>`;
    const body = `
      <div class="cheat-row"><label>四项天赋</label>
        <span class="now">膂力</span><input id="ch-li" value="${p.attrs.li}">
        <span class="now">悟性</span><input id="ch-wu" value="${p.attrs.wu}">
        <span class="now">敏捷</span><input id="ch-min" value="${p.attrs.min}">
        <span class="now">根骨</span><input id="ch-gen" value="${p.attrs.gen}">
        <button class="btn" data-act="cheat-attrs">应用</button></div>
      ${row("银两", "ch-money", p.money, "cheat-money")}
      ${row("潜能", "ch-potential", p.potential, "cheat-potential")}
      ${row("经验", "ch-exp", p.exp, "cheat-exp")}
      ${row("善恶", "ch-moral", p.moral, "cheat-moral")}
      ${row("内力强度", "ch-strength", p.neiliStrength, "cheat-strength")}
      ${row("年龄", "ch-age", p.age, "cheat-age")}
      <div class="cheat-row"><label>武功等级</label>
        <select id="ch-skill">${skillOpts}</select><input id="ch-skill-lv" value="100">
        <button class="btn" data-act="cheat-skill">设置</button></div>
      <div class="cheat-row"><label>添加物品</label>
        <select id="ch-item">${itemOpts}</select><input id="ch-item-n" value="1">
        <button class="btn" data-act="cheat-item">添加</button></div>
      <div class="cheat-row"><label>瞬移</label>
        <select id="ch-area">${areaOpts}</select>
        <button class="btn" data-act="cheat-area">前往</button></div>
      <div class="cheat-row"><label>完成任务</label>
        <select id="ch-quest">${questOpts}</select>
        <button class="btn" data-act="cheat-quest">完成</button></div>
      <div class="cheat-actions">
        <button class="btn jade" data-act="cheat-heal">满血满蓝</button>
        <button class="btn" data-act="cheat-allskills">全武功 100 级</button>
        <button class="btn" data-act="cheat-lock">${p.cheatLock ? "解除锁血" : "锁血无敌"}</button>
        <button class="btn" data-act="cheat-classic">${p.yobdc ? "关闭经典模式" : "经典黑白模式"}</button>
        <button class="btn danger" data-act="cheat-reset">重置存档（慎用）</button>
      </div>
      <div class="cheat-note">老夫当年在文曲星上，只输入一个密码，按一下 F3，便神功大成。你如今有了这一方作弊器，倒也不必再背那句咒语了。改了属性之后，记得存档。全武功 100 级会覆盖现有武功等级，慎用。</div>
    `;
    this.el("cheat").classList.remove("hidden");
    this.q("#cheat .panel-body").innerHTML = body;
    this.bindPanelActions(this.q("#cheat .panel-body"));
  }

  /* ---------------- 战斗 ---------------- */
  showCombat(s: GameState, b: BattleState): void {
    const ui = this.el("combat-ui");
    ui.classList.remove("hidden");
    const ults = availableUts(s);
    const enemy = enemyDef(b.enemyId);
    const pct = (v: number, max: number) => Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
    const log = this.el("cb-log");
    const rewardBlock = b.over && b.victory && b.rewardLines.length
      ? `<div class="reward-banner">战利品：${b.rewardLines.join(" ")}</div>`
      : "";
    log.innerHTML = rewardBlock + b.log.map((e) => {
      const cls = e.kind === "crit" || e.kind === "hit" && e.side === "player" ? "hit" : e.kind === "hit" && e.side === "enemy" ? "hurt" : e.kind === "heal" ? "heal" : e.kind === "death" ? "hurt" : "info";
      return `<div class="${cls}">${e.text}</div>`;
    }).join("");
    log.scrollTop = log.scrollHeight;
    const menu = this.el("cb-menu");
    const over = b.over;
    menu.innerHTML = `
      <div style="width:100%;display:flex;justify-content:space-between;gap:10px;padding:0 14px;color:#f0e2c0;font-size:13px;flex-wrap:wrap">
        <span>你：${b.player.hp}/${b.player.maxHp} 气血 · ${b.player.mp}/${b.player.maxMp} 内力</span>
        <span style="text-align:right">${enemy.title || enemy.name}：${b.enemy.hp}/${b.enemy.maxHp} 气血</span>
      </div>
      <div style="width:100%;display:flex;gap:6px;height:7px;padding:0 14px">
        <div style="flex:1;background:#241a10;border:1px solid #6b4f2a"><div style="width:${pct(b.player.hp, b.player.maxHp)}%;height:100%;background:linear-gradient(#e5484d,#a71d22)"></div></div>
        <div style="flex:1;background:#241a10;border:1px solid #6b4f2a"><div style="width:${pct(b.enemy.hp, b.enemy.maxHp)}%;height:100%;background:linear-gradient(#c9a13a,#8a5a2a)"></div></div>
      </div>
      <div id="cb-btns" style="display:flex;gap:7px;flex-wrap:wrap;justify-content:center">
        ${over ? `<button class="btn jade" data-act="battle-close">${b.victory ? "收下战利品" : b.fled ? "返回" : enemy.spar ? "切磋结束" : "轮回转生"}</button>` : `
          <button class="btn" data-act="battle-attack">攻击</button>
          <button class="btn" data-act="battle-ult-menu">绝招</button>
          <button class="btn secondary" data-act="battle-defend">运功防御</button>
          <button class="btn" data-act="battle-item-menu">物品</button>
          <button class="btn ghost" data-act="battle-flee">逃跑</button>
        `}
      </div>
      ${!over ? `
        <div id="cb-sub" style="width:100%;text-align:center"></div>
        <div id="cb-jiali">
          <span>加力</span>
          <input type="range" min="0" max="10" value="${b.jiali}" data-act="battle-jiali">
          <b id="cb-jiali-v">${b.jiali}</b>
        </div>
      ` : ""}
    `;
    this.bindPanelActions(menu);
    const slider = menu.querySelector("[data-act='battle-jiali']") as HTMLInputElement;
    if (slider) {
      slider.addEventListener("input", () => {
        const v = Number(slider.value);
        this.q("#cb-jiali-v").textContent = String(v);
        this.actions(`battle-jiali:${v}`);
      });
    }
    const sub = menu.querySelector("#cb-sub");
    if (sub) {
      sub.addEventListener("click", (ev) => {
        const t = (ev.target as HTMLElement).closest("[data-act]");
        if (t) this.actions(t.getAttribute("data-act") || "");
      });
    }
  }

  /* ---------------- 标题 / 创建 / 结局 ---------------- */
  showTitle(): void {
    this.closePanels();
    this.el("title").classList.remove("hidden");
    this.el("hud").classList.add("hidden");
    this.showDock(false);
    const t = this.el("title");
    t.innerHTML = `
      <div id="title-inner">
        <h1>英雄坛说</h1>
        <div class="sub">—— 文曲星经典 · 黄金彩色重制 ——</div>
        <div id="title-menu">
          <button class="btn" data-act="title-new">新的江湖</button>
          <button class="btn" data-act="title-load">读取存档</button>
          <button class="btn" data-act="title-about">游戏说明</button>
        </div>
        <div class="foot">江湖路远 · 侠义无双</div>
      </div>
    `;
    this.bindPanelActions(t);
  }

  showCreate(attrs: { li: number; wu: number; min: number; gen: number }): void {
    this.el("title").classList.remove("hidden");
    this.el("title").innerHTML = "";
    const body = `
      <div class="lore">${PROLOGUE}</div>
      <div class="create-row">
        <label>尊姓大名</label><input id="c-name" maxlength="6" value="小虾米">
        <label>性别</label>
        <select id="c-gender"><option value="male">男</option><option value="female">女</option></select>
      </div>
      <div class="attr-grid">
        <div><span>膂力（力气与杀伤）</span><b id="a-li">${attrs.li}</b></div>
        <div><span>悟性（学武速度）</span><b id="a-wu">${attrs.wu}</b></div>
        <div><span>敏捷（闪避与命中）</span><b id="a-min">${attrs.min}</b></div>
        <div><span>根骨（气血与内功）</span><b id="a-gen">${attrs.gen}</b></div>
        <div><span>合计</span><b id="a-total">${attrs.li + attrs.wu + attrs.min + attrs.gen}</b></div>
      </div>
      <div class="create-row">
        <button class="btn secondary" data-act="roll-attrs">掷签问命</button>
        <button class="btn jade" data-act="create-ok">踏入江湖</button>
      </div>
    `;
    const panel = document.createElement("div");
    panel.id = "create";
    panel.className = "panel";
    panel.innerHTML = `<div class="panel-title">少侠初临 · 平安镇</div><div class="panel-body">${body}</div>`;
    this.el("title").appendChild(panel);
    this.bindPanelActions(panel);
  }

  showLoadScreen(): void {
    this.el("title").classList.remove("hidden");
    const slots = saveSlots();
    const rows = [1, 2, 3].map((n) => {
      const found = slots.find((x) => x.slot === n);
      return `<div class="slot-row">
        <div class="info"><b>存档 ${n}</b>${found ? `<br><span style="opacity:.75">${found.name} · ${new Date(found.savedAt).toLocaleString()}</span>` : ""}</div>
        ${found ? `<button class="btn" data-act="load:${n}">读取</button>` : "<span style='opacity:.45'>空</span>"}
      </div>`;
    }).join("");
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `<div class="panel-title">读取存档</div><div class="panel-body">${rows}
      <div class="panel-close"><button class="btn secondary" data-act="title-back">返回</button></div></div>`;
    this.el("title").innerHTML = "";
    this.el("title").appendChild(panel);
    this.bindPanelActions(panel);
  }

  showAbout(): void {
    this.el("title").classList.remove("hidden");
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `<div class="panel-title">游戏说明</div><div class="panel-body">
      <div class="sectline"><b>移动</b> 方向键 / A D　<b>交互</b> E 或 回车　<b>菜单</b> 1-6　<b>作弊器</b> F8</div>
      <div class="sectline"><b>江湖基础</b> 潜能与经验是成长的柴火：打坐把潜能化为内力强度，向师父请教把潜能化为武功等级。武功练到火候，方能悟出绝招。</div>
      <div class="sectline"><b>门派</b> 太极、八卦、雪山、花间、尹贺、红莲，外加黄金版新增的丐帮。每派各有内功、轻功、兵器功夫与独门绝招，拜师有门槛。</div>
      <div class="sectline"><b>主线</b> 从平安镇出发，查黑风寨、破青龙坛、败六大掌门取六块三角石板，最终打开时空尽头，直面「我是谁」。</div>
      <div class="sectline"><b>生活</b> 会饿、会渴、会老。投宿、吃饭、采药、挖矿、打铁、买宅、成亲，江湖不只有刀光剑影。</div>
      <div class="sectline"><b>善恶</b> 滥杀无辜会折损道德。道德过低，正派不纳；行侠仗义，自有好报。</div>
      <div class="sectline"><b>传说</b> 老文曲星玩家或许记得一个密码：YOBDC。在创建角色时把它填进名字，会有故人重逢。</div>
      <div class="panel-close"><button class="btn secondary" data-act="title-back">返回</button></div>
    </div>`;
    this.el("title").innerHTML = "";
    this.el("title").appendChild(panel);
    this.bindPanelActions(panel);
  }

  showEnding(text: string, title = "时空尽头"): void {
    const e = this.el("ending");
    e.classList.remove("hidden");
    e.querySelector(".inner")!.innerHTML = `<h2>${title}</h2>${text}
      <div><button class="btn" data-act="ending-continue">继续行走江湖</button></div>`;
    this.bindPanelActions(e);
  }

  bindPanelActions(root: Element): void {
    root.querySelectorAll("[data-act]").forEach((b) => {
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.actions((b as HTMLElement).dataset.act || "");
      });
    });
  }

  updateCombatLock(v: boolean): void {
    this.combatLocked = v;
  }
}

function kindName(k: string): string {
  const map: Record<string, string> = {
    food: "食物",
    drink: "饮品",
    medicine: "药物",
    material: "材料",
    quest: "任务",
    book: "秘笈",
    special: "杂物"
  };
  return map[k] || k;
}

/* ---------------- 江湖舆图（手绘 SVG 世界地图） ---------------- */

// 节点布局坐标（viewBox 860×460）：镇居中，东行官道入海，北靠群山
const MAP_POS: Record<string, { x: number; y: number }> = {
  wudang: { x: 190, y: 168 },
  town: { x: 396, y: 270 },
  houshan: { x: 388, y: 116 },
  xueshan: { x: 322, y: 44 },
  heifeng: { x: 178, y: 74 },
  shiku: { x: 512, y: 56 },
  shangjia: { x: 558, y: 270 },
  guandao: { x: 690, y: 262 },
  lianhua: { x: 614, y: 124 },
  wuzhi: { x: 770, y: 158 },
  baihua: { x: 604, y: 384 },
  dukou: { x: 764, y: 336 },
  binghuo: { x: 726, y: 446 },
  end: { x: 396, y: 416 }
};

// 区域连接（两端都已知才在图上画出虚线路径）
const MAP_EDGES: [string, string][] = [
  ["town", "wudang"],
  ["town", "houshan"],
  ["town", "shangjia"],
  ["houshan", "xueshan"],
  ["houshan", "heifeng"],
  ["houshan", "shiku"],
  ["shangjia", "guandao"],
  ["guandao", "lianhua"],
  ["guandao", "baihua"],
  ["guandao", "wuzhi"],
  ["guandao", "dukou"],
  ["dukou", "binghuo"],
  ["town", "end"]
];

// 底图装饰：海、波浪、河、山、树林（纯手绘风静态 SVG）
const MAP_DECOR = `
  <path class="map-sea" d="M 862 226 Q 800 292 766 350 Q 720 414 628 462 L 862 462 Z"/>
  <path class="map-wave" d="M 792 306 q 10 -7 20 0 q 10 7 20 0"/>
  <path class="map-wave" d="M 742 396 q 12 -8 24 0 q 12 8 24 0"/>
  <path class="map-wave" d="M 668 432 q 10 -7 20 0 q 10 7 20 0"/>
  <path class="map-river" d="M 108 44 Q 196 104 252 176 Q 312 250 392 272 Q 470 296 522 348 Q 580 404 646 448"/>
  <path class="map-mtn" d="M 70 176 L 102 134 L 134 176 Z"/>
  <path class="map-mtn" d="M 118 172 L 146 144 L 174 172 Z"/>
  <path class="map-mtn snow" d="M 268 44 L 296 12 L 324 44 Z"/>
  <path class="map-mtn snow" d="M 340 40 L 366 14 L 392 40 Z"/>
  <path class="map-mtn" d="M 420 108 L 446 76 L 472 108 Z"/>
  <path class="map-mtn" d="M 448 112 L 470 88 L 492 112 Z"/>
  <path class="map-mtn" d="M 96 84 L 124 48 L 152 84 Z"/>
  <path class="map-mtn" d="M 470 50 L 492 24 L 514 50 Z"/>
  <path class="map-mtn" d="M 540 60 L 560 36 L 580 60 Z"/>
  <path class="map-mtn" d="M 548 118 L 574 84 L 600 118 Z"/>
  <path class="map-mtn" d="M 636 112 L 660 84 L 684 112 Z"/>
  <path class="map-mtn" d="M 706 144 L 720 118 L 734 144 Z"/>
  <path class="map-mtn" d="M 730 138 L 744 106 L 758 138 Z"/>
  <path class="map-mtn" d="M 754 134 L 770 98 L 786 134 Z"/>
  <path class="map-mtn" d="M 782 138 L 796 108 L 810 138 Z"/>
  <path class="map-mtn" d="M 806 144 L 820 120 L 834 144 Z"/>
  <path class="map-tree" d="M 330 152 l 8 -16 l 8 16 Z"/>
  <path class="map-tree" d="M 348 158 l 8 -16 l 8 16 Z"/>
  <path class="map-tree" d="M 300 316 l 8 -16 l 8 16 Z"/>
  <path class="map-tree" d="M 318 322 l 8 -16 l 8 16 Z"/>
  <path class="map-tree" d="M 548 350 l 8 -16 l 8 16 Z"/>
  <path class="map-tree" d="M 566 358 l 8 -16 l 8 16 Z"/>
  <path class="map-tree" d="M 584 348 l 8 -16 l 8 16 Z"/>
  <path class="map-tree" d="M 640 366 l 8 -16 l 8 16 Z"/>
`;

// 六派持板掌门所在区域（依挑战顺序）
const PLATE_MASTER_AREAS: [string, string][] = [
  ["qingXu", "wudang"],
  ["wangWeiYang", "shangjia"],
  ["baiRuiDe", "xueshan"],
  ["liQingZhao", "baihua"],
  ["heZhongYang", "binghuo"],
  ["yuHongRu", "wuzhi"]
];

// 主线各阶段在舆图上的目标区域（金圈指引）
function mainQuestTarget(s: GameState): string | null {
  const qm = s.player.quests.qMain;
  if (qm?.done) return null;
  const stage = qm?.stage ?? 0;
  if (stage <= 0) return "town";
  if (stage === 1) return "houshan";
  if (stage <= 3) return "town";
  if (stage <= 5) return "heifeng";
  if (stage === 6) {
    const next = PLATE_MASTER_AREAS.find(([npcId]) => !s.player.flags[`plate-${npcId}`]);
    return next ? next[1] : "town";
  }
  if (stage === 7) return "town";
  return "end";
}
