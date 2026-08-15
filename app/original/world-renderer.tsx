import {
  activePage,
  friendlyEventName,
  getOriginalMap,
  type MapEvent,
  type OriginalMap,
} from "../game-core/original-world";
import {
  ambientViewportBounds,
  type AmbientBubbleKind,
  type AmbientNpc,
  type AmbientWorld,
} from "../game-core/ambient-npc";
import {
  drawAmbientBubble,
  drawConversationCard,
  layoutConversationCard,
  resolveAmbientBubbleLayout,
} from "../game-core/ambient-bubble-layout";
import {
  executeMapCommands,
  parseSceneGate,
  selectSceneEvent,
} from "../game-core/rmxp-events";
import { npcRecord } from "../game-core/npc-system";
import { canObtainCaihua } from "../game-core/actor-conditions";
import { isCurrentKillTarget } from "../game-core/kill-target";
import { npcVisibleWithInventory } from "../game-core/hidden-npc";
import type { AmbientPlayerState } from "../game-core/ambient-player";
import type { WorldSave } from "../game-core/save-system";

export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 480;
const W = WORLD_WIDTH;
const H = WORLD_HEIGHT;
const T = 32;

type WuxiaArt = {
  characters: Array<HTMLImageElement | null>;
  natureOverlays: HTMLImageElement | null;
  interiorOverlays: HTMLImageElement | null;
};
export type CharacterSprite = { sheet: number; row: number; portrait?: number };

export function characterDirectionColumn(direction: number) {
  // Generated profiles are named by their visible screen-facing direction.
  // RMXP direction 4 means travel left, so it uses the left-facing profile.
  return direction === 4 ? 2 : direction === 6 ? 1 : direction === 8 ? 3 : 0;
}

const wuxiaArt: WuxiaArt = {
  characters: [null, null, null, null, null, null, null],
  natureOverlays: null,
  interiorOverlays: null,
};
const characterSheetNames = [
  "wuxia-characters-v1.webp",
  "wuxia-characters-ages-v1.webp",
  "wuxia-characters-townsfolk-v1.webp",
  "wuxia-characters-factions-v1.webp",
  "wuxia-characters-women-v1.webp",
  "wuxia-characters-faction-signatures-v1.webp",
  "wuxia-characters-flower-variants-v1.webp",
] as const;
const loadingCharacterSheets = new Set<number>();
let artRevision = 0;

export function loadWorldArt() {
  const load = (src: string, ready: (image: HTMLImageElement) => void) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => ready(image);
    image.src = src;
  };
  const loadCharacterSheet = (index: number) => {
    if (wuxiaArt.characters[index] || loadingCharacterSheets.has(index)) return;
    loadingCharacterSheets.add(index);
    load(`/game-assets/generated/${characterSheetNames[index]}`, (image) => {
      wuxiaArt.characters[index] = image;
      loadingCharacterSheets.delete(index);
      artRevision += 1;
      staticMapCache.clear();
    });
  };
  ensureCharacterSheet = loadCharacterSheet;
  // The player sheet is required immediately. NPC sheets are requested only
  // when a visible character actually uses them.
  loadCharacterSheet(0);
  load("/game-assets/redrawn/overlay-nature-v3.webp", (image) => {
    wuxiaArt.natureOverlays = image;
    artRevision += 1;
    staticMapCache.clear();
  });
  load("/game-assets/redrawn/overlay-interior-v3.webp", (image) => {
    wuxiaArt.interiorOverlays = image;
    artRevision += 1;
    staticMapCache.clear();
  });
}

let ensureCharacterSheet: (index: number) => void = () => {};

export function npcCharacterSprite(id: number, fallbackName = ""): CharacterSprite {
  const npc = id > 0 ? npcRecord(id) : {},
    name = String(npc.name || fallbackName),
    description = ((npc.des_text as string[]) || []).join(""),
    text = `${name}${description}`,
    age = Number(npc.age || 30),
    female = Number(npc.gender || 0) === 1,
    merchant = Number(npc.type || 0) === -1 || /老板|掌柜|商人|店|贩|卖/.test(text);
  // Age is a physical identity constraint, not a styling hint. Keep children and
  // elders recognisable even when their descriptions also mention a faction.
  if (age < 18) return { sheet: 1, row: female ? 1 : 0 };
  if (age >= 55) return { sheet: 1, row: female ? 3 : 2 };
  const specialPortraits: Record<string, number> = {
    阿绣: 20, 李青照: 21, 柳如是: 22, 聂隐娘: 23, 入画: 24,
    唐晚词: 25, 李师师: 26, 薛涛: 27, 王璁儿: 28, 唐思儿: 29,
    薛千柔: 32, 白瑞德: 33,
  };
  if (specialPortraits[name] !== undefined) {
    if (/王璁儿|唐思儿/.test(name)) return { sheet: 5, row: 1, portrait: specialPortraits[name] };
    if (name === "薛千柔") return { sheet: 5, row: 3, portrait: 32 };
    if (name === "白瑞德") return { sheet: 0, row: 2, portrait: 33 };
    const flowerRows: Record<string, number> = { 阿绣: 0, 李青照: 1, 柳如是: 2, 聂隐娘: 3 };
    return { sheet: 6, row: flowerRows[name] ?? hashIndex(name, 4), portrait: specialPortraits[name] };
  }
  if (/花间派|李青照|名妓|侍女|剑器之舞|红拂女/.test(text) && female)
    return { sheet: 6, row: hashIndex(name, 4), portrait: 20 + hashIndex(name, 8) };
  if (/红莲教/.test(text))
    return female
      ? { sheet: 5, row: 1, portrait: 28 + hashIndex(name, 2) }
      : { sheet: 3, row: 0, portrait: 31 };
  if (/武当/.test(text)) return { sheet: 5, row: 2, portrait: 30 };
  if (/雪山/.test(text))
    return female ? { sheet: 5, row: 3, portrait: 32 } : { sheet: 0, row: 2, portrait: 33 };
  if (/冰火岛/.test(text))
    return female ? { sheet: 4, row: 0, portrait: 34 } : { sheet: 3, row: 0, portrait: 35 };
  if (female) {
    if (/师太|尼姑|女尼|居士/.test(text)) return { sheet: 4, row: 2 };
    if (/女侠|掌门|剑|杀手|教主|寨主|护法|武功/.test(text))
      return { sheet: 4, row: 0 };
    if (merchant) return { sheet: 4, row: 1 };
    if (/厨|妇人|婆|工|婶|嫂/.test(text))
      return { sheet: 4, row: 3 };
    return { sheet: 0, row: hashIndex(name, 2) ? 1 : 3 };
  }
  if (/和尚|大师|方丈|禅师|罗汉|僧/.test(text)) return { sheet: 3, row: 2 };
  if (/道长|真人|道士|天师|武当|茅山/.test(text)) return { sheet: 3, row: 3 };
  if (/捕快|官|衙门|村长|管事|将军/.test(text)) return { sheet: 2, row: 0 };
  if (merchant) return { sheet: 2, row: 1 };
  if (/公子|书生|秀才|先生|教书|文士|扇/.test(text)) return { sheet: 2, row: 2 };
  if (/厨|工|铁匠|石料|樵夫|伙计|船夫/.test(text)) return { sheet: 2, row: 3 };
  if (/盗|匪|恶|杀手|喽啰|山贼|强人/.test(text)) return { sheet: 3, row: 1 };
  if (/大侠|掌门|剑|刀|教主|寨主|护法|武师|武功/.test(text))
    return { sheet: 3, row: 0 };
  return { sheet: 0, row: hashIndex(name, 2) ? 2 : 0 };
}

