// 判定某个 NPC 是否为「当前要杀的目标」：
// 当前坛主（敌人 163–170 中与坛进度匹配的一坛）或主任务杀人目标。
// 用于把需要击杀的人物用红色感叹号标记，与通缉犯采用同一套视觉强调。
export function isCurrentKillTarget(
  npcId: number | undefined,
  opts: { tanId: number; killId: number },
): boolean {
  if (!npcId) return false;
  if (npcId >= 163 && npcId <= 170) return npcId - 162 === opts.tanId;
  return opts.killId > 0 && npcId === opts.killId;
}
