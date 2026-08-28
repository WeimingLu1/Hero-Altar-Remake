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
  type AmbientWorld,
} from "../game-core/ambient-npc";
import {
  drawAmbientBubble,
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
import { generatedQuestCurrentNpc } from "../game-core/generated-task-system";
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
type PortraitAtlas = "notable" | "roster";
export type CharacterSprite = {
  sheet: number;
  row: number;
  portrait?: number;
  portraitAtlas?: PortraitAtlas;
};
type NpcEquipment =
  | "sword"
  | "blade"
  | "staff"
  | "fan"
  | "book"
  | "hammer"
  | "basket"
  | "flower"
  | "bow"
  | "talisman"
  | "ladle"
  | "rope"
  | "shield";
export type NpcCompositeIdentity = {
  signature: string;
  bodyVariant: number;
  hairVariant: number;
  headwearVariant: number;
  bodyScaleX: number;
  bodyScaleY: number;
  accent: string;
  equipment: NpcEquipment;
};

export function characterDirectionColumn(direction: number) {
  // Generated profiles are named by their visible screen-facing direction.
  // RMXP direction 4 means travel left, so it uses the left-facing profile.
  return direction === 4 ? 2 : direction === 6 ? 1 : direction === 8 ? 3 : 0;
}

const characterSheetNames = [
  "wuxia-characters-v1.webp",
  "wuxia-characters-ages-v1.webp",
  "wuxia-characters-townsfolk-v1.webp",
  "wuxia-characters-factions-v1.webp",
  "wuxia-characters-women-v1.webp",
  "wuxia-characters-faction-signatures-v1.webp",
  "wuxia-characters-flower-variants-v1.webp",
  "wuxia-characters-notable-masters-v2.webp",
  "wuxia-characters-notable-women-v2.webp",
  "wuxia-characters-notable-wanderers-v2.webp",
  "wuxia-characters-underworld-v2.webp",
  "wuxia-characters-beast-school-v3.webp",
] as const;
const wuxiaArt: WuxiaArt = {
  characters: characterSheetNames.map(() => null),
  natureOverlays: null,
  interiorOverlays: null,
};
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
      // 人物图集只用于动态人物绘制，不参与静态地形离屏缓存；
      // 这里不能清 staticMapCache，否则每张懒加载完成都会作废全部地图缓存。
      artRevision += 1;
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

// Named records come before broad age and profession buckets. Each entry pairs
// one directional sprite row with the same person's portrait cell, so a
// distinctive description cannot be flattened into a generic elder, warrior,
// worker, or faction template.
const namedCharacterArt: Record<number, CharacterSprite> = {
  41: { sheet: 8, row: 0, portraitAtlas: "notable", portrait: 4 },
  47: { sheet: 9, row: 0, portraitAtlas: "notable", portrait: 8 },
  48: { sheet: 7, row: 0, portraitAtlas: "notable", portrait: 0 },
  54: { sheet: 8, row: 1, portraitAtlas: "notable", portrait: 5 },
  56: { sheet: 8, row: 2, portraitAtlas: "notable", portrait: 6 },
  81: { sheet: 7, row: 3, portraitAtlas: "notable", portrait: 3 },
  82: { sheet: 3, row: 0, portraitAtlas: "roster", portrait: 4 },
  88: { sheet: 4, row: 0, portraitAtlas: "roster", portrait: 5 },
  91: { sheet: 3, row: 0, portraitAtlas: "roster", portrait: 6 },
  94: { sheet: 2, row: 2, portraitAtlas: "roster", portrait: 7 },
  95: { sheet: 7, row: 2, portraitAtlas: "notable", portrait: 2 },
  102: { sheet: 7, row: 1, portraitAtlas: "notable", portrait: 1 },
  117: { sheet: 1, row: 3, portraitAtlas: "roster", portrait: 12 },
  124: { sheet: 11, row: 0, portraitAtlas: "roster", portrait: 0 },
  125: { sheet: 1, row: 2, portraitAtlas: "roster", portrait: 15 },
  126: { sheet: 2, row: 2, portraitAtlas: "roster", portrait: 14 },
  127: { sheet: 11, row: 1, portraitAtlas: "roster", portrait: 1 },
  128: { sheet: 11, row: 2, portraitAtlas: "roster", portrait: 2 },
  129: { sheet: 9, row: 1, portraitAtlas: "notable", portrait: 9 },
  132: { sheet: 9, row: 2, portraitAtlas: "notable", portrait: 10 },
  134: { sheet: 11, row: 3, portraitAtlas: "roster", portrait: 3 },
  138: { sheet: 3, row: 3, portraitAtlas: "roster", portrait: 8 },
  141: { sheet: 1, row: 2, portraitAtlas: "roster", portrait: 9 },
  144: { sheet: 1, row: 2, portraitAtlas: "roster", portrait: 10 },
  147: { sheet: 1, row: 2, portraitAtlas: "roster", portrait: 11 },
  148: { sheet: 9, row: 3, portraitAtlas: "notable", portrait: 11 },
  149: { sheet: 8, row: 3, portraitAtlas: "notable", portrait: 7 },
  150: { sheet: 10, row: 0, portraitAtlas: "notable", portrait: 12 },
  151: { sheet: 10, row: 1, portraitAtlas: "notable", portrait: 13 },
  161: { sheet: 10, row: 2, portraitAtlas: "notable", portrait: 14 },
  162: { sheet: 10, row: 3, portraitAtlas: "notable", portrait: 15 },
  171: { sheet: 1, row: 2, portraitAtlas: "roster", portrait: 13 },
};

export function npcPaletteFilter(id: number, sprite: CharacterSprite) {
  // Bespoke named and faction sheets carry intentional identity colours.
  // Generic sheets receive a mild, deterministic tint so people sharing the
  // same silhouette still remain visually distinct without flickering.
  if (id <= 0 || namedCharacterArt[id] || sprite.sheet >= 5) return "none";
  // The three coprime cycles have a joint period far above the 1–198 NPC ID
  // range, so every generic record receives a unique combination.
  const hue = -16 + ((id * 37) % 33),
    saturation = 90 + ((id * 17) % 27),
    brightness = 94 + ((id * 11) % 13);
  return `hue-rotate(${hue}deg) saturate(${saturation}%) brightness(${brightness}%)`;
}

export function npcPortraitCell(id: number) {
  if (!Number.isInteger(id) || id < 1 || id > 198) return null;
  const start = Math.floor((id - 1) / 16) * 16 + 1,
    end = Math.min(start + 15, 198),
    index = (id - 1) % 16;
  return {
    src: `/game-assets/generated/wuxia-npc-portraits-${String(start).padStart(3, "0")}-${String(end).padStart(3, "0")}-v1.webp`,
    index,
    column: index % 4,
    row: Math.floor(index / 4),
  };
}

const compositeIdentityCache = new Map<number, NpcCompositeIdentity | null>();

export function npcCompositeIdentity(id: number, sprite: CharacterSprite) {
  if (compositeIdentityCache.has(id)) return compositeIdentityCache.get(id) ?? null;
  // Sheets 7–11 already contain a complete one-person directional design.
  if (id <= 0 || sprite.sheet >= 7) {
    compositeIdentityCache.set(id, null);
    return null;
  }
  const npc = npcRecord(id),
    text = `${String(npc.name || "")}${((npc.des_text as string[]) || []).join("")}`,
    serial = id - 1,
    bodyVariant = serial % 5,
    hairVariant = Math.floor(serial / 5) % 8,
    headwearVariant = Math.floor(serial / 40) % 5,
    equipment: NpcEquipment = /厨|屠户|饭/.test(text)
      ? "ladle"
      : /裁缝|针线/.test(text)
        ? "rope"
        : /铁匠|铸剑|工地|石料/.test(text)
          ? "hammer"
          : /花|侍女/.test(text)
            ? "flower"
            : /猎户|弓|鹰/.test(text)
              ? "bow"
              : /书|诗|词|先生|村长|管家/.test(text)
                ? "book"
                : /道|法术|真人|天师/.test(text)
                  ? "talisman"
                  : /和尚|僧|婆婆|老人/.test(text)
                    ? "staff"
                    : /商|贩|店|花妞/.test(text)
                      ? "basket"
                      : /扇|公子/.test(text)
                        ? "fan"
                        : /盾|官兵|捕快/.test(text)
                          ? "shield"
                          : /刀|匪|盗|坛/.test(text)
                            ? "blade"
                            : /鞭|绳/.test(text)
                              ? "rope"
                              : "sword",
    identity: NpcCompositeIdentity = {
      signature: `${bodyVariant}-${hairVariant}-${headwearVariant}`,
      bodyVariant,
      hairVariant,
      headwearVariant,
      bodyScaleX: [0.91, 0.96, 1, 1.05, 1.1][bodyVariant],
      bodyScaleY: [0.97, 1.02, 1.06, 0.94, 1][hairVariant % 5],
      accent: `hsl(${(id * 137.508) % 360} 68% 62%)`,
      equipment,
    };
  compositeIdentityCache.set(id, identity);
  return identity;
}

export function npcCharacterSprite(id: number, fallbackName = ""): CharacterSprite {
  const npc = id > 0 ? npcRecord(id) : {},
    name = String(npc.name || fallbackName),
    description = ((npc.des_text as string[]) || []).join(""),
    text = `${name}${description}`,
    age = Number(npc.age || 30),
    female = Number(npc.gender || 0) === 1,
    merchant = Number(npc.type || 0) === -1 || /老板|掌柜|商人|店|贩|卖/.test(text);
  const namedArt = namedCharacterArt[id];
  if (namedArt) return namedArt;
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
    dedicatedPortrait = playerGender === undefined ? npcPortraitCell(npcId || 0) : null,
    index = sprite.portrait ?? sprite.sheet * 4 + sprite.row,
    generatedPortrait = "portraitAtlas" in sprite ? sprite.portraitAtlas : undefined,
    factionPortrait = !generatedPortrait && index >= 20,
    localIndex = generatedPortrait ? index : factionPortrait ? index - 20 : index,
    columns = generatedPortrait || factionPortrait ? 4 : 5,
    column = dedicatedPortrait?.column ?? localIndex % columns,
    row = dedicatedPortrait?.row ?? Math.floor(localIndex / columns),
    portraitImage =
      dedicatedPortrait
        ? `url("${dedicatedPortrait.src}")`
        : generatedPortrait === "notable"
        ? 'url("/game-assets/generated/wuxia-notable-portraits-v2.webp")'
        : generatedPortrait === "roster"
          ? 'url("/game-assets/generated/wuxia-roster-portraits-v2.webp")'
          : factionPortrait
            ? 'url("/game-assets/generated/wuxia-faction-portraits-v1.webp")'
            : undefined;
  return (
    <div
      className={`character-portrait ${className}`.trim()}
      role="img"
      aria-label={`${name || "人物"}立绘`}
      style={{
        backgroundImage: portraitImage,
        backgroundSize: dedicatedPortrait || generatedPortrait || factionPortrait ? "400% 400%" : undefined,
        backgroundPosition: `${(column / (columns - 1)) * 100}% ${(row / 3) * 100}%`,
      }}
    />
  );
}

export function drawWorld(ctx: CanvasRenderingContext2D, state: WorldSave, ambient: AmbientWorld, playerAmbient: AmbientPlayerState) {
  const pos = state.position,
    map = getOriginalMap(pos.mapId),
    viewport = ambientViewportBounds(map.width, map.height, pos.x, pos.y),
    sx = viewport.left,
    sy = viewport.top,
    // 换图后 population effect 尚未重建的一瞬，旧地图的漫游 NPC 不应
    // 按 eventId 撞进新视口；只接受属于当前地图的环境对象。
    roamingByEvent = new Map(
      ambient.mapId === map.id
        ? ambient.npcs.map((npc) => [npc.eventId, npc])
        : [],
    ),
    generatedQuestNpc = state.tasks.generatedQuest
      ? generatedQuestCurrentNpc(state.tasks.generatedQuest)
      : null,
    ambientBubbles: Array<{ x: number; y: number; bottomY: number; text: string; kind: AmbientBubbleKind | "player"; shownAt: number }> = [],
    ambientObstacles: Array<{ left: number; top: number; width: number; height: number }> = [];
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
      const screenX = (eventX - sx) * T + 16,
        screenY = (eventY - sy) * T + 23,
        sprite = npcCharacterSprite(visual.npcId || 0, visual.label);
      drawActor(
        ctx,
        screenX,
        screenY,
        hash(visual.label),
        false,
        sprite,
        roaming?.direction || 2,
        npcPaletteFilter(visual.npcId || 0, sprite),
        npcCompositeIdentity(visual.npcId || 0, sprite),
      );
      drawNpcMarker(
        ctx,
        screenX,
        screenY,
        visual.label,
        near,
        // 当前坛主与主任务杀人目标标记红色，让玩家一眼知道该杀谁。
        isCurrentKillTarget(visual.npcId, {
          tanId: state.actor.tanId,
          killId: state.tasks.killId,
        }),
        Boolean(
          generatedQuestNpc &&
            generatedQuestNpc.mapId === map.id &&
            generatedQuestNpc.eventId === e.id,
        ),
      );
      ambientObstacles.push({
        left: screenX - 15,
        top: screenY - 38,
        width: 30,
        height: 44,
      });
      // 环境会话严格串行；布局层优先头顶，冲突时再侧移或放到脚下。
      if (roaming?.bubble) {
        ambientBubbles.push({
          x: screenX,
          y: screenY - 36,
          bottomY: screenY + 6,
          text: roaming.bubble,
          kind: roaming.bubbleKind,
          shownAt: roaming.bubbleShownAt,
        });
      }
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
      2,
      npcPaletteFilter(
        198,
        state.tasks.wantedGender ? { sheet: 4, row: 0 } : { sheet: 3, row: 1 },
      ),
      npcCompositeIdentity(
        198,
        state.tasks.wantedGender ? { sheet: 4, row: 0 } : { sheet: 3, row: 1 },
      ),
    );
    ambientObstacles.push({ left: wx - 15, top: wy - 38, width: 30, height: 44 });
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
  const playerScreenX = (pos.x - sx) * T + 16,
    playerScreenY = (pos.y - sy) * T + 23;
  ambientObstacles.push({
    left: playerScreenX - 15,
    top: playerScreenY - 38,
    width: 30,
    height: 44,
  });
  // 主角台词使用同一避让规则，并最后绘制在最高图层。
  if (playerAmbient.bubble) {
    ambientBubbles.push({
      x: playerScreenX,
      y: playerScreenY - 36,
      bottomY: playerScreenY + 6,
      text: playerAmbient.bubble,
      kind: "player",
      shownAt: playerAmbient.bubbleShownAt,
    });
  }
  const placedBubbles = resolveAmbientBubbleLayout(
    ctx,
    ambientBubbles.sort((first, second) =>
      first.kind === "player" && second.kind !== "player"
        ? 1
        : second.kind === "player" && first.kind !== "player"
          ? -1
          : first.shownAt - second.shownAt,
    ),
    [
      ...ambientObstacles,
      {
        left: 8,
        top: 7,
        width: Math.min(150, map.name.length * 18 + 24),
        height: 25,
      },
    ],
  );
  placedBubbles.forEach((bubble) => drawAmbientBubble(ctx, bubble));
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
// 事件可视性只随存档少数字段变化，但主循环与结构层每帧都会对每个可见事件
// 重算 eventVisual(内含 RMXP 命令解释器与多个正则)。这里按依赖字段做指纹：
// 字段引用/值不变时直接命中 WeakMap 缓存；sync 提交新对象后指纹失配、整体失效。
let eventVisualStateKey: unknown[] = [];
let eventVisualCache = new WeakMap<MapEvent, EventVisual>();

export function eventVisual(event: MapEvent, state: WorldSave): EventVisual {
  const key: unknown[] = [
    state.actor.inventory,
    state.actor.tanId,
    state.tasks.freeWork,
    state.actor.killList,
    state.actor.morals,
    state.actor.age,
    state.actor.gender,
    state.actor.armorIds,
  ];
  if (
    eventVisualStateKey.length !== key.length ||
    eventVisualStateKey.some((value, index) => !Object.is(value, key[index]))
  ) {
    eventVisualStateKey = key;
    eventVisualCache = new WeakMap();
  }
  const cached = eventVisualCache.get(event);
  if (cached) return cached;
  const visual = computeEventVisual(event, state);
  eventVisualCache.set(event, visual);
  return visual;
}

function computeEventVisual(
  event: MapEvent,
  state: WorldSave,
): EventVisual {
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

// 离屏地形缓存按 LRU 封顶：69 张图全缓存约 94MB，保留最近 12 张即可
// (玩家在图间有强局部性)，避免长期游历后内存单调增长。
const STATIC_MAP_CACHE_LIMIT = 12;

function staticMapCanvas(map: OriginalMap) {
  const cached = staticMapCache.get(map.id);
  if (cached?.revision === artRevision) {
    staticMapCache.delete(map.id);
    staticMapCache.set(map.id, cached);
    return cached.canvas;
  }
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
  while (staticMapCache.size > STATIC_MAP_CACHE_LIMIT) {
    const oldest = staticMapCache.keys().next().value;
    if (oldest === undefined) break;
    staticMapCache.delete(oldest);
  }
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
    // 先按视口裁剪再解释事件，视口外的门/花饰无需求值。
    if (event.x < sx - 3 || event.x >= sx + 23 || event.y < sy || event.y >= sy + 16)
      continue;
    const visual = eventVisual(event, state);
    if (visual.kind !== "door") continue;
    if (outdoorWords.test(visual.label)) {
      // Outdoor transfers keep the same clean terrain. A symmetric flower pair
      // signals the entrance without replacing its base tile with a cave/rock.
      drawOverlayCell(ctx, hashIndex(visual.label, 2) ? 9 : 10, (event.x - sx - 1) * T, (event.y - sy) * T);
      drawOverlayCell(ctx, hashIndex(visual.label, 2) ? 10 : 9, (event.x - sx + 1) * T, (event.y - sy) * T);
      continue;
    }
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
  paletteFilter = "none",
  identity: NpcCompositeIdentity | null = null,
) {
  const atlas = wuxiaArt.characters[sprite.sheet];
  if (!atlas) ensureCharacterSheet(sprite.sheet);
  if (atlas?.complete && atlas.naturalWidth) {
    const cellWidth = atlas.naturalWidth / 4,
      cellHeight = atlas.naturalHeight / 4,
      column = characterDirectionColumn(direction),
      width = 44 * (identity?.bodyScaleX ?? 1),
      height = 44 * (identity?.bodyScaleY ?? 1);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 9, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.filter = paletteFilter;
    ctx.drawImage(
      atlas,
      column * cellWidth,
      (sprite.row % 4) * cellHeight,
      cellWidth,
      cellHeight,
      x - width / 2,
      y + 10 - height,
      width,
      height,
    );
    ctx.restore();
    if (identity) drawNpcIdentityDetails(ctx, x, y, identity, direction);
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
  if (identity) drawNpcIdentityDetails(ctx, x, y, identity, direction);
}

const npcHairColors = [
  "#1d1715",
  "#30221c",
  "#4a3427",
  "#171c24",
  "#5a5148",
  "#6d5842",
  "#25231f",
  "#3b2829",
] as const;

function drawNpcIdentityDetails(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  identity: NpcCompositeIdentity,
  direction: number,
) {
  const side = direction === 4 ? -1 : direction === 6 ? 1 : identity.hairVariant % 2 ? 1 : -1,
    hair = npcHairColors[identity.hairVariant],
    headY = y - 24;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";

  // Eight silhouettes remain readable at 32 px: tied, loose, cropped, braided,
  // swept, twin-lock, shaved-front and high-knot variants.
  ctx.fillStyle = hair;
  switch (identity.hairVariant) {
    case 0:
      ctx.fillRect(x - 7, headY - 8, 14, 3);
      ctx.fillRect(x + side * 6 - (side < 0 ? 2 : 0), headY - 5, 3, 7);
      break;
    case 1:
      ctx.fillRect(x - 8, headY - 7, 16, 4);
      ctx.fillRect(x - 9, headY - 4, 3, 11);
      ctx.fillRect(x + 6, headY - 4, 3, 11);
      break;
    case 2:
      ctx.fillRect(x - 7, headY - 7, 14, 3);
      ctx.fillRect(x - 8, headY - 4, 3, 5);
      break;
    case 3:
      ctx.fillRect(x - 7, headY - 8, 14, 4);
      ctx.fillRect(x + side * 7 - (side < 0 ? 2 : 0), headY - 4, 3, 14);
      ctx.fillRect(x + side * 9 - (side < 0 ? 2 : 0), headY + 7, 3, 5);
      break;
    case 4:
      ctx.fillRect(x - 8, headY - 7, 16, 3);
      ctx.fillRect(x - 7, headY - 4, 5, 4);
      break;
    case 5:
      ctx.fillRect(x - 7, headY - 8, 14, 3);
      ctx.fillRect(x - 10, headY - 3, 4, 9);
      ctx.fillRect(x + 6, headY - 3, 4, 9);
      break;
    case 6:
      ctx.fillRect(x - 7, headY - 8, 14, 2);
      ctx.fillRect(x - 2, headY - 10, 4, 3);
      break;
    default:
      ctx.fillRect(x - 7, headY - 8, 14, 3);
      ctx.fillRect(x - 3, headY - 12, 6, 5);
      ctx.fillRect(x - 1, headY - 15, 2, 4);
  }

  ctx.fillStyle = identity.accent;
  ctx.strokeStyle = identity.accent;
  ctx.lineWidth = 2;
  switch (identity.headwearVariant) {
    case 0:
      ctx.fillRect(x - 8, headY - 3, 16, 2);
      break;
    case 1:
      ctx.fillRect(x - 5, headY - 11, 10, 2);
      ctx.fillRect(x - 2, headY - 14, 4, 3);
      break;
    case 2:
      ctx.beginPath();
      ctx.moveTo(x - 10, headY - 7);
      ctx.lineTo(x + 10, headY - 7);
      ctx.lineTo(x + 6, headY - 12);
      ctx.lineTo(x - 6, headY - 12);
      ctx.closePath();
      ctx.fill();
      break;
    case 3:
      ctx.beginPath();
      ctx.moveTo(x - side * 8, headY - 10);
      ctx.lineTo(x + side * 9, headY - 13);
      ctx.stroke();
      ctx.fillRect(x + side * 8 - 1, headY - 15, 3, 5);
      break;
    default:
      ctx.strokeRect(x - 9, headY - 8, 18, 15);
  }

  // Body marks supply a second identity channel that survives similar clothes.
  ctx.globalAlpha = 0.88;
  if (identity.bodyVariant === 0) ctx.fillRect(x - 9, y - 8, 18, 3);
  else if (identity.bodyVariant === 1) {
    ctx.fillRect(x - 7, y - 11, 3, 16);
    ctx.fillRect(x + 4, y - 11, 3, 16);
  } else if (identity.bodyVariant === 2) {
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 11);
    ctx.lineTo(x + 7, y + 4);
    ctx.stroke();
  } else if (identity.bodyVariant === 3) {
    ctx.fillRect(x - 2, y - 12, 4, 17);
    ctx.fillRect(x - 7, y - 2, 14, 2);
  } else {
    ctx.strokeRect(x - 7, y - 10, 14, 14);
  }
  ctx.globalAlpha = 1;

  drawNpcEquipment(ctx, x + side * 13, y - 5, side, identity.equipment, identity.accent);
  ctx.restore();
}

function drawNpcEquipment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: number,
  equipment: NpcEquipment,
  accent: string,
) {
  ctx.strokeStyle = "rgba(30,24,20,.95)";
  ctx.fillStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (equipment === "sword" || equipment === "blade") {
    ctx.moveTo(x - side * 3, y + 12);
    ctx.lineTo(x + side * (equipment === "sword" ? 5 : 7), y - 15);
    ctx.stroke();
    ctx.fillRect(x - side * 4 - 2, y + 8, 8, 2);
  } else if (equipment === "staff" || equipment === "rope") {
    ctx.moveTo(x, y - 17);
    ctx.lineTo(x + side * (equipment === "rope" ? 4 : 1), y + 15);
    ctx.stroke();
    if (equipment === "rope") ctx.strokeRect(x - 3, y + 10, 7, 5);
  } else if (equipment === "fan") {
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x - 7, y - 3);
    ctx.lineTo(x + 6, y - 4);
    ctx.closePath();
    ctx.fill();
  } else if (equipment === "book") {
    ctx.fillRect(x - 6, y - 2, 12, 10);
    ctx.strokeRect(x - 6, y - 2, 12, 10);
  } else if (equipment === "hammer" || equipment === "ladle") {
    ctx.moveTo(x, y + 13);
    ctx.lineTo(x, y - 7);
    ctx.stroke();
    if (equipment === "hammer") ctx.fillRect(x - 6, y - 10, 12, 5);
    else {
      ctx.beginPath();
      ctx.arc(x, y - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (equipment === "basket" || equipment === "shield") {
    ctx.fillRect(x - 7, y, 14, 11);
    ctx.strokeRect(x - 7, y, 14, 11);
    if (equipment === "basket") ctx.strokeRect(x - 4, y - 5, 8, 7);
  } else if (equipment === "flower") {
    ctx.moveTo(x, y + 9);
    ctx.lineTo(x, y - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 3, y - 6, 3, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (equipment === "bow") {
    ctx.arc(x - side * 3, y, 8, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - side * 3, y - 8);
    ctx.lineTo(x - side * 3, y + 8);
    ctx.stroke();
  } else {
    ctx.fillRect(x - 5, y - 4, 10, 12);
    ctx.fillStyle = "rgba(245,230,180,.92)";
    ctx.fillRect(x - 2, y - 1, 4, 6);
  }
}
function drawNpcMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  near: boolean,
  hostile = false,
  quest = false,
) {
  const pulse = Math.sin(Date.now() / 180) > 0,
    accent = hostile ? "#ff6a63" : quest ? "#6df0c0" : "#ffd866";
  ctx.strokeStyle = near ? accent : "rgba(255,216,102,.72)";
  ctx.lineWidth = near ? 3 : 2;
  ctx.strokeRect(x - 11, y + 8, 22, near ? 5 : 3);
  // 击杀目标使用红色感叹号，生成任务目标使用青色菱形。
  if (hostile) {
    ctx.fillStyle = accent;
    ctx.fillRect(x - 2, y - 47 - (pulse ? 2 : 0), 5, 7);
    ctx.fillRect(x - 2, y - 38 - (pulse ? 2 : 0), 5, 3);
  } else if (quest) {
    const top = y - 45 - (pulse ? 2 : 0);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(x, top - 5);
    ctx.lineTo(x + 6, top);
    ctx.lineTo(x, top + 5);
    ctx.lineTo(x - 6, top);
    ctx.closePath();
    ctx.fill();
  }
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
