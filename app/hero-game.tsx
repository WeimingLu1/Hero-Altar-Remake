"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { attackEffect, type Combatant } from "./game-core/combat";
import { originalCounts, originalData } from "./game-core/original-data";

const W = 640, H = 480, TILE = 32;
type Mode = "title" | "play" | "dialog" | "battle" | "menu" | "help" | "ending";
type Pos = { x: number; y: number };
type Item = { id: string; name: string; kind: "heal" | "qi" | "weapon" | "quest"; value: number; desc: string };
type Enemy = { id: string; name: string; hp: number; maxHp: number; atk: number; def: number; exp: number; silver: number; color: string; boss?: boolean };
type Save = {
  format: "rmxp-hero-web-save"; version: 1; savedAt: string; playTimeSeconds: number;
  player: { name: string; hp: number; maxHp: number; qi: number; maxQi: number; atk: number; def: number; level: number; exp: number; silver: number; weapon: string; pos: Pos; map: string; facing: string };
  inventory: Record<string, number>; skills: Record<string, number>; quests: Record<string, number>; flags: Record<string, boolean>;
};

const ITEMS: Record<string, Item> = {
  herb: { id: "herb", name: "金创药", kind: "heal", value: 38, desc: "恢复三十八点气血。" },
  tea: { id: "tea", name: "凝神茶", kind: "qi", value: 28, desc: "恢复二十八点内力。" },
  sword: { id: "sword", name: "青锋剑", kind: "weapon", value: 5, desc: "铁匠亲制，攻击提高五点。" },
  token: { id: "token", name: "黑风令", kind: "quest", value: 0, desc: "黑风寨主随身携带的令牌。" },
};

const MAPS: Record<string, { name: string; tint: string; seed: number; walls: Pos[]; doors: Array<Pos & { to: string; tx: number; ty: number; label: string }>; npcs: Array<Pos & { id: string; name: string; color: string }> }> = {
  town: { name: "平安镇", tint: "#668654", seed: 11, walls: [], doors: [
    { x: 1, y: 7, to: "home", tx: 17, ty: 7, label: "归家" }, { x: 18, y: 7, to: "forest", tx: 1, ty: 7, label: "镇外竹林" }, { x: 10, y: 1, to: "temple", tx: 10, ty: 12, label: "少林山门" },
  ], npcs: [{ x: 7, y: 7, id: "elder", name: "老管家", color: "#d7c39e" }, { x: 13, y: 9, id: "smith", name: "铁匠", color: "#c66d45" }, { x: 10, y: 5, id: "girl", name: "茶馆阿秀", color: "#e998b4" }] },
  home: { name: "故居", tint: "#847058", seed: 29, walls: [], doors: [{ x: 18, y: 7, to: "town", tx: 2, ty: 7, label: "平安镇" }], npcs: [{ x: 8, y: 6, id: "bed", name: "木床", color: "#8a5236" }] },
  forest: { name: "十里竹林", tint: "#315d43", seed: 47, walls: [], doors: [{ x: 0, y: 7, to: "town", tx: 17, ty: 7, label: "平安镇" }, { x: 19, y: 7, to: "camp", tx: 1, ty: 7, label: "黑风寨" }], npcs: [{ x: 8, y: 5, id: "bandit", name: "拦路山贼", color: "#7c3934" }, { x: 14, y: 10, id: "hermit", name: "竹林隐士", color: "#b7bf9c" }] },
  camp: { name: "黑风寨", tint: "#5a4336", seed: 63, walls: [], doors: [{ x: 0, y: 7, to: "forest", tx: 18, ty: 7, label: "十里竹林" }], npcs: [{ x: 13, y: 7, id: "boss", name: "黑风寨主", color: "#5c1f28" }] },
  temple: { name: "少林山门", tint: "#93845b", seed: 89, walls: [], doors: [{ x: 10, y: 13, to: "town", tx: 10, ty: 2, label: "平安镇" }], npcs: [{ x: 10, y: 5, id: "monk", name: "慧空禅师", color: "#d39b43" }] },
};

const freshSave = (): Save => ({
  format: "rmxp-hero-web-save", version: 1, savedAt: new Date().toISOString(), playTimeSeconds: 0,
  player: { name: "少侠", hp: 100, maxHp: 100, qi: 60, maxQi: 60, atk: 13, def: 6, level: 1, exp: 0, silver: 40, weapon: "木剑", pos: { x: 5, y: 8 }, map: "town", facing: "down" },
  inventory: { herb: 2, tea: 1 }, skills: { 基本拳脚: 1, 基本内功: 1, 基本轻功: 1 }, quests: { blackwind: 0 }, flags: {},
});

