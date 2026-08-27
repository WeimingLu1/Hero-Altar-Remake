import assert from "node:assert/strict";
import test from "node:test";
import { drawAmbientBubble, measureAmbientBubble, resolveAmbientBubbleLayout } from "../app/game-core/ambient-bubble-layout";

const mockCtx = (): CanvasRenderingContext2D => {
  const ctx = {
    save: () => {},
    restore: () => {},
    font: "",
    measureText: (text: string) => ({ width: String(text).length * 6 }),
  };
  return ctx as unknown as CanvasRenderingContext2D;
};

const recordingCtx = () => {
  const stroked: string[] = [];
  const filled: Array<{ text: string; fillStyle: string }> = [];
  const ctx = {
    save: () => {},
    restore: () => {},
    font: "",
    textAlign: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    measureText: (text: string) => ({ width: String(text).length * 6 }),
    strokeText: (text: string) => {
      stroked.push(text);
    },
    fillText: (text: string) => {
      filled.push({ text, fillStyle: ctx.fillStyle });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, stroked, filled };
};

const overlaps = (
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;

test("重叠的两个气泡被自动错开到不重叠的位置", () => {
  const ctx = mockCtx();
  const placed = resolveAmbientBubbleLayout(ctx, [
    { x: 100, y: 100, text: "你好", kind: "speech", shownAt: 1 },
    { x: 108, y: 100, text: "吃了吗", kind: "speech", shownAt: 2 },
  ]);
  assert.equal(placed.length, 2);
  assert.equal(
    overlaps(placed[0], placed[1]),
    false,
    `两个气泡不应重叠: ${JSON.stringify(placed)}`,
  );
});

test("玩家与 NPC 气泡也互相错开", () => {
  const ctx = mockCtx();
  const placed = resolveAmbientBubbleLayout(ctx, [
    { x: 120, y: 80, text: "玩家说话", kind: "player", shownAt: 1 },
    { x: 124, y: 80, text: "这位兄台请留步", kind: "speech", shownAt: 2 },
  ]);
  assert.equal(placed.length, 2);
  assert.equal(overlaps(placed[0], placed[1]), false);
});

test("头顶台词字号小、宽度窄、无背景框", () => {
  const ctx = mockCtx();
  const m = measureAmbientBubble(ctx, "这是一句比较长的对话台词内容", "speech");
  assert.ok(m.width <= 144, `气泡宽度应被限制: ${m.width}`);
  assert.equal(m.height, m.lines.length * 9 + 2);
});

test("drawAmbientBubble 整句描边+填充显示且把 to 显示为箭头", () => {
  const { ctx, stroked, filled } = recordingCtx();
  const box = {
    text: "甲 to 乙：“你好”",
    kind: "speech" as const,
    shownAt: 1000,
    left: 10,
    top: 10,
    width: 120,
    height: 12,
    lines: ["甲 to 乙：“你好”"],
    placement: "above" as const,
  };
  drawAmbientBubble(ctx, box);
  assert.deepEqual(stroked, ["甲 → 乙：“你好”"]);
  assert.deepEqual(filled, [{ text: "甲 → 乙：“你好”", fillStyle: "#f0cf71" }]);
});

test("独白用白色、动作用青色、玩家用蓝色", () => {
  const { ctx, filled } = recordingCtx();
  const mono = {
    text: "甲自言自语：“今天天真好”",
    kind: "speech" as const,
    shownAt: 1,
    left: 10,
    top: 10,
    width: 120,
    height: 12,
    lines: ["甲自言自语：“今天天真好”"],
    placement: "above" as const,
  };
  drawAmbientBubble(ctx, mono);
  assert.equal(filled.at(-1)?.fillStyle, "#ffffff");
  const action = { ...mono, text: "甲正在和环境交互：扫地", kind: "action" as const, lines: ["甲正在和环境交互：扫地"] };
  drawAmbientBubble(ctx, action);
  assert.equal(filled.at(-1)?.fillStyle, "#77d6c7");
  const player = { ...mono, text: "主角 to 乙：“在的”", kind: "player" as const, lines: ["主角 to 乙：“在的”"] };
  drawAmbientBubble(ctx, player);
  assert.equal(filled.at(-1)?.fillStyle, "#8ecbff");
});

test("会话气泡默认都从各自头顶向上展开", () => {
  const ctx = mockCtx();
  const placed = resolveAmbientBubbleLayout(ctx, [
    { x: 80, y: 100, text: "甲说话", kind: "speech", shownAt: 1 },
    { x: 260, y: 100, text: "乙说话", kind: "speech", shownAt: 2 },
  ]);
  assert.ok(placed.every((bubble) => bubble.top < 100));
  assert.deepEqual(placed.map((bubble) => bubble.text), ["甲说话", "乙说话"]);
});

test("头顶被占用时优先移到空间更充足的一侧", () => {
  const placed = resolveAmbientBubbleLayout(mockCtx(), [
    { x: 200, y: 120, bottomY: 170, text: "侧边显示", kind: "speech", shownAt: 1 },
  ], [{ left: 0, top: 0, width: 640, height: 122 }]);
  assert.equal(placed[0].placement, "right");
  assert.ok(placed[0].left > 200);
});

test("头顶和两侧都被占用时移到人物脚下", () => {
  const placed = resolveAmbientBubbleLayout(mockCtx(), [
    { x: 200, y: 120, bottomY: 170, text: "下方显示", kind: "speech", shownAt: 1 },
  ], [
    { left: 0, top: 0, width: 640, height: 122 },
    { left: 0, top: 122, width: 640, height: 48 },
  ]);
  assert.equal(placed[0].placement, "below");
  assert.ok(placed[0].top >= 174);
});

test("四个首选方位都冲突时寻找不重叠的邻近坐标", () => {
  const obstacles = [
    { left: 175, top: 90, width: 50, height: 35 },
    { left: 218, top: 125, width: 80, height: 50 },
    { left: 95, top: 125, width: 88, height: 50 },
    { left: 175, top: 170, width: 50, height: 35 },
  ];
  const placed = resolveAmbientBubbleLayout(mockCtx(), [
    { x: 200, y: 120, bottomY: 170, text: "换个坐标", kind: "speech", shownAt: 1 },
  ], obstacles);
  assert.equal(placed[0].placement, "fallback");
  assert.ok(obstacles.every((obstacle) => !overlaps(placed[0], obstacle)));
});

test("多人气泡都保持在画布内且两两不重叠", () => {
  const ctx = mockCtx();
  const bubbles = Array.from({ length: 6 }, (_, i) => ({
    x: 100 + (i % 2) * 40,
    y: 60 + Math.floor(i / 2) * 40,
    text: `第${i}个角色说话内容`,
    kind: "speech" as const,
    shownAt: i,
  }));
  const placed = resolveAmbientBubbleLayout(ctx, bubbles);
  for (let i = 0; i < placed.length; i++) {
    assert.ok(placed[i].left >= 3 && placed[i].top >= 3, `气泡在画布内: ${JSON.stringify(placed[i])}`);
    assert.ok(placed[i].left + placed[i].width <= 637, `气泡未超出右边界: ${JSON.stringify(placed[i])}`);
    assert.ok(placed[i].top + placed[i].height <= 477, `气泡未超出下边界: ${JSON.stringify(placed[i])}`);
    for (let j = i + 1; j < placed.length; j++)
      assert.equal(overlaps(placed[i], placed[j]), false, `气泡${i}与${j}重叠: ${JSON.stringify([placed[i], placed[j]])}`);
  }
});
