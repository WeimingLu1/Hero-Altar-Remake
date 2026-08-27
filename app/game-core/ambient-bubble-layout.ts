export type BubbleKind = "speech" | "action" | "player";

export type AmbientBubbleInput = {
  /** Speaker center x in canvas pixels. */
  x: number;
  /** Top of the speaker's head in canvas pixels. */
  y: number;
  /** Bottom of the speaker sprite; defaults to y + 54 for older callers. */
  bottomY?: number;
  text: string;
  kind: BubbleKind;
  shownAt: number;
};

export type AmbientBubblePlacement =
  | "above"
  | "left"
  | "right"
  | "below"
  | "fallback";

export type AmbientBubbleBox = {
  text: string;
  kind: BubbleKind;
  shownAt: number;
  left: number;
  top: number;
  width: number;
  height: number;
  lines: string[];
  placement: AmbientBubblePlacement;
};

export type LayoutObstacle = { left: number; top: number; width: number; height: number };

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

type BubbleCandidate = {
  left: number;
  top: number;
  placement: AmbientBubblePlacement;
};

const EDGE = 3;
const HEAD_GAP = 4;
const SIDE_GAP = 7;
const SPEAKER_HALF_WIDTH = 15;

/**
 * Stable collision avoidance around the speaker. Candidate priority is:
 * centered above the head → either side → below the feet → nearby fallback.
 * The last fallback performs a bounded canvas scan, so a free remote position
 * is preferred over allowing two lines to cover each other.
 */
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
      headY: bubble.y,
      bottomY: bubble.bottomY ?? bubble.y + 54,
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
  const insideCanvas = (candidate: BubbleCandidate, width: number, height: number) =>
    candidate.left >= EDGE &&
    candidate.left + width <= W - EDGE &&
    candidate.top >= EDGE &&
    candidate.top + height <= H - EDGE;
  const intersectionArea = (
    a: { left: number; top: number; width: number; height: number },
    b: { left: number; top: number; width: number; height: number },
  ) => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

  // 输入顺序决定谁先占首选位置；稳定顺序可避免每帧左右跳动。
  for (const box of measured) {
    const fits = (candidate: BubbleCandidate) => {
      if (!insideCanvas(candidate, box.width, box.height)) return false;
      const sized = {
        left: candidate.left,
        top: candidate.top,
        width: box.width,
        height: box.height,
      };
      return !placed.some((p) => overlap(sized, p)) && !obstacles.some((p) => overlap(sized, p as AmbientBubbleBox));
    };
    const centeredLeft = box.x - box.width / 2,
      aboveTop = box.headY - box.height - HEAD_GAP,
      sideTop = (box.headY + box.bottomY - box.height) / 2,
      leftSide: BubbleCandidate = {
        left: box.x - SPEAKER_HALF_WIDTH - SIDE_GAP - box.width,
        top: sideTop,
        placement: "left",
      },
      rightSide: BubbleCandidate = {
        left: box.x + SPEAKER_HALF_WIDTH + SIDE_GAP,
        top: sideTop,
        placement: "right",
      },
      sides = box.x <= W / 2 ? [rightSide, leftSide] : [leftSide, rightSide],
      primary: BubbleCandidate[] = [
        { left: centeredLeft, top: aboveTop, placement: "above" },
        ...sides,
        { left: centeredLeft, top: box.bottomY + HEAD_GAP, placement: "below" },
      ],
      fallback: BubbleCandidate[] = [];
    const horizontalSteps = [box.width / 2 + 18, box.width + 26];
    for (const dx of horizontalSteps) {
      fallback.push(
        { left: centeredLeft - dx, top: aboveTop, placement: "fallback" },
        { left: centeredLeft + dx, top: aboveTop, placement: "fallback" },
        { left: centeredLeft - dx, top: box.bottomY + HEAD_GAP, placement: "fallback" },
        { left: centeredLeft + dx, top: box.bottomY + HEAD_GAP, placement: "fallback" },
      );
    }
    for (let ring = 1; ring <= 4; ring++) {
      const dy = ring * (box.height + 8),
        dx = ring * (box.width / 2 + 12);
      fallback.push(
        { left: centeredLeft, top: aboveTop - dy, placement: "fallback" },
        { left: centeredLeft, top: box.bottomY + HEAD_GAP + dy, placement: "fallback" },
        { left: centeredLeft - dx, top: sideTop - dy / 2, placement: "fallback" },
        { left: centeredLeft + dx, top: sideTop - dy / 2, placement: "fallback" },
        { left: centeredLeft - dx, top: sideTop + dy / 2, placement: "fallback" },
        { left: centeredLeft + dx, top: sideTop + dy / 2, placement: "fallback" },
      );
    }
    let chosen = [...primary, ...fallback].find(fits);
    if (!chosen) {
      // Rare dense-screen fallback: search a coarse grid for the nearest truly
      // free coordinate instead of silently reusing the occupied head slot.
      let best: BubbleCandidate | undefined,
        bestScore = Number.POSITIVE_INFINITY;
      for (let top = EDGE; top <= H - box.height - EDGE; top += 12) {
        for (let left = EDGE; left <= W - box.width - EDGE; left += 12) {
          const candidate = { left, top, placement: "fallback" as const };
          if (!fits(candidate)) continue;
          const score = Math.abs(left + box.width / 2 - box.x) +
            Math.abs(top + box.height / 2 - box.headY) * 1.15 +
            (top > box.bottomY ? 12 : 0);
          if (score < bestScore) {
            best = candidate;
            bestScore = score;
          }
        }
      }
      chosen = best;
    }
    if (!chosen) {
      // A completely saturated canvas is theoretically possible. Pick the
      // bounded candidate with the least covered area as a deterministic last
      // resort, still moving away from the original occupied coordinate.
      chosen = [...primary, ...fallback]
        .filter((candidate) => insideCanvas(candidate, box.width, box.height))
        .sort((a, b) => {
          const area = (candidate: BubbleCandidate) => {
            const sized = { ...candidate, width: box.width, height: box.height };
            return [...placed, ...obstacles].reduce(
              (sum, item) => sum + intersectionArea(sized, item),
              0,
            );
          };
          return area(a) - area(b);
        })[0] || {
        left: Math.max(EDGE, Math.min(W - box.width - EDGE, centeredLeft)),
        top: Math.max(EDGE, Math.min(H - box.height - EDGE, aboveTop)),
        placement: "fallback",
      };
    }
    placed.push({
      text: box.text,
      kind: box.kind,
      shownAt: box.shownAt,
      left: chosen.left,
      top: chosen.top,
      width: box.width,
      height: box.height,
      lines: box.lines,
      placement: chosen.placement,
    });
  }
  return placed;
}

/** 绘制环境台词：无背景框，深色描边+阴影保证任何底色上可读；「to」显示为箭头，动作青色斜体、独白白色。 */
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
