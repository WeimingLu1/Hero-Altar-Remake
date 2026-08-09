// 原版 Game_Actor#can_get_caihua?：
//   道德 < 128（恶人）且装备老花镜(防具2)且年龄 < 18 且男性(gender==0)
// 才能在山间盆地拾取菜花宝典(物品20)。移植版据此计算，不再硬编码为始终可拾取。
export function canObtainCaihua(actor: {
  morals: number;
  age: number;
  gender: number;
  armorIds: number[];
}): boolean {
  return (
    actor.morals < 128 &&
    actor.armorIds.includes(2) &&
    actor.age < 18 &&
    actor.gender === 0
  );
}
