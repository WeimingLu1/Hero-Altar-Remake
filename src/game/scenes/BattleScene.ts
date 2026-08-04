import Phaser from "phaser";
import { getApp } from "../bus";
import { visualForBattleEnemy, type CharVisual } from "../view/art";
import { dayTint, nightness } from "../view/daynight";
import { enemyDef } from "../content/enemies";
import type { BattleState, BattleEvent } from "../sim/battle";

// 战斗舞台脚线（与原布局一致：玩家 scale 3、脚底 446）
const STAGE_FOOT = 446;

const ULT_COLORS: Record<string, number> = {
  sword: 0x7de0e8,
  blade: 0xffd98a,
  fist: 0xff6b5e,
  staff: 0xe8a05a,
  whip: 0xc87de0,
  neigong: 0xb8a0ff,
  other: 0xe8e8f0
};

export class BattleScene extends Phaser.Scene {
  private battle: BattleState | null = null;
  private theme = "town";
  private playerSprite!: Phaser.GameObjects.Sprite;
  private enemySprite!: Phaser.GameObjects.Sprite;
  private enemyVisual!: CharVisual;
  private playedIdx = 0; // 已播放到的战斗事件索引
  private nextEventAt = 0; // 下一条事件允许播放的最早时刻
  private exitAt = 0;
  private exitSent = false;

  constructor() {
    super("Battle");
  }

  init(data: { battle: BattleState; theme?: string }): void {
    this.battle = data.battle;
    this.theme = data.theme || "town";
    this.playedIdx = 0;
    this.nextEventAt = 0;
    this.exitAt = 0;
    this.exitSent = false;
  }

  create(): void {
    const b = this.battle;
    if (!b) {
      this.scene.stop();
      return;
    }
    this.cameras.main.fadeIn(280, 0, 0, 0);
    const app = getApp();
    const hour = app.state?.player.time.hour ?? 20;
    this.buildBackdrop(this.theme, hour);
    const p = app.state?.player;
    const pal = p?.gender === "female" ? "female" : "male";
    this.add.image(320, STAGE_FOOT - 2, "fx-shadow").setScale(1.6, 1.2);
    this.playerSprite = this.add.sprite(320, STAGE_FOOT - 36, `char-${pal}-idle`).setScale(3);
    const eDef = enemyDef(b.enemyId);
    this.enemyVisual = visualForBattleEnemy(b.enemyId);
    const escale = 3 * this.enemyVisual.scaleMul * (eDef.scale || 1);
    this.add.image(650, STAGE_FOOT - 2, "fx-shadow").setScale(1.6 * (this.enemyVisual.w / 16) * this.enemyVisual.scaleMul, 1.2);
    this.enemySprite = this.add.sprite(650, STAGE_FOOT - (this.enemyVisual.h * escale) / 2, this.enemyVisual.key("idle")).setScale(escale);
    this.enemySprite.setFlipX(true);
    this.add.text(650, this.enemySprite.y - (this.enemyVisual.h * escale) / 2 - 18, eDef.title || eDef.name, {
      fontFamily: "Noto Serif SC, serif",
      fontSize: "18px",
      color: "#ffe9c4"
    }).setOrigin(0.5);
    this.add.text(320, 290, p?.name || "你", {
      fontFamily: "Noto Serif SC, serif",
      fontSize: "18px",
      color: "#ffd98a"
    }).setOrigin(0.5);
    this.events.on("shutdown", () => {
      this.battle = null;
    });
  }

