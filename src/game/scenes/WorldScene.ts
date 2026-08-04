import Phaser from "phaser";
import { getApp } from "../bus";
import { AREAS, ROOMS, areaDef, roomDef } from "../content/areas";
import { enemyDef } from "../content/enemies";
import { NPCS, npcDef } from "../content/npcs";
import { getNpcDialog, randomChatText, randomEncounterEvent } from "../content/story";
import type { BuildingDef, RoomDef } from "../content/types";
import { buildingTexSize, npcScaleHint, visualForEnemy, visualForNpc, type CharVisual } from "../view/art";
import { dayTint, moonArc, nightness, sunArc } from "../view/daynight";
import { enemyAvailable, leaveRoom, meditateTick, travelTo } from "../sim/actions";
import { candidatePairs, lifeCtxFrom, pickRelationBeats, relationPairKey, type LifeBeat } from "../sim/npcLife";
import type { NpcRelation } from "../content/relations";
import type { GameState } from "../sim/state";

const GROUND_Y = 470;
// 角色脚底贴地线（人形精灵中心在 GROUND_Y、脚底 24px 下）
const FOOT_Y = GROUND_Y + 24;

interface EnemyWalker {
  sprite: Phaser.GameObjects.Sprite;
  defX: number;
  speed: number;
  dir: number;
  id: string;
  v: CharVisual;
  shadow: Phaser.GameObjects.Image;
}

interface NpcWalker {
  sprite: Phaser.GameObjects.Sprite;
  defX: number;
  speed: number;
  dir: number;
  v: CharVisual;
  shadow: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  tx: number;
  pauseUntil: number;
}

// NPC 生活引擎的一场互动演出状态机
interface LifeScript {
  rel: NpcRelation;
  aId: string;
  bId: string;
  beats: LifeBeat[];
  idx: number;
  phase: "approach" | "talk" | "return";
  nextAt: number;
  mid: number;
  watched: boolean;
  bubbles: Phaser.GameObjects.GameObject[];
}

type AmbientKind = "petal" | "leaf" | "rain" | "snow" | "fog" | "sand" | "ember" | "smoke";

interface Ambient {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  kind: AmbientKind;
  tAlpha: number;
  phase: number;
  weather: boolean;
}

interface FrontFog {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  tAlpha: number;
  vx: number;
  phase: number;
}

