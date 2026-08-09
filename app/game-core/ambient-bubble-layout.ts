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

export type ConversationCardInput = {
  x: number;
  y: number;
  lines: string[];
  playerInvolved?: boolean;
  playerName?: string;
};

export type ConversationCardBox = ConversationCardInput & {
  left: number;
  top: number;
  width: number;
  height: number;
  entries: Array<{ route: string; lines: string[] }>;
};

type LayoutObstacle = { left: number; top: number; width: number; height: number };

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
  obstacles: LayoutObstacle[] = [],
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

function conversationParts(value: string) {
  const clean = value.replace(/^群聊\s*·\s*/, "").trim(),
    routed = clean.match(/^(.+?)\s+to\s+(.+?)：[“"]?(.*?)[”"]?$/);
  if (routed) return { route: `${routed[1]} → ${routed[2]}`, text: routed[3] };
  const solo = clean.match(/^(.+?)(?:自言自语|正在和环境交互)：[“"]?(.*?)[”"]?$/);
  return solo ? { route: solo[1], text: solo[2] } : { route: "交谈", text: clean };
}

export function layoutConversationCard(ctx: CanvasRenderingContext2D, card: ConversationCardInput): ConversationCardBox {
  const width = 218,
    entries = card.lines.slice(-3).map(conversationParts),
    wrapped = entries.map((entry) => {
      const lines: string[] = []; let line = "";
      ctx.save(); ctx.font = "9px sans-serif";
      for (const character of entry.text) {
        const next = line + character;
        if (line && ctx.measureText(next).width > width - 20) { lines.push(line); line = character; }
        else line = next;
      }
      if (line) lines.push(line);
      ctx.restore();
      return { ...entry, lines };
    }),
    height = 14 + wrapped.reduce((sum, entry) => sum + 13 + entry.lines.length * 12 + 3, 0),
    left = Math.max(5, Math.min(W - width - 5, card.x - width / 2)),
    top = Math.max(5, Math.min(H - height - 5, card.y - height));
  return { ...card, left, top, width, height, entries: wrapped };
}

export function drawConversationCard(ctx: CanvasRenderingContext2D, card: ConversationCardBox) {
  const { left, top, width, height, entries } = card;
  ctx.save();
  ctx.fillStyle = card.playerInvolved ? "rgba(5,13,20,.97)" : "rgba(5,12,10,.95)"; ctx.fillRect(left, top, width, height);
  ctx.strokeStyle = card.playerInvolved ? "rgba(91,166,224,.98)" : "rgba(207,177,95,.88)"; ctx.lineWidth = card.playerInvolved ? 2 : 1.5; ctx.strokeRect(left + .75, top + .75, width - 1.5, height - 1.5);
  let cursor = top + 14;
  entries.forEach((entry, index) => {
    const playerRoute = card.playerName && entry.route.split(" → ").includes(card.playerName);
    ctx.textAlign = "left"; ctx.font = "bold 9px sans-serif"; ctx.fillStyle = playerRoute ? "#8ecbff" : index === entries.length - 1 ? "#f2d67f" : "#9eb7aa";
    ctx.fillText(entry.route, left + 9, cursor); cursor += 13;
    ctx.font = "9px sans-serif"; ctx.fillStyle = "#e8eadf";
    entry.lines.forEach((line) => { ctx.fillText(line, left + 10, cursor); cursor += 12; });
    cursor += 3;
  });
  ctx.restore();
}