  // 按区域主题搭建战斗舞台，并同步当前时辰色温
  private buildBackdrop(theme: string, hour: number): void {
    this.add.tileSprite(0, 0, 960, 540, `sky-${theme}`).setOrigin(0, 0);
    const farG = this.add.graphics();
    const hillColor = theme === "snow" ? 0xdbe7ef : theme === "dark" || theme === "cave" || theme === "cloud" ? 0x262233 : 0x9bb0a8;
    farG.fillStyle(hillColor, 0.85);
    let px = -100;
    let i = 0;
    while (px < 1060) {
      const h = 80 + ((i * 53) % 70);
      farG.fillPoints([
        new Phaser.Geom.Point(px, 300),
        new Phaser.Geom.Point(px + 130, 300 - h),
        new Phaser.Geom.Point(px + 300, 300)
      ], true);
      px += 300;
      i++;
    }
    // 中景：主题化两段底色（上浅下深），避免压住角色
    const darkTheme = theme === "dark" || theme === "cave" || theme === "cloud";
    const midTop = theme === "snow" ? 0xd8e6ef : darkTheme ? 0x352e42 : theme === "island" ? 0x9a8a68 : theme === "town" ? 0x7d8a6f : 0x6f8a78;
    const midBot = theme === "snow" ? 0xb8cdd9 : darkTheme ? 0x231f2e : theme === "island" ? 0x7a6c50 : theme === "town" ? 0x5f6b54 : 0x54685c;
    const midG = this.add.graphics();
    midG.fillStyle(midTop, 1);
    midG.fillRect(0, 300, 960, 110);
    midG.fillStyle(midBot, 1);
    midG.fillRect(0, 410, 960, 80);
    this.add.tileSprite(0, 460, 960, 80, `ground-${theme}`).setOrigin(0, 0);
    // 主题装饰（避开 320/650 战斗位）
    if (theme === "forest" || theme === "temple" || theme === "mountain") {
      for (const tx of [70, 200, 780, 900]) {
        this.add.image(tx + Math.random() * 30, 462, `tree-${theme}`).setOrigin(0.5, 1).setScale(1.1 + Math.random() * 0.5).setAlpha(0.92);
      }
    } else if (theme === "snow") {
      for (const tx of [90, 220, 800]) {
        this.add.image(tx + Math.random() * 30, 462, "tree-snow").setOrigin(0.5, 1).setScale(1.1 + Math.random() * 0.4);
      }
      const dr = this.add.graphics();
      dr.fillStyle(0xf4faff, 0.8);
      for (let k = 0; k < 5; k++) dr.fillEllipse(90 + k * 200, 470, 130, 14);
    } else if (theme === "island") {
      const waves = this.add.graphics();
      waves.lineStyle(2, 0xbfe0ea, 0.7);
      for (let k = 0; k < 6; k++) {
        waves.beginPath();
        waves.arc(80 + k * 170, 466, 34, Math.PI * 1.15, Math.PI * 1.85);
        waves.strokePath();
      }
    } else if (theme === "dark" || theme === "cave" || theme === "cloud") {
      for (let k = 0; k < 2; k++) {
        this.add.image(140 + k * 660, 462, "tree-dark").setOrigin(0.5, 1).setScale(1.2 + Math.random() * 0.4);
      }
      // 火把光
      for (let k = 0; k < 3; k++) {
        const x = 180 + k * 300;
        this.add.image(x, 400, "fx-flash").setScale(0.5).setAlpha(0.9);
        const glow = this.add.image(x, 400, "fx-glow").setScale(1.7).setAlpha(0.7);
        this.tweens.add({ targets: glow, alpha: 0.4, scale: 1.4, duration: 500 + Math.random() * 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    } else if (theme === "town") {
      this.add.image(180, 460, "bld-inn").setOrigin(0.5, 1).setScale(0.85).setAlpha(0.95);
      this.add.image(800, 460, "bld-drug").setOrigin(0.5, 1).setScale(0.85).setAlpha(0.95);
    }
    for (let k = 0; k < 8; k++) {
      const x = 20 + k * 120 + Math.floor(Math.random() * 50);
      this.add.image(x, 474, "rock").setScale(0.7 + Math.random() * 0.9);
    }
    this.add.rectangle(0, 0, 960, 8, 0x000000, 0.35).setOrigin(0, 0);
    // 昼夜同步：色温罩 + 夜空星点
    const t = dayTint(hour);
    this.add.rectangle(0, 0, 960, 540, t.color, t.alpha).setOrigin(0, 0);
    const night = nightness(hour);
    if (night > 0.25) {
      for (let k = 0; k < 24; k++) {
        this.add.image(Math.random() * 960, Math.random() * 260, "fx-spark")
          .setTint(0xdfe8ff)
          .setScale(0.2 + Math.random() * 0.3)
          .setAlpha(night * (0.4 + Math.random() * 0.6));
      }
    }
  }

  update(): void {
    const b = this.battle;
    if (!b) return;
    // 事件队列逐条播放，全部播完才进入退出计时
    if (this.playedIdx < b.log.length && this.time.now >= this.nextEventAt) {
      const ev: BattleEvent = b.log[this.playedIdx];
      this.playEvent(ev);
      this.playedIdx += 1;
      const ultDelay = ev.kind === "move" && ev.ultType ? 560 : ev.kind === "qte" ? 700 : 0;
      this.nextEventAt = this.time.now + (ultDelay || (ev.kind === "death" ? 500 : ev.kind === "crit" ? 420 : 320));
    }
    if (b.over && this.eventsDrained() && !this.exitSent) {
      this.exitSent = true;
      this.exitAt = this.time.now + 1400;
    }
    if (this.exitAt && this.time.now >= this.exitAt) {
      this.exitAt = 0;
      getApp().finishBattle();
      return;
    }
  }

  // 战斗事件是否已全部播完（App 的退出判定同样以此为准）
  eventsDrained(): boolean {
    const b = this.battle;
    return !b || this.playedIdx >= b.log.length;
  }

  private playEvent(ev: BattleEvent): void {
    if (ev.side === "player" && (ev.kind === "move" || ev.kind === "hit" || ev.kind === "crit")) {
      this.playerSprite.setTexture(`char-${this.playerPalette()}-walk`);
      this.tweens.add({
        targets: this.playerSprite,
        x: 400,
        duration: 120,
        yoyo: true,
        onComplete: () => this.playerSprite.setTexture(`char-${this.playerPalette()}-idle`)
      });
      this.hopSprite(this.playerSprite);
      if (ev.kind === "move" && ev.ultType) {
        // 绝招专属演出：按武功类型配色与形态 + 顿帧 + 分级震屏
        this.ultStrike(ev.ultType, ev.mult || 2);
      }
      if (ev.kind === "hit" || ev.kind === "crit") {
        const ultColor = ev.ultType ? ULT_COLORS[ev.ultType] : undefined;
        const qteScale = ev.qte ? 1.6 : 1;
        this.slashAt(
          this.enemySprite.x,
          this.enemySprite.y - 20,
          ultColor ?? (ev.kind === "crit" ? 0xffe0a0 : 0xdff0ff),
          (ev.kind === "crit" ? 1.8 : ev.ultType ? 1.4 : 1.1) * qteScale
        );
        if (ev.qte) this.cameras.main.flash(200, 255, 217, 138);
      }
      if (ev.kind === "crit") {
        this.cameras.main.shake(120, 0.008);
        this.flashScreen();
      }
    }
    if (ev.side === "enemy" && (ev.kind === "move" || ev.kind === "hit" || ev.kind === "crit")) {
      this.enemySprite.setTexture(this.enemyVisual.key("walk"));
      this.tweens.add({
        targets: this.enemySprite,
        x: 570,
        duration: 140,
        yoyo: true,
        onComplete: () => this.enemySprite.setTexture(this.enemyVisual.key("idle"))
      });
      this.hopSprite(this.enemySprite);
      if (ev.kind === "move" && ev.ultName) {
        // 敌方技能前摇：暖色光环
        this.glowRing(this.enemySprite.x, this.enemySprite.y - 20, 0xff9a6a);
      }
      if (ev.kind === "hit" || ev.kind === "crit") {
        this.slashAt(this.playerSprite.x, this.playerSprite.y - 20, ev.kind === "crit" ? 0xffb0a0 : 0xffd0c0, ev.kind === "crit" ? 1.8 : 1.1);
      }
      if (ev.kind === "crit") {
        this.cameras.main.shake(140, 0.01);
        this.flashScreen();
      }
    }
    if (ev.kind === "hit" || ev.kind === "crit" || ev.kind === "poison") {
      const target = ev.side === "player" ? this.playerSprite : this.enemySprite;
      this.tweens.add({
        targets: target,
        alpha: 0.25,
        duration: 60,
        yoyo: true,
        repeat: 2
      });
      this.sparkBurst(
        target.x,
        target.y - 20,
        ev.kind === "poison" ? 0x8ae08a : ev.qte ? 0xffd98a : 0xfff2c0,
        ev.qte ? 14 : ev.kind === "crit" ? 10 : 6
      );
      this.hopSprite(target);
      const dmgText = this.add.text(target.x, target.y - 60, `-${ev.dmg || 0}`, {
        fontFamily: "Noto Serif SC, serif",
        fontSize: "22px",
        color: ev.side === "player" ? "#ff7d6b" : "#ffb84d"
      }).setOrigin(0.5);
      this.tweens.add({
        targets: dmgText,
        y: dmgText.y - 40,
        alpha: 0,
        duration: 700,
        onComplete: () => dmgText.destroy()
      });
    }
    if (ev.kind === "qte") {
      const colors = [0x7de0e8, 0xffd98a, 0xff6b5e, 0x8ae08a, 0xc87de0];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const t = this.add.text(480, 210, ev.text, {
        fontFamily: "Noto Serif SC, serif",
        fontSize: "20px",
        color: "#fff3c8",
        align: "center",
        wordWrap: { width: 760 },
        stroke: "#1a1210",
        strokeThickness: 4
      }).setOrigin(0.5);
      this.tweens.add({
        targets: t,
        y: t.y - 30,
        alpha: 0,
        duration: 1800,
        delay: 350,
        onComplete: () => t.destroy()
      });
      this.sparkBurst(480, 260, color, 16);
      this.cameras.main.flash(180, 255, 217, 138);
    }
    if (ev.kind === "heal") {
      this.healSparkles(this.playerSprite.x, this.playerSprite.y - 24);
    }
    if (ev.kind === "buff") {
      const target = ev.side === "player" ? this.playerSprite : this.enemySprite;
      this.glowRing(target.x, target.y - 20, 0x8ae0c8);
    }
    if (ev.kind === "debuff") {
      const target = ev.side === "player" ? this.playerSprite : this.enemySprite;
      this.glowRing(target.x, target.y - 20, 0xa878c8, true);
      this.smokeAt(target.x, target.y - 20);
    }
    if (ev.kind === "poison") {
      this.smokeAt(this.playerSprite.x, this.playerSprite.y - 20);
    }
    if (ev.kind === "death") {
      const target = ev.side === "player" ? this.playerSprite : this.enemySprite;
      this.tweens.add({
        targets: target,
        angle: 90,
        y: target.y + 30,
        alpha: 0.25,
        duration: 500
      });
    }
    // BOSS 阶段化：全屏红光脉冲 + 变大体形变色
    if (ev.kind === "phase") {
      const f = this.add.rectangle(480, 270, 960, 540, 0xff3b30, 0);
      this.tweens.add({
        targets: f,
        alpha: 0.26,
        duration: 150,
        yoyo: true,
        repeat: 1,
        onComplete: () => f.destroy()
      });
      this.cameras.main.shake(180, 0.008);
      this.enemySprite.setTint(0xff8a7a);
      this.tweens.add({
        targets: this.enemySprite,
        scaleX: this.enemySprite.scaleX * 1.08,
        scaleY: this.enemySprite.scaleY * 1.08,
        duration: 220,
        yoyo: true,
        onComplete: () => this.enemySprite.clearTint()
      });
    }
    // 守势：青色护盾环
    if (ev.kind === "stance") {
      const target = ev.side === "player" ? this.playerSprite : this.enemySprite;
      const g = this.add.graphics();
      g.lineStyle(4, 0x7de0c3, 0.9);
      g.beginPath();
      g.arc(0, 0, 40, Math.PI * 0.7, Math.PI * 2.3);
      g.strokePath();
      g.setPosition(target.x, target.y - 20).setAlpha(0);
      this.tweens.add({
        targets: g,
        alpha: 0.9,
        scale: 1.15,
        duration: 260,
        yoyo: true,
        onComplete: () => g.destroy()
      });
    }
    // 破绽：目标头顶黄星
    if (ev.kind === "opening") {
      const target = ev.side === "player" ? this.playerSprite : this.enemySprite;
      const star = this.add.image(target.x, target.y - 74, "fx-spark").setTint(0xffe08a).setScale(2.6);
      this.tweens.add({
        targets: star,
        y: star.y - 24,
        alpha: 0,
        angle: 120,
        duration: 650,
        onComplete: () => star.destroy()
      });
    }
    // 逃跑：扬尘平移出屏
    if (ev.kind === "flee") {
      const runner = ev.side === "player" ? this.playerSprite : this.enemySprite;
      this.smokeAt(runner.x, runner.y - 6);
      this.tweens.add({
        targets: runner,
        x: ev.side === "player" ? -80 : 1060,
        alpha: 0.15,
        duration: 700,
        ease: "Cubic.easeIn"
      });
    }
    // phase / stance / opening：文字弹出 + 颜色区分
    if (ev.kind === "phase" || ev.kind === "stance" || ev.kind === "opening") {
      const target = ev.side === "player" ? this.playerSprite : this.enemySprite;
      const color = ev.kind === "phase" ? "#ff6b5e" : ev.kind === "stance" ? "#7de0c3" : "#ffe08a";
      const t = this.add.text(target.x, target.y - 92, ev.text, {
        fontFamily: "Noto Serif SC, serif",
        fontSize: "17px",
        color,
        stroke: "#1a1210",
        strokeThickness: 3
      }).setOrigin(0.5);
      this.tweens.add({
        targets: t,
        y: t.y - 34,
        alpha: 0,
        duration: 900,
        onComplete: () => t.destroy()
      });
    }
  }

  // 角色上下翻飞：模拟激烈碰撞中的身法起伏
  private hopSprite(sprite: Phaser.GameObjects.Sprite): void {
    const fromY = sprite.y;
    const up = 18 + Math.random() * 18;
    this.tweens.add({
      targets: sprite,
      y: fromY - up,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        sprite.y = fromY;
      }
    });
  }

  // 绝招专属演出：剑气横斩 / 刀芒斜劈 / 拳劲冲击波 / 杖影竖劈 / 鞭影蛇形 / 内功光环爆发
  private ultStrike(type: string, mult: number): void {
    const color = ULT_COLORS[type] ?? ULT_COLORS.other;
    const x = this.enemySprite.x;
    const y = this.enemySprite.y - 20;
    if (type === "sword") {
      const g = this.add.graphics();
      g.lineStyle(6, color, 0.95);
      g.lineBetween(-70, 0, 70, 0);
      g.lineStyle(2, 0xffffff, 0.9);
      g.lineBetween(-50, -6, 50, -6);
      g.setPosition(x - 160, y).setAlpha(0);
      this.tweens.add({ targets: g, x: x + 30, alpha: 1, duration: 140, yoyo: true, onComplete: () => g.destroy() });
    } else if (type === "blade") {
      this.slashAt(x, y, color, 2.4);
      const g = this.add.graphics();
      g.lineStyle(5, color, 0.9);
      g.beginPath();
      g.arc(0, 0, 52, -0.9, 0.9);
      g.strokePath();
      g.setPosition(x, y).setRotation(0.9).setAlpha(0);
      this.tweens.add({ targets: g, alpha: 1, scale: 1.5, duration: 150, yoyo: true, onComplete: () => g.destroy() });
    } else if (type === "fist") {
      for (let i = 0; i < 2; i++) {
        const g = this.add.graphics();
        g.lineStyle(5 - i * 2, color, 0.9 - i * 0.3);
        g.strokeCircle(0, 0, 18);
        g.setPosition(x, y);
        this.tweens.add({ targets: g, scale: 2.6 + i, alpha: 0, duration: 320 + i * 120, onComplete: () => g.destroy() });
      }
      this.sparkBurst(x, y, 0xff8a70, 12);
    } else if (type === "whip") {
      const g = this.add.graphics();
      g.lineStyle(4, color, 0.95);
      g.beginPath();
      g.moveTo(-90, 0);
      for (let i = 1; i <= 12; i++) g.lineTo(-90 + i * 15, Math.sin(i * 1.1) * 16);
      g.strokePath();
      g.setPosition(x, y).setAlpha(0);
      this.tweens.add({ targets: g, alpha: 1, angle: -30, scale: 1.3, duration: 170, yoyo: true, onComplete: () => g.destroy() });
    } else if (type === "staff") {
      const g = this.add.graphics();
      g.lineStyle(7, color, 0.95);
      g.lineBetween(0, -70, 0, 70);
      g.lineStyle(2, 0xffffff, 0.85);
      g.lineBetween(8, -50, 8, 50);
      g.setPosition(x - 20, y).setRotation(0.5).setAlpha(0);
      this.tweens.add({ targets: g, alpha: 1, x: x + 20, duration: 150, yoyo: true, onComplete: () => g.destroy() });
    } else {
      // 内功/异术：紫白光环爆发
      this.glowRing(x, y, color);
      const g = this.add.graphics();
      g.lineStyle(3, 0xffffff, 0.85);
      g.strokeCircle(0, 0, 12);
      g.setPosition(x, y);
      this.tweens.add({ targets: g, scale: 4.2, alpha: 0, duration: 380, onComplete: () => g.destroy() });
    }
    // 顿帧 80-120ms + 按倍率分级震屏
    this.tweens.timeScale = 0.08;
    this.time.delayedCall(110, () => {
      this.tweens.timeScale = 1;
    });
    this.cameras.main.shake(90 + mult * 30, 0.004 + mult * 0.002);
  }

  private slashAt(x: number, y: number, color: number, scale: number): void {
    const g = this.add.graphics();
    g.lineStyle(5, color, 0.95);
    g.beginPath();
    g.arc(0, 0, 34, -1.1, 1.1);
    g.strokePath();
    g.lineStyle(2, 0xffffff, 0.9);
    g.beginPath();
    g.arc(0, 0, 24, -0.8, 0.8);
    g.strokePath();
    g.setPosition(x, y);
    g.setScale(scale);
    g.setAlpha(0);
    this.tweens.add({
      targets: g,
      alpha: 1,
      angle: 70,
      scale: scale * 1.35,
      duration: 120,
      yoyo: true,
      onComplete: () => g.destroy()
    });
  }

  private sparkBurst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const s = this.add.image(x, y, "fx-spark").setScale(0.7 + Math.random() * 0.8).setTint(color);
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 40;
      this.tweens.add({
        targets: s,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.2,
        angle: 120,
        duration: 380 + Math.random() * 220,
        onComplete: () => s.destroy()
      });
    }
  }

