export type BubbleKind = "speech" | "action" | "player";

export type AmbientBubbleInput = {
  x: number;
  y: number;
  text: string;
  kind: BubbleKind;
  shownAt: number;
  /** 双人对话时一人台词显示在脚下(默认头顶)，与对方一上一下更清楚。 */
  preferBelow?: boolean;
};

export type AmbientBubbleBox = {
  text: string;
  kind: BubbleKind;
  shownAt: number;
  left: number;
  top: number;
  width: number;
  height: number;
  lines: string[];
};

type LayoutObstacle = { left: number; top: number; width: number; height: number };

const W = 640;
const H = 480;
/** 头顶气泡的最大文本宽度与整体宽度（小字号紧凑气泡）。 */
const BUBBLE_TEXT_WIDTH = 128;
const BUBBLE_MAX_WIDTH = 144;
const BUBBLE_LINE_HEIGHT = 9;

function fontFor(kind: BubbleKind) {
  return kind === "action"
    ? "italic 6px sans-serif"
    : kind === "player"
      ? "bold 6px sans-serif"
      : "6px sans-serif";
}

/** 假设 ctx.font 已按气泡类型设置，按最大宽度逐字换行。 */
function wrapAmbientText(ctx: CanvasRenderingContext2D, clean: string, maxWidth = BUBBLE_TEXT_WIDTH) {
  const lines: string[] = [];
  let line = "";
  for (const character of clean) {
    const candidate = line + character;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
    } else line = candidate;
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

export function measureAmbientBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  kind: BubbleKind,
): { width: number; height: number; lines: string[] } {
  const clean = text.replace(/\s+/g, " ").trim();
  ctx.save();
  ctx.font = fontFor(kind);
  const lines = wrapAmbientText(ctx, clean);
  const width = Math.min(
    BUBBLE_MAX_WIDTH,
    Math.max(...lines.map((item) => ctx.measureText(item).width)) + 8,
  );
  ctx.restore();
  return { width, height: lines.length * BUBBLE_LINE_HEIGHT + 2, lines };
}

/** 把重叠的气泡自动错开：优先在头顶向上堆叠，其次移到角色下方，最后左右平移。 */
export function resolveAmbientBubbleLayout(
  ctx: CanvasRenderingContext2D,
  bubbles: AmbientBubbleInput[],
  obstacles: LayoutObstacle[] = [],
): AmbientBubbleBox[] {
  const measured = bubbles.map((bubble) => {
    const m = measureAmbientBubble(ctx, bubble.text, bubble.kind);
    return {
      ...bubble,
      ...m,
      left: Math.max(3, Math.min(W - m.width - 3, bubble.x - m.width / 2)),
      // 头顶优先；双人对话的「脚下」台词则让箱体顶边贴在基准点下方。
      top: bubble.preferBelow ? bubble.y + 2 : bubble.y - m.height,
      baseY: bubble.y,
    };
  });
  const placed: AmbientBubbleBox[] = [];
  const overlap = (
    a: { left: number; top: number; width: number; height: number },
    b: AmbientBubbleBox,
  ) =>
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height;
  const sorted = [...measured].sort((a, b) => a.top - b.top || a.left - b.left);
  for (const box of sorted) {
    const fits = (candidate: { left: number; top: number }) => {
      if (
        candidate.left < 3 ||
        candidate.left + box.width > W - 3 ||
        candidate.top < 3 ||
        candidate.top + box.height > H - 3
      )
        return false;
      // 补上候选框的宽高再做重叠判定
      const sized = {
        left: candidate.left,
        top: candidate.top,
        width: box.width,
        height: box.height,
      };
      return !placed.some((p) => overlap(sized, p)) && !obstacles.some((p) => overlap(sized, p as AmbientBubbleBox));
    };
    const candidates: Array<{ left: number; top: number }> = [];
    for (let i = 0; i < 12; i++)
      candidates.push({ left: box.left, top: box.top - i * (box.height + 4) });
    for (let i = 0; i < 12; i++)
      candidates.push({ left: box.left, top: box.baseY + 34 + i * (box.height + 4) });
    for (let i = 1; i <= 6; i++) {
      candidates.push({ left: box.left - i * (box.width + 8), top: box.top });
      candidates.push({ left: box.left + i * (box.width + 8), top: box.top });
    }
    const chosen = candidates.find(fits) || { left: box.left, top: box.top };
    placed.push({
      text: box.text,
      kind: box.kind,
      shownAt: box.shownAt,
      left: chosen.left,
      top: chosen.top,
      width: box.width,
      height: box.height,
      lines: box.lines,
    });
  }
  return placed;
}

/** 绘制头顶台词：无背景框，深色描边+阴影保证任何底色上可读；「to」显示为箭头，动作青色斜体、独白白色。 */
export function drawAmbientBubble(ctx: CanvasRenderingContext2D, box: AmbientBubbleBox) {
  const { left, top, width, kind, lines } = box,
    monologue = box.text.includes("自言自语"),
    accent = kind === "action"
      ? "#77d6c7"
      : kind === "player"
        ? "#8ecbff"
        : monologue
          ? "#ffffff"
          : "#f0cf71";
  ctx.save();
  ctx.font = fontFor(kind);
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,.95)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.strokeStyle = "rgba(0,0,0,.9)";
  ctx.lineWidth = 2;
  ctx.fillStyle = accent;
  lines.forEach((line, index) => {
    const text = line.replace(/ to /g, " → "),
      baselineY = top + BUBBLE_LINE_HEIGHT + index * BUBBLE_LINE_HEIGHT;
    ctx.strokeText(text, left + width / 2, baselineY);
    ctx.fillText(text, left + width / 2, baselineY);
  });
  ctx.restore();
}
