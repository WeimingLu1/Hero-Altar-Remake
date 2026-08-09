import assert from "node:assert/strict";
import test from "node:test";
import { layoutConversationCard, resolveAmbientBubbleLayout } from "../app/game-core/ambient-bubble-layout";

const mockCtx = (): CanvasRenderingContext2D => {
  const ctx = {
    save: () => {},
    restore: () => {},
    font: "",
    measureText: (text: string) => ({ width: String(text).length * 6 }),
  };
  return ctx as unknown as CanvasRenderingContext2D;
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

test("动作气泡避开多人对话卡", () => {
  const ctx = mockCtx();
  const card = layoutConversationCard(ctx, { x: 120, y: 150, lines: ["甲 to 乙：第一句", "乙 to 甲：第二句"] });
  const [bubble] = resolveAmbientBubbleLayout(ctx, [
    { x: 120, y: 120, text: "正在观察四周", kind: "action", shownAt: 1 },
  ], [card]);
  assert.equal(overlaps(bubble, card), false);
  assert.ok(card.height >= 70, "卡片高度应容纳全部行");
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