export function CharacterPortrait({
  npcId,
  name = "",
  playerGender,
  className = "",
}: {
  npcId?: number;
  name?: string;
  playerGender?: number;
  className?: string;
}) {
  const sprite =
      playerGender === undefined
        ? npcCharacterSprite(npcId || 0, name)
        : { sheet: 0, row: playerGender ? 1 : 0 },
    index = sprite.portrait ?? sprite.sheet * 4 + sprite.row,
    factionPortrait = index >= 20,
    localIndex = factionPortrait ? index - 20 : index,
    columns = factionPortrait ? 4 : 5,
    column = localIndex % columns,
    row = Math.floor(localIndex / columns);
  return (
    <div
      className={`character-portrait ${className}`.trim()}
      role="img"
      aria-label={`${name || "人物"}立绘`}
      style={{
        backgroundImage: factionPortrait
          ? 'url("/game-assets/generated/wuxia-faction-portraits-v1.webp")'
          : undefined,
        backgroundSize: factionPortrait ? "400% 400%" : undefined,
        backgroundPosition: `${(column / (columns - 1)) * 100}% ${(row / 3) * 100}%`,
      }}
    />
  );
}

function conversationSessionKey(npc: AmbientNpc, player: AmbientPlayerState) {
  if (npc.bubbleKind === "action") return "";
  if (npc.groupId) return `group:${npc.groupId}`;
  if (npc.partnerId) return `pair:${Math.min(npc.eventId, npc.partnerId)}:${Math.max(npc.eventId, npc.partnerId)}`;
  if (player.npcIds.includes(npc.eventId) && npc.speechTargetName)
    return `player:${[...player.npcIds].sort((a, b) => a - b).join(":")}`;
  const routed = npc.bubble.match(/^(?:群聊\s*·\s*)?(.+?)\s+to\s+(.+?)：/);
  if (routed) return `route:${[routed[1], routed[2]].sort().join(":")}`;
  return "";
}

function collectConversationCards(ambient: AmbientWorld, player: AmbientPlayerState, sx: number, sy: number, playerName: string) {
  const sessions = new Map<string, AmbientNpc[]>();
  for (const npc of ambient.npcs) {
    const key = conversationSessionKey(npc, player);
    if (!key) continue;
    sessions.set(key, [...(sessions.get(key) || []), npc]);
  }
  return [...sessions.values()].flatMap((members) => {
    const contexts = members.map((member) => member.conversationContext).sort((a, b) => b.length - a.length),
      active = members.filter((member) => member.bubble).sort((a, b) => a.bubbleShownAt - b.bubbleShownAt).map((member) => member.bubble),
      includesPlayer = members.some((member) => player.npcIds.includes(member.eventId)),
      history = [...(contexts[0] || []), ...active, ...(includesPlayer && player.bubble ? [player.bubble] : [])]
        .filter((line, index, all) => line && all.indexOf(line) === index)
        .slice(-3);
    const live = members.some((member) =>
      Boolean(member.bubble || member.queuedBubble || member.generationPending),
    );
    // conversationContext is prompt history, not visible UI state. Once the
    // live turn has ended (or movement has detached the player), history must
    // not resurrect a card or keep it anchored above the protagonist.
    if (!history.length || (!live && !(includesPlayer && player.bubble))) return [];
    return [{
      x: members.reduce((sum, member) => sum + (member.x - sx) * T + 16, 0) / members.length,
      y: Math.min(...members.map((member) => (member.y - sy) * T - 18)),
      lines: history,
      playerInvolved: includesPlayer,
      playerName,
    }];
  });
}

