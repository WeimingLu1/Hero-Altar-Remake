// 昼夜色温关键帧与天体弧线：WorldScene 与 BattleScene 共用。
// 纯函数，不依赖 Phaser。

export interface DayTint {
  color: number;
  alpha: number;
}

interface Key {
  h: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

// 全天色温关键帧：黎明橙粉 → 清晨淡金 → 正午青蓝 → 黄昏金红 → 入夜 → 深夜 → 黎明前微亮
const KEYS: Key[] = [
  { h: 0, r: 10, g: 18, b: 38, a: 0.36 },
  { h: 4, r: 16, g: 26, b: 48, a: 0.3 },
  { h: 5, r: 217, g: 122, b: 78, a: 0.16 },
  { h: 7, r: 255, g: 217, b: 160, a: 0.08 },
  { h: 10, r: 255, g: 242, b: 216, a: 0.03 },
  { h: 12, r: 207, g: 228, b: 240, a: 0.02 },
  { h: 15, r: 255, g: 224, b: 176, a: 0.05 },
  { h: 17, r: 232, g: 147, b: 79, a: 0.16 },
  { h: 19, r: 53, g: 64, b: 106, a: 0.22 },
  { h: 20, r: 14, g: 24, b: 48, a: 0.3 },
  { h: 22, r: 10, g: 18, b: 38, a: 0.34 },
  { h: 24, r: 10, g: 18, b: 38, a: 0.36 }
];

export function dayTint(hour: number): DayTint {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 1 && KEYS[i + 1].h < h) i++;
  const a = KEYS[i];
  const b = KEYS[Math.min(i + 1, KEYS.length - 1)];
  const span = b.h - a.h || 1;
  const t = Math.max(0, Math.min(1, (h - a.h) / span));
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return { color: (r << 16) | (g << 8) | bl, alpha: a.a + (b.a - a.a) * t };
}

// 夜色浓度 0..1：驱动星空、灯光、云变淡
export function nightness(hour: number): number {
  const { alpha } = dayTint(hour);
  return Math.max(0, Math.min(1, (alpha - 0.14) / 0.16));
}

export interface ArcPos {
  x: number;
  y: number;
  alpha: number;
}

// 太阳弧线：6 时升起，18 时落下（屏幕坐标 960×540）
export function sunArc(hour: number): ArcPos {
  const t = (hour - 6) / 12;
  const edge = Math.min((hour - 5) / 1.2, (19 - hour) / 1.2, 1);
  if (t < -0.1 || t > 1.1 || edge <= 0) return { x: -200, y: -200, alpha: 0 };
  const tc = Math.max(0, Math.min(1, t));
  return {
    x: 90 + tc * 780,
    y: 440 - Math.sin(tc * Math.PI) * 370,
    alpha: Math.max(0, edge)
  };
}

// 月亮弧线：18 时升起，次日 6 时落下（17-18 淡入，6-7 淡出）
export function moonArc(hour: number): ArcPos {
  const h = ((hour % 24) + 24) % 24;
  let alpha = 0;
  if (h >= 17 && h < 18) alpha = h - 17;
  else if (h >= 18 || h < 6) alpha = 1;
  else if (h >= 6 && h < 7) alpha = 7 - h;
  if (alpha <= 0) return { x: -200, y: -200, alpha: 0 };
  const t = Math.max(0, Math.min(1, ((h - 18 + 24) % 24) / 12));
  return {
    x: 90 + t * 780,
    y: 430 - Math.sin(t * Math.PI) * 350,
    alpha
  };
}
