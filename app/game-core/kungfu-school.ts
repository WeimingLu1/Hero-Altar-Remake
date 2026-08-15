// 每个专门武功所属的门派，从全部 NPC 的门派(type 1-9)与其 skill_list 推导。
// 原版数据中每个专门武功(id ≥ 12)只由单一门派传授；基础功夫(id 1-11)为公共基础，
// 归入 -1「基础功夫」。门派列表与存档 classId 对应：1 八卦门 … 9 逍遥派。
import { originalTables } from "./original-data";

export const KUNGFU_SCHOOLS = [
  "江湖小虾",
  "八卦门",
  "花间派",
  "红莲教",
  "尹贺谷",
  "太极门",
  "雪山剑派",
  "兽王派",
  "茅山派",
  "逍遥派",
];

const schoolById = new Map<number, number>();
for (const enemy of originalTables.enemies) {
  if (!enemy) continue;
  const schoolId = Number(enemy.type || 0);
  if (schoolId < 1 || schoolId > KUNGFU_SCHOOLS.length - 1) continue;
  const skillList = Array.isArray(enemy.skill_list)
    ? (enemy.skill_list as Array<[number, number]>)
    : [];
  for (const [kungfuId] of skillList) {
    if (kungfuId >= 12) schoolById.set(kungfuId, schoolId);
  }
}

export function kungfuSchoolId(kungfuId: number): number {
  if (kungfuId < 12) return -1; // 基础功夫
  return schoolById.get(kungfuId) ?? -2; // 秘传武功(无门派传授)
}

export function kungfuSchoolName(kungfuId: number): string {
  const schoolId = kungfuSchoolId(kungfuId);
  if (schoolId === -1) return "基础功夫";
  if (schoolId === -2) return "秘传";
  return KUNGFU_SCHOOLS[schoolId] || "未知门派";
}
