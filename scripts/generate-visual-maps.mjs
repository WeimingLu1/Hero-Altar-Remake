import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const original = JSON.parse(fs.readFileSync(path.join(repo, "game-data/maps.json"), "utf8"));
const outputRoot = path.join(repo, "map-src/visual/maps");
const runtimeFile = path.join(repo, "game-data/visual-maps.json");
const TILE = 32;
const LAYERS = [
  "ground",
  "ground-detail",
  "structures-low",
  "props-low",
  "original-anchors",
  "blocking-objects",
  "foreground",
  "lighting",
];

fs.mkdirSync(outputRoot, { recursive: true });

const sceneLabels = {
  0: "江湖人物", 1: "菜花宝典", 2: "可拾取物", 3: "宝物", 4: "钓鱼点",
  5: "水源", 6: "游戏设施", 7: "工作点", 8: "挑战入口", 9: "告示牌",
  10: "绳索", 11: "酒坛", 12: "对战入口", 13: "坛入口", 14: "铸剑台",
  15: "桃花源", 16: "房间入口",
};

function eventProgram(event) {
  const page = event.pages.find((candidate) => candidate.commands.some((command) => command.code !== 0)) || event.pages[0];
  const commands = page?.commands || [];
  const source = commands
    .filter((command) => command.code === 355 || command.code === 655)
    .map((command) => String(command.parameters?.[0] || ""))
    .join("\n");
  const match = source.match(/Scene_Event\.new\(\s*(\d+)(?:\s*,\s*(-?\d+))?(?:\s*,\s*(-?\d+))?/);
  const transferCommand = commands.find((command) => command.code === 201);
  const transfer = transferCommand
    ? {
        mapId: Number(transferCommand.parameters?.[1] || 0),
        x: Number(transferCommand.parameters?.[2] || 0),
        y: Number(transferCommand.parameters?.[3] || 0),
      }
    : undefined;
  return {
    sceneType: match ? Number(match[1]) : undefined,
    sceneId: match?.[2] === undefined ? undefined : Number(match[2]),
    transfer,
    graphic: String(page?.graphic?.character_name || ""),
  };
}

function anchorKind(program) {
  if (program.sceneType === 0 || program.graphic) return "npc";
  if (program.transfer || [13, 15, 16].includes(program.sceneType)) return "door";
  return ({ 2: "item", 3: "item", 4: "fishing", 5: "well", 6: "arcade", 7: "work", 8: "challenge", 9: "notice", 12: "challenge", 14: "forge" })[program.sceneType] || "other";
}

function mapTheme(map) {
  if (/家中|家$|店|当铺|武馆|衙门|大厅|二楼|客房|西厢$|东厢$|房屋|室内|客栈|兵器行/.test(map.name)) return "indoor";
  if (/大雪山|长白山|冰火岛/.test(map.name)) return "snow";
  if (/东海|南海|渡口|岛$/.test(map.name)) return "water";
  if (/坛$/.test(map.name)) return "altar";
  if (/时空|失落|桃花源|铸剑谷/.test(map.name)) return "mystic";
  if (/山|峰|郊|盆地|谷/.test(map.name)) return "mountain";
  return "town";
}

function key(x, y) { return `${x},${y}`; }
function inside(map, x, y) { return x >= 0 && y >= 0 && x < map.width && y < map.height; }
function cell(x, y, sprite, atlas = "environment", variant = 0) { return { x, y, sprite, atlas, variant }; }

function addPath(cells, map, from, to, width = 1) {
  const add = (x, y) => {
    for (let offset = 0; offset < width; offset += 1) {
      if (inside(map, x + offset, y)) cells.set(key(x + offset, y), cell(x + offset, y, 8));
    }
  };
  const bendY = Math.max(1, Math.min(map.height - 2, Math.round((from.y + to.y) / 2)));
  for (let y = Math.min(from.y, bendY); y <= Math.max(from.y, bendY); y += 1) add(from.x, y);
  for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x += 1) add(x, bendY);
  for (let y = Math.min(to.y, bendY); y <= Math.max(to.y, bendY); y += 1) add(to.x, y);
}