export function drawWorld(ctx: CanvasRenderingContext2D, state: WorldSave, ambient: AmbientWorld, playerAmbient: AmbientPlayerState) {
  const pos = state.position,
    map = getOriginalMap(pos.mapId),
    viewport = ambientViewportBounds(map.width, map.height, pos.x, pos.y),
    sx = viewport.left,
    sy = viewport.top,
    roamingByEvent = new Map(ambient.npcs.map((npc) => [npc.eventId, npc])),
    ambientBubbles: Array<{ x: number; y: number; text: string; kind: AmbientBubbleKind | "player"; shownAt: number }> = [];
  ctx.fillStyle = "#0c1410";
  ctx.fillRect(0, 0, W, H);
  const staticMap = staticMapCanvas(map);
  ctx.drawImage(staticMap, sx * T, sy * T, W, H, 0, 0, W, H);
  drawMapStructures(ctx, map, state, sx, sy);
  for (const e of map.events) {
    const visual = eventVisual(e, state),
      roaming = visual.kind === "npc" ? roamingByEvent.get(e.id) : undefined,
      eventX = roaming?.x ?? e.x,
      eventY = roaming?.y ?? e.y;
    if (eventX < sx || eventY < sy || eventX >= sx + 20 || eventY >= sy + 15) continue;
    const near = Math.abs(eventX - pos.x) + Math.abs(eventY - pos.y) <= 2;
    if (visual.kind === "npc") {
      drawActor(
        ctx,
        (eventX - sx) * T + 16,
        (eventY - sy) * T + 23,
        hash(visual.label),
        false,
        npcCharacterSprite(visual.npcId || 0, visual.label),
        roaming?.direction || 2,
      );
      drawNpcMarker(
        ctx,
        (eventX - sx) * T + 16,
        (eventY - sy) * T + 23,
        visual.label,
        near,
        // 当前坛主与主任务杀人目标标记红色，让玩家一眼知道该杀谁。
        isCurrentKillTarget(visual.npcId, {
          tanId: state.actor.tanId,
          killId: state.tasks.killId,
        }),
      );
      if (roaming?.bubble && !conversationSessionKey(roaming, playerAmbient)) ambientBubbles.push({
        x: (eventX - sx) * T + 16,
        y: (eventY - sy) * T - 13,
        text: roaming.bubble,
        kind: roaming.bubbleKind,
        shownAt: roaming.bubbleShownAt,
      });
    } else if (visual.kind === "door")
      drawDoorMarker(
        ctx,
        (e.x - sx) * T + 16,
        (e.y - sy) * T + 21,
        visual.label,
        near,
        visual.locked,
      );
    else if (visual.kind === "object")
      drawObjectMarker(
        ctx,
        (e.x - sx) * T + 16,
        (e.y - sy) * T + 21,
        visual.label,
        near,
      );
    else if (visual.kind === "corpse")
      drawCorpseMarker(
        ctx,
        (e.x - sx) * T + 16,
        (e.y - sy) * T + 23,
        visual.label,
        near,
      );
  }
  if (
    state.tasks.wantedPlace === pos.mapId &&
    state.tasks.wantedX >= sx &&
    state.tasks.wantedY >= sy &&
    state.tasks.wantedX < sx + 20 &&
    state.tasks.wantedY < sy + 15
  ) {
    const wx = (state.tasks.wantedX - sx) * T + 16,
      wy = (state.tasks.wantedY - sy) * T + 23,
      near =
        Math.abs(state.tasks.wantedX - pos.x) +
          Math.abs(state.tasks.wantedY - pos.y) <=
        2;
    drawActor(
      ctx,
      wx,
      wy,
      state.tasks.wantedGender ? "#e45d6d" : "#c44f45",
      false,
      state.tasks.wantedGender ? { sheet: 4, row: 0 } : { sheet: 3, row: 1 },
    );
    drawNpcMarker(ctx, wx, wy, "通缉犯", near, true);
  }
  drawActor(
    ctx,
    (pos.x - sx) * T + 16,
    (pos.y - sy) * T + 23,
    "#dce8ec",
    true,
    { sheet: 0, row: state.actor.gender ? 1 : 0 },
    pos.direction,
  );
  const conversationCards = collectConversationCards(
    ambient,
    playerAmbient,
    sx,
    sy,
    state.actor.name || "少侠",
  )
      .map((card) => card.playerInvolved ? {
        ...card,
        x: (pos.x - sx) * T + 16,
        y: (pos.y - sy) * T - 13,
      } : card)
      .map((card) => layoutConversationCard(ctx, card)),
    playerGrouped = conversationCards.length > 0 && playerAmbient.npcIds.length > 0;
  if (playerAmbient.bubble && !playerGrouped) ambientBubbles.push({
    x: (pos.x - sx) * T + 16,
    y: (pos.y - sy) * T - 13,
    text: playerAmbient.bubble,
    kind: "player",
    shownAt: playerAmbient.bubbleShownAt,
  });
  // 玩家气泡永远最后绘制(最上层)；所有气泡再统一做碰撞错开布局。
  const placedBubbles = resolveAmbientBubbleLayout(
    ctx,
    ambientBubbles.sort((first, second) =>
      first.kind === "player" && second.kind !== "player"
        ? 1
        : second.kind === "player" && first.kind !== "player"
          ? -1
          : first.shownAt - second.shownAt,
    ),
    conversationCards,
  );
  conversationCards.filter((card) => !card.playerInvolved).forEach((card) => drawConversationCard(ctx, card));
  placedBubbles.forEach((bubble) => drawAmbientBubble(ctx, bubble));
  // 主角参与的会话固定在屏幕顶部，并最后绘制，避免被任何环境气泡遮挡。
  conversationCards.filter((card) => card.playerInvolved).forEach((card) => drawConversationCard(ctx, card));
  let shade = shadeCache.get(ctx);
  if (!shade) {
    shade = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 430);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(2,7,4,.34)");
    shadeCache.set(ctx, shade);
  }
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(5,10,7,.72)";
  ctx.fillRect(8, 7, Math.min(150, map.name.length * 18 + 24), 25);
  ctx.fillStyle = "#eadcae";
  ctx.font = "bold 14px serif";
  ctx.textAlign = "left";
  ctx.fillText(map.name, 17, 24);
  ctx.fillStyle = "rgba(5,10,7,.62)";
  ctx.fillRect(W - 107, 8, 99, 22);
  ctx.textAlign = "right";
  ctx.font = "10px monospace";
  ctx.fillStyle = "#9aaa9e";
  ctx.fillText(`MAP ${map.id} · ${pos.x},${pos.y}`, W - 15, 23);
}
export type EventVisual = {
  kind: "npc" | "object" | "door" | "corpse" | "none";
  label: string;
  npcId?: number;
  /** 入口因缺少物品或进度门槛暂时锁住，仍标记在地图上但无法进入 */
  locked?: boolean;
};
const sceneLabels: Record<number, string> = {
  1: "菜花宝典",
  2: "可拾取物",
  3: "宝物",
  4: "钓鱼点",
  5: "水源",
  6: "游戏设施",
  7: "工作点",
  8: "挑战入口",
  9: "告示牌",
  10: "绳索",
  11: "酒坛",
  12: "对战入口",
  13: "坛入口",
  14: "铸剑台",
  15: "桃花源",
  16: "房间入口",
};
export function npcDisplayName(id: number, fallback = "江湖人物") {
  return String(npcRecord(id).name || fallback);
}
// 坛入口(type 13)显示目标坛的名称，其余场景入口沿用场景标签。
function entranceLabel(
  scene: { type: number; id?: number } | undefined,
  cleanName: string,
): string {
  if (scene?.type === 13 && scene.id !== undefined)
    return getOriginalMap(scene.id).name || cleanName || sceneLabels[13];
  return cleanName || (scene ? sceneLabels[scene.type] : "通往别处");
}
export function eventVisual(event: MapEvent, state: WorldSave): EventVisual {
  const page = activePage(event),
    result = executeMapCommands(page.commands),
    scene = selectSceneEvent(result.source, {
      inventory: state.actor.inventory,
      tanId: state.actor.tanId,
      freeWork: state.tasks.freeWork,
      canGetItem: true,
      canGetCaihua: canObtainCaihua(state.actor),
    }),
    graphic = String(page.graphic?.character_name || ""),
    cleanName = friendlyEventName(event.name, result.transfer?.mapId);
  if (scene?.type === 0 && scene.id !== undefined) {
    // 原版：无对应令牌不生成娜可露(132)/茅盈(144)。
    if (!npcVisibleWithInventory(scene.id, state.actor.inventory))
      return { kind: "none", label: "" };
    if ((state.actor.killList || []).includes(scene.id))
      return scene.id >= 173 && scene.id <= 194
        ? { kind: "none", label: "" }
        : {
            kind: "corpse",
            label: `${String(npcRecord(scene.id).name || cleanName || "江湖人物")}遗骸`,
          };
    return {
      kind: "npc",
      label: String(npcRecord(scene.id).name || cleanName || "江湖人物"),
      npcId: scene.id,
    };
  }
  if (graphic) return { kind: "npc", label: cleanName || "江湖人物" };
  if (result.transfer || (scene && [13, 15, 16].includes(scene.type)))
    return { kind: "door", label: entranceLabel(scene, cleanName) };
  if (scene)
    return {
      kind: "object",
      label: cleanName || sceneLabels[scene.type] || "可互动",
    };
  // 条件不满足时，被物品/进度门槛锁住的入口仍然标记在地图上。
  const gate = parseSceneGate(result.source);
  if (gate?.scene && [8, 13, 15, 16].includes(gate.scene.type))
    return {
      kind: "door",
      label: entranceLabel(gate.scene, cleanName),
      locked: true,
    };
  return { kind: "none", label: "" };
}
export type MapTheme = "town" | "indoor" | "grassland" | "forest" | "desert" | "mountain" | "snow" | "water" | "altar" | "mystic" | "scifi";
const roadCache = new Map<number, Set<string>>();
const eventCellCache = new Map<number, Set<string>>();
const furnitureCache = new Map<number, Map<string, number>>();
const staticMapCache = new Map<number, { revision: number; canvas: HTMLCanvasElement }>();
const shadeCache = new WeakMap<CanvasRenderingContext2D, CanvasGradient>();

