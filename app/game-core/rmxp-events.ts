export type RmxpCommand = { code: number; indent: number; parameters: unknown[] };
export type EventResult = {
  transfer?: { mapId: number; x: number; y: number; direction: number; fade: number };
  sceneEvent?: { type: number; id?: number; extra?: number };
  sounds: string[];
  source: string;
};

export const supportedEventCodes = new Set([0, 201, 250, 355, 655]);

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