function placeFacade(map, anchor, structures, foreground) {
  const width = map.id === 3 || map.id === 15 ? 5 : 4;
  const left = Math.max(0, Math.min(map.width - width, anchor.x - Math.floor(width / 2)));
  const top = Math.max(0, anchor.y - 3);
  for (let column = 0; column < width; column += 1) {
    const mx = left + column;
    if (inside(map, mx, top)) foreground.set(key(mx, top), cell(mx, top, column === 0 ? 32 : column === width - 1 ? 34 : 33));
    if (inside(map, mx, top + 1)) structures.set(key(mx, top + 1), cell(mx, top + 1, column === Math.floor(width / 2) ? 37 : 36));
    if (inside(map, mx, top + 2) && mx !== anchor.x) structures.set(key(mx, top + 2), cell(mx, top + 2, 41));
  }
  structures.set(key(anchor.x, anchor.y - 1), cell(anchor.x, anchor.y - 1, 39));
}

function furniturePlan(map, anchors, occupied) {
  const props = new Map();
  const add = (x, y, sprite) => {
    if (inside(map, x, y) && x > 0 && y > 0 && x < map.width - 1 && y < map.height - 1 && !occupied.has(key(x, y)))
      props.set(key(x, y), cell(x, y, sprite, "furniture"));
  };
  const npcs = anchors.filter((anchor) => anchor.kind === "npc");
  const exit = anchors.find((anchor) => anchor.kind === "door");
  const cx = Math.floor(map.width / 2);
  const top = 2;
  if (/裁缝店/.test(map.name)) {
    for (const x of [3, 5, 13, 15]) add(x, top + 1, 21);
    for (const x of [4, 8, 12, 16]) add(x, 5, x % 4 ? 25 : 49);
    add(10, 4, 20); add(10, 8, 34); add(4, 10, 46); add(15, 10, 35);
  } else if (/豆腐店/.test(map.name)) {
    for (const x of [3, 6, 9, 12, 15]) add(x, 3, x % 2 ? 17 : 18);
    for (const x of [4, 7, 10, 13, 16]) add(x, 6, 39);
    add(4, 9, 34); add(7, 9, 36); add(14, 9, 46); add(16, 11, 35);
  } else if (/杂货店|药店|当铺/.test(map.name)) {
    for (let x = 3; x < map.width - 2; x += 3) add(x, 3, x % 2 ? 17 : 18);
    for (let x = 4; x < map.width - 3; x += 2) add(x, 6, 20);
    add(3, 9, 34); add(map.width - 4, 9, 46); add(cx, 9, 35);
  } else if (/家中|客房|西厢|东厢|房屋|老婆婆家/.test(map.name)) {
    add(3, 3, 0); add(4, 3, 7); add(map.width - 4, 3, 15);
    add(5, 7, 9); add(4, 8, 11); add(6, 8, 12); add(map.width - 5, 8, 25);
    add(3, map.height - 3, 55); add(map.width - 4, map.height - 3, 46);
  } else if (/武馆|兵器行/.test(map.name)) {
    for (const x of [3, 6, 13, 16]) add(x, 3, x % 2 ? 22 : 23);
    add(cx, 5, 24); add(cx - 3, 8, 8); add(cx + 3, 8, 8);
  } else if (/客栈/.test(map.name)) {
    for (const x of [4, 9, 14]) { add(x, 5, 9); add(x - 1, 6, 11); add(x + 1, 6, 12); }
    add(3, 3, 35); add(map.width - 4, 3, 39);
  } else if (/衙门|大厅|二楼/.test(map.name)) {
    add(cx, 3, 45); add(cx - 3, 4, 12); add(cx + 3, 4, 13);
    add(3, 3, 26); add(map.width - 4, 3, 24); add(cx, 8, 32);
  } else {
    for (const npc of npcs.slice(0, 8)) {
      add(npc.x - 1, npc.y - 1, 9); add(npc.x + 1, npc.y - 1, 15);
    }
  }
  if (exit) props.delete(key(exit.x, exit.y));
  return props;
}