function staticMapCanvas(map: OriginalMap) {
  const cached = staticMapCache.get(map.id);
  if (cached?.revision === artRevision) return cached.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = map.width * T;
  canvas.height = map.height * T;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.imageSmoothingEnabled = true;
  for (let my = 0; my < map.height; my += 1)
    for (let mx = 0; mx < map.width; mx += 1)
      drawAuthoredTerrain(context, map, mx, my, mx * T, my * T);
  drawFactionLandmarks(context, map, 0, 0);
  drawPinganTownPlan(context, map, 0, 0);
  staticMapCache.set(map.id, { revision: artRevision, canvas });
  return canvas;
}

export function mapTheme(map: Pick<OriginalMap, "name">): MapTheme {
  if (/家中|家$|店|当铺|武馆|衙门|大厅|二楼|客房|西厢$|东厢$|房屋|室内|客栈|兵器行/.test(map.name)) return "indoor";
  if (/时空的尽头/.test(map.name)) return "scifi";
  if (/失落的世界|铸剑谷/.test(map.name)) return "desert";
  if (/桃花源|花园/.test(map.name)) return "forest";
  if (/大雪山|长白山|冰火岛/.test(map.name)) return "snow";
  if (/东海|南海|渡口|岛$/.test(map.name)) return "water";
  if (/坛$/.test(map.name)) return "altar";
  if (/时空|失落|桃花源|铸剑谷/.test(map.name)) return "mystic";
  if (/山|峰|谷/.test(map.name)) return "mountain";
  if (/郊|盆地/.test(map.name)) return "grassland";
  return "town";
}

function authoredRoads(map: OriginalMap) {
  const cached = roadCache.get(map.id);
  if (cached) return cached;
  const anchors = map.events
    .filter((event) => executeMapCommands(activePage(event).commands).transfer)
    .map((event) => ({ x: event.x, y: event.y }));
  const cells = new Set<string>(),
    hub = anchors.length
      ? {
          x: Math.round(anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length),
          y: Math.round(anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length),
        }
      : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const add = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < map.width && y < map.height) cells.add(`${x},${y}`);
  };
  for (const anchor of anchors.length ? anchors : [hub]) {
    for (let y = Math.min(anchor.y, hub.y); y <= Math.max(anchor.y, hub.y); y++) add(anchor.x, y);
    for (let x = Math.min(anchor.x, hub.x); x <= Math.max(anchor.x, hub.x); x++) add(x, hub.y);
  }
  roadCache.set(map.id, cells);
  return cells;
}

function eventCells(map: OriginalMap) {
  const cached = eventCellCache.get(map.id);
  if (cached) return cached;
  const cells = new Set(map.events.map((event) => `${event.x},${event.y}`));
  eventCellCache.set(map.id, cells);
  return cells;
}

const factionMapIds = new Set([23, 25, 27, 36, 42, 52, 54, 59, 60, 61, 62, 63, 64, 65, 66]);
const pinganUrbanMapIds = new Set([2, 3, 5, 15]);

