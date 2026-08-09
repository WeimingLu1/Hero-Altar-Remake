export type RmxpCommand = { code: number; indent: number; parameters: unknown[] };
export type EventResult = {
  transfer?: { mapId: number; x: number; y: number; direction: number; fade: number };
  sceneEvent?: { type: number; id?: number; extra?: number };
  sounds: string[];
  source: string;
};

export const supportedEventCodes = new Set([0, 201, 250, 355, 655]);
export type EventContext = { inventory:Record<string,number>;tanId:number;freeWork:number;canGetItem?:boolean;canGetCaihua?:boolean };

const parseCall=(line:string):EventResult["sceneEvent"]=>{const m=line.match(/Scene_Event\.new\(\s*(-?\d+)(?:\s*,\s*(-?\d+))?(?:\s*,\s*(-?\d+))?/);return m?{type:Number(m[1]),id:m[2]===undefined?undefined:Number(m[2]),extra:m[3]===undefined?undefined:Number(m[3])}:undefined;};
function evaluateCondition(source:string,context:EventContext){
  return source.split(/\s+or\s+/).some(part=>{
    const item=part.match(/item_number\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*(>|==)\s*(\d+)/);if(item){const count=context.inventory[`${item[1]}:${item[2]}`]||0;return item[3]===">"?count>Number(item[4]):count===Number(item[4]);}
    const tan=part.match(/tan_id\s*>\s*(\d+)/);if(tan)return context.tanId>Number(tan[1]);
    const work=part.match(/free_work\s*==\s*(\d+)/);if(work)return context.freeWork===Number(work[1]);
    if(part.includes("can_get_item?"))return context.canGetItem!==false;
    if(part.includes("can_get_caihua?"))return context.canGetCaihua!==false;
    return false;
  });
}

export function selectSceneEvent(source:string,context:EventContext){
  let condition="",inCondition=false,selected:EventResult["sceneEvent"];
  for(const raw of source.split("\n")){const line=raw.trim();if(line.startsWith("if ")){inCondition=true;condition=line.slice(3);continue;}if(line==="end"){inCondition=false;condition="";continue;}if(inCondition&&!line.includes("Scene_Event.new")){condition+=` ${line}`;continue;}if(line.includes("Scene_Event.new")&&(!inCondition||evaluateCondition(condition,context)))selected=parseCall(line);}
  return selected;
}

export type SceneGate = {
  scene?: EventResult["sceneEvent"];
  itemId?: number;
  itemOp?: ">" | "==";
  itemCount?: number;
  tanId?: number;
};

// 解析脚本中受条件控制的入口事件，无论当前条件是否满足：
// 用于把被物品/进度门槛锁住的入口依然标记在地图上，并在交互时提示缺少什么。
export function parseSceneGate(source: string): SceneGate | undefined {
  const sceneMatch = source.match(
    /Scene_Event\.new\(\s*(-?\d+)(?:\s*,\s*(-?\d+))?(?:\s*,\s*(-?\d+))?/,
  );
  if (!sceneMatch) return undefined;
  const item = source.match(
    /item_number\(\s*\d+\s*,\s*(\d+)\s*\)\s*(>|==)\s*(\d+)/,
  );
  const tan = source.match(/tan_id\s*>\s*(\d+)/);
  return {
    scene: {
      type: Number(sceneMatch[1]),
      id: sceneMatch[2] === undefined ? undefined : Number(sceneMatch[2]),
      extra: sceneMatch[3] === undefined ? undefined : Number(sceneMatch[3]),
    },
    itemId: item ? Number(item[1]) : undefined,
    itemOp: item ? (item[2] as ">" | "==") : undefined,
    itemCount: item ? Number(item[3]) : undefined,
    tanId: tan ? Number(tan[1]) : undefined,
  };
}

export function executeMapCommands(commands: RmxpCommand[]): EventResult {
  const result: EventResult = { sounds: [], source: "" };
  let script = "";
  for (const command of commands) {
    if (command.code === 201) {
      const [, mapId, x, y, direction, fade] = command.parameters.map(Number);
      result.transfer = { mapId, x, y, direction, fade };
    } else if (command.code === 250) {
      const audio = command.parameters[0] as { name?: string } | string | undefined;
      result.sounds.push(typeof audio === "string" ? audio : audio?.name || "");
    } else if (command.code === 355 || command.code === 655) {
      script += `${String(command.parameters[0] || "")}\n`;
    }
  }
  result.source = script.trim();
  // All map-side story hooks in this project route through Scene_Event.new.
  // Conditions remain in source for the scene adapter to evaluate against save data.
  const calls = [...script.matchAll(/Scene_Event\.new\(\s*(-?\d+)(?:\s*,\s*(-?\d+))?(?:\s*,\s*(-?\d+))?/g)];
  if (calls.length) {
    const call = calls[calls.length - 1];
    result.sceneEvent = { type: Number(call[1]), id: call[2] === undefined ? undefined : Number(call[2]), extra: call[3] === undefined ? undefined : Number(call[3]) };
  }
  return result;
}
