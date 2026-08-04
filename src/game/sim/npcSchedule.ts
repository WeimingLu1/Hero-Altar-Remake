// NPC 作息调度：工作日白天固定在岗位，其余时间和周末随机外出/串门。

function hashText(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export function isWeekend(day: number): boolean {
  return day % 7 === 6 || day % 7 === 0;
}

export function atWork(day: number, hour: number): boolean {
  return !isWeekend(day) && hour >= 9 && hour < 16;
}

export function shouldBeOut(npcId: string, day: number, hour: number): boolean {
  if (atWork(day, hour)) return false;
  const key = `${npcId}:${day}:${Math.floor(hour)}`;
  const r = hashText(key) % 100;
  return r < (isWeekend(day) ? 88 : 68);
}
