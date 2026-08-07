import { derivedStats, maxFood, maxWater } from "./inventory-system";
import { originalSystem, originalTables } from "./original-data";
import type { SceneActorState } from "./scene-event";
import { combatSkillProfile } from "./skill-system";

const levels = (originalSystem.levels as string[]) || [];
const attackLevels = (originalSystem.attack_lv as string[]) || [];
const schools = (originalSystem.school as string[]) || [];

export const levelTitle = (level: number) =>
  levels[Math.min(49, Math.max(0, Math.floor(level / 5)))] || "不堪一击";
export const levelTier = (level: number) =>
  Math.min(50, Math.max(1, Math.floor(level / 5) + 1));

export function actorStatusProfile(actor: SceneActorState) {
  const stats = derivedStats(actor),
    combat = combatSkillProfile(actor),
    martialValue = Math.floor(
      (combat.attack + Math.floor((combat.dodge + combat.parry) / 2)) / 3,
    ),
    realmIndex = Math.min(49, Math.floor(martialValue / 5)),
    attackValue = stats.str + stats.atk + Math.floor(actor.fpPlus / 2),
    attackIndex = Math.min(
      5,
      Math.floor(attackValue / 20),
    ),
    faceIndex = Math.min(7, Math.max(0, Math.floor((actor.face - 10) / 3))),
    faces =
      actor.gender === 1
        ? (originalSystem.girl_face as string[])
        : (originalSystem.boy_face as string[]),
    equippedWeapon = actor.weaponId
      ? String(originalTables.weapons[actor.weaponId]?.name || "未知兵刃")
      : "空手",
    equippedArmors = actor.armorIds.map((id) =>
      String(originalTables.armors[id]?.name || `防具 ${id}`),
    );
  return {
    stats,
    combat,
    school: schools[actor.classId] || "江湖小虾",
    teacher:
      actor.teacherId > 0
        ? String(originalTables.enemies[actor.teacherId]?.name || "未知师父")
        : "无",
    gender: actor.gender === 0 ? "男" : actor.gender === 1 ? "女" : "？",
    realm: levels[realmIndex] || "不堪一击",
    realmIndex,
    realmTier: realmIndex + 1,
    realmValue: martialValue,
    attackWeight: attackLevels[attackIndex] || "极轻",
    attackIndex,
    attackTier: attackIndex + 1,
    attackValue,
    appearanceTier: faceIndex + 1,
    appearance:
      actor.age < 16
        ? String(originalSystem.young_face || "一脸稚气")
        : faces?.[faceIndex] || "相貌平平",
    weapon: equippedWeapon,
    armor: equippedArmors.length ? equippedArmors.join("、") : "无",
    maxFood: maxFood(actor),
    maxWater: maxWater(actor),
  };
}