function buildVisualMap(map) {
  const theme = mapTheme(map);
  const anchors = map.events.map((event) => {
    const program = eventProgram(event);
    const kind = anchorKind(program);
    return {
      mapId: map.id, eventId: event.id, x: event.x, y: event.y, kind,
      label: event.name || sceneLabels[program.sceneType] || kind,
      targetMapId: program.transfer?.mapId,
      sceneType: program.sceneType,
      blocking: kind === "npc" || ["well", "arcade", "notice", "forge"].includes(kind),
      locked: true,
    };
  });
  const occupied = new Set(anchors.map((anchor) => key(anchor.x, anchor.y)));
  const groundDetail = new Map();
  const structures = new Map();
  const foreground = new Map();
  const lighting = new Map();
  const staticAnchors = anchors.filter((anchor) => anchor.kind !== "npc" && anchor.kind !== "other");
  const props = theme === "indoor" ? furniturePlan(map, anchors, occupied) : new Map();
  const hub = staticAnchors.length
    ? { x: Math.round(staticAnchors.reduce((sum, anchor) => sum + anchor.x, 0) / staticAnchors.length), y: Math.round(staticAnchors.reduce((sum, anchor) => sum + anchor.y, 0) / staticAnchors.length) }
    : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };

  if (theme !== "indoor") {
    const roads = new Map();
    for (const anchor of staticAnchors) addPath(roads, map, anchor, hub, map.id === 3 || map.id === 15 ? 2 : 1);
    for (const [cellKey, road] of roads) groundDetail.set(cellKey, road);
    for (const anchor of anchors.filter((item) => item.kind === "door" && item.targetMapId && !/山|峰|海|岛|谷|郊|坛/.test(item.label)))
      placeFacade(map, anchor, structures, foreground);

    // Deliberate landscape clusters break the old one-tile confetti pattern.
    const scenery = theme === "water" ? [54, 54, 50] : theme === "snow" ? [50, 51, 49] : theme === "mountain" ? [48, 50, 53] : [48, 49, 53];
    const candidates = [
      [2, 2], [map.width - 4, 2], [2, map.height - 4], [map.width - 4, map.height - 4],
      [Math.floor(map.width * 0.25), Math.floor(map.height * 0.55)],
      [Math.floor(map.width * 0.72), Math.floor(map.height * 0.62)],
    ];
    candidates.forEach(([x, y], index) => {
      if (!inside(map, x, y) || occupied.has(key(x, y)) || groundDetail.has(key(x, y))) return;
      foreground.set(key(x, y), cell(x, y, scenery[(map.id + index) % scenery.length]));
      if (inside(map, x + 1, y) && !occupied.has(key(x + 1, y))) foreground.set(key(x + 1, y), cell(x + 1, y, scenery[(map.id + index + 1) % scenery.length]));
    });
  }

  const factionIds = new Set([23, 25, 27, 36, 42, 52, 54, 59, 60, 61, 62, 63, 64, 65, 66]);
  if (factionIds.has(map.id) && map.id !== 23) {
    const width = Math.min(map.width - 4, map.id >= 59 ? 9 : 11),
      left = Math.floor((map.width - width) / 2),
      top = 2;
    for (let x = left; x < left + width; x += 1) {
      foreground.set(key(x, top), cell(x, top, x === left ? 32 : x === left + width - 1 ? 34 : 33));
      if (!occupied.has(key(x, top + 1))) structures.set(key(x, top + 1), cell(x, top + 1, (x - left) % 3 === 1 ? 37 : 36));
    }
    for (let y = top + 2; y < Math.min(map.height - 2, top + 7); y += 1) {
      if (!occupied.has(key(left, y))) structures.set(key(left, y), cell(left, y, 40));
      if (!occupied.has(key(left + width - 1, y))) structures.set(key(left + width - 1, y), cell(left + width - 1, y, 42));
    }
    for (const x of [left + 2, left + width - 3]) {
      if (inside(map, x, top + 4) && !occupied.has(key(x, top + 4))) props.set(key(x, top + 4), cell(x, top + 4, map.id === 25 ? 55 : map.id === 36 || map.id === 42 ? 50 : 53));
    }
  }

  for (const anchor of anchors) {
    if (anchor.kind === "well") props.set(key(anchor.x, anchor.y), cell(anchor.x, anchor.y, 56));
    if (anchor.kind === "arcade") props.set(key(anchor.x, anchor.y), cell(anchor.x, anchor.y, 57));
    if (anchor.kind === "notice") props.set(key(anchor.x, anchor.y), cell(anchor.x, anchor.y, 58));
    if (anchor.kind === "forge") props.set(key(anchor.x, anchor.y), cell(anchor.x, anchor.y, 59));
    if (anchor.kind === "fishing") props.set(key(anchor.x, anchor.y), cell(anchor.x, anchor.y, 60));
    if (anchor.kind === "work") props.set(key(anchor.x, anchor.y), cell(anchor.x, anchor.y, 61));
  }

  // Four hand-authored vertical slices: extra composition around immutable anchors.
  if (map.id === 3) {
    for (let x = 0; x < map.width; x += 1) {
      if (!occupied.has(key(x, 11))) groundDetail.set(key(x, 11), cell(x, 11, 8));
    }
    for (const point of [[1, 13], [4, 12], [15, 12], [20, 13]]) foreground.set(key(...point), cell(...point, 53));
  }
  if (map.id === 6) {
    for (let x = 2; x < map.width - 2; x += 1) structures.set(key(x, 2), cell(x, 2, x % 4 === 0 ? 34 : 33));
    for (const [x, y, sprite] of [[3, 9, 55], [4, 9, 55], [15, 4, 48], [16, 4, 49], [5, 4, 62]])
      if (!occupied.has(key(x, y))) props.set(key(x, y), cell(x, y, sprite));
  }
  if (map.id === 23) {
    const center = 15;
    for (let y = 1; y < map.height; y += 1) {
      for (let x = center - (y < 8 ? 3 : 1); x <= center + (y < 8 ? 3 : 1); x += 1)
        if (inside(map, x, y) && !occupied.has(key(x, y))) groundDetail.set(key(x, y), cell(x, y, y < 8 ? 15 : 8));
    }
    for (let x = 8; x <= 22; x += 1) foreground.set(key(x, 4), cell(x, 4, x === 8 ? 32 : x === 22 ? 34 : 33));
    for (const [x, y] of [[6, 5], [24, 5], [5, 13], [25, 13], [7, 22], [23, 22]]) foreground.set(key(x, y), cell(x, y, 53));
  }

  const baseSprite =
    theme === "indoor" ? 46 :
    factionIds.has(map.id) ? 15 :
    theme === "water" ? 24 :
    theme === "snow" ? 16 :
    theme === "altar" ? 15 :
    theme === "mystic" ? 7 :
    theme === "mountain" ? 7 : 0;
  const defaultSpawn = { x: Math.min(map.width - 1, Math.max(0, 9)), y: Math.min(map.height - 1, Math.max(0, 7)), direction: 2 };
  return {
    originalMapId: map.id, name: map.name, version: 1, width: map.width, height: map.height,
    theme, baseSprite, defaultSpawn, anchors,
    layers: {
      "ground-detail": [...groundDetail.values()],
      "structures-low": [...structures.values()],
      "props-low": [...props.values()],
      foreground: [...foreground.values()], lighting: [...lighting.values()],
    },
    blockingObjects: anchors.filter((anchor) => anchor.blocking && anchor.kind !== "npc").map(({ eventId, x, y, kind }) => ({ eventId, x, y, kind })),
  };
}