function drawCleanBaseTile(
  ctx: CanvasRenderingContext2D,
  theme: ReturnType<typeof mapTheme>,
  road: boolean,
  faction: boolean,
  pingan: boolean,
  mx: number,
  my: number,
  x: number,
  y: number,
) {
  const stone = faction || pingan || theme === "altar";
  const color = road
    ? stone ? "#77776f" : "#8b7859"
    : theme === "indoor" ? "#896746"
    : theme === "water" ? "#39747c"
    : theme === "snow" ? "#cbd4d2"
    : theme === "forest" ? "#4f7448"
    : theme === "grassland" ? "#799553"
    : theme === "desert" ? "#b89a63"
    : theme === "scifi" ? "#303d4d"
    : theme === "mountain" || theme === "mystic" ? "#87755b"
    : stone ? "#7d817b"
    : "#718852";
  ctx.fillStyle = color;
  ctx.fillRect(x, y, T, T);
  ctx.lineWidth = 1;
  if (theme === "indoor") {
    ctx.strokeStyle = "rgba(55,35,22,.23)";
    ctx.beginPath();
    ctx.moveTo(x, y + T - .5);
    ctx.lineTo(x + T, y + T - .5);
    if ((my & 1) === 0) {
      ctx.moveTo(x + T / 2, y);
      ctx.lineTo(x + T / 2, y + T);
    }
    ctx.stroke();
    ctx.fillStyle = (mx + my) % 3 === 0 ? "rgba(255,235,190,.025)" : "rgba(30,18,10,.018)";
    ctx.fillRect(x, y, T, T);
  } else if (theme === "water" && !road) {
    ctx.strokeStyle = "rgba(197,230,225,.18)";
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 10); ctx.lineTo(x + 19, y + 10);
    ctx.moveTo(x + 13, y + 23); ctx.lineTo(x + 28, y + 23);
    ctx.stroke();
  } else if (theme === "scifi") {
    ctx.strokeStyle = "rgba(91,205,220,.22)";
    ctx.strokeRect(x + 2.5, y + 2.5, T - 5, T - 5);
    if ((mx + my) % 4 === 0) { ctx.fillStyle = "rgba(111,226,232,.18)"; ctx.fillRect(x + 6, y + 6, 3, 3); }
  } else if (theme === "desert") {
    ctx.strokeStyle = "rgba(105,77,42,.13)";
    ctx.beginPath(); ctx.moveTo(x + 4, y + 22); ctx.quadraticCurveTo(x + 16, y + 17, x + 29, y + 21); ctx.stroke();
  } else if (stone || road) {
    ctx.strokeStyle = "rgba(38,40,37,.16)";
    ctx.strokeRect(x + .5, y + .5, T - 1, T - 1);
    if ((my & 1) === 0) {
      ctx.beginPath(); ctx.moveTo(x + T / 2, y); ctx.lineTo(x + T / 2, y + T); ctx.stroke();
    }
  } else {
    ctx.fillStyle = (mx * 3 + my * 5) % 7 === 0 ? "rgba(213,224,151,.035)" : "rgba(27,48,24,.025)";
    ctx.fillRect(x, y, T, T);
  }
}

function drawAuthoredTerrain(
  ctx: CanvasRenderingContext2D,
  map: OriginalMap,
  mx: number,
  my: number,
  x: number,
  y: number,
) {
  const theme = mapTheme(map),
    roads = authoredRoads(map),
    road = roads.has(`${mx},${my}`),
    faction = factionMapIds.has(map.id),
    pingan = pinganUrbanMapIds.has(map.id);
  drawCleanBaseTile(ctx, theme, road, faction, pingan, mx, my, x, y);
  if (road && theme !== "indoor") {
    ctx.strokeStyle = theme === "mountain" ? "rgba(83,59,35,.42)" : "rgba(38,49,39,.35)";
    ctx.lineWidth = 1;
    if (!roads.has(`${mx - 1},${my}`)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + T); ctx.stroke(); }
    if (!roads.has(`${mx + 1},${my}`)) { ctx.beginPath(); ctx.moveTo(x + T, y); ctx.lineTo(x + T, y + T); ctx.stroke(); }
    if (!roads.has(`${mx},${my - 1}`)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + T, y); ctx.stroke(); }
    if (!roads.has(`${mx},${my + 1}`)) { ctx.beginPath(); ctx.moveTo(x, y + T); ctx.lineTo(x + T, y + T); ctx.stroke(); }
  }
  if (theme === "snow") {
    ctx.fillStyle = "rgba(221,235,235,.22)";
    ctx.fillRect(x, y, T, T);
  }
  if (theme === "indoor") {
    const furniture = indoorFurniture(map).get(`${mx},${my}`);
    if (furniture !== undefined) drawOverlayCell(ctx, furniture, x, y);
    return;
  }
  if (road || eventCells(map).has(`${mx},${my}`)) return;
  const seed = (Math.imul(map.id + 17, 73856093) ^ Math.imul(mx + 11, 19349663) ^ Math.imul(my + 7, 83492791)) >>> 0;
  const besideRoad = roads.has(`${mx - 1},${my}`) || roads.has(`${mx + 1},${my}`) || roads.has(`${mx},${my - 1}`) || roads.has(`${mx},${my + 1}`),
    vegetationBorder = theme !== "water" && theme !== "desert" && theme !== "scifi" &&
      (mx === 2 || my === 2 || mx === map.width - 3 || my === map.height - 3);
  if (besideRoad && (mx + my + map.id) % 4 === 0) {
    drawOverlayCell(ctx, theme === "snow" ? 5 : theme === "forest" ? 2 : [3, 4, 8, 9, 10][seed % 5], x, y);
    return;
  }
  if (vegetationBorder && (mx * 3 + my + map.id) % 4 === 0) {
    drawOverlayCell(ctx, theme === "forest" ? [0, 2, 3][seed % 3] : [2, 3, 4][seed % 3], x, y);
    return;
  }
  const landscapedEdge = faction && (mx < 3 || my < 3 || mx >= map.width - 3 || my >= map.height - 3);
  if (landscapedEdge && seed % 11 === 0) {
    const factionDecoration = map.id === 23 ? 4 : map.id === 25 ? 9 : map.id === 36 || map.id === 42 || map.id === 54 ? 5 : [3, 4, 12, 13][seed % 4];
    drawOverlayCell(ctx, factionDecoration, x, y);
    return;
  }
  if (seed % (faction ? 37 : 31) !== 0) return;
  const decoration =
    theme === "water" ? 6 :
    theme === "altar" || theme === "scifi" ? 13 :
    theme === "desert" ? [12, 13, 15][seed % 3] :
    theme === "forest" ? [0, 2, 3, 4, 5, 6][seed % 6] :
    theme === "mountain" || theme === "snow" ? [5, 12, 13, 14, 15][seed % 5] :
    [0, 2, 3, 4, 8, 9, 10][seed % 7];
  drawOverlayCell(ctx, decoration, x, y);
}