function mulberry32(seed: number) { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function expNeed(level: number) { return level * level * 55; }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

export default function HeroGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<Save>(freshSave());
  const modeRef = useRef<Mode>("title");
  const keys = useRef(new Set<string>());
  const held = useRef<Record<string, number>>({});
  const battleRef = useRef<Enemy | null>(null);
  const messagesRef = useRef<string[]>([]);
  const battleLog = useRef<string[]>([]);
  const startedAt = useRef(0);
  const [mode, setModeState] = useState<Mode>("title");
  const [save, setSaveState] = useState<Save>(freshSave);
  const [messages, setMessages] = useState<string[]>([]);
  const [battleMessages, setBattleMessages] = useState<string[]>([]);
  const [hasLocalSave] = useState(() => typeof window !== "undefined" && !!localStorage.getItem("hero-save-v1"));
  const [menuTab, setMenuTab] = useState(0);
  const [toast, setToast] = useState("准备就绪");

  const syncSave = useCallback((next: Save) => { saveRef.current = next; setSaveState(structuredClone(next)); }, []);
  const setMode = useCallback((next: Mode) => { modeRef.current = next; setModeState(next); }, []);
  const say = useCallback((lines: string[]) => { messagesRef.current = lines; setMessages(lines); setMode("dialog"); }, [setMode]);
  const persist = useCallback((announce = true) => {
    const next = { ...saveRef.current, savedAt: new Date().toISOString(), playTimeSeconds: saveRef.current.playTimeSeconds + Math.floor((Date.now() - startedAt.current) / 1000) };
    startedAt.current = Date.now(); syncSave(next); localStorage.setItem("hero-save-v1", JSON.stringify(next)); if (announce) setToast("已保存到这台设备");
  }, [syncSave]);

  const start = useCallback((continueGame: boolean) => {
    const raw = continueGame ? localStorage.getItem("hero-save-v1") : null;
    let next = freshSave();
    if (raw) { try { next = JSON.parse(raw); } catch { /* use fresh */ } }
    syncSave(next); setMode("play"); setToast(continueGame && raw ? "旧梦重温" : "踏入江湖");
  }, [setMode, syncSave]);

  const addItem = useCallback((id: string, amount = 1) => {
    const s = structuredClone(saveRef.current); s.inventory[id] = (s.inventory[id] || 0) + amount; syncSave(s);
  }, [syncSave]);

  const levelCheck = useCallback((s: Save) => {
    while (s.player.exp >= expNeed(s.player.level)) { s.player.exp -= expNeed(s.player.level); s.player.level++; s.player.maxHp += 18; s.player.maxQi += 10; s.player.atk += 3; s.player.def += 2; s.player.hp = s.player.maxHp; s.player.qi = s.player.maxQi; setToast(`突破！境界提升至 ${s.player.level} 级`); }
  }, []);

  const beginBattle = useCallback((kind: "bandit" | "boss") => {
    const lv = saveRef.current.player.level;
    const e: Enemy = kind === "boss"
      ? { id: "boss", name: "黑风寨主", hp: 145, maxHp: 145, atk: 18, def: 8, exp: 120, silver: 88, color: "#9b2838", boss: true }
      : { id: "bandit", name: "拦路山贼", hp: 50 + lv * 6, maxHp: 50 + lv * 6, atk: 10 + lv, def: 3 + lv, exp: 38, silver: 18, color: "#843d38" };
    battleRef.current = e; battleLog.current = [`${e.name} 挡住了去路！`]; setBattleMessages([...battleLog.current]); setMode("battle");
  }, [setMode]);

  const interact = useCallback(() => {
    const s = saveRef.current, map = MAPS[s.player.map];
    const d: Record<string, Pos> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const v = d[s.player.facing] || d.down; const tx = s.player.pos.x + v.x, ty = s.player.pos.y + v.y;
    const npc = map.npcs.find(n => n.x === tx && n.y === ty); if (!npc) { setToast("风吹过，四下无人回应"); return; }
    if (npc.id === "elder") {
      if (s.quests.blackwind === 0) { const n = structuredClone(s); n.quests.blackwind = 1; syncSave(n); say(["老管家：镇外黑风寨近来为祸乡里。", "你若愿去查探，切记先找铁匠备一把趁手兵器。", "任务开启：黑风之患"]); }
      else if (s.quests.blackwind === 2 && (s.inventory.token || 0) > 0) { const n = structuredClone(s); n.quests.blackwind = 3; n.inventory.token--; n.player.silver += 150; n.player.exp += 100; levelCheck(n); syncSave(n); say(["老管家接过令牌，长出一口气。", "平安镇终于能睡个安稳觉了。", "任务完成：获得一百五十两、阅历一百。"]); }
      else say([s.quests.blackwind >= 3 ? "老管家：江湖路远，莫忘初心。" : "老管家：黑风寨就在竹林深处，小心行事。"]);
    } else if (npc.id === "smith") {
      if (!s.flags.sword && s.quests.blackwind >= 1) { const n = structuredClone(s); n.flags.sword = true; n.player.weapon = "青锋剑"; n.player.atk += 5; syncSave(n); addItem("sword"); say(["铁匠：这柄青锋剑赠你防身。", "装备青锋剑，攻击提高五点。"]); }
      else say(["铁匠：好兵器也要配得上好功夫。"]);
    } else if (npc.id === "girl") { const n = structuredClone(s); n.player.qi = n.player.maxQi; syncSave(n); say(["阿秀斟上一盏热茶。", "茶香入喉，你的内力完全恢复了。"]); }
    else if (npc.id === "bed") { const n = structuredClone(s); n.player.hp = n.player.maxHp; n.player.qi = n.player.maxQi; syncSave(n); persist(false); say(["你在旧木床上沉沉睡去。", "气血、内力恢复，游戏已自动保存。"]); }
    else if (npc.id === "bandit") { if (s.flags.bandit) say(["地上只剩一柄折断的朴刀。"]); else beginBattle("bandit"); }
    else if (npc.id === "boss") { if (s.flags.boss) say(["黑风寨大旗已经倒下。"]); else if (!s.flags.bandit) say(["寨主冷笑：连守门的都没过，也敢来送死？"]); else beginBattle("boss"); }
    else if (npc.id === "hermit") { if (!s.flags.palm) { const n = structuredClone(s); n.flags.palm = true; n.skills["落叶掌"] = 1; syncSave(n); say(["隐士见你根骨清奇，传下一式落叶掌。", "战斗中按 2 可消耗十二点内力施展。"]); } else say(["竹林隐士：落叶无心，人亦当如此。"]); }
    else if (npc.id === "monk") { if (s.quests.blackwind >= 3 && !s.flags.meditate) { const n = structuredClone(s); n.flags.meditate = true; n.skills["基本内功"] += 2; n.player.maxQi += 20; n.player.qi = n.player.maxQi; syncSave(n); say(["慧空禅师：能除暴而不矜，善哉。", "禅师为你讲解吐纳法，基本内功提升两级。"]); } else say(["慧空禅师：一呼一吸，皆是修行。"]); }
  }, [addItem, beginBattle, levelCheck, persist, say, syncSave]);

  const move = useCallback((dx: number, dy: number) => {
    if (modeRef.current !== "play") return; const s = structuredClone(saveRef.current); const map = MAPS[s.player.map];
    s.player.facing = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : "down";
    const nx = clamp(s.player.pos.x + dx, 0, 19), ny = clamp(s.player.pos.y + dy, 1, 13);
    if (!map.npcs.some(n => n.x === nx && n.y === ny)) { s.player.pos = { x: nx, y: ny }; const door = map.doors.find(d => d.x === nx && d.y === ny); if (door) { s.player.map = door.to; s.player.pos = { x: door.tx, y: door.ty }; setToast(`抵达 · ${MAPS[door.to].name}`); } syncSave(s); }
  }, [syncSave]);

  const battleAction = useCallback((type: "attack" | "skill" | "heal" | "flee") => {
    const enemy = battleRef.current; if (!enemy || modeRef.current !== "battle") return; const s = structuredClone(saveRef.current); let playerDmg = 0;
    if (type === "flee" && !enemy.boss) { battleLog.current = ["你虚晃一招，脱离了战斗。", ...battleLog.current].slice(0, 5); setBattleMessages([...battleLog.current]); setMode("play"); return; }
    if (type === "heal") { if ((s.inventory.herb || 0) <= 0) { battleLog.current.unshift("行囊里没有金创药。"); setBattleMessages([...battleLog.current]); return; } s.inventory.herb--; const heal = Math.min(38, s.player.maxHp - s.player.hp); s.player.hp += heal; battleLog.current.unshift(`服下金创药，恢复 ${heal} 点气血。`); }
    else if (type === "skill") { if (!s.skills["落叶掌"]) { battleLog.current.unshift("你还没有学会可用的绝招。"); setBattleMessages([...battleLog.current]); return; } if (s.player.qi < 12) { battleLog.current.unshift("内力不足，无法施展落叶掌。"); setBattleMessages([...battleLog.current]); return; } s.player.qi -= 12; playerDmg = Math.max(5, s.player.atk * 2 + s.skills["落叶掌"] * 4 - enemy.def); enemy.hp -= playerDmg; battleLog.current.unshift(`落叶掌劲穿林而过，造成 ${playerDmg} 点伤害！`); }
    else if (type === "attack") {
      const attacker = playerCombatant(s);
      const result = attackEffect(attacker, enemyCombatant(enemy, s.player.level), max => Math.floor(Math.random() * max));
      s.player.qi = attacker.fp;
      if (typeof result.damage === "number") {
        playerDmg = result.damage;
        enemy.hp -= playerDmg;
        battleLog.current.unshift(`你挥动${s.player.weapon}，造成 ${playerDmg} 点伤害${result.hurt > 0 ? `，并留下 ${result.hurt} 点外伤` : ""}。`);
      } else {
        const reason = result.damage === "Miss.1" ? "被对方以轻功避开" : result.damage === "Miss.2" ? "被对方招架" : "被虚影挡下";
        battleLog.current.unshift(`这一招${reason}。`);
      }
    }
    if (enemy.hp <= 0) { s.player.exp += enemy.exp; s.player.silver += enemy.silver; s.flags[enemy.id] = true; if (enemy.boss) { s.quests.blackwind = 2; s.inventory.token = (s.inventory.token || 0) + 1; battleLog.current.unshift("你取得了黑风令！回平安镇复命。", `击败${enemy.name}，获得阅历 ${enemy.exp}、银两 ${enemy.silver}。`); } else battleLog.current.unshift(`击败${enemy.name}，获得阅历 ${enemy.exp}、银两 ${enemy.silver}。`); setBattleMessages([...battleLog.current]); levelCheck(s); syncSave(s); setTimeout(() => { setMode("play"); setToast(enemy.boss ? "黑风寨已破，回镇复命" : "首战告捷"); }, 900); return; }
    const enemyDmg = Math.max(1, enemy.atk + Math.floor(Math.random() * 4) - s.player.def); s.player.hp -= enemyDmg; battleLog.current.unshift(`${enemy.name}反击，造成 ${enemyDmg} 点伤害。`); battleLog.current = battleLog.current.slice(0, 5); setBattleMessages([...battleLog.current]);
    if (s.player.hp <= 0) { s.player.hp = Math.ceil(s.player.maxHp / 2); s.player.qi = Math.ceil(s.player.maxQi / 2); s.player.map = "home"; s.player.pos = { x: 12, y: 7 }; s.player.silver = Math.max(0, s.player.silver - 10); setMode("play"); setToast("你被路人救回家中，损失十两"); }
    syncSave(s);
  }, [levelCheck, setMode, syncSave]);

  const consumeItem = useCallback((id: string) => { const item = ITEMS[id], s = structuredClone(saveRef.current); if (!item || !s.inventory[id] || item.kind === "quest" || item.kind === "weapon") return; if (item.kind === "heal") s.player.hp = Math.min(s.player.maxHp, s.player.hp + item.value); else s.player.qi = Math.min(s.player.maxQi, s.player.qi + item.value); s.inventory[id]--; syncSave(s); setToast(`使用了${item.name}`); }, [syncSave]);

  const exportSave = useCallback(() => { persist(false); const blob = new Blob([JSON.stringify(saveRef.current, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `英雄坛说-${saveRef.current.player.name}-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); setToast("JSON 存档已下载"); }, [persist]);
  const importSave = useCallback(async (file?: File) => { if (!file) return; try { const data = JSON.parse(await file.text()); if (data.format !== "rmxp-hero-web-save" || data.version !== 1 || !MAPS[data.player?.map]) throw new Error(); syncSave(data); localStorage.setItem("hero-save-v1", JSON.stringify(data)); setMode("play"); setToast("JSON 存档读取成功"); } catch { setToast("无法读取：存档格式或地图编号无效"); } }, [setMode, syncSave]);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (["arrowup","arrowdown","arrowleft","arrowright"," ","tab"].includes(k)) e.preventDefault(); if (e.repeat && !["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) return; keys.current.add(k);
      const m = modeRef.current;
      if (m === "title") { if (k === "enter" || k === "z" || k === " ") start(!!localStorage.getItem("hero-save-v1")); else if (k === "n") start(false); else if (k === "l") fileRef.current?.click(); else if(k === "o") location.href="/original"; }
      else if (m === "dialog") { if (["z","enter"," ","x","escape"].includes(k)) { const rest = messagesRef.current.slice(1); messagesRef.current = rest; setMessages(rest); if (!rest.length) setMode("play"); } }
      else if (m === "battle") { if (k === "1" || k === "z" || k === "enter") battleAction("attack"); else if (k === "2") battleAction("skill"); else if (k === "3") battleAction("heal"); else if (k === "4" || k === "x" || k === "escape") battleAction("flee"); }
      else if (m === "menu") { if (["x","escape","c","tab"].includes(k)) setMode("play"); }
      else if (m === "help") { if (["x","escape","?"].includes(k)) setMode("play"); }
      else if (m === "play") { if (["z","enter"," "].includes(k)) interact(); else if (["x","escape","c","tab"].includes(k)) setMode("menu"); else if (k === "f") persist(); else if (k === "?") setMode("help"); }
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); delete held.current[e.key.toLowerCase()]; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [battleAction, interact, persist, setMode, start]);

  useEffect(() => { const id = setInterval(() => { if (modeRef.current !== "play") return; const now = Date.now(); const moves: Array<[string[],number,number]> = [[["w","arrowup"],0,-1],[["s","arrowdown"],0,1],[["a","arrowleft"],-1,0],[["d","arrowright"],1,0]]; for (const [ks,dx,dy] of moves) { const k = ks.find(x => keys.current.has(x)); if (k && (!held.current[k] || now - held.current[k] > 125)) { held.current[k] = now; move(dx,dy); break; } } }, 32); return () => clearInterval(id); }, [move]);

  useEffect(() => {
    let raf = 0; const render = () => { const c = canvasRef.current, ctx = c?.getContext("2d"); if (!c || !ctx) { raf = requestAnimationFrame(render); return; } ctx.imageSmoothingEnabled = false; drawWorld(ctx, saveRef.current, modeRef.current, battleRef.current, battleLog.current); raf = requestAnimationFrame(render); }; render(); return () => cancelAnimationFrame(raf);
  }, []);

  return <main className="game-shell">
    <section className="masthead"><div><span className="seal">侠</span><h1>英雄坛说 <small>云游志</small></h1></div><p>像素重绘 · 浏览器移植版</p></section>
    <section className="cabinet">
      <div className="screen-wrap"><canvas ref={canvasRef} width={W} height={H} aria-label="英雄坛说游戏画面" />
        {mode === "title" && <div className="title-overlay"><div className="mountains"/><div className="title-copy"><b>英雄坛说</b><span>云 游 志</span></div><div className="title-actions"><button onClick={() => start(hasLocalSave)}>{hasLocalSave ? "继续江湖" : "初入江湖"}<kbd>Enter</kbd></button><button onClick={() => start(false)}>新开一局 <kbd>N</kbd></button><button onClick={() => location.href="/original"}>原版世界 <kbd>O</kbd></button><button onClick={() => fileRef.current?.click()}>读取 JSON <kbd>L</kbd></button></div></div>}
        {mode === "dialog" && <button className="dialog" onClick={() => { const rest = messages.slice(1); messagesRef.current = rest; setMessages(rest); if (!rest.length) setMode("play"); }}><span>{messages[0]}</span><i>▼</i></button>}
        {mode === "battle" && <div className="battle-ui"><div className="battle-log">{battleMessages.map((x,i)=><p key={`${x}-${i}`}>{x}</p>)}</div><div className="battle-actions"><button onClick={()=>battleAction("attack")}>1 普通攻击</button><button onClick={()=>battleAction("skill")}>2 落叶掌</button><button onClick={()=>battleAction("heal")}>3 金创药</button><button onClick={()=>battleAction("flee")}>4 脱离</button></div></div>}
        {mode === "menu" && <div className="menu-panel"><nav>{["人物","行囊","武学","任务","存档","原典"].map((x,i)=><button className={menuTab===i?"active":""} onClick={()=>setMenuTab(i)} key={x}>{x}</button>)}</nav><div className="menu-content">{menuTab===0&&<Status s={save}/>} {menuTab===1&&<Inventory s={save} consumeItem={consumeItem}/>} {menuTab===2&&<Skills s={save}/>} {menuTab===3&&<Quests s={save}/>} {menuTab===4&&<div className="save-actions"><button onClick={()=>persist()}>保存到设备</button><button onClick={exportSave}>下载 JSON</button><button onClick={()=>fileRef.current?.click()}>读取 JSON</button><p>存档为明文 JSON，可用文本编辑器修改。读取时会校验基本结构。</p></div>} {menuTab===5&&<Codex/>}</div><button className="close" onClick={()=>setMode("play")}>×</button></div>}
        {mode === "help" && <div className="help-panel"><h2>键盘操作</h2><div><kbd>WASD</kbd><span>移动</span><kbd>方向键</kbd><span>移动</span><kbd>Z / Enter</kbd><span>确认、交互</span><kbd>X / Esc</kbd><span>返回</span><kbd>C / Tab</kbd><span>人物菜单</span><kbd>F</kbd><span>快速保存</span></div><button onClick={()=>setMode("play")}>返回江湖</button></div>}
      </div>
      <aside className="hud"><div><span>境界</span><strong>{save.player.level}</strong></div><Bar label="气血" value={save.player.hp} max={save.player.maxHp} color="#c44747"/><Bar label="内力" value={save.player.qi} max={save.player.maxQi} color="#4e87b8"/><div className="hud-row"><span>兵器</span><b>{save.player.weapon}</b></div><div className="hud-row"><span>银两</span><b>{save.player.silver}</b></div><div className="hud-row"><span>所在</span><b>{MAPS[save.player.map].name}</b></div><div className="quest-pin"><small>当前目标</small><b>{questText(save)}</b></div><button className="key-help" onClick={()=>setMode("help")}>? 按键说明</button></aside>
    </section>
    <footer><span className="pulse"/> {toast}<span className="spacer"/>移动 <kbd>WASD</kbd> · 交互 <kbd>Z</kbd> · 菜单 <kbd>C</kbd></footer>
    <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={e=>{void importSave(e.target.files?.[0]); e.target.value="";}}/>
  </main>;
}

function Bar({label,value,max,color}:{label:string;value:number;max:number;color:string}) { return <div className="bar"><span>{label}</span><div><i style={{width:`${Math.max(0,value/max*100)}%`,background:color}}/></div><b>{value}/{max}</b></div>; }
function Status({s}:{s:Save}) { return <div className="status-grid"><span>姓名</span><b>{s.player.name}</b><span>等级</span><b>{s.player.level}</b><span>阅历</span><b>{s.player.exp}/{expNeed(s.player.level)}</b><span>攻击</span><b>{s.player.atk}</b><span>防御</span><b>{s.player.def}</b><span>兵器</span><b>{s.player.weapon}</b><span>银两</span><b>{s.player.silver}</b><span>游历</span><b>{Math.floor(s.playTimeSeconds/60)} 分钟</b></div>; }
function Inventory({s,consumeItem}:{s:Save;consumeItem:(id:string)=>void}) { const list=Object.entries(s.inventory).filter(([,n])=>n>0); return <div className="item-list">{list.length?list.map(([id,n])=><button key={id} onClick={()=>consumeItem(id)}><i className={`item-icon ${id}`}/><span><b>{ITEMS[id]?.name||id} × {n}</b><small>{ITEMS[id]?.desc}</small></span></button>):<p>行囊空空。</p>}</div>; }
function Skills({s}:{s:Save}) { return <div className="skill-list">{Object.entries(s.skills).map(([name,lv])=><div key={name}><i/><span><b>{name}</b><small>{name==="落叶掌"?"掌风如秋叶，消耗内力造成双倍伤害。":"江湖基础修为。"}</small></span><em>Lv.{lv}</em></div>)}</div>; }
function Quests({s}:{s:Save}) { return <div className="quest-list"><h3>黑风之患</h3><p>{questText(s)}</p><ol><li className={s.quests.blackwind>=1?"done":""}>听老管家讲述镇外异动</li><li className={s.flags.bandit?"done":""}>穿过十里竹林</li><li className={s.quests.blackwind>=2?"done":""}>击败黑风寨主</li><li className={s.quests.blackwind>=3?"done":""}>携黑风令回镇复命</li></ol></div>; }
function Codex() { return <div className="codex"><p>已载入原版数据库</p><div className="codex-counts"><span>武学 <b>{originalCounts.kungfus}</b></span><span>绝招 <b>{originalCounts.skills}</b></span><span>物品 <b>{originalCounts.items}</b></span><span>武器 <b>{originalCounts.weapons}</b></span><span>防具 <b>{originalCounts.armors}</b></span><span>人物 <b>{originalCounts.enemies}</b></span></div><h3>武学总览</h3><div className="codex-list">{originalData.kungfus.map((item,index)=><span key={`${item.name}-${index}`}>{item.name}</span>)}</div></div>; }
function questText(s:Save) { const q=s.quests.blackwind; if(q===0)return"去找镇中的老管家谈谈";if(q===1&&!s.flags.sword)return"向镇东铁匠讨一柄趁手兵器";if(q===1&&!s.flags.bandit)return"由镇东进入竹林，击退拦路山贼";if(q===1)return"深入竹林，剿灭黑风寨";if(q===2)return"把黑风令交给老管家";return s.flags.meditate?"江湖任你行" : "前往少林山门拜访慧空禅师"; }

function playerCombatant(s: Save): Combatant {
  const level = s.player.level;
  const fist = s.skills["基本拳脚"] || 1;
  const dodge = s.skills["基本轻功"] || 1;
  return { exp:s.player.exp + level*100, hit:level*3, eva:level*2, attackKfLv:fist, dodgeKfLv:dodge, parryKfLv:fist, agi:30+level, int:30+level, str:30+level*2, atk:s.player.atk, pdef:s.player.def, fp:s.player.qi, fpPlus:0, weaponId:s.player.weapon==="木剑"?1:2, movable:true, fenshen:-1, kfAp:0, kfDp:0, kfPp:0, kfDamage:0, kfForce:0, hitType:0 };
}
function enemyCombatant(enemy: Enemy, level: number): Combatant {
  return { exp:enemy.maxHp*100, hit:level*3+5, eva:level*2+3, attackKfLv:level*4, dodgeKfLv:level*3, parryKfLv:level*3, agi:30+level, int:30, str:30+level*2, atk:enemy.atk, pdef:enemy.def, fp:40+level*10, fpPlus:0, weaponId:1, movable:true, fenshen:-1, kfAp:0, kfDp:0, kfPp:0, kfDamage:0, kfForce:0, hitType:0 };
}

function drawWorld(ctx:CanvasRenderingContext2D,s:Save,mode:Mode,enemy:Enemy|null,log:string[]) {
  ctx.fillStyle="#111913";ctx.fillRect(0,0,W,H); const map=MAPS[s.player.map]; const rand=mulberry32(map.seed);
  for(let y=0;y<15;y++)for(let x=0;x<20;x++){const n=rand();ctx.fillStyle=shade(map.tint,(n-.5)*24);ctx.fillRect(x*TILE,y*TILE,TILE,TILE);ctx.fillStyle=n>.72?"rgba(255,255,255,.04)":"rgba(0,0,0,.05)";ctx.fillRect(x*TILE+(x*7+y*3)%24,y*TILE+(x*3+y*11)%24,3,3);}
  if(s.player.map==="town") drawTown(ctx); else if(s.player.map==="home") drawHome(ctx); else if(s.player.map==="forest") drawForest(ctx,47); else if(s.player.map==="camp") drawCamp(ctx); else drawTemple(ctx);
  for(const d of map.doors){ctx.fillStyle="#d8bd70";ctx.fillRect(d.x*TILE+12,d.y*TILE+12,8,8);ctx.fillStyle="rgba(20,24,18,.82)";ctx.fillRect(d.x*TILE-18,d.y*TILE-15,68,16);ctx.fillStyle="#f1dfae";ctx.font="11px monospace";ctx.textAlign="center";ctx.fillText(d.label,d.x*TILE+16,d.y*TILE-3);}
  for(const n of map.npcs){if((n.id==="bandit"&&s.flags.bandit)||(n.id==="boss"&&s.flags.boss))continue;drawPerson(ctx,n.x*TILE+16,n.y*TILE+23,n.color,n.id==="boss");ctx.fillStyle="rgba(10,15,12,.75)";ctx.fillRect(n.x*TILE-10,n.y*TILE-12,52,14);ctx.fillStyle="#fff0c2";ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(n.name,n.x*TILE+16,n.y*TILE-2);}
  if(mode!=="battle")drawPerson(ctx,s.player.pos.x*TILE+16,s.player.pos.y*TILE+23,"#d8e4ec",false,true);
  ctx.fillStyle="rgba(7,13,10,.65)";ctx.fillRect(0,0,W,32);ctx.fillStyle="#f5e8be";ctx.font="bold 16px sans-serif";ctx.textAlign="left";ctx.fillText(map.name,16,21);ctx.font="11px monospace";ctx.fillStyle="#c8b98d";ctx.textAlign="right";ctx.fillText("云游历 · 甲辰",W-16,20);
  if(mode==="battle"&&enemy){ctx.fillStyle="rgba(13,12,15,.82)";ctx.fillRect(0,32,W,H-32);for(let i=0;i<50;i++){ctx.fillStyle=`rgba(220,170,100,${(i%7)/90})`;ctx.fillRect((i*83)%W,50+(i*47)%(H-80),2,2)}drawPerson(ctx,190,235,"#d8e4ec",false,true,3);drawPerson(ctx,450,220,enemy.color,!!enemy.boss,false,3);drawBattleBar(ctx,380,72,enemy.name,enemy.hp,enemy.maxHp,"#b33f4a");drawBattleBar(ctx,48,338,s.player.name,s.player.hp,s.player.maxHp,"#4d94bd");ctx.fillStyle="#d8c69b";ctx.font="13px sans-serif";ctx.textAlign="center";ctx.fillText(enemy.boss?"寨中旗影翻飞，杀气迫人":"竹叶随杀意飞旋",W/2,55);void log;}
}
function shade(hex:string,amount:number){const n=parseInt(hex.slice(1),16),r=clamp((n>>16)+amount,0,255),g=clamp((n>>8&255)+amount,0,255),b=clamp((n&255)+amount,0,255);return `rgb(${r},${g},${b})`;}
function drawPerson(ctx:CanvasRenderingContext2D,x:number,y:number,color:string,big=false,hero=false,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);if(hero){ctx.fillStyle="rgba(0,0,0,.25)";ctx.fillRect(-9,5,18,4);}ctx.fillStyle=big?"#31151c":"#29241e";ctx.fillRect(-8,-13,16,9);ctx.fillStyle="#e0b88e";ctx.fillRect(-6,-16,12,10);ctx.fillStyle=color;ctx.fillRect(-9,-7,18,14);ctx.fillStyle=hero?"#657f97":"#4c3d32";ctx.fillRect(-9,7,7,7);ctx.fillRect(2,7,7,7);ctx.fillStyle="#111";ctx.fillRect(-3,-13,2,2);ctx.fillRect(3,-13,2,2);if(big){ctx.fillStyle="#d8ac55";ctx.fillRect(-11,-7,3,18);ctx.fillRect(8,-7,3,18);}ctx.restore();}
function drawTown(ctx:CanvasRenderingContext2D){for(const [x,y,w,c] of [[2,2,5,"#7f4935"],[12,2,5,"#6f4134"],[3,9,5,"#8a5737"],[12,10,6,"#704438"]] as const){ctx.fillStyle="#d7bf8f";ctx.fillRect(x*TILE,y*TILE,w*TILE,64);ctx.fillStyle=c;for(let i=-1;i<w+1;i++)ctx.fillRect((x+i)*TILE,y*TILE-10+(i%2)*4,TILE+2,18);ctx.fillStyle="#523629";ctx.fillRect((x+Math.floor(w/2))*TILE,y*TILE+32,24,32);}ctx.fillStyle="#cbb27c";ctx.fillRect(9*TILE,1*TILE,2*TILE,12*TILE);for(let y=2;y<13;y++){ctx.fillStyle=y%2?"#aa9366":"#b9a273";ctx.fillRect(9*TILE,y*TILE,64,30);}}
function drawHome(ctx:CanvasRenderingContext2D){ctx.fillStyle="#bea476";ctx.fillRect(2*TILE,2*TILE,16*TILE,11*TILE);ctx.fillStyle="#654633";ctx.fillRect(2*TILE,2*TILE,16*TILE,10);for(let x=3;x<18;x+=3){ctx.fillStyle="#866147";ctx.fillRect(x*TILE,3*TILE,8,9*TILE)}ctx.fillStyle="#8a5236";ctx.fillRect(7*TILE,5*TILE,3*TILE,2*TILE);ctx.fillStyle="#d6c19b";ctx.fillRect(7*TILE,5*TILE,3*TILE,18);}
function drawForest(ctx:CanvasRenderingContext2D,seed:number){const r=mulberry32(seed);for(let i=0;i<60;i++){const x=Math.floor(r()*20)*TILE+16,y=Math.floor(r()*14+1)*TILE+16;if(y>6*TILE&&y<9*TILE)continue;ctx.fillStyle="#183c2b";ctx.fillRect(x-3,y-22,6,32);ctx.fillStyle=i%3?"#477d52":"#5b8e58";ctx.fillRect(x-9,y-28,18,9);ctx.fillRect(x-7,y-38,14,12);}}
function drawCamp(ctx:CanvasRenderingContext2D){for(let x=2;x<19;x+=4){ctx.fillStyle="#3a2722";ctx.fillRect(x*TILE,2*TILE,7,11*TILE);ctx.fillStyle="#d0b171";ctx.fillRect(x*TILE-4,2*TILE,15,10);}ctx.fillStyle="#1f1a18";ctx.fillRect(10*TILE,3*TILE,7*TILE,5*TILE);ctx.fillStyle="#7d2730";ctx.fillRect(11*TILE,4*TILE,5*TILE,3*TILE);ctx.fillStyle="#e2c06e";ctx.font="bold 28px serif";ctx.textAlign="center";ctx.fillText("義",13.5*TILE,6*TILE);}
function drawTemple(ctx:CanvasRenderingContext2D){ctx.fillStyle="#d2bd83";ctx.fillRect(5*TILE,2*TILE,10*TILE,8*TILE);ctx.fillStyle="#753d31";ctx.fillRect(4*TILE,2*TILE,12*TILE,18);ctx.fillStyle="#b77939";for(let x=5;x<16;x++)ctx.fillRect(x*TILE,2*TILE-(x%2)*4,TILE,9);ctx.fillStyle="#4c3027";ctx.fillRect(9*TILE,6*TILE,2*TILE,4*TILE);ctx.fillStyle="#d3a84e";ctx.font="bold 22px serif";ctx.textAlign="center";ctx.fillText("禅",10*TILE,5*TILE);}
function drawBattleBar(ctx:CanvasRenderingContext2D,x:number,y:number,name:string,hp:number,max:number,color:string){ctx.fillStyle="rgba(8,10,9,.85)";ctx.fillRect(x,y,210,42);ctx.fillStyle="#f3e5ba";ctx.font="bold 13px sans-serif";ctx.textAlign="left";ctx.fillText(name,x+8,y+15);ctx.fillStyle="#302b2b";ctx.fillRect(x+8,y+24,194,9);ctx.fillStyle=color;ctx.fillRect(x+8,y+24,194*Math.max(0,hp/max),9);ctx.textAlign="right";ctx.font="10px monospace";ctx.fillText(`${Math.max(0,hp)} / ${max}`,x+200,y+15);}
