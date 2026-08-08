export type BubbleKind = "speech" | "action" | "player";

export type AmbientBubbleInput = {
  x: number;
  y: number;
  text: string;
  kind: BubbleKind;
  shownAt: number;
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

const W = 640;
const H = 480;

export function measureAmbientBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  kind: BubbleKind,
): { width: number; height: number; lines: string[] } {
  const clean = text.replace(/\s+/g, " ").trim();
  ctx.save();
  ctx.font =
    kind === "action"
      ? "italic 10px sans-serif"
      : kind === "player"
        ? "bold 10px sans-serif"
        : "10px sans-serif";
  const maxTextWidth = 204,
    lines: string[] = [];
  let line = "";
  for (const character of clean) {
    const candidate = line + character;
    if (line && ctx.measureText(candidate).width > maxTextWidth) {
      lines.push(line);
      line = character;
    } else line = candidate;
  }
  if (line || !lines.length) lines.push(line);
  const width = Math.min(
    220,
    Math.max(...lines.map((item) => ctx.measureText(item).width)) + 16,
  );
  ctx.restore();
  return { width, height: lines.length * 14 + 8, lines };
}

/** 把重叠的气泡自动错开：优先在头顶向上堆叠，其次移到角色下方，最后左右平移。 */
export function resolveAmbientBubbleLayout(
  ctx: CanvasRenderingContext2D,
  bubbles: AmbientBubbleInput[],
): AmbientBubbleBox[] {
  const measured = bubbles.map((bubble) => {
    const m = measureAmbientBubble(ctx, bubble.text, bubble.kind);
    return {
      ...bubble,
      ...m,
      left: Math.max(3, Math.min(W - m.width - 3, bubble.x - m.width / 2)),
      top: bubble.y - m.height, // 头顶优先位置(暂不钳制，由候选处理)
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
      return !placed.some((p) => overlap(sized, p));
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

export function drawAmbientBubble(
  ctx: CanvasRenderingContext2D,
  box: AmbientBubbleBox,
) {
  const { left, top, width, height, lines, kind } = box,
    accent = kind === "action" ? "#77d6c7" : kind === "player" ? "#8ecbff" : "#f0cf71";
  ctx.save();
  ctx.font =
    kind === "action"
      ? "italic 10px sans-serif"
      : kind === "player"
        ? "bold 10px sans-serif"
        : "10px sans-serif";
  ctx.fillStyle = "rgba(5,12,8,.94)";
  ctx.strokeStyle =
    kind === "action"
      ? "rgba(82,174,162,.82)"
      : kind === "player"
        ? "rgba(91,166,224,.95)"
        : "rgba(193,157,75,.86)";
  ctx.lineWidth = 1;
  ctx.fillRect(left, top, width, height);
  ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);
  ctx.fillStyle = accent;
  ctx.textAlign = "center";
  lines.forEach((line, index) =>
    ctx.fillText(line, left + width / 2, top + 14 + index * 14),
  );
  ctx.restore();
}