function indoorFurniture(map: OriginalMap) {
  const cached = furnitureCache.get(map.id);
  if (cached) return cached;
  const cells = new Map<string, number>(),
    occupied = eventCells(map),
    add = (x: number, y: number, source: number) => {
      if (x > 0 && y > 0 && x < map.width - 1 && y < map.height - 1 && !occupied.has(`${x},${y}`) && !cells.has(`${x},${y}`))
        cells.set(`${x},${y}`, source);
    },
    cx = Math.floor(map.width / 2),
    cy = Math.floor(map.height / 2),
    row = (y: number, start: number, end: number, step: number, source: number) => {
      for (let x = start; x <= end; x += step) add(x, y, source);
    },
    tableSet = (x: number, y: number) => {
      add(x, y, 16); add(x - 1, y, 17); add(x + 1, y, 17);
    };
  if (/客房|家中|家$|房屋|西厢|东厢/.test(map.name)) {
    add(3, 3, 18); add(map.width - 4, 3, 19); add(map.width - 4, 6, 23);
    tableSet(cx, cy); add(3, map.height - 4, 24); add(map.width - 4, map.height - 4, 22);
  } else if (/药店/.test(map.name)) {
    row(3, 3, map.width - 4, 3, 19);
    row(6, 4, map.width - 5, 4, 26);
    add(cx, 8, 20); add(cx - 2, 8, 23); add(cx + 2, 8, 23);
  } else if (/裁缝店/.test(map.name)) {
    row(3, 3, map.width - 4, 4, 25);
    row(6, 4, map.width - 5, 5, 19);
    add(cx, 8, 20); tableSet(5, map.height - 4);
  } else if (/杂货店|豆腐店|当铺/.test(map.name)) {
    row(3, 3, map.width - 4, 3, 19);
    row(6, 4, map.width - 5, 4, /当铺/.test(map.name) ? 21 : /豆腐/.test(map.name) ? 27 : 26);
    add(cx, 9, 20); add(cx - 3, 9, 24); add(cx + 3, 9, 23);
  } else if (/兵器行|武馆/.test(map.name)) {
    row(3, 3, map.width - 4, 4, 30);
    row(6, 4, map.width - 5, 5, 21);
    tableSet(cx, cy + 2);
  } else if (/客栈/.test(map.name)) {
    for (let y = 5; y < map.height - 4; y += 4)
      for (let x = 4; x < map.width - 3; x += 5) tableSet(x, y);
    row(3, 3, map.width - 4, 5, 24); add(map.width - 4, 3, 22);
  } else if (/衙门|大厅|二楼/.test(map.name)) {
    row(3, 3, map.width - 4, 5, 29);
    add(cx, 5, 20); add(cx - 2, 7, 17); add(cx + 2, 7, 17);
    add(3, map.height - 4, 22); add(map.width - 4, map.height - 4, 22);
  } else {
    add(3, 3, 19); add(map.width - 4, 3, 21); add(cx, cy, 16); add(cx - 1, cy + 1, 17);
  }
  // A restrained repeated furnishing rhythm makes every room feel occupied
  // without returning to random clutter or embedding props in the floor.
  for (let x = 3; x < map.width - 3; x += 6) {
    add(x, map.height - 3, (x + map.id) % 3 ? 23 : 22);
    add(x + 2, map.height - 3, (x + map.id) % 2 ? 8 : 10);
  }
  furnitureCache.set(map.id, cells);
  return cells;
}

function drawOverlayCell(
  ctx: CanvasRenderingContext2D,
  source: number,
  x: number,
  y: number,
) {
  const interior = source >= 16,
    atlas = interior ? wuxiaArt.interiorOverlays : wuxiaArt.natureOverlays,
    atlasSource = interior ? source - 16 : source;
  if (!atlas?.complete || !atlas.naturalWidth) return;
  const cellWidth = atlas.naturalWidth / 4,
    cellHeight = atlas.naturalHeight / 4,
    tree = source <= 5,
    size = tree ? 44 : 36,
    offsetX = (T - size) / 2,
    offsetY = tree ? T - size : (T - size) / 2;
  ctx.drawImage(
    atlas,
    (atlasSource % 4) * cellWidth,
    Math.floor(atlasSource / 4) * cellHeight,
    cellWidth,
    cellHeight,
    x + offsetX,
    y + offsetY,
    size,
    size,
  );
}

function drawMapStructures(
  ctx: CanvasRenderingContext2D,
  map: OriginalMap,
  state: WorldSave,
  sx: number,
  sy: number,
) {
  // Interior maps use furniture and interior walls only. A transfer back to a
  // street is an exit, not permission to place that street's facade indoors.
  if (mapTheme(map) === "indoor") return;
  const outdoorWords = /山|郊|峰|海|岛|谷|林|坛|渡口|桃花源|时空|世界/;
  const occupied: Array<{ x: number; y: number }> = [];
  for (const event of map.events) {
    const visual = eventVisual(event, state);
    if (visual.kind !== "door") continue;
    if (outdoorWords.test(visual.label)) {
      // Outdoor transfers keep the same clean terrain. A symmetric flower pair
      // signals the entrance without replacing its base tile with a cave/rock.
      drawOverlayCell(ctx, hashIndex(visual.label, 2) ? 9 : 10, (event.x - sx - 1) * T, (event.y - sy) * T);
      drawOverlayCell(ctx, hashIndex(visual.label, 2) ? 10 : 9, (event.x - sx + 1) * T, (event.y - sy) * T);
      continue;
    }
    if (event.x < sx - 3 || event.x >= sx + 23 || event.y < sy || event.y >= sy + 16)
      continue;
    if (occupied.some((point) => Math.abs(point.x - event.x) < 4 && Math.abs(point.y - event.y) < 3))
      continue;
    occupied.push({ x: event.x, y: event.y });
    const widthTiles = hashIndex(visual.label, 2) ? 5 : 4,
      leftTile = event.x - Math.floor(widthTiles / 2),
      topTile = event.y - 3;
    drawCleanBuilding(ctx, (leftTile - sx) * T, (topTile - sy) * T, widthTiles, event.x - leftTile, hashIndex(visual.label, 3));
  }
}

function drawCleanBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, widthTiles: number, doorColumn: number, style: number) {
  const width = widthTiles * T,
    roof = style === 1 ? "#354650" : style === 2 ? "#59413a" : "#343936",
    wall = style === 1 ? "#bdc7c3" : style === 2 ? "#c6aa82" : "#d2c7aa",
    timber = style === 2 ? "#58372c" : "#4b4540";
  ctx.fillStyle = "rgba(25,28,25,.24)"; ctx.fillRect(x + 4, y + T * 3 - 2, width - 8, 5);
  ctx.fillStyle = wall; ctx.fillRect(x + 5, y + T, width - 10, T * 2);
  ctx.fillStyle = roof; ctx.fillRect(x, y + 5, width, T - 6);
  ctx.fillStyle = "rgba(235,240,226,.14)"; ctx.fillRect(x + 6, y + 9, width - 12, 3);
  ctx.fillStyle = timber;
  for (let column = 0; column <= widthTiles; column++) ctx.fillRect(x + column * T - 2, y + T, 4, T * 2);
  ctx.fillRect(x + 3, y + T, width - 6, 5); ctx.fillRect(x + 3, y + T * 2 - 3, width - 6, 5);
  for (let column = 0; column < widthTiles; column++) {
    if (column === doorColumn) continue;
    ctx.fillStyle = "#51483e"; ctx.fillRect(x + column * T + 10, y + T + 10, 12, 10);
    ctx.fillStyle = "#9dbea8"; ctx.fillRect(x + column * T + 12, y + T + 12, 8, 6);
  }
  ctx.fillStyle = "#492e25"; ctx.fillRect(x + doorColumn * T + 7, y + T * 2 - 1, 18, T + 1);
  ctx.fillStyle = "#c89b55"; ctx.fillRect(x + doorColumn * T + 22, y + T * 2 + 13, 2, 2);
}

function drawStoneFoundation(ctx: CanvasRenderingContext2D, x: number, y: number, widthTiles: number, heightTiles: number) {
  ctx.fillStyle = "#929b9b"; ctx.fillRect(x, y, widthTiles * T, heightTiles * T);
  ctx.strokeStyle = "rgba(50,58,60,.25)"; ctx.lineWidth = 1;
  for (let row = 0; row <= heightTiles; row++) { ctx.beginPath(); ctx.moveTo(x, y + row * T); ctx.lineTo(x + widthTiles * T, y + row * T); ctx.stroke(); }
  for (let column = 0; column <= widthTiles; column++) { ctx.beginPath(); ctx.moveTo(x + column * T, y); ctx.lineTo(x + column * T, y + heightTiles * T); ctx.stroke(); }
}

function drawFactionLandmarks(
  ctx: CanvasRenderingContext2D,
  map: OriginalMap,
  sx: number,
  sy: number,
) {
  if (!factionMapIds.has(map.id)) return;
  const width = map.id >= 59 ? 9 : Math.min(11, map.width - 2),
    left = Math.max(1, Math.floor(map.width / 2 - width / 2)),
    top = Math.max(1, Math.min(4, Math.floor(map.height * 0.16))),
    x = (left - sx) * T,
    y = (top - sy) * T;
  if (mapTheme(map) === "snow") {
    drawStoneFoundation(ctx, x, y + T, width, 3);
  } else {
    drawStoneFoundation(ctx, x, y + T * 3, width, 2);
    drawCleanBuilding(ctx, x, y, width, Math.floor(width / 2), map.id % 3);
  }
  drawOverlayCell(ctx, map.id === 23 ? 3 : 4, x - T, y + T * 3);
  drawOverlayCell(ctx, map.id === 23 ? 3 : 4, x + width * T, y + T * 3);
}