  private healSparkles(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const s = this.add.image(x + (Math.random() - 0.5) * 34, y, "fx-spark").setScale(0.6 + Math.random() * 0.5).setTint(0x8ae08a);
      this.tweens.add({
        targets: s,
        y: y - 30 - Math.random() * 30,
        alpha: 0,
        duration: 600 + Math.random() * 300,
        onComplete: () => s.destroy()
      });
    }
  }

  private glowRing(x: number, y: number, color: number, debuff = false): void {
    const g = this.add.graphics();
    g.lineStyle(4, color, 0.9);
    g.strokeCircle(0, 0, 30);
    g.lineStyle(2, debuff ? 0x604888 : 0xffffff, 0.7);
    g.strokeCircle(0, 0, 40);
    g.setPosition(x, y);
    g.setAlpha(0.4);
    this.tweens.add({
      targets: g,
      alpha: 1,
      scale: 1.6,
      angle: 45,
      duration: 420,
      yoyo: true,
      onComplete: () => g.destroy()
    });
  }

  private smokeAt(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const s = this.add.image(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 16, "fx-smoke").setScale(0.6 + Math.random() * 0.9);
      this.tweens.add({
        targets: s,
        x: s.x + (Math.random() - 0.5) * 46,
        y: s.y - 34,
        alpha: 0,
        scale: s.scale * 1.8,
        duration: 700 + Math.random() * 400,
        onComplete: () => s.destroy()
      });
    }
  }

  private flashScreen(): void {
    const f = this.add.rectangle(480, 270, 960, 540, 0xffffff, 0.24);
    this.tweens.add({
      targets: f,
      alpha: 0,
      duration: 220,
      onComplete: () => f.destroy()
    });
  }

  private playerPalette(): string {
    return getApp().state?.player.gender === "female" ? "female" : "male";
  }
}