function tiledLayer(name, id, visual) {
  if (name === "ground") {
    return { id, name, type: "tilelayer", width: visual.width, height: visual.height, visible: true, opacity: 1, data: Array(visual.width * visual.height).fill(visual.baseSprite + 1) };
  }
  if (name === "original-anchors") {
    return {
      id, name, type: "objectgroup", locked: true, visible: true, opacity: 1,
      objects: visual.anchors.map((anchor, index) => ({
        id: index + 1, name: anchor.label, class: anchor.kind, type: anchor.kind,
        x: anchor.x * TILE, y: anchor.y * TILE, width: TILE, height: TILE,
        properties: [
          { name: "mapId", type: "int", value: anchor.mapId },
          { name: "eventId", type: "int", value: anchor.eventId },
          { name: "locked", type: "bool", value: true },
          { name: "blocking", type: "bool", value: anchor.blocking },
          ...(anchor.targetMapId ? [{ name: "targetMapId", type: "int", value: anchor.targetMapId }] : []),
          ...(anchor.sceneType === undefined ? [] : [{ name: "sceneType", type: "int", value: anchor.sceneType }]),
        ],
      })),
    };
  }
  if (name === "blocking-objects") {
    return { id, name, type: "objectgroup", visible: false, opacity: 1, objects: visual.blockingObjects.map((object, index) => ({ id: index + 1, name: object.kind, class: "blocking", type: "blocking", x: object.x * TILE, y: object.y * TILE, width: TILE, height: TILE })) };
  }
  const data = Array(visual.width * visual.height).fill(0);
  for (const item of visual.layers[name] || [])
    data[item.x + item.y * visual.width] = (item.atlas === "furniture" ? 65 : 1) + item.sprite;
  return { id, name, type: "tilelayer", width: visual.width, height: visual.height, visible: true, opacity: 1, data };
}