function drawPinganTownPlan(
  ctx: CanvasRenderingContext2D,
  map: OriginalMap,
  sx: number,
  sy: number,
) {
  if (!pinganUrbanMapIds.has(map.id) || mapTheme(map) === "indoor") return;
  const occupied = eventCells(map),
    draw = (mx: number, my: number, source: number) => {
      if (occupied.has(`${mx},${my}`)) return;
      const x = (mx - sx) * T, y = (my - sy) * T;
      if (x <= -T || y <= -T || x >= W || y >= H) return;
      drawOverlayCell(ctx, source, x, y);
    };
  // Repeated planting is an overlay, never part of the terrain base.
  for (let x = 2; x < map.width - 2; x += 5) { draw(x, 2, 2); draw(x, map.height - 3, 3); }
  for (let y = 5; y < map.height - 5; y += 5) { draw(2, y, 4); draw(map.width - 3, y, 4); }
  if (map.id === 15) {
    for (let x = 4; x < map.width - 4; x += 5) {
      draw(x, 4, 8); draw(x + 2, 4, 10);
      draw(x, map.height - 5, 8); draw(x + 2, map.height - 5, 10);
    }
  }
}
function drawActor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  hero: boolean,
  sprite: CharacterSprite = { sheet: 0, row: 0 },
  direction = 2,
) {
  const atlas = wuxiaArt.characters[sprite.sheet];
  if (!atlas) ensureCharacterSheet(sprite.sheet);
  if (atlas?.complete && atlas.naturalWidth) {
    const cellWidth = atlas.naturalWidth / 4,
      cellHeight = atlas.naturalHeight / 4,
      column = characterDirectionColumn(direction),
      width = 44,
      height = 44;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 9, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(
      atlas,
      column * cellWidth,
      (sprite.row % 4) * cellHeight,
      cellWidth,
      cellHeight,
      x - width / 2,
      y - 34,
      width,
      height,
    );
    return;
  }
  ctx.fillStyle = "rgba(0,0,0,.5)";
  ctx.fillRect(x - 10, y + 5, 20, 5);
  ctx.fillStyle = hero ? "#d8f3ff" : "#fff0b0";
  ctx.fillRect(x - 8, y - 14, 16, 10);
  ctx.fillRect(x - 9, y - 8, 18, 16);
  ctx.fillStyle = "#26221d";
  ctx.fillRect(x - 7, y - 13, 14, 8);
  ctx.fillStyle = "#dfb78d";
  ctx.fillRect(x - 5, y - 15, 10, 9);
  ctx.fillStyle = color;
  ctx.fillRect(x - 8, y - 7, 16, 14);
  ctx.fillStyle = hero ? "#657f97" : "#40362e";
  ctx.fillRect(x - 8, y + 7, 6, 7);
  ctx.fillRect(x + 2, y + 7, 6, 7);
}
function drawNpcMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  near: boolean,
  hostile = false,
) {
  const pulse = Math.sin(Date.now() / 180) > 0,
    accent = hostile ? "#ff6a63" : "#ffd866";
  ctx.strokeStyle = near ? accent : "rgba(255,216,102,.72)";
  ctx.lineWidth = near ? 3 : 2;
  ctx.strokeRect(x - 11, y + 8, 22, near ? 5 : 3);
  ctx.fillStyle = accent;
  ctx.fillRect(x - 2, y - 47 - (pulse ? 2 : 0), 5, 7);
  ctx.fillRect(x - 2, y - 38 - (pulse ? 2 : 0), 5, 3);
  if (!near) return;
  const label = name.length > 7 ? `${name.slice(0, 7)}…` : name;
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  const width = Math.ceil(ctx.measureText(label).width) + 8;
  ctx.fillStyle = "rgba(7,12,9,.92)";
  ctx.fillRect(x - width / 2, y - 62, width, 13);
  ctx.fillStyle = accent;
  ctx.fillText(label, x, y - 52);
}
function drawObjectMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  near: boolean,
) {
  const pulse = Math.sin(Date.now() / 220) > 0,
    accent = "#70e0d0";
  ctx.fillStyle = "rgba(7,22,20,.85)";
  ctx.fillRect(x - 10, y - 8, 20, 15);
  ctx.strokeStyle = near ? accent : "rgba(112,224,208,.72)";
  ctx.lineWidth = near ? 3 : 2;
  ctx.strokeRect(x - 11, y - 9, 22, 17);
  ctx.fillStyle = accent;
  ctx.fillRect(x - 3, y - 5, 6, 6);
  ctx.fillRect(x - 1, y - 9 - (pulse ? 2 : 0), 2, 2);
  drawMarkerLabel(ctx, x, y - 18, name, accent, near);
}
function drawCorpseMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  near: boolean,
) {
  const accent = "#9d9481";
  ctx.fillStyle = "rgba(12,10,8,.78)";
  ctx.fillRect(x - 10, y + 1, 20, 7);
  ctx.fillStyle = "#d6cfba";
  ctx.fillRect(x - 5, y - 4, 10, 8);
  ctx.fillStyle = "#342e28";
  ctx.fillRect(x - 3, y - 1, 2, 2);
  ctx.fillRect(x + 2, y - 1, 2, 2);
  ctx.strokeStyle = accent;
  ctx.strokeRect(x - 11, y, 22, 9);
  drawMarkerLabel(ctx, x, y - 12, name, accent, near);
}
function drawDoorMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  near: boolean,
  locked = false,
) {
  const pulse = Math.sin(Date.now() / 250) > 0,
    accent = locked ? "#d08a5e" : "#8ee28f";
  ctx.fillStyle = locked ? "rgba(20,12,6,.86)" : "rgba(6,20,12,.84)";
  ctx.fillRect(x - 11, y - 14, 22, 23);
  ctx.strokeStyle = near ? accent : "rgba(208,138,94,.55)";
  ctx.lineWidth = near ? 3 : 2;
  ctx.strokeRect(x - 12, y - 15, 24, 25);
  ctx.fillStyle = accent;
  ctx.fillRect(x - 7, y - 10, 14, 3);
  ctx.fillRect(x - 7, y - 7, 3, 12);
  ctx.fillRect(x + 4, y - 7, 3, 12);
  if (locked) {
    // 锁住的入口在门闩处画一把小锁，提示暂不可进入。
    ctx.fillStyle = "#f0cfa0";
    ctx.fillRect(x - 4, y - 6, 8, 6);
    ctx.fillRect(x - 2, y - 9, 4, 3);
  } else {
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 20 - (pulse ? 1 : 0));
    ctx.lineTo(x + 4, y - 20 - (pulse ? 1 : 0));
    ctx.lineTo(x, y - 16 - (pulse ? 1 : 0));
    ctx.fill();
  }
  drawMarkerLabel(ctx, x, y - 27, name, accent, near, true);
}
function drawMarkerLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  accent: string,
  visible: boolean,
  always = false,
) {
  if (!visible && !always) return;
  const label = name.length > 8 ? `${name.slice(0, 8)}…` : name;
  ctx.font = `bold ${visible ? 10 : 9}px sans-serif`;
  ctx.textAlign = "center";
  const width = Math.ceil(ctx.measureText(label).width) + 8;
  ctx.fillStyle = visible ? "rgba(6,13,9,.94)" : "rgba(6,13,9,.78)";
  ctx.fillRect(x - width / 2, y - 11, width, 13);
  ctx.fillStyle = accent;
  ctx.fillText(label, x, y - 1);
}
function hash(text: string) {
  let n = 0;
  for (const c of text) n = (n * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${n} 45% 58%)`;
}
function hashIndex(text: string, max: number) {
  let n = 0;
  for (const c of text) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n % max;
}