export class WorldScene extends Phaser.Scene {
  private keys!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };
  private player: Phaser.GameObjects.Sprite | null = null;
  private playerPalette = "male";
  private playerShadow: Phaser.GameObjects.Image | null = null;
  private holders: Phaser.GameObjects.GameObject[] = [];
  private npcSprites = new Map<string, NpcWalker>();
  private enemyWalkers: EnemyWalker[] = [];
  private buildings: { def: BuildingDef; image: Phaser.GameObjects.Image }[] = [];
  private exits: { x: number; w: number; label: string; area: string; room?: string }[] = [];
  private interactables: { x: number; w: number; label: string; action: string }[] = [];
  private meditating = false;
  private meditateAcc = 0;
  private hudAcc = 0;
  private dustAcc = 0;
  private hintGlow: Phaser.GameObjects.Image | null = null;
  private lastChatText = "";
  private battleCooldown = 0;
  private areaId = "";
  private roomId: string | null = null;
  private ambient: Ambient[] = [];
  private weatherOverlay: Phaser.GameObjects.Rectangle | null = null;
  private collectibles: { sprite: Phaser.GameObjects.Image; defX: number; kind: "gold" | "herb"; respawnAt: number }[] = [];
  private chatterAt = 0;
  private chatterNext = 12000;
  // 昼夜系统
  private sun: Phaser.GameObjects.Image | null = null;
  private moon: Phaser.GameObjects.Image | null = null;
  private tintRect: Phaser.GameObjects.Rectangle | null = null;
  private clouds: { img: Phaser.GameObjects.Image; vx: number }[] = [];
  private stars: { img: Phaser.GameObjects.Image; phase: number; speed: number }[] = [];
  private nightLights: { img: Phaser.GameObjects.Image; phase: number; base: number }[] = [];
  private displayHour = 8;
  // 天气 v2
  private weatherFade = 1;
  private renderedWeather = "sunny";
  // 石窟（cave 主题）区域：昼夜系统恒暗，日月星云不入场
  private caveMode = false;
  private lastInteractAt = 0;
  private pendingFrontFog: FrontFog[] = [];
  private splashPool: Phaser.GameObjects.Image[] = [];
  private splashIdx = 0;
  thunderstorm = false;
  private nextBoltAt = 0;
  private fading = false;
  // NPC 生活引擎：定时触发有关系的一对 NPC 走近闲聊
  private lifeScript: LifeScript | null = null;
  private lifeCooldowns = new Map<string, number>();
  private lifeNext = 0;
  private meditateRun = 0;

  constructor() {
    super("World");
  }

  create(): void {
    getApp().world = this;
    const kb = this.input.keyboard!;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    kb.on("keydown-E", () => this.interact());
    kb.on("keydown-ENTER", () => this.interact());
    kb.on("keydown-M", () => getApp().handleAction("map"));
    kb.on("keydown-ESC", () => {
      if (this.meditating) this.toggleMeditate();
      else getApp().handleAction("ui-close");
    });
    kb.on("keydown-F8", () => getApp().handleAction("cheat"));
    for (const [key, action] of [
      ["ONE", "status"],
      ["TWO", "bag"],
      ["THREE", "skill"],
      ["FOUR", "quest"],
      ["FIVE", "meditate"],
      ["SIX", "save"]
    ] as const) {
      kb.on(`keydown-${key}`, () => getApp().handleAction(action));
    }
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.lifeNext = this.time.now + 6000 + Math.random() * 8000;
    this.refresh();
  }

  refresh(): void {
    this.cleanup();
    const s = getApp().state;
    if (!s) {
      this.renderTownBackdrop();
      return;
    }
    const p = s.player;
    this.areaId = p.area;
    this.roomId = p.room;
    this.playerPalette = p.gender === "female" ? "female" : "male";
    this.displayHour = p.time.hour;
    const def = areaDef(this.areaId);
    const room = this.roomId ? roomDef(this.roomId) : null;
    const width = room ? room.width : def.width;
    this.cameras.main.setBounds(0, 0, width, 540);
    this.renderBackground(room ? "temple" : def.theme, width, room ? "room" : "area");
    if (room) this.renderRoom(room, width);
    else this.renderArea(def, width);
    this.player = this.add.sprite(Math.max(40, Math.min(width - 40, p.x)), GROUND_Y, `char-${this.playerPalette}-idle`).setScale(2);
    this.playerShadow = this.add.image(this.player.x, FOOT_Y - 2, "fx-shadow").setScale(1.15, 1);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setFollowOffset(0, 0);
    this.spawnFrontFog(width);
    this.maybeIntro();
    this.refreshHud();
    this.maybeTaohunAmbush(s);
  }

  // 逃婚风波·甲线：护送阿沅进入百花谷时，富商的家丁追了上来（每次进谷触发，直到分出胜负）
  private maybeTaohunAmbush(s: GameState): void {
    const p = s.player;
    if (p.room || p.area !== "baihua") return;
    const qt = p.quests.qTaoHun;
    if (!qt || qt.done || qt.stage !== 1) return;
    getApp().ui.showDialog([
      {
        id: "r",
        speaker: "追兵",
        text: "刚进谷口，身后忽然传来一声断喝：「站住！我家老爷有请小姐回府！」\n\n三五个提棍的家丁从道旁包抄过来，为首一人劈面就是一棍——",
        opts: [{ text: "护住阿沅，动手！", action: "fight:jiading" }]
      }
    ]);
  }

  // 区域/房间切换转场：淡出 → 重渲染 → 淡入
  refreshWithFade(): void {
    if (this.fading) return;
    this.fading = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.refresh();
      this.cameras.main.fadeIn(300, 0, 0, 0);
      this.fading = false;
    });
  }

  focusPlayer(): void {
    if (this.player) this.cameras.main.centerOn(this.player.x, 270);
  }

  toggleMeditate(): void {
    const s = getApp().state;
    if (!s) return;
    this.meditating = !this.meditating;
    this.meditateAcc = 0;
    if (this.meditating) {
      this.meditateRun = 0;
      getApp().ui.showHint("打坐中…… [5] 停止");
    } else {
      getApp().ui.showHint(null);
      // 打坐收功（满 8 秒）有概率触发一段奇遇
      if (this.meditateRun >= 8) getApp().maybeEvent("meditate");
      this.meditateRun = 0;
    }
  }

  update(_time: number, delta: number): void {
    const s = getApp().state;
    if (!s || !this.player) return;
    if (getApp().battle) return;
    if (this.fading) return;
    const dt = delta / 1000;
    const now = this.time.now;
    const width = this.areaDefWidth();
    this.updateDayNight(dt);
    if (!this.roomId && s.player.weather !== this.renderedWeather) {
      this.transitionWeather(s.player.weather);
    }
    if (this.thunderstorm && now >= this.nextBoltAt) {
      this.nextBoltAt = now + 5000 + Math.random() * 9000;
      this.lightning();
    }
    if (this.weatherFade < 1) this.weatherFade = Math.min(1, this.weatherFade + dt);
    this.battleCooldown = Math.max(0, this.battleCooldown - dt);
    const left = this.keys.left.isDown || this.keys.a.isDown;
    const right = this.keys.right.isDown || this.keys.d.isDown;
    const speed = 190;
    let vx = 0;
    if (left) vx -= speed;
    if (right) vx += speed;
    let nx = this.player.x + vx * dt;
    nx = Math.max(20, Math.min(width - 20, nx));
    this.player.x = nx;
    s.player.x = nx;
    if (this.playerShadow) this.playerShadow.x = nx;
    if (vx !== 0) {
      this.player.setFlipX(vx < 0);
      const frame = Math.floor(this.time.now / 180) % 2 === 0 ? "walk" : "walk2";
      this.player.setTexture(`char-${this.playerPalette}-${frame}`);
      this.dustAcc += dt;
      if (this.dustAcc > 0.14) {
        this.dustAcc = 0;
        const dust = this.add
          .image(this.player.x + (Math.random() * 24 - 12), FOOT_Y - 3, "fx-sand")
          .setScale(0.5 + Math.random() * 0.5)
          .setAlpha(0.32);
        this.tweens.add({
          targets: dust,
          x: dust.x + (Math.random() * 30 - 15),
          y: dust.y - 14,
          alpha: 0,
          duration: 480 + Math.random() * 280,
          onComplete: () => dust.destroy()
        });
      }
    } else {
      this.player.setTexture(`char-${this.playerPalette}-idle`);
      this.dustAcc = 0;
    }
    for (const w of this.enemyWalkers) {
      w.sprite.x += w.dir * w.speed * dt;
      if (w.sprite.x > w.defX + 90) w.dir = -1;
      if (w.sprite.x < w.defX - 90) w.dir = 1;
      w.sprite.setFlipX(w.dir < 0);
      w.shadow.x = w.sprite.x;
      const frame = Math.floor(this.time.now / 220) % 2 === 0 ? "walk" : "walk2";
      w.sprite.setTexture(w.v.key(frame));
      if (this.battleCooldown <= 0 && Math.abs(this.player.x - w.sprite.x) < 30) {
        this.battleCooldown = 1;
        getApp().startBattle(w.id);
        return;
      }
    }
    for (const [id, n] of this.npcSprites) {
      n.label.x = n.sprite.x;
      n.label.y = n.sprite.y - 38;
      if (this.lifeScript && (this.lifeScript.aId === id || this.lifeScript.bId === id)) {
        // 参与生活演出：走近/归位途中播行走帧，对话阶段立定（位移由 tween 承担）
        const frame =
          this.lifeScript.phase === "talk" ? "idle" : Math.floor(this.time.now / 240) % 2 === 0 ? "walk" : "walk2";
        n.sprite.setTexture(n.v.key(frame));
        continue;
      }
      if (n.speed <= 0 || this.time.now < n.pauseUntil) {
        n.sprite.setTexture(n.v.key("idle"));
        continue;
      }
      const dx = n.tx - n.sprite.x;
      if (Math.abs(dx) < 4) {
        n.pauseUntil = this.time.now + 300 + Math.random() * 900;
        this.pickNpcTarget(n);
      } else {
        n.dir = dx > 0 ? 1 : -1;
        n.sprite.x += n.dir * n.speed * dt;
        n.sprite.setFlipX(n.dir < 0);
        n.shadow.x = n.sprite.x;
        const frame = Math.floor(this.time.now / 240) % 2 === 0 ? "walk" : "walk2";
        n.sprite.setTexture(n.v.key(frame));
      }
    }
    const fade = this.weatherFade;
    for (const a of this.ambient) {
      const sp = a.sprite;
      if (a.kind === "rain") {
        sp.x += a.vx * dt;
        sp.y += a.vy * dt;
        if (sp.y >= GROUND_Y - 4) {
          this.splashAt(sp.x);
          sp.y = -20 - Math.random() * 80;
          sp.x = Math.random() * width;
        }
        if (sp.x < -20) sp.x = width + 10;
      } else if (a.kind === "snow") {
        sp.x += (a.vx + Math.sin(now / 700 + a.phase) * 14) * dt;
        sp.y += a.vy * dt;
        sp.rotation += dt * 0.8;
        if (sp.y >= GROUND_Y - 2) {
          sp.y = -10;
          sp.x = Math.random() * width;
        }
        if (sp.x < -20) sp.x = width + 10;
        if (sp.x > width + 20) sp.x = -10;
      } else if (a.kind === "fog") {
        sp.x += a.vx * dt;
        if (a.vx > 0 && sp.x > width + 320) sp.x = -320;
        if (a.vx < 0 && sp.x < -320) sp.x = width + 320;
        sp.setAlpha(a.tAlpha * (0.7 + 0.3 * Math.sin(now / 900 + a.phase)) * fade);
        continue;
      } else {
        // petal/leaf/sand/ember/smoke：横向飘移 + 摇摆旋转
        sp.x += a.vx * dt;
        sp.y += (a.vy + Math.sin(now / 600 + a.phase) * 10) * dt;
        sp.rotation += dt * 0.9;
        if (sp.x > width + 20) {
          sp.x = -10;
          sp.y = Math.random() * 380;
        }
        if (sp.x < -20) {
          sp.x = width + 10;
          sp.y = Math.random() * 380;
        }
        if (sp.y > GROUND_Y - 6) {
          sp.y = -10;
          sp.x = Math.random() * width;
        }
      }
      sp.setAlpha(a.tAlpha * fade);
    }
    for (const c of this.collectibles) {
      if (c.respawnAt === 0) {
        if (Math.abs(this.player.x - c.sprite.x) < 30) {
          if (c.kind === "gold") {
            const m = 10 + Math.floor(Math.random() * 31);
            s.player.money += m;
            getApp().toast(`你拾到 ${m} 两散碎银两。`);
            this.sparkleAt(c.sprite.x, 456, 0xffd86a);
          } else {
            s.player.items.yaocai = (s.player.items.yaocai || 0) + 1;
            getApp().toast("你拾到一株药草。");
            this.sparkleAt(c.sprite.x, 456, 0x8ae08a);
          }
          c.sprite.setVisible(false);
          c.respawnAt = this.time.now + 40000;
          this.refreshHud();
        }
      } else if (this.time.now >= c.respawnAt) {
        c.sprite.x = 140 + Math.random() * Math.max(220, this.areaDefWidth() - 280);
        c.sprite.setVisible(true);
        c.respawnAt = 0;
      }
    }
    // 生活演出期间暂停单人闲聊气泡
    if (this.time.now >= this.chatterNext && !this.lifeScript) {
      this.chatterNext = this.time.now + 16000 + Math.random() * 18000;
      const arr = [...this.npcSprites.values()];
      if (arr.length) {
        const n = arr[Math.floor(Math.random() * arr.length)];
        let chat = randomChatText(s);
        for (let i = 0; i < 5 && chat === this.lastChatText; i++) chat = randomChatText(s);
        this.lastChatText = chat;
        const t = this.add.text(n.sprite.x, n.sprite.y - 58, chat, {
          fontFamily: "Noto Serif SC, serif",
          fontSize: "12px",
          color: "#f3e3bd",
          backgroundColor: "rgba(18,13,8,.72)",
          padding: { x: 6, y: 2 }
        }).setOrigin(0.5);
        this.tweens.add({
          targets: t,
          y: t.y - 26,
          alpha: 0,
          duration: 3200,
          onComplete: () => t.destroy()
        });
      }
    }
    this.checkDialogDistance();
    // NPC 生活引擎：每 25-45 秒尝试触发一场互动演出
    if (!this.lifeScript && now >= this.lifeNext) {
      this.lifeNext = now + 6000 + Math.random() * 8000;
      this.tryStartLife();
    }
    this.updateLife(now);
    this.updatePrompts();
    if (this.meditating) {
      this.meditateAcc += dt;
      this.meditateRun += dt;
      if (this.meditateAcc >= 1) {
        this.meditateAcc = 0;
        const res = meditateTick(s);
        if (!res.ok) {
          this.toggleMeditate();
          getApp().toast(res.text);
        } else if (Math.floor(this.time.now / 3000) % 3 === 0) {
          getApp().toast(res.text);
        }
        this.refreshHud();
      }
    }
    this.hudAcc += dt;
    if (this.hudAcc >= 1) {
      this.hudAcc = 0;
      this.refreshHud();
    }
  }

  // 全天色温 / 日月弧线 / 星空 / 云 / 夜晚灯光，逐帧平滑推进
  private updateDayNight(dt: number): void {
    const s = getApp().state;
    const target = s?.player.time.hour ?? 8;
    let d = target - this.displayHour;
    if (d > 12) d -= 24;
    if (d < -12) d += 24;
    this.displayHour = (this.displayHour + d * Math.min(1, dt * 1.6) + 24) % 24;
    const h = this.displayHour;
    const now = this.time.now;
    const night = this.caveMode ? 0 : nightness(h);
    if (this.tintRect) {
      // 石窟恒暗：不随时辰变化
      const t = this.caveMode ? { color: 0x050310, alpha: 0.5 } : dayTint(h);
      this.tintRect.setFillStyle(t.color, t.alpha);
    }
    if (this.sun) {
      const p = sunArc(h);
      this.sun.setPosition(p.x, p.y);
      this.sun.setAlpha(this.caveMode ? 0 : p.alpha);
    }
    if (this.moon) {
      const p = moonArc(h);
      this.moon.setPosition(p.x, p.y);
      this.moon.setAlpha(this.caveMode ? 0 : p.alpha * 0.95);
    }
    for (const st of this.stars) {
      st.img.setAlpha(night * (0.3 + 0.7 * Math.abs(Math.sin(now * 0.001 * st.speed + st.phase))));
    }
    for (const c of this.clouds) {
      c.img.x += c.vx * dt;
      if (c.img.x > 1100) c.img.x = -180;
      c.img.setAlpha(0.9 * (1 - night * 0.75));
    }
    for (const l of this.nightLights) {
      l.img.setAlpha(night * (l.base + 0.18 * Math.sin(now * 0.004 + l.phase)));
    }
  }

  // 从在场且同屏（|Δx|<500）的 NPC 中挑一对有关系的，开始互动演出
  private tryStartLife(): void {
    const s = getApp().state;
    if (!s || this.lifeScript) return;
    // 对话面板打开时不打扰
    if (!getApp().ui.el("dialog").classList.contains("hidden")) return;
    const now = this.time.now;
    const width = this.areaDefWidth();
    const cands: { rel: NpcRelation; wa: NpcWalker; wb: NpcWalker }[] = [];
    for (const rel of candidatePairs([...this.npcSprites.keys()])) {
      const wa = this.npcSprites.get(rel.a);
      const wb = this.npcSprites.get(rel.b);
      if (!wa || !wb) continue;
      if (Math.abs(wa.sprite.x - wb.sprite.x) >= 950) continue;
      // 同一对 10 分钟内不重复演出
      const last = this.lifeCooldowns.get(relationPairKey(rel.a, rel.b)) ?? -Infinity;
      if (now - last < 90000) continue;
      cands.push({ rel, wa, wb });
    }
    let wa: NpcWalker;
    let wb: NpcWalker;
    let rel: NpcRelation;
    let beats: LifeBeat[];
    if (cands.length) {
      const pick = cands[Math.floor(Math.random() * cands.length)];
      wa = pick.wa;
      wb = pick.wb;
      rel = pick.rel;
      beats = pickRelationBeats(rel, lifeCtxFrom(s));
    } else {
      // 没有专属关系时，任意两位附近的 NPC 也可能相遇闲聊，让世界更活
      const ids = [...this.npcSprites.keys()];
      const pairs: { a: NpcWalker; b: NpcWalker }[] = [];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = this.npcSprites.get(ids[i]);
          const b = this.npcSprites.get(ids[j]);
          if (!a || !b) continue;
          if (Math.abs(a.sprite.x - b.sprite.x) >= 950) continue;
          const aId = a.sprite.getData("npcId") as string;
          const bId = b.sprite.getData("npcId") as string;
          const last = this.lifeCooldowns.get(relationPairKey(aId, bId)) ?? -Infinity;
          if (now - last < 30000) continue;
          pairs.push({ a, b });
        }
      }
      if (!pairs.length) return;
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      wa = pair.a;
      wb = pair.b;
      const aId = wa.sprite.getData("npcId") as string;
      const bId = wb.sprite.getData("npcId") as string;
      rel = { a: aId, b: bId, kind: "friend", lines: [] };
      beats = [
        { who: "a", emoji: "💬", text: randomChatText(s) },
        { who: "b", emoji: "💬", text: randomChatText(s) },
        { who: "a", emoji: "💬", text: randomChatText(s) }
      ];
    }
    const mid = Math.max(60, Math.min(width - 60, (wa.sprite.x + wb.sprite.x) / 2));
    const left = wa.sprite.x <= wb.sprite.x ? wa : wb;
    const right = left === wa ? wb : wa;
    const dist = Math.abs(wa.sprite.x - wb.sprite.x);
    const dur = Math.min(2600, 500 + dist * 2);
    // 1) 互相走近到相距 60px，面对面
    this.tweens.add({ targets: [left.sprite, left.shadow, left.label], x: mid - 30, duration: dur, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: [right.sprite, right.shadow, right.label], x: mid + 30, duration: dur, ease: "Sine.easeInOut" });
    left.sprite.setFlipX(false);
    right.sprite.setFlipX(true);
    this.lifeScript = {
      rel,
      aId: rel.a,
      bId: rel.b,
      beats,
      idx: 0,
      phase: "approach",
      nextAt: now + dur + 150,
      mid,
      watched: false,
      bubbles: []
    };
  }

  // 生活演出状态机：approach → talk（逐条冒泡）→ return → 谢幕
  private updateLife(now: number): void {
    const ls = this.lifeScript;
    if (!ls || now < ls.nextAt) return;
    if (ls.phase === "approach") {
      ls.phase = "talk";
      ls.nextAt = now + 300;
      ls.watched = !!this.player && Math.abs(this.player.x - ls.mid) < 300;
      return;
    }
    if (ls.phase === "talk") {
      for (const b of ls.bubbles) b.destroy();
      ls.bubbles = [];
      if (ls.idx >= ls.beats.length) {
        // 3) 各自归位
        const wa = this.npcSprites.get(ls.aId);
        const wb = this.npcSprites.get(ls.bId);
        if (!wa || !wb) {
          this.lifeScript = null;
          return;
        }
        const dur = 900;
        this.tweens.add({ targets: [wa.sprite, wa.shadow, wa.label], x: wa.defX, duration: dur, ease: "Sine.easeInOut" });
        this.tweens.add({ targets: [wb.sprite, wb.shadow, wb.label], x: wb.defX, duration: dur, ease: "Sine.easeInOut" });
        ls.phase = "return";
        ls.nextAt = now + dur + 150;
        return;
      }
      // 2) 轮流头顶冒泡：emoji（大字号）+ 短句，每条 1.6 秒
      const beat = ls.beats[ls.idx++];
      const w = this.npcSprites.get(beat.who === "a" ? ls.aId : ls.bId);
      if (w) {
        const y = w.sprite.y;
        const em = this.add.text(w.sprite.x, y - 74, beat.emoji, { fontSize: "20px" }).setOrigin(0.5, 1);
        const tx = this.add
          .text(w.sprite.x, y - 62, beat.text, {
            fontFamily: "Noto Serif SC, serif",
            fontSize: "12px",
            color: "#f3e3bd",
            backgroundColor: "rgba(18,13,8,.78)",
            padding: { x: 6, y: 2 }
          })
          .setOrigin(0.5);
        ls.bubbles.push(em, tx);
      }
      ls.nextAt = now + 1600;
      return;
    }
    // 谢幕：记冷却；玩家全程在附近看完有 10% 概率拾得一条传闻
    this.lifeCooldowns.set(relationPairKey(ls.aId, ls.bId), now);
    const s = getApp().state;
    const watched = ls.watched && this.player && Math.abs(this.player.x - ls.mid) < 300;
    this.lifeScript = null;
    if (watched && s) {
      if (Math.random() < 0.1) {
        getApp().toast("👂 你无意间听到……" + randomChatText(s));
      } else if (Math.random() < 0.07) {
        const aName = NPCS[ls.aId]?.name || "有人";
        const bName = NPCS[ls.bId]?.name || "有人";
        getApp().toast(randomEncounterEvent(aName, bName));
      }
    }
  }

  private renderTownBackdrop(): void {
    const def = areaDef("town");
    this.cameras.main.setBounds(0, 0, def.width, 540);
    this.renderBackground("town", def.width, "area");
    this.renderArea(def, def.width);
  }

  private cleanup(): void {
    // 旧对象上的 tween（淡出销毁、光点脉动、灯光呼吸）一并清掉，避免作用于已销毁对象
    this.tweens.killAll();
    // 生活演出：区域切换/进出战斗时中止，气泡一并销毁
    if (this.lifeScript) {
      for (const b of this.lifeScript.bubbles) b.destroy();
      this.lifeScript = null;
    }
    for (const h of this.holders) h.destroy();
    this.holders = [];
    this.npcSprites.clear();
    this.enemyWalkers = [];
    this.buildings = [];
    this.exits = [];
    this.interactables = [];
    for (const a of this.ambient) a.sprite.destroy();
    this.ambient = [];
    if (this.weatherOverlay) {
      this.weatherOverlay.destroy();
      this.weatherOverlay = null;
    }
    for (const sp of this.splashPool) sp.destroy();
    this.splashPool = [];
    this.pendingFrontFog = [];
    this.sun = null;
    this.moon = null;
    this.tintRect = null;
    this.clouds = [];
    this.stars = [];
    this.nightLights = [];
    this.thunderstorm = false;
    for (const c of this.collectibles) c.sprite.destroy();
    this.collectibles = [];
    if (this.playerShadow) {
      this.playerShadow.destroy();
      this.playerShadow = null;
    }
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    if (this.hintGlow) {
      this.hintGlow.destroy();
      this.hintGlow = null;
    }
  }

  private renderBackground(theme: string, width: number, mode: "area" | "room"): void {
    // 视觉宽度至少铺满视口（房间 900 < 960 时右侧不露底）
    const vw = Math.max(width, 960);
    // 石窟（cave）按暗色调渲染、昼夜系统恒暗（见 updateDayNight）
    this.caveMode = mode === "area" && theme === "cave";
    const darkish = theme === "dark" || theme === "cave";
    // 天空底为水平均匀渐变，平铺无拉伸变形
    const sky = this.add.tileSprite(0, 0, vw, 540, `sky-${theme}`).setOrigin(0, 0);
    const far = this.add.container(0, 0);
    far.setScrollFactor(0.2, 1);
    const farG = this.add.graphics();
    const hillColor = theme === "snow" ? 0xdbe7ef : darkish ? 0x262233 : 0x9bb0a8;
    farG.fillGradientStyle(hillColor, hillColor, 0x5c6f68, 0x5c6f68, 1, 1);
    farG.fillStyle(hillColor, 0.85);
    let px = -200;
    let i = 0;
    while (px < width + 600) {
      const h = 110 + ((i * 53) % 90);
      const pts = [
        new Phaser.Geom.Point(px, 380),
        new Phaser.Geom.Point(px + 130, 380 - h),
        new Phaser.Geom.Point(px + 250, 380),
        new Phaser.Geom.Point(px + 330, 380 - h * 0.55),
        new Phaser.Geom.Point(px + 460, 380)
      ];
      farG.fillPoints(pts, true);
      if (theme === "snow") {
        farG.fillStyle(0xf4faff, 0.9);
        farG.fillPoints([
          new Phaser.Geom.Point(px + 120, 380 - h),
          new Phaser.Geom.Point(px + 135, 380 - h + 12),
          new Phaser.Geom.Point(px + 105, 380 - h + 12)
        ], true);
        farG.fillStyle(hillColor, 0.85);
      }
      px += 430;
      i++;
    }
    far.add(farG);
    const mid = this.add.container(0, 0);
    mid.setScrollFactor(0.45, 1);
    const midG = this.add.graphics();
    const midA = theme === "snow" ? 0xcfdfe8 : darkish ? 0x332b3d : 0x6f8a78;
    midG.fillGradientStyle(midA, midA, 0x4e5f4d, 0x4e5f4d, 1, 1);
    midG.fillStyle(theme === "snow" ? 0xcfdfe8 : darkish ? 0x332b3d : 0x6f8a78, 0.8);
    px = -300;
    let j = 0;
    while (px < width + 600) {
      const h = 70 + ((j * 41) % 55);
      midG.fillPoints(
        [
          new Phaser.Geom.Point(px, 400),
          new Phaser.Geom.Point(px + 110, 400 - h),
          new Phaser.Geom.Point(px + 210, 400)
        ],
        true
      );
      px += 260;
      j++;
    }
    mid.add(midG);
    for (let k = 0; k < Math.ceil(width / 340) + 2; k++) {
      // 石窟里不长树，中景留空（钟乳石笋由 renderArea 地面装饰承担）
      if (theme === "cave") break;
      const t = this.add.image(k * 340 + Math.random() * 160, 396, `tree-${theme}`).setScale(0.8 + Math.random() * 0.3);
      mid.add(t);
    }
    const near = this.add.container(0, 0);
    near.setScrollFactor(0.8, 1);
    const nearG = this.add.graphics();
    nearG.fillStyle(theme === "snow" ? 0xbfd4de : darkish ? 0x3f3748 : 0x58704a, 0.9);
    // 按区域宽度铺满近景丘带
    let nx = -200;
    let nk = 0;
    while (nx < width + 640) {
      const lift = (nk % 3) * 8;
      nearG.fillPoints(
        [
          new Phaser.Geom.Point(nx, 470),
          new Phaser.Geom.Point(nx + 140, 410 - lift),
          new Phaser.Geom.Point(nx + 300, 470),
          new Phaser.Geom.Point(nx + 480, 425 - lift),
          new Phaser.Geom.Point(nx + 640, 470)
        ],
        true
      );
      nx += 640;
      nk++;
    }
    near.add(nearG);
    const ground = this.add.tileSprite(0, 470, vw, 70, `ground-${theme}`).setOrigin(0, 0);
    this.holders.push(sky, far, mid, near, ground);
    if (mode === "area") {
      this.spawnCelestial(theme);
      if (getApp().state?.player.weather === "sunny") this.spawnAmbient(theme, width);
      this.spawnWeather(vw);
    }
  }

  // 昼夜系统对象：太阳/月亮/云/星/全屏色温罩
  private spawnCelestial(theme: string): void {
    const t = dayTint(this.displayHour);
    this.tintRect = this.add.rectangle(0, 0, 960, 540, t.color, t.alpha).setOrigin(0, 0).setScrollFactor(0, 0);
    this.sun = this.add.image(-200, -200, "fx-sun").setScrollFactor(0, 0).setAlpha(0);
    this.moon = this.add.image(-200, -200, "fx-moon").setScrollFactor(0, 0).setAlpha(0);
    this.holders.push(this.tintRect, this.sun, this.moon);
    this.clouds = [];
    // 石窟无云；cloud 主题云最少
    const cloudCount = theme === "cave" ? 0 : theme === "cloud" ? 2 : 3;
    for (let k = 0; k < cloudCount; k++) {
      const img = this.add.image(k * 360 + Math.random() * 140, 56 + k * 38 + Math.random() * 20, "fx-cloud")
        .setScrollFactor(0, 0)
        .setScale(0.85 + Math.random() * 0.45)
        .setAlpha(0.85);
      this.holders.push(img);
      this.clouds.push({ img, vx: 4.5 + Math.random() * 4 + k });
    }
    this.stars = [];
    for (let k = 0; k < 36; k++) {
      const img = this.add.image(Math.random() * 960, Math.random() * 300, "fx-spark")
        .setScrollFactor(0, 0)
        .setTint(0xdfe8ff)
        .setScale(0.2 + Math.random() * 0.3)
        .setAlpha(0);
      this.holders.push(img);
      this.stars.push({ img, phase: Math.random() * 6.28, speed: 0.5 + Math.random() * 1.2 });
    }
  }

  // 晴天主题飘浮物（雨雪雾风天气由天气系统接管）
  private spawnAmbient(theme: string, width: number): void {
    const kindMap: Record<string, { key: string; kind: AmbientKind; count: number }> = {
      forest: { key: "fx-leaf", kind: "leaf", count: 8 },
      town: { key: "fx-petal", kind: "petal", count: 8 },
      temple: { key: "fx-leaf", kind: "leaf", count: 6 },
      snow: { key: "fx-snow", kind: "snow", count: 12 },
      dark: { key: "fx-ember", kind: "ember", count: 8 },
      cave: { key: "fx-smoke", kind: "smoke", count: 6 },
      cloud: { key: "fx-ember", kind: "ember", count: 8 }
    };
    const cfg = kindMap[theme];
    if (!cfg) return;
    for (let i = 0; i < cfg.count; i++) {
      const img = this.add.image(Math.random() * width, Math.random() * 380, cfg.key);
      const tAlpha = 0.3 + Math.random() * 0.45;
      img.setAlpha(tAlpha);
      img.setScale(0.5 + Math.random() * 0.7);
      if (cfg.kind === "petal") img.setTint(Math.random() < 0.5 ? 0xe8a7b8 : 0xffe0a8);
      this.ambient.push({
        sprite: img,
        vx: (Math.random() - 0.5) * 16 + 6,
        vy: 8 + Math.random() * 14,
        kind: cfg.kind,
        tAlpha,
        phase: Math.random() * 6.28,
        weather: false
      });
    }
  }

  private spawnWeather(width: number): void {
    const s = getApp().state;
    if (!s) return;
    const w = s.player.weather;
    this.renderedWeather = w;
    this.weatherFade = 0;
    this.thunderstorm = false;
    if (w === "sunny") {
      this.weatherFade = 1;
      return;
    }
    const color = w === "rain" ? 0x3f5a78 : w === "snow" ? 0xdfeaf2 : w === "fog" ? 0xbfc7d4 : 0x5f6b78;
    const alpha = w === "rain" ? 0.16 : w === "fog" ? 0.2 : w === "snow" ? 0.1 : 0.12;
    const rect = this.add.rectangle(0, 0, width, 540, color, alpha).setOrigin(0, 0);
    rect.setScrollFactor(1, 0);
    this.weatherOverlay = rect;
    if (w === "rain") {
      for (let i = 0; i < 80; i++) {
        const img = this.add.image(Math.random() * width, Math.random() * 540, "fx-rain");
        const tAlpha = 0.5 + Math.random() * 0.4;
        img.setAlpha(0);
        this.ambient.push({ sprite: img, vx: -30 - Math.random() * 40, vy: 420 + Math.random() * 220, kind: "rain", tAlpha, phase: 0, weather: true });
      }
      for (let i = 0; i < 16; i++) {
        const sp = this.add.image(-50, -50, "fx-splash").setVisible(false);
        this.splashPool.push(sp);
      }
      // 10% 概率升级为雷雨
      this.thunderstorm = Math.random() < 0.1;
      this.nextBoltAt = this.time.now + 2500 + Math.random() * 7000;
    } else if (w === "snow") {
      for (let i = 0; i < 46; i++) {
        const img = this.add.image(Math.random() * width, Math.random() * 540, "fx-snow");
        const tAlpha = 0.4 + Math.random() * 0.5;
        img.setAlpha(0);
        img.setScale(0.6 + Math.random() * 0.8);
        this.ambient.push({ sprite: img, vx: -16 - Math.random() * 22, vy: 26 + Math.random() * 30, kind: "snow", tAlpha, phase: Math.random() * 6.28, weather: true });
      }
    } else if (w === "fog") {
      for (let i = 0; i < 4; i++) {
        const img = this.add.image(Math.random() * width, 300 + Math.random() * 130, "fx-smoke");
        img.setAlpha(0);
        img.setScale(11 + Math.random() * 5, 2.4 + Math.random() * 1.2);
        img.setScrollFactor(0.55, 1);
        this.ambient.push({ sprite: img, vx: 10 + Math.random() * 12, vy: 0, kind: "fog", tAlpha: 0.2 + Math.random() * 0.1, phase: Math.random() * 6.28, weather: true });
      }
      // 前景雾带在角色之后创建（refresh 末尾 spawnFrontFog）
      for (let i = 0; i < 3; i++) {
        this.pendingFrontFog.push({
          x: Math.random() * width,
          y: 430 + Math.random() * 60,
          scaleX: 13 + Math.random() * 6,
          scaleY: 3 + Math.random() * 1.4,
          tAlpha: 0.13 + Math.random() * 0.07,
          vx: 12 + Math.random() * 14,
          phase: Math.random() * 6.28
        });
      }
    } else {
      // 风：按区域主题吹落相应粒子
      const theme = areaDef(this.areaId).theme;
      const windCfg: Record<string, { key: string; kind: AmbientKind; tint?: number }> = {
        forest: { key: "fx-leaf", kind: "leaf" },
        mountain: { key: "fx-leaf", kind: "leaf" },
        temple: { key: "fx-leaf", kind: "leaf" },
        town: { key: "fx-petal", kind: "petal", tint: 0xe8a7b8 },
        snow: { key: "fx-snow", kind: "snow" },
        island: { key: "fx-sand", kind: "sand" },
        dark: { key: "fx-ember", kind: "ember" },
        cave: { key: "fx-sand", kind: "sand", tint: 0x9a9088 },
        cloud: { key: "fx-ember", kind: "ember", tint: 0xb0a8c8 }
      };
      const cfg = windCfg[theme] || windCfg.town;
      for (let i = 0; i < 24; i++) {
        const img = this.add.image(Math.random() * width, Math.random() * 400, cfg.key);
        const tAlpha = 0.4 + Math.random() * 0.4;
        img.setAlpha(0);
        img.setScale(0.7 + Math.random() * 0.6);
        if (cfg.tint) img.setTint(cfg.tint);
        this.ambient.push({
          sprite: img,
          vx: 46 + Math.random() * 46,
          vy: 18 + Math.random() * 22,
          kind: cfg.kind === "snow" ? "sand" : cfg.kind,
          tAlpha,
          phase: Math.random() * 6.28,
          weather: true
        });
      }
      if (theme === "town") {
        for (let i = 0; i < 10; i++) {
          const img = this.add.image(Math.random() * width, Math.random() * 400, "fx-sand");
          const tAlpha = 0.3 + Math.random() * 0.3;
          img.setAlpha(0);
          this.ambient.push({ sprite: img, vx: 60 + Math.random() * 40, vy: 12, kind: "sand", tAlpha, phase: Math.random() * 6.28, weather: true });
        }
      }
    }
  }

  // 前景雾带（在角色/NPC 之后创建，位于最前景）
  private spawnFrontFog(width: number): void {
    for (const f of this.pendingFrontFog) {
      const img = this.add.image(f.x, f.y, "fx-smoke");
      img.setAlpha(0);
      img.setScale(f.scaleX, f.scaleY);
      img.setScrollFactor(1.15, 1);
      this.ambient.push({ sprite: img, vx: f.vx, vy: 0, kind: "fog", tAlpha: f.tAlpha, phase: f.phase, weather: true });
    }
    this.pendingFrontFog = [];
  }

  // 天气切换渐变：旧粒子淡出销毁，新粒子淡入
  private transitionWeather(w: string): void {
    for (const a of this.ambient) {
      if (!a.weather) continue;
      this.tweens.add({ targets: a.sprite, alpha: 0, duration: 1000, onComplete: () => a.sprite.destroy() });
    }
    this.ambient = this.ambient.filter((a) => !a.weather);
    if (this.weatherOverlay) {
      const ov = this.weatherOverlay;
      this.weatherOverlay = null;
      this.tweens.add({ targets: ov, alpha: 0, duration: 1000, onComplete: () => ov.destroy() });
    }
    for (const sp of this.splashPool) sp.destroy();
    this.splashPool = [];
    this.thunderstorm = false;
    const s = getApp().state;
    if (s && w === "sunny" && !this.roomId && !this.ambient.some((a) => !a.weather)) {
      this.spawnAmbient(areaDef(this.areaId).theme, this.areaDefWidth());
    }
    this.spawnWeather(this.areaDefWidth());
    this.spawnFrontFog(this.areaDefWidth());
  }

  private splashAt(x: number): void {
    if (!this.splashPool.length) return;
    const sp = this.splashPool[this.splashIdx++ % this.splashPool.length];
    this.tweens.killTweensOf(sp);
    sp.setPosition(x, GROUND_Y - 2).setScale(0.5).setAlpha(0.85).setVisible(true);
    this.tweens.add({
      targets: sp,
      scale: 1.35,
      alpha: 0,
      duration: 240,
      onComplete: () => sp.setVisible(false)
    });
  }

  private lightning(): void {
    const f = this.add.rectangle(0, 0, 960, 540, 0xffffff, 0).setOrigin(0, 0).setScrollFactor(0, 0);
    f.setAlpha(0.5);
    this.cameras.main.shake(140, 0.012);
    this.tweens.add({
      targets: f,
      alpha: 0,
      duration: 110,
      onComplete: () => f.destroy()
    });
    // 闷雷：短暂延迟后的轻微二次震屏
    this.time.delayedCall(380 + Math.random() * 500, () => this.cameras.main.shake(100, 0.004));
  }

  private renderArea(def: ReturnType<typeof areaDef>, width: number): void {
    const s = getApp().state;
    const objects = this.add.container(0, 0);
    for (let i = 40; i < width - 40; i += 220) {
      const r = Math.sin(i * 0.37 + def.id.length);
      if (r > -0.25) {
        const kind = Math.floor(i / 220) % 3;
        if (def.theme === "cave") {
          // 石窟地面：灰紫石笋/怪石
          const rock = this.add.image(i + 40, 472, "rock").setOrigin(0.5, 1).setScale(1.5 + (r % 1));
          rock.setTint(0x7d7688);
          objects.add(rock);
        } else if (kind === 0) {
          const bush = this.add.image(i + 60, 470, `bush-${def.theme}`).setOrigin(0.5, 1).setScale(1 + (r % 1));
          objects.add(bush);
        } else if (kind === 1) {
          const flowerColors = ["d9829f", "e8c850", "8fb4e8"];
          const f = this.add.image(i + 130, 472, `flower-${flowerColors[Math.floor(i / 220) % 3]}`).setOrigin(0.5, 1).setScale(1.4);
          objects.add(f);
        } else {
          const rock = this.add.image(i + 40, 472, "rock").setOrigin(0.5, 1).setScale(0.9 + (r % 1));
          objects.add(rock);
        }
      }
    }
    if (def.theme === "cave") {
      // 石窟火把光点：暖光晕呼吸 + 底火
      for (let i = 260; i < width - 120; i += 460) {
        const glow = this.add.image(i, 428, "fx-glow").setTint(0xff9a3c).setScale(1).setAlpha(0.5);
        objects.add(glow);
        this.tweens.add({ targets: glow, alpha: 0.26, scale: 0.78, duration: 820 + (i % 240), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        objects.add(this.add.image(i, 452, "fx-ember").setScale(0.9).setAlpha(0.9));
      }
    }
    for (let i = 0; i < 3; i++) {
      const kind = i % 2 === 0 ? "gold" : "herb";
      const x = 140 + ((i * 397 + def.id.length * 61) % Math.max(220, width - 220));
      const spr = this.add.image(x, 462, "fx-spark").setScale(0.9).setTint(kind === "gold" ? 0xffd86a : 0x8ae08a);
      spr.setAlpha(0.9);
      objects.add(spr);
      // 收集物光点脉动呼吸
      this.tweens.add({ targets: spr, alpha: 0.5, scale: 0.7, duration: 720, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.collectibles.push({ sprite: spr, defX: x, kind, respawnAt: 0 });
    }
    // 环境漂浮星光：让世界更亮、更有生气
    for (let i = 0; i < 7; i++) {
      const sp = this.add
        .image(40 + Math.random() * Math.max(200, width - 80), 120 + Math.random() * 260, "fx-spark")
        .setScale(0.22 + Math.random() * 0.3)
        .setTint(0xfff0c8)
        .setAlpha(0.28);
      objects.add(sp);
      this.tweens.add({
        targets: sp,
        y: sp.y - 26,
        alpha: 0.05,
        duration: 1400 + Math.random() * 1200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }
    for (const b of def.buildings || []) {
      const img = this.add.image(b.x + b.w / 2, 470, `bld-${b.kind}`).setOrigin(0.5, 1).setScale(b.w / 180);
      objects.add(img);
      this.buildings.push({ def: b, image: img });
      this.addNightLights(objects, b, img);
    }
    for (const it of def.interactables || []) {
      let icon: Phaser.GameObjects.GameObject;
      if (it.action === "well") icon = this.add.image(it.x, 470, "well").setOrigin(0.5, 1);
      else if (it.action === "tree") icon = this.add.image(it.x, 470, "hangtree").setOrigin(0.5, 1);
      else if (it.action === "sign") icon = this.add.image(it.x, 470, "sign").setOrigin(0.5, 1);
      else if (it.action === "mine" || it.action === "herb" || it.action === "crack") icon = this.add.image(it.x, 470, "rock").setOrigin(0.5, 1).setScale(1.4);
      else if (it.action === "look") icon = this.add.image(it.x, 470, "rock").setOrigin(0.5, 1).setScale(1);
      else icon = this.add.image(it.x, 470, "sign").setOrigin(0.5, 1);
      objects.add(icon);
      this.interactables.push({ x: it.x, w: it.w || 70, label: it.label, action: it.action });
    }
    for (const npcId of def.npcs || []) {
      const nd = npcDef(npcId);
      if (!this.npcPresent(nd)) continue;
      this.spawnNpc(npcId, nd.x, nd.walk || 0, objects);
    }
    for (const fe of def.fixedEnemies || []) {
      if (!s || !enemyAvailable(s, fe.enemy)) continue;
      const ed = enemyDef(fe.enemy);
      const v = visualForEnemy(fe.enemy);
      const scale = 2 * v.scaleMul * (ed.scale || 1);
      const y = FOOT_Y - (v.h * scale) / 2;
      const shadow = this.add.image(fe.x, FOOT_Y - 2, "fx-shadow").setScale(1.1 * (v.w / 16) * v.scaleMul, 1);
      objects.add(shadow);
      const spr = this.add.sprite(fe.x, y, v.key("idle")).setScale(scale);
      spr.setData("enemyId", fe.enemy);
      spr.setFlipX(Math.random() < 0.5);
      objects.add(spr);
      this.enemyWalkers.push({ sprite: spr, defX: fe.x, speed: (fe.walk || 70) * 0.12, dir: Math.random() < 0.5 ? -1 : 1, id: fe.enemy, v, shadow });
    }
    if (def.id === "houshan" && s) {
      const qp = s.player.quests.qChuE;
      const night = s.player.time.hour >= 21 || s.player.time.hour <= 5;
      if (night && qp && !qp.done && !s.player.flags["eGuiDead"]) {
        const v = visualForEnemy("eGui");
        const scale = 2 * v.scaleMul;
        const shadow = this.add.image(1250, FOOT_Y - 2, "fx-shadow");
        objects.add(shadow);
        const spr = this.add.sprite(1250, FOOT_Y - (v.h * scale) / 2 - 6, v.key("idle")).setScale(scale);
        spr.setData("enemyId", "eGui");
        objects.add(spr);
        this.enemyWalkers.push({ sprite: spr, defX: 1250, speed: 9, dir: 1, id: "eGui", v, shadow });
      }
      // 云中鹤通缉链：接了 qYunZhongHe 后，夜间（21-5 时）在后山现身
      const qy = s.player.quests.qYunZhongHe;
      if (night && qy && !qy.done && !s.player.flags["yunZhongHeDead"]) {
        const v = visualForEnemy("yunZhongHe");
        const scale = 2 * v.scaleMul;
        const shadow = this.add.image(1650, FOOT_Y - 2, "fx-shadow");
        objects.add(shadow);
        const spr = this.add.sprite(1650, FOOT_Y - (v.h * scale) / 2 - 6, v.key("idle")).setScale(scale);
        spr.setData("enemyId", "yunZhongHe");
        objects.add(spr);
        this.enemyWalkers.push({ sprite: spr, defX: 1650, speed: 10, dir: -1, id: "yunZhongHe", v, shadow });
      }
    }
    for (const ex of def.exits || []) {
      this.exits.push({ ...ex, w: ex.w || 90 });
      const sign = this.add.text(ex.x + 50, 420, ex.label, {
        fontFamily: "Noto Serif SC, serif",
        fontSize: "13px",
        color: "#f3e3bd",
        backgroundColor: "rgba(18,13,8,.72)",
        padding: { x: 6, y: 3 }
      }).setOrigin(0.5);
      objects.add(sign);
    }
    this.holders.push(objects);
  }

  // 夜晚建筑灯光：窗户暖光 + 门口灯笼光晕
  private addNightLights(objects: Phaser.GameObjects.Container, b: BuildingDef, img: Phaser.GameObjects.Image): void {
    const sx = b.w / 180;
    const tex = buildingTexSize(b.kind);
    const spots: { tx: number; ty: number; scale: number; base: number }[] = [
      { tx: 31, ty: 64, scale: 0.6, base: 0.5 },
      { tx: 149, ty: 64, scale: 0.6, base: 0.5 },
      { tx: 14, ty: 34, scale: 0.95, base: 0.62 },
      { tx: 166, ty: 34, scale: 0.95, base: 0.62 }
    ];
    for (const sp of spots) {
      const glow = this.add.image(img.x + (sp.tx - 90) * sx, 470 - (tex.h - sp.ty) * sx, "fx-glow")
        .setScale(sp.scale * sx)
        .setAlpha(0);
      objects.add(glow);
      this.nightLights.push({ img: glow, phase: Math.random() * 6.28, base: sp.base });
    }
  }

  private renderRoom(def: RoomDef, width: number): void {
    const objects = this.add.container(0, 0);
    const vw = Math.max(width, 960);
    const wallColors: Record<string, number> = {
      inn: 0x6d5a45,
      hall: 0x63564a,
      smith: 0x565049,
      drug: 0x5d6248,
      study: 0x6a6250,
      yamen: 0x524e48,
      home: 0x6d5a45,
      shrine: 0x584a3c,
      shop: 0x665844
    };
    const wall = this.add.rectangle(0, 100, vw, 320, wallColors[def.theme] ?? 0x6d5a45).setOrigin(0, 0);
    objects.add(wall);
    // 墙纸竖纹 + 护墙裙
    const stripes = this.add.graphics();
    stripes.lineStyle(2, 0x000000, 0.07);
    for (let x = 14; x < vw; x += 26) stripes.lineBetween(x, 104, x, 388);
    stripes.fillStyle(0x3a2c1c, 0.85);
    stripes.fillRect(0, 392, vw, 28);
    stripes.fillStyle(0xc9a13a, 0.5);
    stripes.fillRect(0, 389, vw, 3);
    objects.add(stripes);
    const floor = this.add.tileSprite(0, 420, vw, 120, "wood").setOrigin(0, 0);
    objects.add(floor);
    // 吊灯与暖光晕
    for (const lx of [width * 0.3, width * 0.7]) {
      objects.add(this.add.image(lx, 100, "furn-lamp").setOrigin(0.5, 0));
      const glow = this.add.image(lx, 142, "fx-glow").setScale(2.4).setAlpha(0.45);
      objects.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.3, duration: 1300 + (lx % 400), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    // 按房间类型摆放家具
    for (const f of roomFurniture(def.id, def.theme)) {
      objects.add(this.add.image(f.x, 470, f.key).setOrigin(0.5, 1).setScale(f.scale || 1));
    }
    for (const npcId of def.npcs || []) {
      const nd = npcDef(npcId);
      if (!this.npcPresent(nd)) continue;
      this.spawnNpc(npcId, nd.x, nd.walk || 0, objects);
    }
    for (const it of def.interactables || []) {
      const icon = this.add.image(it.x, 470, furnitureIcon(it.action, def.id, def.theme, it.label)).setOrigin(0.5, 1);
      objects.add(icon);
      this.interactables.push({ x: it.x, w: it.w || 70, label: it.label, action: it.action });
    }
    for (const ex of def.exits || []) {
      this.exits.push({ ...ex, x: ex.x, w: 90 });
      objects.add(
        this.add.text(ex.x + 40, 410, ex.label, {
          fontFamily: "Noto Serif SC, serif",
          fontSize: "13px",
          color: "#f3e3bd",
          backgroundColor: "rgba(18,13,8,.72)",
          padding: { x: 6, y: 3 }
        }).setOrigin(0.5)
      );
    }
    this.holders.push(objects);
  }

  private spawnNpc(npcId: string, x: number, walk: number, objects: Phaser.GameObjects.Container): void {
    const nd = npcDef(npcId);
    const v = visualForNpc(npcId);
    const sh = npcScaleHint(npcId);
    const scale = 2 * v.scaleMul;
    const y = FOOT_Y - (v.h * scale * sh.y) / 2;
    const shadow = this.add.image(x, FOOT_Y - 2, "fx-shadow").setScale(1.1 * (v.w / 16) * v.scaleMul * sh.x, 1);
    objects.add(shadow);
    const spr = this.add.sprite(x, y, v.key("idle")).setScale(scale * sh.x, scale * sh.y);
    objects.add(spr);
    spr.setData("npcId", npcId);
    spr.setData("npcName", nd.name);
    const label = this.add.text(x, y - 36, nd.name, {
      fontFamily: "Noto Serif SC, serif",
      fontSize: "11px",
      color: "#f3e3bd",
      backgroundColor: "rgba(18,13,8,.68)",
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5);
    objects.add(label);
    this.npcSprites.set(npcId, {
      sprite: spr,
      defX: x,
      speed: walk * 0.18,
      dir: 1,
      v,
      shadow,
      label,
      tx: x,
      pauseUntil: 0
    });
  }

  private npcPresent(nd: ReturnType<typeof npcDef>): boolean {
    // 逃婚风波了结后，阿沅离开官道（甲线安家百花谷，乙线回家），不再现身
    if (nd.id === "taohun") {
      const qt = getApp().state?.player.quests.qTaoHun;
      if (qt?.done) return false;
    }
    if (!nd.hours) return true;
    const h = getApp().state?.player.time.hour ?? 8;
    return h >= nd.hours[0] && h < nd.hours[1];
  }

  // 宽范围游荡：大概率原地附近，小概率走远，甚至可能跑到区域另一端
  private pickNpcTarget(n: NpcWalker): void {
    const width = this.areaDefWidth();
    if (Math.random() < 0.85) {
      n.tx = Math.max(40, Math.min(width - 40, n.defX + (Math.random() * 240 - 120)));
    } else {
      n.tx = 40 + Math.random() * Math.max(80, width - 80);
    }
  }

  // 玩家走开超过一段距离，NPC 对话框自动关闭
  private checkDialogDistance(): void {
    const app = getApp();
    if (!app.dialogNpc || !this.player || app.ui.el("dialog").classList.contains("hidden")) return;
    const n = this.npcSprites.get(app.dialogNpc);
    if (!n || Math.abs(this.player.x - n.sprite.x) > 140) app.closeUi();
  }

  private sparkleAt(x: number, y: number, color: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      const sp = this.add
        .image(x, y, "fx-spark")
        .setTint(color)
        .setScale(0.5 + Math.random() * 0.6)
        .setAlpha(0.9);
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 30;
      this.tweens.add({
        targets: sp,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 12,
        alpha: 0,
        scale: 0.2,
        duration: 420 + Math.random() * 260,
        onComplete: () => sp.destroy()
      });
    }
  }

  private ensureHintGlow(x: number, y: number): void {
    if (!this.hintGlow) {
      this.hintGlow = this.add.image(x, y, "fx-glow").setScale(1.15).setAlpha(0.32);
      this.tweens.add({
        targets: this.hintGlow,
        alpha: 0.16,
        scale: 0.9,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    } else {
      this.hintGlow.setPosition(x, y).setVisible(true);
    }
  }

  private areaDefWidth(): number {
    const s = getApp().state;
    if (!s) return 3450;
    const def = areaDef(s.player.area);
    if (s.player.room) return roomDef(s.player.room).width;
    return def.width;
  }

  private updatePrompts(): void {
    if (this.meditating) {
      getApp().ui.showHint("打坐中…… [5] 停止");
      return;
    }
    const s = getApp().state;
    if (!s || !this.player) return;
    const ui = getApp().ui;
    let hint = "";
    let glowX = -1;
    let glowY = -1;
    for (const npc of this.npcSprites.values()) {
      if (Math.abs(this.player.x - npc.sprite.x) < 52) {
        hint = `${npc.sprite.getData("npcName")} · [E]交谈`;
        break;
      }
    }
    if (!hint) {
      for (const w of this.enemyWalkers) {
        if (Math.abs(this.player.x - w.sprite.x) < 40) {
          hint = `${enemyDef(w.id).name} · 撞上即战`;
          break;
        }
      }
    }
    if (!hint) {
      for (const ex of this.exits) {
        if (Math.abs(this.player.x - (ex.x + 45)) < 60) {
          hint = `[E] ${ex.label}`;
          glowX = ex.x + 45;
          glowY = 420;
          break;
        }
      }
    }
    if (!hint) {
      for (const it of this.interactables) {
        if (Math.abs(this.player.x - it.x) < it.w / 2 + 24) {
          hint = `[E] ${it.label}`;
          glowX = it.x;
          glowY = 440;
          break;
        }
      }
    }
    if (!hint) {
      for (const b of this.buildings) {
        if (b.def.doorX !== undefined && (b.def.room || b.def.id === "taohua") && Math.abs(this.player.x - b.def.doorX) < 44) {
          hint = `[E] 进入${b.def.name}`;
          glowX = b.def.doorX;
          glowY = 440;
          break;
        }
      }
    }
    ui.showHint(hint || null);
    if (glowX >= 0) this.ensureHintGlow(glowX, glowY);
    else if (this.hintGlow) this.hintGlow.setVisible(false);
  }

  private interact(): void {
    const app = getApp();
    const s = app.state;
    if (!s || !this.player || this.fading) return;
    // Phaser 偶发把同一次 keydown 同步分发两次（scene 重启后竞争），短时节流防双触发
    const nowMs = this.time.now;
    if (nowMs - this.lastInteractAt < 250) return;
    this.lastInteractAt = nowMs;
    for (const npc of this.npcSprites.values()) {
      if (Math.abs(this.player.x - npc.sprite.x) < 56) {
        const npcId = npc.sprite.getData("npcId") as string;
        app.dialogNpc = npcId;
        app.ui.dialogNpc = npcId;
        const nd = npcDef(npcId);
        const qBei = s.player.quests.qBeiFang;
        if (nd.master && qBei && !qBei.done && qBei.stage === 0) {
          // 同一掌门重复拜访不计数，须拜访三位不同的掌门
          const visited = (s.player.flags["visited-masters"] as string[] | undefined) || [];
          if (!visited.includes(npcId)) {
            visited.push(npcId);
            s.player.flags["visited-masters"] = visited;
            s.player.task.visits = visited.length;
            app.toast(`你拜访了${nd.name}（${visited.length}/3）。`);
          } else {
            app.toast(`你已拜访过${nd.name}，去其他门派走走吧。`);
          }
        }
        const nodes = getNpcDialog(npcId, s);
        if (nodes) app.ui.showDialog(nodes);
        else app.toast(`${npc.sprite.getData("npcName")}看了你一眼，没有说话。`);
        return;
      }
    }
    for (const ex of this.exits) {
      if (Math.abs(this.player.x - (ex.x + 45)) < 60) {
        if (ex.room) {
          s.player.doorX = ex.x + 40;
          s.player.room = ex.room;
          s.player.x = 180;
        } else {
          if (this.roomId) {
            leaveRoom(s);
          } else {
            const blocked = travelTo(s, ex.area);
            if (blocked) {
              app.toast(blocked);
              return;
            }
            app.toast(`你来到${areaDef(s.player.area).name}。`);
            app.maybeEvent("travel");
          }
        }
        this.refreshWithFade();
        return;
      }
    }
    for (const it of this.interactables) {
      if (Math.abs(this.player.x - it.x) < it.w / 2 + 26) {
        let action = it.action;
        if (this.roomId === "popoHome") {
          if (action === "well") action = "water";
          if (action === "desk") action = "chop";
          if (action === "meditate") action = "sweep";
        }
        if (action === "rest") {
          // 自家卧榻免费全恢复；客栈床铺走食宿面板
          app.handleAction(this.roomId === "taohua" ? "house-rest" : "rest-panel");
          return;
        }
        app.handleAction(action);
        return;
      }
    }
    for (const b of this.buildings) {
      if (b.def.doorX !== undefined && (b.def.room || b.def.id === "taohua") && Math.abs(this.player.x - b.def.doorX) < 46) {
        if (b.def.id === "taohua") {
          // 未购房走买房对话；已购房正常进屋（卧榻免费全恢复 + 存物柜）
          if (s.player.house && b.def.room) {
            s.player.doorX = b.def.doorX ?? 180;
            s.player.room = b.def.room;
            s.player.x = 180;
            this.refreshWithFade();
          } else {
            app.handleAction("shrine");
          }
          return;
        }
        if (b.def.room) {
          s.player.doorX = b.def.doorX ?? 180;
          s.player.room = b.def.room;
          s.player.x = 180;
          this.refreshWithFade();
          return;
        }
      }
    }
  }

  private refreshHud(): void {
    const app = getApp();
    if (app.state) app.ui.showHud(app.state);
  }

  private maybeIntro(): void {
    const s = getApp().state;
    if (!s || s.player.room || s.player.flags[`seen-${this.areaId}`]) return;
    s.player.flags[`seen-${this.areaId}`] = true;
    const def = areaDef(this.areaId);
    getApp().ui.showDialog([
      {
        id: "r",
        speaker: def.name,
        text: `${def.desc}\n\n${randomChatText(s)}`,
        opts: [{ text: "四处看看", node: "bye" }]
      },
      { id: "bye", speaker: def.name, text: "你收拾心情，迈步向前。", opts: [] }
    ]);
  }
}

// 房间家具布局（装饰性，不含交互物）
function roomFurniture(roomId: string, theme: RoomDef["theme"]): { key: string; x: number; scale?: number }[] {
  const byRoom: Record<string, { key: string; x: number; scale?: number }[]> = {
    juyi: [
      { key: "furn-rack", x: 140 },
      { key: "furn-table", x: 520 },
      { key: "furn-stool", x: 488 },
      { key: "furn-stool", x: 552 },
      { key: "furn-jar", x: 660 },
      { key: "furn-cabinet", x: 780 }
    ]
  };
  if (byRoom[roomId]) return byRoom[roomId];
  const byTheme: Record<string, { key: string; x: number; scale?: number }[]> = {
    inn: [
      { key: "furn-table", x: 470 },
      { key: "furn-stool", x: 438 },
      { key: "furn-stool", x: 502 },
      { key: "furn-table", x: 640 },
      { key: "furn-stool", x: 672 },
      { key: "furn-shelf", x: 780 }
    ],
    hall: [
      { key: "furn-rack", x: 140 },
      { key: "furn-table", x: 620 },
      { key: "furn-stool", x: 588 },
      { key: "furn-stool", x: 652 },
      { key: "furn-jar", x: 740 }
    ],
    smith: [
      { key: "furn-forge", x: 150 },
      { key: "furn-rack", x: 560 },
      { key: "furn-jar", x: 660 },
      { key: "furn-table", x: 780 }
    ],
    drug: [
      { key: "furn-drug", x: 180 },
      { key: "furn-counter", x: 430 },
      { key: "furn-jar", x: 580 },
      { key: "furn-shelf", x: 730 }
    ],
    study: [
      { key: "furn-desk", x: 420 },
      { key: "furn-stool", x: 470 },
      { key: "furn-shelf", x: 620 },
      { key: "furn-shelf", x: 760 }
    ],
    yamen: [
      { key: "furn-cabinet", x: 160 },
      { key: "furn-table", x: 450 },
      { key: "furn-rack", x: 660 },
      { key: "furn-jar", x: 780 }
    ],
    home: [
      { key: "furn-bed", x: 170 },
      { key: "furn-cabinet", x: 330 },
      { key: "furn-table", x: 520 },
      { key: "furn-stool", x: 556 },
      { key: "furn-stove", x: 720 }
    ],
    shrine: [
      { key: "furn-shrine", x: 450 },
      { key: "furn-jar", x: 200 },
      { key: "furn-cabinet", x: 720 }
    ],
    shop: [
      { key: "furn-counter", x: 320 },
      { key: "furn-shelf", x: 560 },
      { key: "furn-jar", x: 680 },
      { key: "furn-cabinet", x: 800 }
    ]
  };
  return byTheme[theme] || byTheme.home;
}

// 交互物对应的家具图标
function furnitureIcon(action: string, roomId: string, theme: RoomDef["theme"], label: string): string {
  if (action === "rest") return label.includes("柜台") ? "furn-counter" : "furn-bed";
  if (action === "chest") return "furn-cabinet";
  if (action === "look") return "furn-shelf";
  if (action === "well") return "furn-jar";
  if (action === "shrine") return "furn-shrine";
  if (action === "meditate") return theme === "hall" ? "furn-dummy" : "furn-table";
  if (action === "desk") {
    if (roomId === "smith") return "furn-anvil";
    if (roomId === "juyi") return "furn-throne";
    if (label.includes("书架")) return "furn-shelf";
    if (label.includes("柴堆")) return "furn-stove";
    return "furn-desk";
  }
  return "furn-table";
}