const visualMaps = original.maps.map(buildVisualMap);
for (const visual of visualMaps) {
  const tiled = {
    type: "map", class: "RMXPVisualMap", version: "1.10", tiledversion: "1.12.2",
    orientation: "orthogonal", renderorder: "right-down", infinite: false,
    width: visual.width, height: visual.height, tilewidth: TILE, tileheight: TILE,
    nextlayerid: LAYERS.length + 1, nextobjectid: visual.anchors.length + 100,
    properties: [
      { name: "originalMapId", type: "int", value: visual.originalMapId },
      { name: "visualMapVersion", type: "int", value: visual.version },
      { name: "theme", type: "string", value: visual.theme },
      { name: "mapName", type: "string", value: visual.name },
      { name: "defaultSpawnX", type: "int", value: visual.defaultSpawn.x },
      { name: "defaultSpawnY", type: "int", value: visual.defaultSpawn.y },
    ],
    layers: LAYERS.map((name, index) => tiledLayer(name, index + 1, visual)),
    tilesets: [
      { firstgid: 1, source: "../tilesets/environment.tsj" },
      { firstgid: 65, source: "../tilesets/furniture.tsj" },
    ],
  };
  fs.writeFileSync(path.join(outputRoot, `map-${String(visual.originalMapId).padStart(3, "0")}.json`), `${JSON.stringify(tiled, null, 2)}\n`);
}
fs.writeFileSync(runtimeFile, `${JSON.stringify({ format: "rmxp-anchor-visual-maps", version: 1, maps: visualMaps })}\n`);
console.log(`Generated ${visualMaps.length} visual maps with ${visualMaps.reduce((sum, map) => sum + map.anchors.length, 0)} locked anchors.`);
